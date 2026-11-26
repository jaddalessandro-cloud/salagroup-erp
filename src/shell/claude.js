/**
 * Adaptador `claude.use(...)`: base de datos, identidad, descargas y adjuntos,
 * con la misma forma que usaba el tablero original, ahora sobre Firebase.
 */
import { ref, uploadBytes, getBlob } from 'firebase/storage';

const PERFIL_ERP = { admin: 'Administrador', gerencia: 'Gerencia', consulta: 'Consulta' };
const limpio = (s) => String(s || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-120);

export function instalarClaude(ctx, datos, user, role) {
  const nombreDe = (uid) => (datos.usuarios[uid] && datos.usuarios[uid].nombre) || (uid === 'instalación' ? 'Instalación' : '');
  const usuario = {
    me: async () => ({ name: nombreDe(user.uid) || 'Usuario', perfil: PERFIL_ERP[role] }),
    id: async () => user.uid,
    // "editor del tablero" = Administrador (configuración y perfiles); el resto lo controla el servidor
    canEdit: async () => role === 'admin',
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((i) => [i, { name: nombreDe(i) || 'Usuario anterior' }])),
    search: async (q) => {
      const n = String(q || '').toLowerCase();
      return Object.values(datos.usuarios).filter((u) => !n || `${u.nombre} ${u.usuario}`.toLowerCase().includes(n)).map((u) => ({ id: u.uid, name: u.nombre }));
    },
  };
  const descargas = {
    save: async ({ filename, data, mime }) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime || (/\.csv$/i.test(filename) ? 'text/csv;charset=utf-8' : 'application/octet-stream') });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || 'archivo'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return {};
    },
  };
  const adjuntos = {
    upload: async (file) => {
      if (role === 'consulta') throw new Error('Tu perfil es de consulta.');
      const ruta = `adjuntos/${user.uid}/${Date.now()}_${limpio(file.name)}`;
      await uploadBytes(ref(ctx.st, ruta), file, { contentType: file.type || 'application/octet-stream' });
      return { id: ruta, url: `/adjunto/${encodeURIComponent(ruta)}` };
    },
  };
  window.claude = {
    use: async (n) => (n === 'db' ? datos.db : n === 'user' ? usuario : n === 'downloads' ? descargas : n === 'assets' ? adjuntos : null),
  };

  // los adjuntos se abren con la sesión de la persona (nunca con un enlace público)
  document.addEventListener('click', async (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href^="/adjunto/"]');
    if (!a) return;
    ev.preventDefault();
    const ventana = window.open('', '_blank');
    try {
      const ruta = decodeURIComponent(a.getAttribute('href').slice('/adjunto/'.length));
      const blob = await getBlob(ref(ctx.st, ruta));
      const url = URL.createObjectURL(blob);
      if (ventana) ventana.location.href = url; else location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch {
      if (ventana) ventana.close();
      alert('No se pudo abrir el adjunto.');
    }
  });
}
