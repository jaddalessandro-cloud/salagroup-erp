/**
 * Paneles propios de la versión Firebase, dentro de Administración → Configuración:
 * usuarios y permisos, Google Drive, respaldos, registro de accesos, auditoría e importación de datos.
 * También conecta la cuenta del menú lateral (cambiar contraseña, cerrar sesión).
 */
import { collection, doc, onSnapshot, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import { COLECCIONES } from './datos.js';

const PERFILES = { admin: 'Administrador', gerencia: 'Gerencia', consulta: 'Consulta' };
const $ = (s) => document.querySelector(s);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fecha = (t) => {
  const d = t && typeof t.toDate === 'function' ? t.toDate() : t ? new Date(t) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};
const msg = (sel, txt, tipo) => { const e = $(sel); if (!e) return; e.textContent = txt || ''; e.className = `us-msg ${tipo || ''}`; e.hidden = !txt; };
const textoError = (e) => (e && e.message ? e.message.replace(/^.*?: /, '') : 'No se pudo completar la operación.');

export function montarPaneles(ctx, datos, user, role, acciones) {
  const admin = role === 'admin';
  document.querySelectorAll('[data-solo-admin]').forEach((x) => { x.hidden = !admin; });
  document.querySelectorAll('[data-solo-editor]').forEach((x) => { x.hidden = role === 'consulta'; });

  /* cuenta en el menú lateral */
  const yo = () => datos.usuarios[user.uid] || {};
  const quien = () => { const q = $('#cta-quien'); if (q) q.textContent = `${yo().nombre || ''} · ${PERFILES[role]}`; };
  quien();
  document.querySelectorAll('#btn-salir').forEach((b) => b.addEventListener('click', () => ctx.salir()));
  document.querySelectorAll('#btn-clave').forEach((b) => b.addEventListener('click', () => acciones.abrirCambioClave()));

  /* usuarios */
  const dibujarUsuarios = () => {
    quien();
    const mi = $('#us-mi-perfil'); if (mi) mi.textContent = PERFILES[role];
    const tb = $('#us-filas'); if (!tb) return;
    const lista = Object.values(datos.usuarios).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    tb.replaceChildren(...lista.map((u) => {
      const tr = el('tr');
      tr.append(el('td', null, u.usuario || ''), el('td', null, u.nombre || ''));
      const tdP = el('td');
      if (admin && u.uid !== user.uid) {
        const s = el('select', 'dash-select'); s.setAttribute('aria-label', `Perfil de ${u.nombre}`);
        Object.entries(PERFILES).forEach(([v, t]) => { const o = el('option', null, t); o.value = v; o.selected = u.perfil === v; s.appendChild(o); });
        s.addEventListener('change', async () => {
          s.disabled = true; msg('#us-msg', '');
          try { await ctx.llamar('cambiarPerfil')({ uid: u.uid, perfil: s.value }); msg('#us-msg', `Perfil de ${u.nombre} actualizado. Lo verá al volver a ingresar.`, 'ok'); } catch (e) { msg('#us-msg', textoError(e), 'err'); s.value = u.perfil; } finally { s.disabled = false; }
        });
        tdP.appendChild(s);
      } else tdP.appendChild(el('span', 'us-chip', PERFILES[u.perfil] || u.perfil));
      const tdE = el('td');
      tdE.appendChild(el('span', `us-chip ${u.activo === false ? 'off' : u.clave_provisoria ? 'temp' : ''}`, u.activo === false ? 'Desactivado' : u.clave_provisoria ? 'Contraseña provisoria' : 'Activo'));
      tr.append(tdP, tdE, el('td', null, fecha(u.ultimo_ingreso)));
      const tdA = el('td'); const acc = el('div', 'us-acc'); tdA.appendChild(acc);
      if (admin && u.uid !== user.uid) {
        const r = el('button', 'gs-act', 'Contraseña provisoria'); r.type = 'button';
        r.addEventListener('click', async () => {
          if (!r.dataset.ok) { r.dataset.ok = '1'; r.textContent = '¿Generar? Confirmar'; r.classList.add('gs-act-warn'); setTimeout(() => { delete r.dataset.ok; r.textContent = 'Contraseña provisoria'; r.classList.remove('gs-act-warn'); }, 5000); return; }
          r.disabled = true;
          try { const x = await ctx.llamar('restablecerClave')({ uid: u.uid }); mostrarClave(u.nombre, x.usuario, x.clave); } catch (e) { msg('#us-msg', textoError(e), 'err'); } finally { r.disabled = false; }
        });
        const a = el('button', 'gs-act', u.activo === false ? 'Reactivar' : 'Desactivar'); a.type = 'button';
        a.addEventListener('click', async () => {
          a.disabled = true;
          try { await ctx.llamar('activarUsuario')({ uid: u.uid, activo: u.activo === false }); msg('#us-msg', `${u.nombre}: ${u.activo === false ? 'reactivado' : 'desactivado'}.`, 'ok'); } catch (e) { msg('#us-msg', textoError(e), 'err'); } finally { a.disabled = false; }
        });
        acc.append(r, a);
      }
      tr.appendChild(tdA);
      return tr;
    }));
  };
  const mostrarClave = (nombre, usuario, clave) => {
    $('#us-clave-quien').textContent = `${nombre} (usuario: ${usuario})`;
    $('#us-clave').textContent = clave;
    $('#us-clave-box').hidden = false;
  };
  document.querySelectorAll('#us-clave-ok').forEach((b) => b.addEventListener('click', () => { $('#us-clave').textContent = ''; $('#us-clave-box').hidden = true; }));
  document.querySelectorAll('#us-nuevo').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const b = f.querySelector('button[type="submit"]'); b.disabled = true; msg('#us-nuevo-msg', '');
    try {
      const x = await ctx.llamar('crearUsuario')({ usuario: d.usuario, nombre: d.nombre, perfil: d.perfil });
      f.reset(); mostrarClave(d.nombre, x.usuario, x.clave);
      msg('#us-nuevo-msg', `Usuario ${x.usuario} creado.`, 'ok');
    } catch (e) { msg('#us-nuevo-msg', textoError(e), 'err'); } finally { b.disabled = false; }
  }));

  /* Google Drive */
  const dibujarDrive = () => {
    const e = $('#drive-estado'); if (!e) return;
    const s = datos.sistema.drive;
    if (!s) { e.textContent = 'Todavía no se sincronizó la carpeta ESTACIONES.'; return; }
    const partes = [];
    if (s.ultima) partes.push(`Última sincronización: ${fecha(s.ultima)} · ${s.carpetas} carpetas y ${s.archivos} archivos.`);
    if (s.error) partes.push(`Último intento con error (${fecha(s.intento)}): ${s.error}`);
    if (s.cuenta) partes.push(`Cuenta de servicio con acceso de lectura: ${s.cuenta}`);
    e.textContent = partes.join(' ');
  };
  document.querySelectorAll('#drive-sync').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true; msg('#drive-msg', 'Sincronizando… puede tardar unos minutos.');
    try { const r = await ctx.llamar('sincronizarDriveAhora')({}); msg('#drive-msg', `Listo: ${r.carpetas} carpetas y ${r.archivos} archivos.`, 'ok'); } catch (e) { msg('#drive-msg', textoError(e), 'err'); } finally { b.disabled = false; }
  }));

  /* respaldos, accesos y auditoría (solo Administrador) */
  const dibujarRespaldo = () => {
    const e = $('#resp-estado'); if (!e) return;
    const s = datos.sistema.respaldo;
    e.textContent = s && s.ultimo ? `Último respaldo automático: ${fecha(s.ultimo)} (${s.destino}).` : 'El respaldo automático corre todos los días a las 03:17 (hora de Buenos Aires). Todavía no hay ninguno registrado.';
  };
  if (admin) {
    const nombre = (uid) => (datos.usuarios[uid] && datos.usuarios[uid].nombre) || uid || '—';
    onSnapshot(query(collection(ctx.fs, 'accesos'), orderBy('fecha', 'desc'), limit(60)), (snap) => {
      const tb = $('#acc-filas'); if (!tb) return;
      tb.replaceChildren(...snap.docs.map((d) => { const x = d.data(); const tr = el('tr'); tr.append(el('td', null, fecha(x.fecha)), el('td', null, nombre(x.uid)), el('td', null, x.evento || ''), el('td', null, x.detalle || ''), el('td', null, x.ip || '')); return tr; }));
    }, () => {});
    onSnapshot(query(collection(ctx.fs, 'auditoria'), orderBy('fecha', 'desc'), limit(60)), (snap) => {
      const tb = $('#aud-filas'); if (!tb) return;
      tb.replaceChildren(...snap.docs.map((d) => { const x = d.data(); const tr = el('tr'); tr.append(el('td', null, fecha(x.fecha)), el('td', null, nombre(x.uid)), el('td', null, x.accion || ''), el('td', null, `${x.coleccion}/${x.registro}`), el('td', null, (x.campos || []).join(', '))); return tr; }));
    }, () => {});
  }

  /* importar y descargar datos (solo Administrador) */
  document.querySelectorAll('#imp-form').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const archivo = f.querySelector('input[type="file"]').files[0];
    if (!archivo) { msg('#imp-msg', 'Elegí el archivo de datos.', 'err'); return; }
    const b = f.querySelector('button[type="submit"]'); b.disabled = true;
    try {
      const paquete = JSON.parse(await archivo.text());
      if (!paquete || paquete.formato !== 'salagroup-erp/1') throw new Error('El archivo no es un paquete de datos del ERP Sala Group.');
      const r = await importar(ctx.fs, paquete, (t) => msg('#imp-msg', t));
      msg('#imp-msg', `Importación terminada: ${r.planillas} planillas y ${r.registros} registros.`, 'ok');
      f.reset();
    } catch (e) { msg('#imp-msg', textoError(e), 'err'); } finally { b.disabled = false; }
  }));
  document.querySelectorAll('#exp-todo').forEach((b) => b.addEventListener('click', async () => {
    const paquete = { formato: 'salagroup-erp/1', generado: new Date().toISOString(), datasets: {}, registros: {} };
    Object.entries(COLECCIONES).forEach(([col, id]) => { const t = datos.leer(id); if (col !== 'config' && t && t.status === 'ok') paquete.registros[col] = t.data; });
    const cfg = window.dash.data('config'); paquete.registros.config = (cfg.data || []).filter((r) => r.id !== 'perfiles');
    datos.planillas().forEach((id) => { const t = datos.leer(id); if (t && t.status === 'ok') paquete.datasets[id] = { rows: t.data, columns: t.columns }; });
    const dl = await window.claude.use('downloads');
    await dl.save({ filename: `salagroup-erp_copia_${new Date().toISOString().slice(0, 10)}.json`, data: JSON.stringify(paquete), mime: 'application/json' });
  }));

  const todo = () => { dibujarUsuarios(); dibujarDrive(); dibujarRespaldo(); };
  datos.alCambiar(todo);
  todo();
}

/** Escribe un paquete de datos en Firestore (lotes de hasta 400 operaciones). */
export async function importar(fs, paquete, avance) {
  const ops = [];
  let planillas = 0, registros = 0;
  Object.entries(paquete.datasets || {}).forEach(([id, ds]) => {
    if (!/^[a-z0-9_]{2,60}$/.test(id) || id.startsWith('drive_')) return;
    const filas = Array.isArray(ds) ? ds : ds.rows || [];
    const partes = partir(filas);
    partes.forEach((p, i) => ops.push([`datasets/${i ? `${id}__${i + 1}` : id}`, { parte_de: id, parte: i + 1, partes: partes.length, rows: p, columns: ds.columns || (filas[0] ? Object.keys(filas[0]) : []), fuente: ds.fuente || ds.title || '', actualizado: new Date().toISOString() }]));
    planillas += 1;
  });
  Object.entries(paquete.registros || {}).forEach(([col, filas]) => {
    if (!(col in COLECCIONES) || col === 'historial' || !Array.isArray(filas)) return;
    filas.forEach((r) => { if (!r || !r.id || col === 'config' && r.id === 'perfiles') return; const { id, ...resto } = r; ops.push([`data/erp/${col}/${String(id).replace(/\//g, '_')}`, resto]); registros += 1; });
  });
  for (let i = 0; i < ops.length; i += 400) {
    const lote = writeBatch(fs);
    ops.slice(i, i + 400).forEach(([ruta, d]) => lote.set(doc(fs, ruta), d));
    if (avance) avance(`Guardando ${Math.min(i + 400, ops.length)} de ${ops.length}…`);
    await lote.commit();
  }
  return { planillas, registros };
}
const partir = (filas, max = 700000) => {
  const partes = [[]]; let tam = 0;
  filas.forEach((f) => { const t = JSON.stringify(f).length + 40; if (tam + t > max && partes[partes.length - 1].length) { partes.push([]); tam = 0; } partes[partes.length - 1].push(f); tam += t; });
  return partes;
};
