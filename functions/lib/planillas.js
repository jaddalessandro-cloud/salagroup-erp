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

/**
 * Planilla "Situación": una hoja por empresa ("Bancos Shell", "Bancos YPF", "Bancos Alvemem") con bloques por banco.
 * Cada bloque: título "Banco …", tabla de líneas (Línea, Calificación, Saldo, Disponible, TNA, TEA) y
 * tabla de préstamos (Préstamos, N° cuota/Plazo, Monto, Cuota, Saldo, Tasa) hasta "Total Calificación".
 */
const EMPRESA_SIT = [[/shell|dsb/i, 'Shell (DSB)'], [/ypf|magdalena/i, 'YPF (Comb. Magdalena)'], [/alvem/i, 'Alvemem']];
export const leerSituacion = async (buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const filas = [];
  wb.worksheets.forEach((ws) => {
    if (!/^bancos/i.test(ws.name.trim())) return;
    const e = EMPRESA_SIT.find(([re]) => re.test(ws.name)); if (!e) return;
    const empresa = e[1];
    const v = (r, c) => ws.getRow(r).getCell(c).value;
    for (let r = 1; r <= ws.rowCount; r++) {
      for (let c = 1; c <= ws.columnCount; c++) {
        const t = txt(v(r, c));
        if (!/^banco\s/i.test(t) || !/^l[ií]nea$/i.test(txt(v(r + 1, c)))) continue;
        const banco = t.replace(/\s+/g, ' ').trim();
        let modo = 'linea';
        for (let k = r + 2; k <= Math.min(ws.rowCount, r + 30); k++) {
          const nombre = txt(v(k, c));
          if (/^total calificaci/i.test(nombre)) break;
          if (/^pr[eé]stamos$/i.test(nombre)) { modo = 'prestamo'; continue; }
          if (!nombre || /^total$/i.test(nombre)) continue;
          if (modo === 'linea') {
            const calificacion = num(v(k, c + 1)), saldo = num(v(k, c + 2));
            if (!calificacion && !saldo) continue;
            filas.push({ empresa, banco, tipo: 'Línea', linea: nombre, calificacion: calificacion || null, saldo: saldo || null, plazo: '', monto: null, cuota: null, tasa: null, vencimiento: null, nota: '' });
          } else {
            const pz = v(k, c + 1), monto = num(v(k, c + 2)), cuota = num(v(k, c + 3)), saldo = num(v(k, c + 4)), tasa = num(v(k, c + 5));
            if (!monto && !saldo && !cuota) continue;
            let plazo = '', vencimiento = fecha(v(k, c + 6));
            const fp = fecha(pz);
            if (fp) vencimiento = vencimiento || fp;
            else if (typeof pz === 'number') plazo = `${pz} meses`;
            else {
              plazo = txt(pz);
              const m = plazo.match(/(\d{1,2})\s*[-/]\s*(\d{1,2})\s*\/\s*(\d{4})/);
              if (m) { vencimiento = vencimiento || `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; plazo = `vence ${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`; }
            }
            filas.push({ empresa, banco, tipo: 'Préstamo', linea: nombre, calificacion: null, saldo: saldo || null, plazo, monto: monto || null, cuota: cuota || null, tasa: tasa || null, vencimiento: vencimiento || null, nota: '' });
          }
        }
      }
    }
  });
  // aviso de posibles duplicados: mismo saldo y tasa en dos bancos de la misma empresa
  filas.forEach((a, i) => filas.slice(0, i).forEach((b) => {
    if (a.tipo === 'Préstamo' && b.tipo === 'Préstamo' && a.empresa === b.empresa && a.banco !== b.banco && a.saldo && a.saldo === b.saldo && a.tasa === b.tasa) {
      a.nota = `Mismo saldo y tasa que el préstamo de ${b.banco}: posible duplicado en la planilla, a confirmar`;
    }
  }));
  return filas;
};

/**
 * Libro "Gestión de cheques emitidos": hoja Base_Cheques (una fila por cheque, encabezados en la fila 3).
 */
const EMPRESA_CH = { DSB: 'Shell (DSB)', CM: 'YPF (Comb. Magdalena)', ALVEMEM: 'Alvemem', SALA: 'Sala', 'EL CHAPERIO': 'El Chaperío' };
const habil = (iso) => { if (!iso) return null; const d = new Date(`${iso}T12:00:00Z`); const w = d.getUTCDay(); if (w === 6) d.setUTCDate(d.getUTCDate() + 2); if (w === 0) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
export const leerCheques = async (buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets.find((w) => /base_?cheques/i.test(w.name));
  if (!ws) throw new Error('no se encontró la hoja Base_Cheques');
  let cab = 0; const col = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !cab; r++) {
    const row = ws.getRow(r);
    if (/^id$/i.test(txt(row.getCell(1).value))) { cab = r; row.eachCell((cell, c) => { col[txt(cell.value).toLowerCase()] = c; }); }
  }
  if (!cab) throw new Error('no se encontró el encabezado de Base_Cheques');
  const busca = (re) => { const k = Object.keys(col).find((x) => re.test(x)); return k ? col[k] : null; };
  const C = { id: busca(/^id$/), emp: busca(/^empresa/), emision: busca(/fecha de emisi/), numero: busca(/^n[ºo°]\s*de cheque/), banco: busca(/^banco/), benef: busca(/^beneficiario$/), importe: busca(/^importe \(/), pago: busca(/fecha de pago/), tipo: busca(/^tipo de cheque/), estado: busca(/^estado registrado/), efectivo: busca(/fecha d[eé]bito efectivo/), obs: busca(/^observaciones/), estimada: busca(/d[eé]bito estimada/) };
  const filas = [];
  for (let r = cab + 1; r <= ws.rowCount; r++) {
    const g = (k) => (C[k] ? ws.getRow(r).getCell(C[k]).value : null);
    const id = txt(g('id')); const importe = num(g('importe'));
    if (!id || !importe) continue;
    const empTxt = txt(g('emp')).toUpperCase();
    const fp = fecha(g('pago'));
    filas.push({
      id, empresa: EMPRESA_CH[empTxt] || txt(g('emp')), banco: txt(g('banco')), numero: txt(g('numero')), beneficiario: txt(g('benef')) || '(sin dato)',
      importe, fecha_pago: fp, fecha_debito: fecha(g('estimada')) || habil(fp), tipo: txt(g('tipo')), estado: txt(g('estado')) || 'Emitido',
      fecha_debito_efectivo: fecha(g('efectivo')), fecha_emision: fecha(g('emision')),
      observaciones: txt(g('obs')).replace(/\[Diagn[oó]stico\]\s*/g, '').replace(/\s*;\s*/g, ' | '),
    });
  }
  return filas;
};
