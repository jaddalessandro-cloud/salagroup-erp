/**
 * Funciones del servidor del ERP Sala Group.
 *
 * - Usuarios: alta, perfil, baja/reactivación y contraseñas provisorias (solo Administrador).
 * - Cambio de contraseña propio (obligatorio al primer ingreso).
 * - Registro de accesos y auditoría de cada alta, modificación y baja.
 * - Respaldo diario de la base de datos.
 * - Sincronización de solo lectura de la carpeta ESTACIONES de Google Drive.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { randomInt } from 'node:crypto';
import { DOMINIO, PERFILES, normalizarUsuario, errorUsuario, validarClave, claveProvisoria, perfilNombre } from './lib/reglas.js';
import { recorrerCarpeta, partirFilas } from './lib/drive.js';
import { leerPlanesDePago, leerSituacion, leerCheques } from './lib/planillas.js';

initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5 });

const db = getFirestore();
const auth = getAuth();
const ZONA = 'America/Argentina/Buenos_Aires';
const DRIVE_RAIZ = process.env.DRIVE_CARPETA_ESTACIONES || '1tS741373VbJ-Gl39qvAm5n2EdYrOZeFR';

/* ---------- ayudas ---------- */
const exigirSesion = (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Tenés que ingresar al sistema.');
  return req.auth;
};
const exigirAdmin = (req) => {
  const a = exigirSesion(req);
  if (a.token.role !== 'admin' || a.token.temp === true) throw new HttpsError('permission-denied', 'Solo un Administrador puede hacer esto.');
  return a;
};
const registrarAcceso = (datos) => db.collection('accesos').add({ ...datos, fecha: FieldValue.serverTimestamp() });
const origen = (req) => ({
  ip: String((req.rawRequest && (req.rawRequest.headers['x-forwarded-for'] || req.rawRequest.ip)) || '').split(',')[0].trim().slice(0, 60),
  agente: String((req.rawRequest && req.rawRequest.headers['user-agent']) || '').slice(0, 200),
});
const contarAdmins = async () => (await db.collection('usuarios').where('perfil', '==', 'admin').where('activo', '==', true).count().get()).data().count;

/* ---------- usuarios (solo Administrador) ---------- */
export const crearUsuario = onCall(async (req) => {
  const admin = exigirAdmin(req);
  const usuario = normalizarUsuario(req.data && req.data.usuario);
  if (errorUsuario(usuario)) throw new HttpsError('invalid-argument', errorUsuario(usuario));
  const nombre = String((req.data && req.data.nombre) || '').trim().slice(0, 80);
  const perfil = String((req.data && req.data.perfil) || '');
  if (!nombre) throw new HttpsError('invalid-argument', 'Falta el nombre.');
  if (!PERFILES.includes(perfil)) throw new HttpsError('invalid-argument', 'Perfil no válido.');
  const clave = claveProvisoria(randomInt);
  let rec;
  try {
    rec = await auth.createUser({ email: `${usuario}@${DOMINIO}`, password: clave, displayName: nombre });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'Ese usuario ya existe.');
    throw e;
  }
  await auth.setCustomUserClaims(rec.uid, { role: perfil, temp: true });
  await db.doc(`usuarios/${rec.uid}`).set({ usuario, nombre, perfil, activo: true, clave_provisoria: true, creado: FieldValue.serverTimestamp(), creado_por: admin.uid });
  await registrarAcceso({ uid: admin.uid, evento: 'Alta de usuario', detalle: `${usuario} (${perfilNombre(perfil)})`, ...origen(req) });
  return { uid: rec.uid, usuario, clave };
});

export const restablecerClave = onCall(async (req) => {
  const admin = exigirAdmin(req);
  const uid = String((req.data && req.data.uid) || '');
  const u = await db.doc(`usuarios/${uid}`).get();
  if (!u.exists) throw new HttpsError('not-found', 'Usuario inexistente.');
  const clave = claveProvisoria(randomInt);
  await auth.updateUser(uid, { password: clave });
  await auth.setCustomUserClaims(uid, { role: u.get('perfil'), temp: true });
  await auth.revokeRefreshTokens(uid);
  await u.ref.update({ clave_provisoria: true, modificado: FieldValue.serverTimestamp(), modificado_por: admin.uid });
  await registrarAcceso({ uid: admin.uid, evento: 'Contraseña provisoria', detalle: u.get('usuario'), ...origen(req) });
  return { usuario: u.get('usuario'), clave };
});

export const cambiarPerfil = onCall(async (req) => {
  const admin = exigirAdmin(req);
  const uid = String((req.data && req.data.uid) || '');
  const perfil = String((req.data && req.data.perfil) || '');
  if (!PERFILES.includes(perfil)) throw new HttpsError('invalid-argument', 'Perfil no válido.');
  const u = await db.doc(`usuarios/${uid}`).get();
  if (!u.exists) throw new HttpsError('not-found', 'Usuario inexistente.');
  if (u.get('perfil') === 'admin' && perfil !== 'admin' && (await contarAdmins()) <= 1) throw new HttpsError('failed-precondition', 'Tiene que quedar al menos un Administrador activo.');
  await auth.setCustomUserClaims(uid, { role: perfil, temp: !!u.get('clave_provisoria') });
  await auth.revokeRefreshTokens(uid);
  await u.ref.update({ perfil, modificado: FieldValue.serverTimestamp(), modificado_por: admin.uid });
  await registrarAcceso({ uid: admin.uid, evento: 'Cambio de perfil', detalle: `${u.get('usuario')}: ${perfilNombre(u.get('perfil'))} → ${perfilNombre(perfil)}`, ...origen(req) });
  return { ok: true };
});

export const activarUsuario = onCall(async (req) => {
  const admin = exigirAdmin(req);
  const uid = String((req.data && req.data.uid) || '');
  const activo = !!(req.data && req.data.activo);
  if (uid === admin.uid && !activo) throw new HttpsError('failed-precondition', 'No podés desactivar tu propio usuario.');
  const u = await db.doc(`usuarios/${uid}`).get();
  if (!u.exists) throw new HttpsError('not-found', 'Usuario inexistente.');
  if (!activo && u.get('perfil') === 'admin' && (await contarAdmins()) <= 1) throw new HttpsError('failed-precondition', 'Tiene que quedar al menos un Administrador activo.');
  await auth.updateUser(uid, { disabled: !activo });
  if (!activo) await auth.revokeRefreshTokens(uid);
  await u.ref.update({ activo, modificado: FieldValue.serverTimestamp(), modificado_por: admin.uid });
  await registrarAcceso({ uid: admin.uid, evento: activo ? 'Reactivación de usuario' : 'Baja de usuario', detalle: u.get('usuario'), ...origen(req) });
  return { ok: true };
});

/* ---------- contraseña propia ---------- */
// El navegador vuelve a pedir la contraseña actual antes de llamar (reautenticación);
// acá se exige que ese ingreso sea reciente y se valida la política de contraseñas.
export const cambiarClave = onCall(async (req) => {
  const a = exigirSesion(req);
  const nueva = String((req.data && req.data.nueva) || '');
  const authTime = Number(a.token.auth_time || 0) * 1000;
  if (Date.now() - authTime > 5 * 60 * 1000) throw new HttpsError('failed-precondition', 'Volvé a ingresar tu contraseña actual.');
  const u = await db.doc(`usuarios/${a.uid}`).get();
  if (!u.exists || u.get('activo') === false) throw new HttpsError('permission-denied', 'Usuario no habilitado.');
  const error = validarClave(nueva, u.get('usuario'), u.get('nombre'));
  if (error) throw new HttpsError('invalid-argument', error);
  await auth.updateUser(a.uid, { password: nueva });
  await auth.setCustomUserClaims(a.uid, { role: u.get('perfil'), temp: false });
  await u.ref.update({ clave_provisoria: false, clave_cambiada: FieldValue.serverTimestamp() });
  await registrarAcceso({ uid: a.uid, evento: 'Cambio de contraseña', detalle: u.get('usuario'), ...origen(req) });
  return { ok: true };
});

/* ---------- registro de ingresos ---------- */
export const registrarIngreso = onCall(async (req) => {
  const a = exigirSesion(req);
  const u = await db.doc(`usuarios/${a.uid}`).get();
  await db.doc(`usuarios/${a.uid}`).set({ ultimo_ingreso: FieldValue.serverTimestamp() }, { merge: true });
  await registrarAcceso({ uid: a.uid, evento: 'Ingreso al sistema', detalle: u.exists ? u.get('usuario') : '', ...origen(req) });
  return { ok: true };
});

/* ---------- auditoría de cada cambio ---------- */
export const auditar = onDocumentWrittenWithAuthContext('data/erp/{col}/{id}', async (ev) => {
  const antes = ev.data && ev.data.before && ev.data.before.exists ? ev.data.before.data() : null;
  const despues = ev.data && ev.data.after && ev.data.after.exists ? ev.data.after.data() : null;
  if (ev.params.col === 'historial' && antes === null) return; // el historial ya es un registro
  const accion = !antes ? 'Alta' : !despues ? 'Baja' : 'Modificación';
  const campos = [...new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})])]
    .filter((k) => JSON.stringify((antes || {})[k]) !== JSON.stringify((despues || {})[k]));
  await db.collection('auditoria').add({
    fecha: FieldValue.serverTimestamp(),
    coleccion: ev.params.col,
    registro: ev.params.id,
    accion,
    uid: ev.authId || '',
    tipo_autor: ev.authType || '',
    campos: campos.slice(0, 60),
    // en una baja se guarda el registro completo para poder recuperarlo
    anterior: accion === 'Baja' ? JSON.stringify(antes).slice(0, 200000) : null,
  });
});

/* ---------- respaldo diario de la base de datos ---------- */
// Se guarda en el depósito de Storage del proyecto, carpeta respaldos/ (las reglas no la dejan leer desde la página).
// Se conservan 30 días: los respaldos más viejos se borran solos.
const DIAS_RESPALDO = 30;
const respaldar = async (origen) => {
  const modFs = await import('@google-cloud/firestore');
  const v1 = modFs.v1 || (modFs.default && modFs.default.v1);
  const { getStorage } = await import('firebase-admin/storage');
  const cliente = new v1.FirestoreAdminClient();
  const proyecto = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const bucket = process.env.BUCKET_RESPALDOS || `${proyecto}.firebasestorage.app`;
  const ahora = new Date();
  const fecha = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA }).format(ahora);
  const hora = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ahora).replace(':', '');
  const destino = `gs://${bucket}/respaldos/firestore/${fecha}_${hora}`;
  try {
    const [op] = await cliente.exportDocuments({ name: cliente.databasePath(proyecto, '(default)'), outputUriPrefix: destino, collectionIds: [] });
    // limpieza de respaldos viejos
    let borrados = 0;
    try {
      const limite = new Date(ahora.getTime() - DIAS_RESPALDO * 86400000).toISOString().slice(0, 10);
      const [archivos] = await getStorage().bucket(bucket).getFiles({ prefix: 'respaldos/firestore/' });
      for (const f of archivos) { const d = f.name.split('/')[2] || ''; if (d.slice(0, 10) < limite) { await f.delete().catch(() => {}); borrados += 1; } }
    } catch (e) { logger.warn('Limpieza de respaldos', e.message); }
    await db.doc('sistema/respaldo').set({ ultimo: FieldValue.serverTimestamp(), destino, operacion: op.name, origen, error: null, borrados }, { merge: true });
    logger.info('Respaldo iniciado', { destino });
    return { destino };
  } catch (e) {
    const msg = String(e.message || e).slice(0, 300);
    await db.doc('sistema/respaldo').set({ error: msg, intento: FieldValue.serverTimestamp() }, { merge: true });
    throw new HttpsError('internal', `No se pudo hacer el respaldo: ${msg}`);
  }
};
export const respaldoDiario = onSchedule({ schedule: 'every day 03:17', timeZone: ZONA, timeoutSeconds: 540 }, async () => {
  try { await respaldar('automático'); } catch (e) { logger.error('Respaldo', e.message); }
});
export const respaldarAhora = onCall({ timeoutSeconds: 540 }, async (req) => {
  const a = exigirAdmin(req);
  const r = await respaldar('manual');
  await registrarAcceso({ uid: a.uid, evento: 'Respaldo manual', detalle: r.destino, ...origen(req) });
  return r;
});

/* ---------- Google Drive: ESTACIONES (solo lectura) ---------- */
const sincronizar = async () => {
  const { google } = await import('googleapis');
  const gauth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  const cuenta = (await gauth.getCredentials()).client_email || '';
  const drive = google.drive({ version: 'v3', auth: gauth });
  try {
    const { carpetas, archivos } = await recorrerCarpeta(drive, DRIVE_RAIZ);
    const lote = db.batch();
    const nuevos = new Set();
    const escribir = (id, filas, columnas) => partirFilas(filas).forEach((parte, i, todas) => {
      const docId = i ? `${id}__${i + 1}` : id; nuevos.add(docId);
      lote.set(db.doc(`datasets/${docId}`), { origen: 'drive', parte_de: id, parte: i + 1, partes: todas.length, columns: columnas, rows: parte, actualizado: FieldValue.serverTimestamp() });
    });
    escribir('drive_carpetas', carpetas, ['id', 'nombre', 'carpeta_id', 'url', 'modificado']);
    escribir('drive_archivos', archivos, ['id', 'nombre', 'tipo', 'carpeta_id', 'creado', 'modificado', 'url', 'tamano']);
    const viejos = await db.collection('datasets').where('origen', '==', 'drive').get();
    viejos.forEach((d) => { if (!nuevos.has(d.id)) lote.delete(d.ref); });
    lote.set(db.doc('sistema/drive'), { ultima: FieldValue.serverTimestamp(), carpetas: carpetas.length, archivos: archivos.length, cuenta, error: null }, { merge: true });
    await lote.commit();
    return { carpetas: carpetas.length, archivos: archivos.length, cuenta };
  } catch (e) {
    const sinAcceso = e.code === 404 || e.code === 403;
    const msg = sinAcceso ? `La cuenta de servicio no tiene acceso a ESTACIONES. Compartí la carpeta (Lector) con ${cuenta}.` : String(e.message || e).slice(0, 300);
    await db.doc('sistema/drive').set({ error: msg, cuenta, intento: FieldValue.serverTimestamp() }, { merge: true });
    throw new HttpsError(sinAcceso ? 'permission-denied' : 'internal', msg);
  }
};
export const sincronizarDrive = onSchedule({ schedule: 'every 6 hours', timeZone: ZONA, timeoutSeconds: 540, memory: '512MiB' }, async () => {
  try { await sincronizar(); } catch (e) { logger.error('Drive', e.message); }
});
export const sincronizarDriveAhora = onCall({ timeoutSeconds: 540, memory: '512MiB' }, async (req) => {
  exigirAdmin(req);
  return sincronizar();
});

/* ---------- planillas vinculadas de Drive (solo lectura) ---------- */
// El Administrador pega el enlace de la planilla en Configuración (data/erp/config/planillas).
// El servidor la descarga, la interpreta y reemplaza el conjunto de datos; nunca modifica el archivo.
const LECTORES = {
  planes_pago: { nombre: 'PLANES DE PAGO', leer: leerPlanesDePago },
  lineas_bancarias: { nombre: 'Situación', leer: leerSituacion },
  cheques: { nombre: 'Gestión de cheques emitidos', leer: leerCheques },
};
const idDeEnlace = (s) => { const t = String(s || '').trim(); const m = t.match(/\/d\/([\w-]{20,})/) || t.match(/[?&]id=([\w-]{20,})/); return m ? m[1] : (/^[\w-]{20,}$/.test(t) ? t : ''); };
const actualizarPlanillas = async () => {
  const { google } = await import('googleapis');
  const gauth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  let cuenta = ''; try { cuenta = (await gauth.getCredentials()).client_email || ''; } catch { /* sin credenciales locales */ }
  const drive = google.drive({ version: 'v3', auth: gauth });
  const cfg = (await db.doc('data/erp/config/planillas').get()).data() || {};
  const resultado = {};
  for (const [ds, lector] of Object.entries(LECTORES)) {
    const id = idDeEnlace(cfg[ds]);
    if (!id) { resultado[ds] = { estado: 'sin vincular' }; continue; }
    try {
      const { data: meta } = await drive.files.get({ fileId: id, fields: 'id, name, mimeType, modifiedTime', supportsAllDrives: true });
      const res = meta.mimeType === 'application/vnd.google-apps.spreadsheet'
        ? await drive.files.export({ fileId: id, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, { responseType: 'arraybuffer' })
        : await drive.files.get({ fileId: id, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
      const filas = await lector.leer(Buffer.from(res.data));
      if (!filas.length) throw new Error('la planilla no tiene filas reconocibles');
      const ref = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA }).format(new Date(meta.modifiedTime));
      await db.doc(`datasets/${ds}`).set({ rows: filas.map((f) => ({ ...f, ref })), columns: Object.keys(filas[0]).concat('ref'), fuente: `${meta.name} (Drive)`, origen: 'drive-planilla', archivo: id, modificado_drive: meta.modifiedTime, actualizado: FieldValue.serverTimestamp() });
      resultado[ds] = { estado: 'ok', filas: filas.length, archivo: meta.name, modificado: meta.modifiedTime };
    } catch (e) {
      const sinAcceso = [403, 404].includes(e.code || (e.response && e.response.status));
      resultado[ds] = { estado: 'error', error: sinAcceso ? `Sin acceso a ${lector.nombre}: compartila (Lector) con ${cuenta || "la cuenta del servidor"}.` : String(e.message || e).slice(0, 200) };
    }
  }
  await db.doc('sistema/planillas').set({ ...resultado, cuenta, ultima: FieldValue.serverTimestamp() }, { merge: false });
  return { ...resultado, cuenta };
};
export const actualizarPlanillasDrive = onSchedule({ schedule: 'every 2 hours', timeZone: ZONA, timeoutSeconds: 300, memory: '512MiB' }, async () => {
  try { await actualizarPlanillas(); } catch (e) { logger.error('Planillas', e.message); }
});
export const actualizarPlanillasAhora = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async (req) => {
  exigirAdmin(req);
  return actualizarPlanillas();
});
