/**
 * Lectura de la planilla PLANES DE PAGO (Google Sheets exportada a Excel).
 * Una hoja por empresa; en cada fila: plan, cantidad de cuotas, fecha de débito, cuota actual,
 * cuotas pendientes, importe de cuota, obligaciones y banco de débito.
 * Las filas marcadas "si o si" son pagos puntuales. Los planes numéricos (o bajo un título ARBA) son de ARBA.
 */
import ExcelJS from 'exceljs';

const EMPRESAS = { ALVEMEM: 'Alvemem', MAGDALENA: 'YPF (Comb. Magdalena)', DSB: 'Shell (DSB)', SALA: 'Sala', 'EL CHAPERIO': 'El Chaperío' };
const txt = (v) => {
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((x) => x.text).join('');
  if (typeof v === 'object' && 'result' in v) return txt(v.result);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, ' ').trim();
};
const num = (v) => {
  if (v && typeof v === 'object' && 'result' in v) return num(v.result);
  if (typeof v === 'number') return v;
  const s = txt(v).replace(/\$/g, '').replace(/\./g, '').replace(',', '.');
  return s !== '' && !Number.isNaN(Number(s)) ? Number(s) : null;
};
const fecha = (v) => {
  if (v && typeof v === 'object' && 'result' in v) return fecha(v.result);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = txt(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};
const titulo = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const esSiOSi = (v) => /si\s*o\s*si/i.test(txt(v));

export const leerPlanesDePago = async (buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const filas = [];
  wb.worksheets.forEach((ws) => {
    const empresa = EMPRESAS[ws.name.trim().toUpperCase()];
    if (!empresa) return;
    let arba = false;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const c = (i) => row.getCell(i).value;
      const a = txt(c(1));
      if (/^ARBA/i.test(a)) { arba = true; return; }
      if (!a || /^(NRO PLAN|PLANES)/i.test(a)) return;
      const importe = num(c(6));
      if (importe == null) return;
      const plan = typeof c(1) === 'number' ? String(c(1)) : a;
      const organismo = arba || /^\d+$/.test(plan) ? 'ARBA' : 'ARCA';
      const extras = [9, 10, 11].map((i) => txt(c(i))).filter((x) => x && Number.isNaN(Number(x)));
      const obligaciones = txt(c(7));
      const actual = num(c(4)), total = num(c(2));
      let pendientes = num(c(5));
      if (pendientes == null && total != null && actual != null && !esSiOSi(c(5)) && !esSiOSi(c(7))) pendientes = Math.max(0, total - actual);
      const siosi = esSiOSi(c(2)) || esSiOSi(c(4)) || esSiOSi(c(5)) || (pendientes == null && esSiOSi(c(7)));
      const caduco = extras.some((x) => /CADUCO/i.test(x));
      const nota = caduco ? extras.join(' ').trim() : /IMPAGA/i.test(obligaciones) ? obligaciones : '';
      const banco = txt(c(8));
      if (siosi) {
        filas.push({ tipo: 'Pago SI O SI', empresa, organismo, plan, cuotas_total: null, cuota_actual: null, cuotas_pendientes: null, importe_cuota: importe,
          fecha_debito: fecha(c(3)), obligaciones: 'Pago marcado "SI O SI" en la planilla', banco_debito: '', estado: 'Vigente', nota: '' });
        return;
      }
      filas.push({ tipo: 'Plan', empresa, organismo, plan, cuotas_total: total, cuota_actual: actual, cuotas_pendientes: pendientes, importe_cuota: importe,
        fecha_debito: fecha(c(3)), obligaciones, banco_debito: banco ? titulo(banco) : '', estado: caduco ? 'Caduco' : 'Vigente', nota });
    });
  });
  return filas;
};
