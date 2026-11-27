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
  const drive = { files: { get: async () => ({ data: { id: 'R' } }), list: async ({ q }) => ({ data: { files: arbol[q.match(/'(\w+)'/)[1]] || [] } }) } };
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
test('Drive: avisa si la carpeta no está compartida', async () => {
  const drive = { files: { get: async () => { const e = new Error('nf'); e.code = 404; throw e; }, list: async () => ({ data: { files: [] } }) } };
  await assert.rejects(recorrerCarpeta(drive, 'R'), (e) => e.code === 404 && /no está compartida/.test(e.message));
});
test('planilla PLANES DE PAGO (datos de ejemplo)', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const { leerPlanesDePago } = await import('../lib/planillas.js');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DSB');
  ws.addRow(['PLANES VIGENTES']);
  ws.addRow(['NRO PLAN', 'CANTIDAD DE CUOTAS', 'FECHA DE DEBITO', new Date('2026-11-26'), 'CUOTAS PENDIENTES', 'IMPORTE CUOTA', 'OBLIGACIONES', 'CBU']);
  ws.addRow(['X000001', 8, new Date('2026-11-26T00:00:00Z'), 3, 5, 1000.5, 'IVA prueba', 'MACRO']);
  ws.addRow(['X000002', 8, new Date('2026-04-16T00:00:00Z'), 4, 4, 2000, 'Seg. Social prueba', 'MACRO', 'CADUCO', 'REGULARIZAR']);
  ws.addRow(['X000003', 8, new Date('2026-12-16T00:00:00Z'), 8, null, 300, null, null]);
  ws.addRow(['X000001', 'SI O SI', new Date('2026-12-12T00:00:00Z'), null, null, 999]);
  ws.addRow(['ARBA PLANES DE PAGO']);
  ws.addRow([1234, 21, new Date('2026-12-10T00:00:00Z'), 3, 18, 50, 'IIBB prueba', 'DEBITO MACRO']);
  wb.addWorksheet('OTRA').addRow(['X9', 1, null, 1, 0, 1]);
  const r = await leerPlanesDePago(await wb.xlsx.writeBuffer());
  assert.equal(r.length, 5);
  assert.deepEqual(r.map((x) => [x.tipo, x.plan, x.organismo, x.estado, x.cuotas_pendientes]), [
    ['Plan', 'X000001', 'ARCA', 'Vigente', 5], ['Plan', 'X000002', 'ARCA', 'Caduco', 4], ['Plan', 'X000003', 'ARCA', 'Vigente', 0],
    ['Pago SI O SI', 'X000001', 'ARCA', 'Vigente', null], ['Plan', '1234', 'ARBA', 'Vigente', 18]]);
  assert.equal(r[0].empresa, 'Shell (DSB)'); assert.equal(r[0].fecha_debito, '2026-11-26'); assert.equal(r[0].banco_debito, 'Macro');
  assert.equal(r[1].nota, 'CADUCO REGULARIZAR');
});
test('planilla Situación (datos de ejemplo)', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const { leerSituacion } = await import('../lib/planillas.js');
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Bancos Shell');
  ws.addRow(['SHELL', 'Empresa de prueba']);
  ws.addRow(['Banco Uno', null, null, null, null, null, null, 'Banco Dos']);
  ws.addRow(['Línea', 'Calificación', 'Saldo', 'Disponible', 'TNA', 'TEA', null, 'Línea', 'Calificación', 'Saldo']);
  ws.addRow(['ACC', 100, 50, 50, null, null, null, 'ACC', null, null]);
  ws.addRow(['VN', null, 0, 0, null, null, null, 'Valores Negociados', 300, 200]);
  ws.addRow(['Total', 100, null, null, null, null, null, 'Total', 300]);
  ws.addRow(['Préstamos', 'N°cuota/Plazo', 'Monto', 'Cuota', 'Saldo', 'Tasa', null, 'Préstamos', 'N°cuota/Plazo', 'Monto', 'Cuota', 'Saldo', 'Tasa']);
  ws.addRow(['Pmo Amort', '3 de 12', 1200, 100, 900, 0.4, null, 'Pmo C/T', new Date('2026-12-04T00:00:00Z'), 500, null, 900, 0.4]);
  ws.addRow(['Total', null, 1200, null, null, null, null, 'Total', null, 500]);
  ws.addRow(['Total Calificación', null, 1300, null, null, null, null, 'Total calificación', null, 800]);
  const r = await leerSituacion(await wb.xlsx.writeBuffer());
  assert.deepEqual(r.map((x) => [x.banco, x.tipo, x.linea]), [['Banco Uno', 'Línea', 'ACC'], ['Banco Uno', 'Préstamo', 'Pmo Amort'], ['Banco Dos', 'Línea', 'Valores Negociados'], ['Banco Dos', 'Préstamo', 'Pmo C/T']]);
  assert.equal(r[1].plazo, '3 de 12'); assert.equal(r[3].vencimiento, '2026-12-04'); assert.match(r[3].nota, /duplicado/);
});
test('planilla de cheques (datos de ejemplo)', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const { leerCheques } = await import('../lib/planillas.js');
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Base_Cheques');
  ws.addRow(['Base']); ws.addRow(['nota']);
  ws.addRow(['ID', 'Fila', 'Empresa emisora', 'Fecha de emisión', 'Nº de cheque', 'Banco emisor', 'Cuenta', 'Beneficiario', 'CUIT', 'Importe ($)', 'Fecha de pago / vencimiento', 'Tipo de cheque', 'Concepto', 'Sector', 'Estado registrado', 'Fecha débito efectivo', 'Rel', 'Observaciones']);
  ws.addRow(['CH-1', 1, 'DSB', null, '123', 'Banco Uno', null, 'Proveedor SA', null, 1000, new Date('2026-11-28T00:00:00Z'), null, null, null, 'Emitido', null, null, '[Diagnóstico] Sin CUIT']);
  ws.addRow(['CH-2', 2, 'CM', null, null, 'Banco Dos', null, null, null, 500, new Date('2026-11-30T00:00:00Z'), null, null, null, 'Rechazado']);
  ws.addRow([null, null, null]);
  const r = await leerCheques(await wb.xlsx.writeBuffer());
  assert.equal(r.length, 2);
  assert.equal(r[0].empresa, 'Shell (DSB)'); assert.equal(r[0].fecha_debito, '2026-11-30'); assert.equal(r[0].observaciones, 'Sin CUIT');
  assert.equal(r[1].empresa, 'YPF (Comb. Magdalena)'); assert.equal(r[1].beneficiario, '(sin dato)'); assert.equal(r[1].estado, 'Rechazado');
});
