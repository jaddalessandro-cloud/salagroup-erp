/**
 * Arranque del ERP Sala Group sobre Firebase.
 *
 * 1. Ingreso con usuario y contraseña (Firebase Authentication).
 * 2. Cambio obligatorio de la contraseña provisoria.
 * 3. Carga de datos con permisos controlados por el servidor (reglas de Firestore).
 * 4. Ejecuta el código del ERP (calc.js, app.js, erp.js, erp2.js) sobre el adaptador `dash`.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, setPersistence, browserSessionPersistence, onIdTokenChanged,
  signInWithEmailAndPassword, signOut, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { crearDatos } from './datos.js';
import { instalarDash } from './dash.js';
import { instalarClaude } from './claude.js';
import { montarPaneles } from './paneles.js';

export const DOMINIO = 'usuarios.salagroup-erp.web.app';
const INACTIVIDAD_MIN = 30;
const $ = (s) => document.querySelector(s);
const ver = (sel, si) => document.querySelectorAll(sel).forEach((e) => { e.hidden = !si; });

const local = ['localhost', '127.0.0.1'].includes(location.hostname);

const arrancar = async () => {
  let config;
  try {
    const r = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    config = await r.json();
  } catch {
    mostrarPantalla('error');
    $('#err-texto').textContent = 'No se pudo conectar con el servidor. Revisá la conexión a internet y volvé a intentar.';
    return;
  }
  const app = initializeApp(config);
  const auth = getAuth(app);
  const fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const fn = getFunctions(app, 'southamerica-east1');
  const st = getStorage(app);
  if (local) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(fs, '127.0.0.1', 8080);
    connectFunctionsEmulator(fn, '127.0.0.1', 5001);
    connectStorageEmulator(st, '127.0.0.1', 9199);
  }
  await setPersistence(auth, browserSessionPersistence);
  const llamar = (nombre) => async (datos) => (await httpsCallable(fn, nombre)(datos)).data;
  const ctx = { auth, fs, fn, st, llamar, salir: () => salir(auth) };
  window.__sg = ctx; // para pruebas y diagnóstico

  conectarFormularios(ctx);
  let iniciado = false;
  onIdTokenChanged(auth, async (user) => {
    if (!user) {
      if (iniciado) { location.reload(); return; }
      let motivo = ''; try { motivo = sessionStorage.getItem('sg_motivo') || ''; sessionStorage.removeItem('sg_motivo'); } catch { /* */ }
      if (motivo === 'inactividad') error('#l-error', `La sesión se cerró después de ${INACTIVIDAD_MIN} minutos sin actividad. Volvé a ingresar.`);
      mostrarPantalla('login');
      return;
    }
    let tok;
    try { tok = await user.getIdTokenResult(); } catch { mostrarPantalla('login'); return; }
    const role = tok.claims.role;
    if (!['admin', 'gerencia', 'consulta'].includes(role)) { mostrarPantalla('sin-perfil'); return; }
    if (tok.claims.temp === true) { abrirCambioClave(ctx, true); return; }
    if (iniciado) return;
    iniciado = true;
    mostrarPantalla('cargando');
    try {
      await iniciarERP(ctx, user, role);
    } catch (e) {
      console.error(e);
      mostrarPantalla('error');
      $('#err-texto').textContent = 'No se pudieron cargar los datos del sistema. Volvé a intentar en unos minutos.';
    }
  });
};

/* ---------- pantallas de acceso ---------- */
const PANTALLAS = ['login', 'clave', 'sin-perfil', 'cargando', 'error'];
function mostrarPantalla(cual) {
  ver('#acceso', !!cual);
  PANTALLAS.forEach((p) => ver(`#ac-${p}`, p === cual));
  const foco = cual === 'login' ? '#l-usuario' : cual === 'clave' ? '#c-actual' : null;
  if (foco) setTimeout(() => { const e = $(foco); if (e) e.focus(); }, 30);
}

const MENSAJES = {
  'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
  'auth/wrong-password': 'Usuario o contraseña incorrectos.',
  'auth/user-not-found': 'Usuario o contraseña incorrectos.',
  'auth/invalid-email': 'Usuario o contraseña incorrectos.',
  'auth/user-disabled': 'Este usuario está desactivado. Consultá con un Administrador.',
  'auth/too-many-requests': 'Demasiados intentos seguidos. Esperá unos minutos y volvé a probar.',
  'auth/network-request-failed': 'Sin conexión con el servidor. Revisá internet y volvé a intentar.',
};
const mensaje = (e) => MENSAJES[e && e.code] || (e && e.message && !/^Firebase/.test(e.message) ? e.message : 'No se pudo completar la operación. Volvé a intentar.');
const error = (sel, txt) => { const e = $(sel); if (!e) return; e.textContent = txt || ''; e.hidden = !txt; };
const emailDe = (u) => (u.includes('@') ? u : `${u}@${DOMINIO}`);

function ojos() {
  document.querySelectorAll('.ac-ojo').forEach((b) => b.addEventListener('click', () => {
    const inp = b.parentElement.querySelector('input');
    const mostrar = inp.type === 'password';
    inp.type = mostrar ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(mostrar));
    b.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
    inp.focus();
  }));
}

function conectarFormularios(ctx) {
  ojos();
  $('#ac-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const u = $('#l-usuario').value.trim().toLowerCase(), c = $('#l-clave').value;
    if (!u || !c) { error('#l-error', 'Ingresá tu usuario y tu contraseña.'); return; }
    const b = $('#l-btn'); b.disabled = true; error('#l-error', '');
    try {
      await signInWithEmailAndPassword(ctx.auth, emailDe(u), c);
      $('#l-clave').value = '';
    } catch (e) {
      error('#l-error', mensaje(e));
      $('#l-clave').select();
    } finally { b.disabled = false; }
  });
  $('#ac-clave').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const actual = $('#c-actual').value, nueva = $('#c-nueva').value, otra = $('#c-otra').value;
    error('#c-error', ''); ver('#c-ok', false);
    if (!actual || !nueva) { error('#c-error', 'Completá todos los campos.'); return; }
    if (nueva !== otra) { error('#c-error', 'Las dos contraseñas nuevas no coinciden.'); return; }
    if (nueva === actual) { error('#c-error', 'La contraseña nueva tiene que ser distinta de la actual.'); return; }
    const b = $('#c-btn'); b.disabled = true;
    try {
      const user = ctx.auth.currentUser;
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, actual));
      await ctx.llamar('cambiarClave')({ nueva });
      ['#c-actual', '#c-nueva', '#c-otra'].forEach((s) => { $(s).value = ''; });
      if (ctx.voluntario) { ver('#c-ok', true); setTimeout(() => { mostrarPantalla(null); }, 1400); }
      await user.getIdToken(true); // la credencial nueva ya no tiene la marca de provisoria
    } catch (e) {
      const m = e && e.code === 'auth/invalid-credential' ? 'La contraseña actual no es correcta.' : mensaje(e);
      error('#c-error', m);
    } finally { b.disabled = false; }
  });
  $('#c-cancelar').addEventListener('click', () => { if (ctx.voluntario) mostrarPantalla(null); else salir(ctx.auth); });
  document.querySelectorAll('.ac-salir').forEach((b) => b.addEventListener('click', () => salir(ctx.auth)));
  document.querySelectorAll('.ac-reintentar').forEach((b) => b.addEventListener('click', () => location.reload()));
}

function abrirCambioClave(ctx, obligatorio) {
  ctx.voluntario = !obligatorio;
  ver('#c-intro-obl', obligatorio); ver('#c-intro-vol', !obligatorio);
  $('#c-cancelar').textContent = obligatorio ? 'Salir' : 'Cancelar';
  error('#c-error', ''); ver('#c-ok', false);
  mostrarPantalla('clave');
}

async function salir(auth, motivo) {
  try { sessionStorage.clear(); if (motivo) sessionStorage.setItem('sg_motivo', motivo); } catch { /* sin almacenamiento */ }
  await signOut(auth);
  location.replace('/');
}

/* ---------- cierre por inactividad ---------- */
function vigilarInactividad(ctx) {
  let t;
  const reiniciar = () => { clearTimeout(t); t = setTimeout(() => salir(ctx.auth, 'inactividad'), INACTIVIDAD_MIN * 60 * 1000); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
  reiniciar();
}

/* ---------- ERP ---------- */
const cargarScript = (src) => new Promise((ok, mal) => {
  const s = document.createElement('script');
  s.src = src; s.async = false;
  s.onload = ok; s.onerror = () => mal(new Error(`No se pudo cargar ${src}`));
  document.body.appendChild(s);
});

async function iniciarERP(ctx, user, role) {
  const datos = crearDatos(ctx.fs);
  await datos.listo;
  const dash = instalarDash(datos);
  instalarClaude(ctx, datos, user, role);
  document.body.dataset.rol = role;
  await cargarScript('/vendor/d3.min.js');
  for (const f of ['calc.js', 'app.js', 'erp.js', 'erp2.js']) await cargarScript(`/erp/${f}?v=__VERSION__`);
  montarPaneles(ctx, datos, user, role, { abrirCambioClave: () => abrirCambioClave(ctx, false) });
  ver('#erp', true);
  mostrarPantalla(null);
  dash.correr();
  vigilarInactividad(ctx);
  // registro del ingreso en el servidor (una vez por sesión del navegador)
  let ya = false; try { ya = sessionStorage.getItem('sg_ingreso_srv') === '1'; } catch { /* */ }
  if (!ya) ctx.llamar('registrarIngreso')({}).then(() => { try { sessionStorage.setItem('sg_ingreso_srv', '1'); } catch { /* */ } }).catch(() => {});
  // enlace directo a una sección (#modulo)
  const destino = decodeURIComponent(location.hash.slice(1));
  if (destino) { const b = document.querySelector(`[data-go="${CSS.escape(destino)}"], .sp-tab[data-tab="${CSS.escape(destino)}"]`); if (b) b.click(); }
}

arrancar();
