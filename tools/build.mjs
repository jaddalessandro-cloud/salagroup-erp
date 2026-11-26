/**
 * Arma la carpeta public/ que publica Firebase Hosting:
 *   public/index.html   pantalla de acceso + estructura del ERP
 *   public/main.js      arranque (Firebase + adaptadores), empaquetado con esbuild
 *   public/erp/*        código del ERP sin cambios (calc, app, erp, erp2, estilos)
 *   public/vendor/d3    biblioteca de gráficos
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (...p) => join(raiz, 'src', ...p);
const pub = (...p) => join(raiz, 'public', ...p);
const leer = (p) => readFileSync(p, 'utf8');

let version;
try { version = execSync('git rev-parse --short HEAD', { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { version = ''; }
version = version || Date.now().toString(36);

rmSync(pub(), { recursive: true, force: true });
mkdirSync(pub('erp'), { recursive: true });
mkdirSync(pub('vendor'), { recursive: true });

/* ---------- estructura del ERP ---------- */
let erp = leer(src('erp', 'index.html'))
  .replace(/^<meta name="dash-[^>]*>\n/gm, '')
  .replace(/^<link rel="stylesheet" href="[^"]*">\n/gm, '')
  .replace(/^<script src="[^"]*"><\/script>\n?/gm, '');

const reemplazar = (texto, desde, hasta, nuevo, nombre) => {
  const i = texto.indexOf(desde);

  if (i < 0) {
    throw new Error(`build: no se encontró ${nombre}`);
  }

  const inicio = i + desde.length;

  let j;

  if (hasta instanceof RegExp) {
    const relativo = texto.slice(inicio).search(hasta);
    j = relativo < 0 ? -1 : inicio + relativo;
  } else {
    j = hasta ? texto.indexOf(hasta, inicio) : inicio;
  }

  if (j < 0) {
    throw new Error(`build: no se encontró el final de ${nombre}`);
  }

  return texto.slice(0, i) + nuevo + texto.slice(j);
};
// cuenta (cambiar contraseña, cerrar sesión) al pie del menú lateral
erp = reemplazar(erp, '<p class="gs-side-foot">', null, `${leer(src('shell', 'cuenta.html'))}<p class="gs-side-foot">`, 'pie del menú');
// los perfiles del tablero original pasan a ser usuarios y permisos reales del servidor
erp = reemplazar(erp, '<h2>Perfiles de usuario</h2>', /<\/div>\r?\n<div id="adm-hist"/, `${leer(src('shell', 'paneles.html'))}`, 'perfiles de usuario');
const html = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0E2A47">
<title>Sala Group — Sistema de información y gestión</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/erp/lato.css?v=${version}">
<link rel="stylesheet" href="/shell.css?v=${version}">
<link rel="stylesheet" href="/erp/app.css?v=${version}">
</head>
<body>
<div id="erp" hidden>
${erp}
</div>
${leer(src('shell', 'acceso.html'))}
<script type="module" src="/main.js?v=${version}"></script>
</body>
</html>
`;
writeFileSync(pub('index.html'), html);

/* ---------- archivos ---------- */
for (const f of ['calc.js', 'app.js', 'erp.js', 'erp2.js', 'app.css', 'lato.css']) copyFileSync(src('erp', f), pub('erp', f));
copyFileSync(src('shell', 'shell.css'), pub('shell.css'));
copyFileSync(join(raiz, 'node_modules', 'd3', 'dist', 'd3.min.js'), pub('vendor', 'd3.min.js'));

// ícono: isotipo de Sala Group
const iso = erp.match(/<svg class="gs-logo-iso"[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/);
if (!iso) throw new Error('build: no se encontró el isotipo');
writeFileSync(pub('favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iso[1]}"><rect x="160" y="160" width="880" height="880" rx="160" fill="#0E2A47"/>${iso[2].replace(/var\(--sg-sky\)/g, '#29B8EC').replace(/var\(--sg-side\)/g, '#0E2A47')}</svg>`);

await build({
  entryPoints: [src('shell', 'main.js')],
  bundle: true, format: 'esm', minify: true, target: 'es2020', sourcemap: false,
  outfile: pub('main.js'), define: { __VERSION__: JSON.stringify(version) }, legalComments: 'none',
});
writeFileSync(pub('main.js'), leer(pub('main.js')).replaceAll('__VERSION__', version));
console.log(`public/ listo (versión ${version})`);
