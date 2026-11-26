/** Recorrido de solo lectura de una carpeta de Google Drive (API v3). Nunca modifica archivos. */
const CARPETA = 'application/vnd.google-apps.folder';

export const recorrerCarpeta = async (drive, raiz, { maxCarpetas = 3000, maxArchivos = 20000 } = {}) => {
  // primero se confirma que la cuenta de servicio ve la carpeta raíz (si no está compartida, Drive devuelve listas vacías sin error)
  try {
    await drive.files.get({ fileId: raiz, fields: 'id, name', supportsAllDrives: true });
  } catch (e) {
    const err = new Error('La carpeta ESTACIONES no está compartida con la cuenta del servidor.');
    err.code = (e && (e.code || (e.response && e.response.status))) === 404 ? 404 : 403;
    throw err;
  }
  const carpetas = [], archivos = [], cola = [raiz], vistas = new Set([raiz]);
  while (cola.length) {
    const padre = cola.shift();
    let pageToken;
    do {
      const { data } = await drive.files.list({
        q: `'${padre}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, parents, createdTime, modifiedTime, webViewLink, size)',
        pageSize: 1000, pageToken, supportsAllDrives: true, includeItemsFromAllDrives: true,
      });
      for (const f of data.files || []) {
        if (f.mimeType === CARPETA) {
          if (vistas.has(f.id) || carpetas.length >= maxCarpetas) continue;
          vistas.add(f.id); cola.push(f.id);
          carpetas.push({ id: f.id, nombre: f.name, carpeta_id: padre, url: f.webViewLink || '', modificado: f.modifiedTime || '' });
        } else if (archivos.length < maxArchivos) {
          archivos.push({ id: f.id, nombre: f.name, tipo: f.mimeType, carpeta_id: padre, creado: f.createdTime || '', modificado: f.modifiedTime || '', url: f.webViewLink || '', tamano: f.size ? Number(f.size) : null });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  archivos.sort((a, b) => (a.modificado < b.modificado ? 1 : -1));
  return { carpetas, archivos };
};

/** Parte una lista en trozos que entren holgados en un documento de Firestore (límite 1 MiB). */
export const partirFilas = (filas, maxBytes = 700000) => {
  const partes = [[]]; let tam = 0;
  for (const f of filas) {
    const t = Buffer.byteLength(JSON.stringify(f)) + 40;
    if (tam + t > maxBytes && partes[partes.length - 1].length) { partes.push([]); tam = 0; }
    partes[partes.length - 1].push(f); tam += t;
  }
  return partes;
};
