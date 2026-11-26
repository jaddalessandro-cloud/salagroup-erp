/**
 * Publica storage.rules en el depósito de Firebase Storage usando la API de reglas
 * (sirve aunque la cuenta de publicación no pueda consultar el depósito por defecto).
 * Uso: TOKEN=$(gcloud auth print-access-token) PROYECTO=erp-sala-group BUCKET=erp-sala-group.firebasestorage.app node tools/reglas-storage.mjs
 */
import { readFileSync } from 'node:fs';
const { TOKEN, PROYECTO, BUCKET } = process.env;
if (!TOKEN || !PROYECTO || !BUCKET) { console.error('Faltan TOKEN, PROYECTO o BUCKET'); process.exit(1); }
const api = `https://firebaserules.googleapis.com/v1/projects/${PROYECTO}`;
const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROYECTO };
const pedir = async (url, metodo, cuerpo) => {
  const r = await fetch(url, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { texto: t }; }
  return { ok: r.ok, status: r.status, j };
};
const rs = await pedir(`${api}/rulesets`, 'POST', { source: { files: [{ name: 'storage.rules', content: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8') }] } });
if (!rs.ok) { console.error('No se pudo crear el conjunto de reglas:', rs.status, JSON.stringify(rs.j)); process.exit(1); }
const nombre = `projects/${PROYECTO}/releases/firebase.storage/${BUCKET}`;
let rel = await pedir(`https://firebaserules.googleapis.com/v1/${nombre}`, 'PATCH', { release: { name: nombre, rulesetName: rs.j.name } });
if (rel.status === 404) rel = await pedir(`${api}/releases`, 'POST', { name: nombre, rulesetName: rs.j.name });
if (!rel.ok) { console.error('No se pudo publicar:', rel.status, JSON.stringify(rel.j)); process.exit(1); }
console.log(`Reglas de Storage publicadas en ${BUCKET} (${rs.j.name}).`);
