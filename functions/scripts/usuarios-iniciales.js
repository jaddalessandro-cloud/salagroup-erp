/**
 * Crea los usuarios iniciales del sistema (Hernán, Javier y Christian) como Administradores.
 *
 * Se corre una sola vez desde GitHub Actions ("Crear usuarios iniciales"), con:
 *   - GOOGLE_APPLICATION_CREDENTIALS → clave de la cuenta de servicio (secreto FIREBASE_SERVICE_ACCOUNT)
 *   - CLAVE_INICIAL                   → contraseña provisoria elegida por el responsable (secreto CLAVE_INICIAL)
 *
 * La contraseña provisoria nunca se escribe en el repositorio ni en los registros. Cada persona
 * está obligada a cambiarla en su primer ingreso: hasta entonces no puede ver ningún dato.
 * Si un usuario ya existe, no se toca.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DOMINIO } from '../lib/reglas.js';

const INICIALES = [
  { usuario: 'hernan', nombre: 'Hernán' },
  { usuario: 'javier', nombre: 'Javier' },
  { usuario: 'christian', nombre: 'Christian' },
];

const clave = process.env.CLAVE_INICIAL || '';
if (clave.length < 10 || !/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) {
  console.error('CLAVE_INICIAL falta o es débil: al menos 10 caracteres, con letras y números.');
  process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT || undefined });
const auth = getAuth(), db = getFirestore();

for (const p of INICIALES) {
  const email = `${p.usuario}@${DOMINIO}`;
  try {
    await auth.getUserByEmail(email);
    console.log(`· ${p.usuario}: ya existía, sin cambios.`);
    continue;
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }
  const u = await auth.createUser({ email, password: clave, displayName: p.nombre });
  await auth.setCustomUserClaims(u.uid, { role: 'admin', temp: true });
  await db.doc(`usuarios/${u.uid}`).set({ usuario: p.usuario, nombre: p.nombre, perfil: 'admin', activo: true, clave_provisoria: true, creado: FieldValue.serverTimestamp(), creado_por: 'instalación' });
  await db.collection('accesos').add({ uid: 'instalación', evento: 'Alta de usuario', detalle: `${p.usuario} (Administrador)`, fecha: FieldValue.serverTimestamp() });
  console.log(`✓ ${p.usuario}: creado como Administrador, con contraseña provisoria.`);
}
