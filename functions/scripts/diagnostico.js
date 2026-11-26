/**
 * Diagnóstico de solo lectura: no escribe nada y no muestra cifras ni contenidos,
 * solo cantidades, identificadores de planillas y el estado de cada usuario.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT });
const db = getFirestore(), auth = getAuth();
const out = (s) => console.log(s);

const ds = await db.collection('datasets').get();
out(`## Planillas (datasets): ${ds.size} documentos`);
ds.docs.forEach((d) => out(`- ${d.id}: ${Array.isArray(d.get('rows')) ? d.get('rows').length : 'sin rows'} filas`));

const erp = await db.doc('data/erp').listCollections();
out(`\n## Registros (data/erp): ${erp.length} colecciones`);
for (const c of erp) out(`- ${c.id}: ${(await c.count().get()).data().count}`);

const us = await db.collection('usuarios').get();
out(`\n## Usuarios en la base: ${us.size}`);
const lista = await auth.listUsers(100);
out(`## Usuarios en Authentication: ${lista.users.length}`);
for (const u of lista.users) {
  const doc = us.docs.find((d) => d.id === u.uid);
  out(`- ${u.email} · deshabilitado=${u.disabled} · claims=${JSON.stringify(u.customClaims || {})} · doc usuarios=${doc ? JSON.stringify({ perfil: doc.get('perfil'), activo: doc.get('activo'), clave_provisoria: doc.get('clave_provisoria') }) : 'NO EXISTE'} · último ingreso=${u.metadata.lastSignInTime || '—'}`);
}
for (const k of ['drive', 'respaldo']) { const s = await db.doc(`sistema/${k}`).get(); out(`\n## sistema/${k}: ${s.exists ? JSON.stringify({ ...s.data(), cuenta: s.get('cuenta') ? '(oculta)' : undefined }) : 'no existe'}`); }
