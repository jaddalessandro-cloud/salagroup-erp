/** Reglas compartidas: nombres de usuario, perfiles y política de contraseñas. */
export const DOMINIO = 'usuarios.salagroup-erp.web.app';
export const PERFILES = ['admin', 'gerencia', 'consulta'];
const NOMBRES = { admin: 'Administrador', gerencia: 'Gerencia', consulta: 'Consulta' };
export const perfilNombre = (p) => NOMBRES[p] || p || '—';

export const normalizarUsuario = (u) => String(u || '').trim().toLowerCase();
/** Devuelve un texto con el problema, o null si el nombre de usuario es aceptable. */
export const errorUsuario = (s) => (/^[a-z0-9][a-z0-9._-]{2,29}$/.test(s) ? null
  : 'El usuario debe tener entre 3 y 30 letras minúsculas, números, punto o guion, sin espacios ni acentos.');

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Devuelve un texto con el problema, o null si la contraseña es aceptable. */
export const validarClave = (c, usuario, nombre) => {
  if (typeof c !== 'string' || c.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (c.length > 128) return 'La contraseña es demasiado larga.';
  if (!/[a-zA-Z]/.test(c) || !/[0-9]/.test(c)) return 'La contraseña debe combinar letras y números.';
  const n = sinAcentos(c);
  if (usuario && n.includes(sinAcentos(usuario))) return 'La contraseña no puede contener el nombre de usuario.';
  const primero = sinAcentos(String(nombre || '').split(/\s+/)[0]);
  if (primero.length >= 3 && n.includes(primero)) return 'La contraseña no puede contener tu nombre.';
  if (/^(.)\1+$/.test(c) || /(0123456789|1234567890|qwerty|password|contrase)/i.test(n)) return 'La contraseña es demasiado fácil de adivinar.';
  return null;
};

/** Contraseña provisoria de 14 caracteres sin letras ambiguas (generador criptográfico). */
export const claveProvisoria = (randomInt) => {
  const L = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789', T = L + D;
  const c = [L[randomInt(L.length)], D[randomInt(D.length)]];
  while (c.length < 14) c.push(T[randomInt(T.length)]);
  for (let i = c.length - 1; i > 0; i--) { const j = randomInt(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
  return c.join('');
};
