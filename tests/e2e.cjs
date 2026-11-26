/**
 * Prueba de punta a punta contra los emuladores de Firebase:
 *   npm run emuladores   (en otra terminal)
 *   CLAVE_INICIAL=... node functions/scripts/usuarios-iniciales.js  (con las variables del emulador)
 *   DATOS=/ruta/paquete.json CLAVE_INICIAL=... node tests/e2e.cjs
 */
const { chromium } = require('playwright');
const assert = require('node:assert');
const URL = process.env.URL || 'http://127.0.0.1:5000/';
const INI = process.env.CLAVE_INICIAL;
const NUEVA = 'Estaciones2026ok';
const SHOT = process.env.SHOTS || '';

(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/permission|Failed to load resource|400|403/.test(m.text())) errores.push(m.text()); });
  const foto = (n) => SHOT && p.screenshot({ path: `${SHOT}/${n}.png` });

  await p.goto(URL);
  await p.waitForSelector('#ac-login:not([hidden])');
  await foto('1_login');
  // contraseña incorrecta
  await p.fill('#l-usuario', 'hernan'); await p.fill('#l-clave', 'mala12345678'); await p.click('#l-btn');
  await p.waitForSelector('#l-error:not([hidden])');
  assert.match(await p.textContent('#l-error'), /incorrectos/);
  // mostrar / ocultar
  await p.click('#ac-login .ac-ojo'); assert.equal(await p.getAttribute('#l-clave', 'type'), 'text'); await p.click('#ac-login .ac-ojo');
  // ingreso con contraseña provisoria → cambio obligatorio
  await p.fill('#l-clave', INI); await p.click('#l-btn');
  await p.waitForSelector('#ac-clave:not([hidden])');
  await p.fill('#c-actual', INI); await p.fill('#c-nueva', 'hernan2026abc'); await p.fill('#c-otra', 'hernan2026abc'); await p.click('#c-btn');
  await p.waitForSelector('#c-error:not([hidden])'); assert.match(await p.textContent('#c-error'), /usuario/);
  await foto('2_clave');
  await p.fill('#c-nueva', NUEVA); await p.fill('#c-otra', NUEVA); await p.click('#c-btn');
  await p.waitForSelector('#erp:not([hidden])', { timeout: 30000 });
  await p.waitForSelector('#bienvenida:not([hidden])');
  const sal = await p.textContent('#bienvenida .gs-bien-sal');
  assert.match(sal, /Buen(os|as) (días|tardes|noches), Hernán/);
  await foto('3_bienvenida');
  await p.click('#btn-ingresar');
  assert.match(await p.textContent('.gs-saludo'), /Hernán/);

  // importar datos
  if (process.env.DATOS) {
    await p.evaluate(() => document.querySelector('[data-go="adm-config"]').click());
    await p.waitForSelector('#imp-form:not([hidden])');
    await p.setInputFiles('#imp-form input[type=file]', process.env.DATOS);
    await p.click('#imp-form button[type=submit]');
    await p.waitForFunction(() => /terminada/.test(document.querySelector('#imp-msg').textContent), null, { timeout: 60000 });
    console.log('importación:', await p.textContent('#imp-msg'));
    await foto('4_config');
  }

  // recorrido de todos los módulos y submódulos
  await p.evaluate(() => document.querySelector('.sp-tab[data-tab="dash"]').click());
  await p.waitForTimeout(800);
  await foto('5_dashboard');
  const tabs = await p.$$eval('.sp-tab[data-tab]', (x) => x.map((y) => y.dataset.tab));
  for (const t of tabs) {
    await p.evaluate((t) => document.querySelector(`.sp-tab[data-tab="${t}"]`).click(), t); await p.waitForTimeout(150);
    const subs = await p.$$eval(`[data-panel="${t}"] .gs-subtab`, (x) => x.map((y) => y.dataset.sub));
    for (const s of subs) { await p.evaluate((s) => document.querySelector(`.gs-subtab[data-sub="${s}"]`).click(), s); await p.waitForTimeout(120); }
  }
  await p.evaluate(() => document.querySelector('.sp-tab[data-tab="fin"]').click()); await p.waitForTimeout(500); await foto('6_finanzas');

  // alta de un usuario de Gerencia
  await p.evaluate(() => document.querySelector('[data-go="adm-config"]').click());
  await p.fill('#us-nuevo input[name=usuario]', 'prueba.gerencia'); await p.fill('#us-nuevo input[name=nombre]', 'Prueba Gerencia');
  await p.selectOption('#us-nuevo select[name=perfil]', 'gerencia'); await p.click('#us-nuevo button[type=submit]');
  await p.waitForSelector('#us-clave-box:not([hidden])', { timeout: 20000 });
  const tmp = (await p.textContent('#us-clave')).trim();
  assert.equal(tmp.length, 14);
  // un registro nuevo, con historial
  const r = await p.evaluate(async () => { const db = await claude.use('db'); await db.doc('data/erp/vencimientos/VEN-PRUEBA').set({ concepto: 'Prueba', fecha: '2026-12-01', estado: 'Pendiente', estacion: 'Shell' }); return 'ok'; });
  assert.equal(r, 'ok');
  await p.click('#btn-salir');
  await p.waitForSelector('#ac-login:not([hidden])');

  // Gerencia: no administra usuarios ni configuración (lo frena el servidor)
  await p.fill('#l-usuario', 'prueba.gerencia'); await p.fill('#l-clave', tmp); await p.click('#l-btn');
  await p.waitForSelector('#ac-clave:not([hidden])');
  await p.fill('#c-actual', tmp); await p.fill('#c-nueva', 'Gerencia2026xyz'); await p.fill('#c-otra', 'Gerencia2026xyz'); await p.click('#c-btn');
  await p.waitForSelector('#erp:not([hidden])', { timeout: 30000 });
  if (await p.isVisible('#btn-ingresar')) await p.click('#btn-ingresar');
  const g = await p.evaluate(async () => {
    const db = await claude.use('db'); const out = {};
    try { await db.doc('data/erp/config/avisos').set({ x: 1 }); out.config = 'escribió'; } catch (e) { out.config = e.code; }
    try { await db.doc('data/erp/vencimientos/VEN-G').set({ concepto: 'Gerencia', estado: 'Pendiente' }); out.registro = 'ok'; } catch (e) { out.registro = e.code; }
    try { await db.collection('data/erp/historial').add({ usuario: 'otro', accion: 'x' }); out.historialAjeno = 'escribió'; } catch (e) { out.historialAjeno = e.code; }
    try { await __sg.llamar('crearUsuario')({ usuario: 'intruso', nombre: 'X', perfil: 'admin' }); out.crear = 'creó'; } catch (e) { out.crear = e.code; }
    out.panelUsuarios = !document.querySelector('#us-nuevo').hidden;
    return out;
  });
  console.log('gerencia:', JSON.stringify(g));
  assert.equal(g.config, 'permission-denied'); assert.equal(g.registro, 'ok'); assert.equal(g.historialAjeno, 'permission-denied');
  assert.equal(g.crear, 'functions/permission-denied'); assert.equal(g.panelUsuarios, false);
  await foto('7_gerencia');

  console.log(errores.length ? `errores en la página:\n${[...new Set(errores)].slice(0, 15).join('\n')}` : 'sin errores en la página');
  await b.close();
  console.log('E2E OK');
})().catch((e) => { console.error('FALLÓ:', e); process.exit(1); });
