/**
 * Datos del ERP en Firestore, en vivo.
 *  - datasets/<id>            planillas importadas y carpetas de Drive (una fila por registro en `rows`)
 *  - data/erp/<colección>/<id> registros cargados en el sistema
 *  - usuarios/<uid>           personas (nombre y perfil), escritas solo por el servidor
 */
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';

// colección de Firestore → nombre del conjunto de datos en el ERP
export const COLECCIONES = {
  vencimientos: 'vencimientos', cuentas: 'cuentas', flota: 'flota', oportunidades: 'oportunidades', cheques: 'cheques_reg',
  cheques_estado: 'cheques_estado', legajos: 'legajos', ordenes_trabajo: 'ordenes_trabajo', ordenes_compra: 'ordenes_compra',
  mantenimientos: 'mantenimientos', notif_estado: 'notif_estado', historial: 'historial', config: 'config', egresos: 'egresos',
  caja: 'caja', cuentas_banco: 'cuentas_banco', extractos: 'extractos', extracto_mov: 'extracto_mov', conciliacion: 'conciliacion',
  planes_fin: 'planes_fin', clientes: 'clientes', proveedores: 'proveedores', facturas: 'facturas', contratos: 'contratos',
  societaria: 'societaria', seguros: 'seguros', tramites: 'tramites', ventas_fisicas: 'ventas_fisicas', precios: 'precios',
  tienda: 'tienda', proyectos: 'proyectos', pagos_prov: 'pagos_prov', plan_cuotas: 'plan_cuotas',
};

const PERFIL_ERP = { admin: 'Administrador', gerencia: 'Gerencia', consulta: 'Consulta' };

export function crearDatos(fs) {
  const tablas = {};       // id del ERP → { status, data, columns }
  const usuarios = {};     // uid → { nombre, perfil, ... }
  const sistema = {};      // documentos de estado del servidor (drive, respaldo)
  const oyentes = new Set();
  let version = 0;
  const avisar = () => { version += 1; oyentes.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); };
  const pendientes = [];
  const primera = () => { let r; const p = new Promise((ok) => { r = ok; }); pendientes.push(p); return r; };

  // registros del sistema
  Object.entries(COLECCIONES).forEach(([col, id]) => {
    const listo = primera();
    tablas[id] = { status: 'loading', data: [] };
    onSnapshot(collection(fs, `data/erp/${col}`), (snap) => {
      const filas = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      tablas[id] = { status: 'ok', data: filas, columns: filas[0] ? Object.keys(filas[0]) : [] };
      listo(); avisar();
    }, (e) => { console.warn(col, e.code); tablas[id] = { status: 'error', data: [], error: e.code }; listo(); avisar(); });
  });

  // planillas (con soporte para conjuntos partidos en varios documentos)
  const listoDs = primera();
  const conjuntos = new Set();
  onSnapshot(collection(fs, 'datasets'), (snap) => {
    const grupos = {};
    snap.docs.forEach((d) => {
      const x = d.data(); const id = x.parte_de || d.id;
      (grupos[id] = grupos[id] || []).push(x);
    });
    conjuntos.forEach((id) => { if (!grupos[id]) delete tablas[id]; });
    conjuntos.clear();
    Object.entries(grupos).forEach(([id, partes]) => {
      partes.sort((a, b) => (a.parte || 1) - (b.parte || 1));
      const filas = partes.flatMap((p) => (Array.isArray(p.rows) ? p.rows : []));
      tablas[id] = { status: 'ok', data: filas, columns: partes[0].columns || (filas[0] ? Object.keys(filas[0]) : []), meta: { actualizado: partes[0].actualizado || null, fuente: partes[0].fuente || '' } };
      conjuntos.add(id);
    });
    listoDs(); avisar();
  }, (e) => { console.warn('datasets', e.code); listoDs(); avisar(); });

  // personas
  const listoUs = primera();
  onSnapshot(collection(fs, 'usuarios'), (snap) => {
    Object.keys(usuarios).forEach((k) => delete usuarios[k]);
    snap.docs.forEach((d) => { usuarios[d.id] = { ...d.data(), uid: d.id }; });
    listoUs(); avisar();
  }, () => { listoUs(); });

  // estado del servidor
  ['drive', 'respaldo', 'planillas'].forEach((k) => onSnapshot(doc(fs, `sistema/${k}`), (d) => { sistema[k] = d.exists() ? d.data() : null; avisar(); }, () => {}));

  const leer = (id) => {
    if (id === 'config') {
      // los perfiles los define el servidor; el ERP los lee de config/perfiles
      const base = tablas.config && tablas.config.status === 'ok' ? tablas.config.data.filter((r) => r.id !== 'perfiles') : [];
      const asignaciones = Object.fromEntries(Object.values(usuarios).filter((u) => u.activo !== false).map((u) => [u.uid, PERFIL_ERP[u.perfil] || 'Consulta']));
      return { status: 'ok', data: [...base, { id: 'perfiles', asignaciones }], columns: ['id'] };
    }
    return tablas[id];
  };

  return {
    listo: Promise.all(pendientes),
    leer,
    usuarios,
    sistema,
    planillas: () => [...conjuntos].filter((id) => !id.startsWith('drive_')),
    version: () => version,
    alCambiar: (f) => { oyentes.add(f); return () => oyentes.delete(f); },
    // escrituras con la misma forma que la base del tablero original
    db: {
      doc: (ruta) => {
        const ref = doc(fs, ruta);
        return {
          id: ref.id,
          set: (d) => setDoc(ref, d),
          update: (d) => updateDoc(ref, d),
          delete: () => deleteDoc(ref),
        };
      },
      collection: (ruta) => ({
        doc: (id) => { const ref = doc(fs, `${ruta}/${id}`); return { id, set: (d) => setDoc(ref, d), update: (d) => updateDoc(ref, d), delete: () => deleteDoc(ref) }; },
        add: async (d) => { const r = await addDoc(collection(fs, ruta), d); return { id: r.id }; },
      }),
    },
  };
}
