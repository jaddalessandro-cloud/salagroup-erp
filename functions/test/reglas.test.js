import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { validarClave, claveProvisoria, errorUsuario, normalizarUsuario } from '../lib/reglas.js';
import { recorrerCarpeta, partirFilas } from '../lib/drive.js';

test('política de contraseñas', () => {
  assert.match(validarClave('corta1', 'hernan', 'Hernán'), /10 caracteres/);
  assert.match(validarClave('soloLetrasLargas', 'hernan', 'Hernán'), /letras y números/);
  assert.match(validarClave('hernan2026abc', 'hernan', 'Hernán'), /usuario/);
  assert.match(validarClave('xxHERNAN2026', 'hrn', 'Hernán'), /nombre/);
  assert.equal(validarClave('Estaciones2026ok', 'hernan', 'Hernán'), null);
});
test('contraseña provisoria', () => {
  const vistas = new Set();
  for (let i = 0; i < 200; i++) { const c = claveProvisoria(randomInt); assert.equal(c.length, 14); assert.equal(validarClave(c), null); vistas.add(c); }
  assert.equal(vistas.size, 200);
});
test('nombres de usuario', () => {
  assert.equal(errorUsuario(normalizarUsuario(' Hernan ')), null);
  assert.ok(errorUsuario('ab'));
  assert.ok(errorUsuario('hernán'));
  assert.ok(errorUsuario('a b c'));
});
test('Drive: recorre subcarpetas y no repite', async () => {
  const arbol = { R: [{ id: 'A', name: 'BANCOS', mimeType: 'application/vnd.google-apps.folder' }, { id: 'f1', name: 'x.pdf', mimeType: 'application/pdf', modifiedTime: '2026-01-01' }],
    A: [{ id: 'f2', name: 'y.xlsx', mimeType: 'application/vnd.ms-excel', modifiedTime: '2026-02-01', size: '10' }, { id: 'A', name: 'ciclo', mimeType: 'application/vnd.google-apps.folder' }] };
  const drive = { files: { list: async ({ q }) => ({ data: { files: arbol[q.match(/'(\w+)'/)[1]] || [] } }) } };
  const { carpetas, archivos } = await recorrerCarpeta(drive, 'R');
  assert.deepEqual(carpetas.map((c) => [c.id, c.carpeta_id]), [['A', 'R']]);
  assert.deepEqual(archivos.map((a) => a.id), ['f2', 'f1']);
  assert.equal(archivos[0].tamano, 10);
});
test('partición de filas grandes', () => {
  const filas = Array.from({ length: 5000 }, (_, i) => ({ id: i, nombre: 'x'.repeat(300) }));
  const partes = partirFilas(filas);
  assert.ok(partes.length > 1);
  assert.equal(partes.flat().length, 5000);
});
