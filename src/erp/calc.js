/* ---------- cálculos ---------- */
dash.calc('pl_mensual', {
  title: 'P&L mensual Shell',
  description: 'Estado de resultados por mes: 2025 desde el balance, 2026 desde litros, márgenes por litro y gastos pagados.',
  inputs: ['ventas_netas', 'volumenes', 'costos_litro', 'gastos_fijos', 'supuestos', 'balance_2025', 'deudas_bancarias'],
  fn: (ventas, volumenes, costos, gastos, supuestos, balance, deudas) => {
  const S = Object.fromEntries(supuestos.map((r) => [r.clave, Number(r.valor)]));
  const B = Object.fromEntries(balance.map((r) => [r.rubro, Number(r.ejercicio_2025)]));
  const vb = B['Ventas del ejercicio'];
  const r25 = {
    margen: B['Margen bruto'] / vb, iibb: B['Impuesto a los IIBB'] / vb, sueldos: B['Sueldos y jornales'] / vb,
    cargas: B['Cargas sociales'] / vb, energia: B['Energía'] / vb, bancarios: B['Comisiones y gastos bancarios'] / vb,
    honorarios: B['Honorarios'] / vb, amort: B['Amortizaciones'] / vb,
    opexTotal: (-B['Gastos de administración'] - B['Gastos de comercialización'] - B['Otros gastos operativos'] - B['Amortizaciones']) / vb,
    fin: B['Resultados financieros y por tenencia (incl. RECPAM)'] / vb, gan: B['Impuesto a las Ganancias'] / vb,
  };
  const PROD = ['Nafta Súper', 'V-Power Nafta', 'Evolux Diesel', 'V-Power Diesel'];
  const vol = {}; volumenes.forEach((r) => { (vol[r.mes] ??= {})[r.producto] = Number(r.volumen); });
  const vta = {}; ventas.filter((r) => r.estacion === 'Shell').forEach((r) => { vta[r.mes] = Number(r.ventas_netas); });
  // hoja de costos que rige cada mes (la última actualización del mes)
  const hoja = {}; costos.forEach((r) => { const h = (hoja[r.mes] ??= {}); if (!h[r.producto] || r.actualizado > h[r.producto].actualizado) h[r.producto] = r; });
  const ago = hoja['2026-08'];
  const gnc = {};
  const g = {}; gastos.forEach((r) => { const k = (g[r.mes] ??= {}); k[r.categoria] = (k[r.categoria] || 0) + Number(r.monto); });
  // costo del gas por m3: pagos a Camuzzi ene–oct / m3 vendidos ene–oct
  let gasPag = 0, gasM3 = 0;
  for (let m = 1; m <= 10; m++) { const k = `2026-${String(m).padStart(2, '0')}`; gasPag += g[k]?.costo_gnc || 0; gasM3 += vol[k]?.GNC || 0; }
  const costoGasM3 = gasPag / gasM3;
  const precioGncAgo = S.precio_gnc_m3;
  const d0 = B['Préstamos y deudas financieras corrientes'] + B['Préstamos y deudas financieras no corrientes'];
  const d1 = deudas.filter((r) => r.empresa.startsWith('DSB')).reduce((a, r) => a + Number(r.deuda_total), 0);
  const meses = [];
  for (let y = 2025; y <= 2026; y++) for (let m = 1; m <= 12; m++) { if (y === 2026 && m > 10) break; meses.push(`${y}-${String(m).padStart(2, '0')}`); }
  const rows = [];
  const playa = (mes) => {
    const m = Number(mes.slice(5));
    const f = m < 8 ? Math.pow(1 - S.deflactor_mensual, 8 - m) : 1;
    const h = m < 8 ? ago : hoja[mes];
    let vl = 0, ml = 0, lit = 0;
    PROD.forEach((p) => { const l = vol[mes]?.[p] || 0; lit += l; vl += l * h[p].precio_shell * f; ml += l * h[p].ganancia_litro * f; });
    const m3 = vol[mes]?.GNC || 0;
    const vg = m3 * precioGncAgo * f, mg = m3 * (precioGncAgo * f - costoGasM3);
    return { lit, m3, ventas_liq: vl / 1.21, margen_liq: ml / 1.21, ventas_gnc: vg / 1.21, margen_gnc: mg / 1.21 };
  };
  // ratio facturación / venta en playa (ene–sep 2026) para estimar octubre
  let sf = 0, sp = 0;
  meses.filter((k) => k >= '2026-01' && vta[k]).forEach((k) => { const p = playa(k); sf += vta[k]; sp += p.ventas_liq + p.ventas_gnc; });
  const ratioFact = sf / sp;
  meses.forEach((mes, i) => {
    const y = Number(mes.slice(0, 4));
    const r = { mes, anio: y, litros_liquidos: PROD.reduce((a, p) => a + (vol[mes]?.[p] || 0), 0) || null, gnc_m3: vol[mes]?.GNC || null };
    if (y === 2025) {
      const v = vta[mes];
      Object.assign(r, { base: 'Balance 2025 prorrateado', estimado: false, ventas_netas: v, ventas_playa: null, ventas_otros: null,
        margen_liquidos: null, margen_gnc: null, margen_otros: null, margen_bruto: v * r25.margen,
        sueldos: v * r25.sueldos, cargas_sociales: v * r25.cargas, energia: v * r25.energia, iibb: v * r25.iibb,
        bancarios: v * r25.bancarios, honorarios: v * r25.honorarios, servicios: null, gastos_fijos_cierre: null });
      r.otros_gastos = v * r25.opexTotal - (r.sueldos + r.cargas_sociales + r.energia + r.iibb + r.bancarios + r.honorarios);
      r.amortizaciones = v * r25.amort; r.resultado_financiero = v * r25.fin; r.ganancias_fijo = v * r25.gan;
      r.servicio_deuda = null;
    } else {
      const p = playa(mes), k = g[mes] || {};
      const est = !vta[mes];
      const v = est ? (p.ventas_liq + p.ventas_gnc) * ratioFact : vta[mes];
      const otros = v - p.ventas_liq - p.ventas_gnc;
      Object.assign(r, { base: est ? 'Estimado (volumen × precio)' : 'Bottom-up 2026', estimado: est, ventas_netas: v,
        ventas_playa: p.ventas_liq + p.ventas_gnc, ventas_otros: otros,
        margen_liquidos: p.margen_liq, margen_gnc: p.margen_gnc, margen_otros: Math.max(otros, 0) * S.margen_otros });
      r.margen_bruto = r.margen_liquidos + r.margen_gnc + r.margen_otros;
      r.cargas_sociales = k.cargas_sociales || 0;
      r.sueldos = r.cargas_sociales * S.factor_sueldos;
      r.energia = k.energia || 0;
      r.servicios = k.servicios || 0;
      r.iibb = v * S.iibb_pct;
      r.bancarios = v * S.bancarios_pct;
      r.honorarios = S.honorarios_mes;
      r.gastos_fijos_cierre = S.comisiones_shell_mes + S.limpieza_mes + S.mantenimiento_mes;
      r.otros_gastos = 0;
      r.amortizaciones = S.amortizacion_mes;
      const mi = Number(mes.slice(5));
      r.deuda_estimada = d0 + (d1 - d0) * mi / 10;
      r.resultado_financiero = -r.deuda_estimada * S.tna_deuda / 12;
      r.servicio_deuda = (k.prestamos || 0) + (k.planes_fiscales || 0);
    }
    r.cmv = r.ventas_netas - r.margen_bruto;
    r.gastos_operativos = r.sueldos + r.cargas_sociales + r.energia + (r.servicios || 0) + r.iibb + r.bancarios + r.honorarios + (r.gastos_fijos_cierre || 0) + r.otros_gastos;
    r.ebitda = r.margen_bruto - r.gastos_operativos;
    r.ebit = r.ebitda - r.amortizaciones;
    r.rai = r.ebit + r.resultado_financiero;
    r.ganancias = y === 2025 ? -r.ganancias_fijo : -Math.max(r.rai, 0) * S.tasa_ganancias;
    delete r.ganancias_fijo;
    r.resultado_neto = r.rai + r.ganancias;
    r.margen_bruto_pct = r.margen_bruto / r.ventas_netas;
    r.ebitda_pct = r.ebitda / r.ventas_netas;
    r.neto_pct = r.resultado_neto / r.ventas_netas;
    r.costo_gas_m3 = y === 2026 ? costoGasM3 : null;
    rows.push(r);
  });
  return rows;
},
});
dash.calc('pl_rangos', {
  title: 'P&L por período',
  description: 'Totales del P&L para cada combinación de mes desde / mes hasta.',
  inputs: ['pl_mensual'],
  fn: (pl) => {
  const campos = ['ventas_netas', 'ventas_playa', 'ventas_otros', 'cmv', 'margen_bruto', 'margen_liquidos', 'margen_gnc', 'margen_otros', 'sueldos', 'cargas_sociales', 'energia', 'servicios', 'iibb', 'bancarios', 'honorarios', 'gastos_fijos_cierre', 'otros_gastos', 'gastos_operativos', 'ebitda', 'amortizaciones', 'ebit', 'resultado_financiero', 'rai', 'ganancias', 'resultado_neto', 'litros_liquidos', 'gnc_m3', 'servicio_deuda'];
  const out = [];
  for (let i = 0; i < pl.length; i++) {
    const acc = Object.fromEntries(campos.map((c) => [c, 0]));
    let est = 0;
    for (let j = i; j < pl.length; j++) {
      campos.forEach((c) => { acc[c] += Number(pl[j][c]) || 0; });
      if (pl[j].estimado) est++;
      const r = { desde: pl[i].mes, hasta: pl[j].mes, meses: j - i + 1, meses_estimados: est, ...acc };
      r.margen_bruto_pct = r.margen_bruto / r.ventas_netas;
      r.gastos_operativos_pct = r.gastos_operativos / r.ventas_netas;
      r.ebitda_pct = r.ebitda / r.ventas_netas;
      r.neto_pct = r.resultado_neto / r.ventas_netas;
      r.ebitda_mensual_prom = r.ebitda / r.meses;
      campos.slice(0, 25).forEach((c) => { r['pct_' + c] = r[c] / r.ventas_netas; });
      out.push(r);
    }
  }
  return out;
},
});
dash.calc('diario_alv', {
  title: 'Cajas diarias Alvemem por estación',
  description: 'Venta de cada día de Tolosa, Olmos y Alvemem total (días con ambas), con comparación contra el promedio.',
  inputs: ['diario_alvemem'],
  fn: (dias) => {
    const campos = ['ventas_playa', 'gnc', 'tienda', 'cigarrillos', 'lubricantes', 'total', 'nafta_litros', 'nafta_pesos', 'gasoil_litros', 'gasoil_pesos', 'euro_litros', 'euro_pesos', 'gnc_m3', 'gnc_pesos'];
    const rows = dias.map((d) => ({ ...d }));
    const fechas = [...new Set(dias.map((d) => d.fecha))].sort();
    fechas.forEach((f) => {
      const t = dias.find((d) => d.unidad === 'Tolosa' && d.fecha === f), o = dias.find((d) => d.unidad === 'Olmos' && d.fecha === f);
      if (t && o) { const r = { unidad: 'Alvemem', fecha: f }; campos.forEach((c) => { r[c] = Number(t[c]) + Number(o[c]); }); rows.push(r); }
    });
    ['Tolosa', 'Olmos', 'Alvemem'].forEach((u) => {
      const rs = rows.filter((r) => r.unidad === u);
      const pt = rs.reduce((a, r) => a + Number(r.total), 0) / rs.length, pp = rs.reduce((a, r) => a + Number(r.ventas_playa), 0) / rs.length;
      rs.forEach((r) => { r.total_vs_prom = r.total / pt - 1; r.playa_vs_prom = r.ventas_playa / pp - 1; r.tienda_cig = Number(r.tienda) + Number(r.cigarrillos); });
    });
    return rows;
  },
});
dash.calc('alv_resumen', {
  title: 'Composición de la caja Alvemem',
  description: 'Suma por rubro (playa, GNC, tienda, cigarrillos, lubricantes) de las cajas diarias de cada estación.',
  inputs: ['diario_alvemem'],
  fn: (dias) => {
    const rubros = [['ventas_playa', 'Playa'], ['gnc', 'GNC'], ['tienda', 'Tienda'], ['cigarrillos', 'Cigarrillos'], ['lubricantes', 'Lubricantes']];
    const out = [];
    ['Tolosa', 'Olmos'].forEach((u) => {
      const rs = dias.filter((d) => d.unidad === u);
      rubros.forEach(([c, n]) => out.push({ unidad: u, rubro: n, monto: rs.reduce((a, r) => a + Number(r[c]), 0), dias: rs.length }));
    });
    return out;
  },
});
dash.calc('alv_litros', {
  title: 'Litros vendidos Alvemem en octubre',
  description: 'Litros (y m³ de GNC) vendidos y precio promedio por estación y producto, 1 al 15 de octubre 2026.',
  inputs: ['diario_alvemem'],
  fn: (dias) => {
    const prods = [['nafta', 'Nafta', 'L'], ['gasoil', 'Gas oil', 'L'], ['euro', 'Euro', 'L'], ['gnc', 'GNC', 'm³']];
    const out = [];
    ['Tolosa', 'Olmos'].forEach((u) => {
      const rs = dias.filter((d) => d.unidad === u && d.fecha >= '2026-10-01');
      prods.forEach(([k, n, un]) => {
        const v = rs.reduce((a, r) => a + Number(r[k === 'gnc' ? 'gnc_m3' : k + '_litros']), 0), p = rs.reduce((a, r) => a + Number(r[k + '_pesos']), 0);
        if (v > 0) out.push({ unidad: u, producto: n, unidad_medida: un, volumen: v, pesos: p, precio_promedio: p / v });
      });
    });
    return out;
  },
});
dash.calc('pl_empresas', {
  title: 'P&L mensual por empresa',
  description: 'Estado de resultados por mes de Shell, YPF, Alvemem Tolosa y Olmos, más Alvemem total y el grupo.',
  inputs: ['pl_mensual', 'ventas_netas', 'gastos_empresas', 'cajas_alvemem', 'supuestos', 'deudas_bancarias'],
  fn: (pl_shell, ventas, gastos, cajas, supuestos, deudas) => {
  const S = Object.fromEntries(supuestos.map((r) => [r.clave, Number(r.valor)]));
  // reparto Tolosa / Olmos según las cajas diarias de los días que tienen ambas
  const dias = {}; cajas.forEach((c) => { (dias[c.fecha] ??= {})[c.unidad] = Number(c.total); });
  let tt = 0, to = 0; Object.values(dias).forEach((d) => { if (d.Tolosa && d.Olmos) { tt += d.Tolosa; to += d.Olmos; } });
  const shareT = tt / (tt + to);
  const vta = {}; ventas.forEach((r) => { (vta[r.mes] ??= {})[r.estacion] = Number(r.ventas_netas); });
  const g = {}; gastos.forEach((r) => { const k = ((g[r.unidad] ??= {})[r.mes] ??= {}); k[r.categoria] = (k[r.categoria] || 0) + Number(r.monto); });
  const deuda = (pre) => deudas.filter((r) => r.empresa.startsWith(pre)).reduce((a, r) => a + Number(r.deuda_total), 0);
  const dY = deuda('Combustibles'), dA = deuda('Alvemem');
  const comunes = ['cargas_sociales', 'seguros', 'prestamos', 'planes_fiscales'];
  const rows = [];
  const fin = (r) => {
    r.gastos_operativos = r.sueldos + r.cargas_sociales + r.energia + r.servicios + r.alquiler + r.seguros + r.iibb + r.bancarios + r.otros_gastos;
    r.cmv = r.ventas_netas - r.margen_bruto;
    r.ebitda = r.margen_bruto - r.gastos_operativos;
    r.ebit = r.ebitda - r.amortizaciones;
    r.rai = r.ebit + r.resultado_financiero;
    if (r.ganancias == null) r.ganancias = -Math.max(r.rai, 0) * S.tasa_ganancias;
    r.resultado_neto = r.rai + r.ganancias;
    r.margen_bruto_pct = r.margen_bruto / r.ventas_netas; r.ebitda_pct = r.ebitda / r.ventas_netas; r.neto_pct = r.resultado_neto / r.ventas_netas;
    rows.push(r);
  };
  pl_shell.forEach((p) => fin({ empresa: 'shell', mes: p.mes, estimado: p.estimado, ventas_netas: p.ventas_netas, margen_bruto: p.margen_bruto,
    sueldos: p.sueldos, cargas_sociales: p.cargas_sociales, energia: p.energia, servicios: p.servicios || 0, alquiler: 0, seguros: 0,
    iibb: p.iibb, bancarios: p.bancarios, otros_gastos: p.honorarios + (p.gastos_fijos_cierre || 0) + (p.otros_gastos || 0),
    amortizaciones: p.amortizaciones, resultado_financiero: p.resultado_financiero, ganancias: p.ganancias, servicio_deuda: p.servicio_deuda || 0 }));
  const nueva = (empresa, mes, v, margen, k, comun, part, d) => {
    const c = (cat) => (k[cat] || 0) + (comun[cat] || 0) * part;
    fin({ empresa, mes, estimado: false, ventas_netas: v, margen_bruto: v * margen,
      sueldos: c('cargas_sociales') * S.factor_sueldos, cargas_sociales: c('cargas_sociales'), energia: k.energia || 0,
      servicios: k.servicios || 0, alquiler: k.alquiler || 0, seguros: c('seguros'), iibb: v * S.iibb_pct, bancarios: v * S.bancarios_pct,
      otros_gastos: 0, amortizaciones: 0, resultado_financiero: -d * part * S.tna_deuda / 12, ganancias: null,
      servicio_deuda: c('prestamos') + c('planes_fiscales') });
  };
  Object.keys(vta).sort().filter((m) => m >= '2026-01').forEach((mes) => {
    if (vta[mes].YPF) nueva('ypf', mes, vta[mes].YPF, S.margen_bruto_ypf, g.YPF?.[mes] || {}, g.YPF?.[mes] || {}, 0, dY);
    if (vta[mes].Alvemem) {
      const kt = g.Tolosa?.[mes] || {}, ko = g.Olmos?.[mes] || {};
      const com = Object.fromEntries(comunes.map((c) => [c, kt[c] || 0]));
      const ktSitio = { ...kt }; comunes.forEach((c) => delete ktSitio[c]);
      nueva('tolosa', mes, vta[mes].Alvemem * shareT, S.margen_bruto_alvemem, ktSitio, com, shareT, dA);
      nueva('olmos', mes, vta[mes].Alvemem * (1 - shareT), S.margen_bruto_alvemem, ko, com, 1 - shareT, dA);
    }
  });
  // la deuda e intereses de YPF van completos a YPF
  rows.filter((r) => r.empresa === 'ypf').forEach((r) => { r.resultado_financiero = -dY * S.tna_deuda / 12; r.rai = r.ebit + r.resultado_financiero; r.ganancias = -Math.max(r.rai, 0) * S.tasa_ganancias; r.resultado_neto = r.rai + r.ganancias; r.neto_pct = r.resultado_neto / r.ventas_netas; });
  const campos = ['ventas_netas', 'cmv', 'margen_bruto', 'sueldos', 'cargas_sociales', 'energia', 'servicios', 'alquiler', 'seguros', 'iibb', 'bancarios', 'otros_gastos', 'gastos_operativos', 'ebitda', 'amortizaciones', 'ebit', 'resultado_financiero', 'rai', 'ganancias', 'resultado_neto', 'servicio_deuda'];
  const agregar = (nombre, emps) => {
    const meses = [...new Set(rows.filter((r) => emps.includes(r.empresa)).map((r) => r.mes))].sort();
    meses.forEach((mes) => {
      const rs = rows.filter((r) => emps.includes(r.empresa) && r.mes === mes);
      const o = { empresa: nombre, mes, estimado: rs.some((r) => r.estimado), empresas_con_datos: rs.length };
      campos.forEach((c) => { o[c] = rs.reduce((a, r) => a + (Number(r[c]) || 0), 0); });
      o.margen_bruto_pct = o.margen_bruto / o.ventas_netas; o.ebitda_pct = o.ebitda / o.ventas_netas; o.neto_pct = o.resultado_neto / o.ventas_netas;
      rows.push(o);
    });
  };
  const base = rows.length;
  agregar('alvemem', ['tolosa', 'olmos']);
  agregar('grupo', ['shell', 'ypf', 'tolosa', 'olmos']);
  rows.forEach((r) => { r.participacion_tolosa = shareT; r.empresas_con_datos ??= 1; });
  return rows;
},
});
dash.calc('pl_empresas_rangos', {
  title: 'P&L por empresa y período',
  description: 'Totales del P&L de cada empresa para cada combinación de mes desde / mes hasta.',
  inputs: ['pl_empresas'],
  fn: (ple) => {
  const campos = ['ventas_netas', 'cmv', 'margen_bruto', 'sueldos', 'cargas_sociales', 'energia', 'servicios', 'alquiler', 'seguros', 'iibb', 'bancarios', 'otros_gastos', 'gastos_operativos', 'ebitda', 'amortizaciones', 'ebit', 'resultado_financiero', 'rai', 'ganancias', 'resultado_neto', 'servicio_deuda'];
  const meses = [];
  for (let y = 2025; y <= 2026; y++) for (let m = 1; m <= 12; m++) { if (y === 2026 && m > 10) break; meses.push(`${y}-${String(m).padStart(2, '0')}`); }
  const by = {}; ple.forEach((r) => { (by[r.empresa] ??= {})[r.mes] = r; });
  const out = [];
  Object.keys(by).forEach((emp) => {
    for (let i = 0; i < meses.length; i++) {
      const acc = Object.fromEntries(campos.map((c) => [c, 0]));
      let n = 0, est = 0, desdeDatos = null, hastaDatos = null;
      for (let j = i; j < meses.length; j++) {
        const r = by[emp][meses[j]];
        if (r) { n++; if (r.estimado) est++; campos.forEach((c) => { acc[c] += Number(r[c]) || 0; }); desdeDatos ??= meses[j]; hastaDatos = meses[j]; }
        const o = { empresa: emp, desde: meses[i], hasta: meses[j], meses_con_datos: n, meses_estimados: est, primer_mes_con_datos: desdeDatos, ultimo_mes_con_datos: hastaDatos, ...acc };
        campos.forEach((c) => { o['pct_' + c] = n ? o[c] / o.ventas_netas : null; });
        o.personal = o.sueldos + o.cargas_sociales;
        o.pct_personal = o.ventas_netas ? o.personal / o.ventas_netas : null;
        o.estructura = o.energia + o.servicios + o.alquiler + o.seguros;
        o.comerciales = o.iibb + o.bancarios;
        out.push(o);
      }
    }
  });
  return out;
},
});
dash.calc('roi', {
  title: 'ROI de la remodelación por escenario',
  description: 'Flujo, recupero, VAN y TIR según el aumento de ventas, con los supuestos de la propuesta técnico-económica.',
  inputs: ['supuestos_propuesta', 'inversion_rubros'],
  fn: (supuestos, rubros) => {
  const S = Object.fromEntries(supuestos.map((r) => [r.clave, Number(r.valor)]));
  const vb = S.ventas_base, g = S.tasa_ganancias, r = S.tasa_descuento, H = S.horizonte_anios;
  // margen de contribución sobre ventas incrementales (los costos operativos quedan fijos)
  const mc = S.part_liquidos * S.margen_liquidos + (1 - S.part_liquidos) * (S.reparto_gnc * S.margen_gnc + (1 - S.reparto_gnc) * S.margen_tienda);
  const ebitdaActual = vb * (mc - S.opex_pct);
  const anu = Array.from({ length: H }, (_, k) => 1 / Math.pow(1 + r, k + 1)).reduce((a, b) => a + b, 0);
  const desc5 = 1 / Math.pow(1 + r, H);
  const calc = (u, inv) => {
    const amort = inv / S.amort_anios;
    const d = u * vb * mc;
    const flujo = d - g * (d - amort);
    const van = (res) => -inv + flujo * anu + res * inv * desc5;
    const tir = (res) => { let lo = -0.9, hi = 3; for (let k = 0; k < 100; k++) { const m = (lo + hi) / 2; const v = -inv + Array.from({ length: H }, (_, j) => flujo / Math.pow(1 + m, j + 1)).reduce((a, b) => a + b, 0) + res * inv / Math.pow(1 + m, H); if (v > 0) lo = m; else hi = m; } return (lo + hi) / 2; };
    return { d, flujo, van, tir };
  };
  const inv = S.inversion_total;
  const uDeFlujo = (f) => (f - g * inv / S.amort_anios) / (1 - g) / (vb * mc);
  const uBase = uDeFlujo((inv + S.acumulado_base_y5) / H);
  const uOpt = uDeFlujo((S.van_optimista + inv - S.residual_base * inv * desc5) / anu);
  const uEq = uDeFlujo((inv - S.residual_base * inv * desc5) / anu);
  const esc = [
    ['20', '+20% de ventas', 0.20],
    ['base', 'Base de la propuesta', uBase],
    ['equilibrio', 'VAN = 0 (residual 15%)', uEq],
    ['optimista', 'Optimista de la propuesta', uOpt],
  ];
  return esc.map(([id, etiqueta, u]) => {
    const c = calc(u, inv), cc = calc(u, inv * (1 + S.ajuste_cac));
    return { escenario: id, etiqueta, aumento_ventas: u, ventas_incrementales: u * vb, inversion: inv,
      margen_contribucion: mc, ebitda_actual: ebitdaActual, ebitda_incremental: c.d, flujo_anual: c.flujo,
      payback_anios: inv / c.flujo, acumulado_5: c.flujo * H - inv, roi_acumulado: (c.flujo * H - inv) / inv,
      van_res15: c.van(S.residual_base), van_res50: c.van(S.residual_alt), tir_res15: c.tir(S.residual_base),
      van_res15_cac: cc.van(S.residual_base) };
  });
},
});
dash.calc('roi_flujos', {
  title: 'Flujo acumulado de la remodelación',
  description: 'Flujo por año y acumulado para cada escenario, sin valor residual.',
  inputs: ['roi', 'supuestos_propuesta'],
  fn: (roi, supuestos) => {
  const H = Number(supuestos.find((r) => r.clave === 'horizonte_anios').valor);
  const out = [];
  roi.forEach((e) => { for (let k = 0; k <= H; k++) out.push({ escenario: e.escenario, etiqueta: e.etiqueta, anio: k, flujo: k === 0 ? -e.inversion : e.flujo_anual, acumulado: -e.inversion + k * e.flujo_anual }); });
  return out;
},
});
dash.calc('grupo_rangos', {
  title: 'Ventas del grupo por período',
  description: 'Ventas netas de Shell, YPF y Alvemem sumadas para cada período.',
  inputs: ['ventas_netas'],
  fn: (ventas) => {
  const meses = [...new Set(ventas.map((r) => r.mes))].sort();
  meses.push('2026-10');
  const by = {}; ventas.forEach((r) => { (by[r.mes] ??= {})[r.estacion] = Number(r.ventas_netas); });
  const out = [];
  for (let i = 0; i < meses.length; i++) {
    let s = 0, y = 0, a = 0;
    for (let j = i; j < meses.length; j++) {
      s += by[meses[j]]?.Shell || 0; y += by[meses[j]]?.YPF || 0; a += by[meses[j]]?.Alvemem || 0;
      const t = s + y + a;
      out.push({ desde: meses[i], hasta: meses[j], shell: s, ypf: y, alvemem: a, total: t, shell_pct: t ? s / t : null });
    }
  }
  return out;
},
});
dash.calc('balance_kpis', {
  title: 'Indicadores del balance 2025',
  description: 'ROE, ROA, liquidez, endeudamiento y deuda bancaria actual.',
  inputs: ['balance_2025', 'deudas_bancarias'],
  fn: (balance, deudas) => {
  const B = Object.fromEntries(balance.map((r) => [r.rubro, [Number(r.ejercicio_2025), Number(r.ejercicio_2024)]]));
  const pn = B['Patrimonio neto'], at = B['Activo total'];
  const dShell = deudas.filter((r) => r.empresa.startsWith('DSB')).reduce((a, r) => a + Number(r.deuda_total), 0);
  const dGrupo = deudas.reduce((a, r) => a + Number(r.deuda_total), 0);
  const califShell = deudas.filter((r) => r.empresa.startsWith('DSB')).reduce((a, r) => a + Number(r.calificacion), 0);
  return [{ roe: B['Resultado final'][0] / ((pn[0] + pn[1]) / 2), roa: B['Resultado final'][0] / at[0],
    liquidez_corriente: B['Activo corriente'][0] / B['Pasivo corriente'][0], endeudamiento: B['Pasivo total'][0] / pn[0],
    margen_neto: B['Resultado final'][0] / B['Ventas del ejercicio'][0], margen_bruto: B['Margen bruto'][0] / B['Ventas del ejercicio'][0],
    deuda_financiera_balance: B['Préstamos y deudas financieras corrientes'][0] + B['Préstamos y deudas financieras no corrientes'][0],
    deuda_bancaria_shell: dShell, deuda_bancaria_grupo: dGrupo, calificacion_shell: califShell, uso_calificacion: dShell / califShell }];
},
});
dash.calc('diario', {
  title: 'Ventas diarias septiembre 2026',
  description: 'Venta de cada día por producto y comparación con el promedio diario del mes.',
  inputs: ['ventas_diarias'],
  fn: (dias) => {
    const prom = (c) => dias.reduce((a, d) => a + Number(d[c]), 0) / dias.length;
    const pt = prom('total_pesos'), pl = prom('liquidos_litros'), pg = prom('gnc_m3');
    return dias.map((d) => ({ ...d,
      super_pesos: d.super_litros * d.precio_super, vpn_pesos: d.vpn_litros * d.precio_vpn,
      evolux_pesos: d.evolux_litros * d.precio_evolux, vpd_pesos: d.vpd_litros * d.precio_vpd,
      precio_gnc: d.gnc_m3 ? d.gnc_pesos / d.gnc_m3 : null,
      total_vs_prom: d.total_pesos / pt - 1, liquidos_vs_prom: d.liquidos_litros / pl - 1, gnc_vs_prom: d.gnc_m3 / pg - 1 }));
  },
});

/* ---------- utilidades compartidas ---------- */
(() => {
  const root = document.querySelector('.sp');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const nf = (d) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: d, minimumFractionDigits: d });
  const U = {
    mes: (k) => `${MESES[Number(k.slice(5)) - 1]}-${k.slice(2, 4)}`,
    mesLargo: (k) => `${MESES[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`,
    m: (v) => v == null || isNaN(v) ? '—' : `${v < 0 ? '−' : ''}$ ${Math.abs(v) >= 1e9 ? `${nf(2).format(Math.abs(v) / 1e9)} mil M` : `${nf(1).format(Math.abs(v) / 1e6)} M`}`,
    p: (v) => v == null || isNaN(v) ? '—' : `${nf(1).format(v * 100)}%`,
    n: (v) => v == null || isNaN(v) ? '—' : nf(0).format(v),
    $: (v) => v == null || isNaN(v) ? '—' : `$ ${nf(0).format(v)}`,
    x: (v) => v == null || isNaN(v) ? '—' : `${nf(2).format(v)}×`,
    a: (v) => v == null || isNaN(v) ? '—' : `${nf(1).format(v)} años`,
    d: (v) => v == null || isNaN(v) ? '—' : `${v >= 0 ? '+' : ''}${nf(1).format(v * 100)}%`,
    'p+': (v) => v == null || isNaN(v) ? '—' : `+${nf(1).format(v * 100)}%`,
    rango: () => {
      const p = dash.params();
      let a = (p.fecha_desde || '').slice(0, 7) || p.desde || '2026-01', b = (p.fecha_hasta || '').slice(0, 7) || p.hasta || '2026-12';
      if (a > b) [a, b] = [b, a];
      const MIN = '2025-01', MAX = '2026-10';
      const c = (m) => (m < MIN ? MIN : m > MAX ? MAX : m);
      return [c(a), c(b)];
    },
    where: (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'),
    tip: (box) => {
      let t = box.querySelector('.sp-tip');
      if (!t) { t = document.createElement('div'); t.className = 'sp-tip'; t.hidden = true; box.appendChild(t); }
      return {
        show: (ev, lines) => {
          t.replaceChildren(...lines.map((l, i) => { const d = document.createElement('div'); d.textContent = l; if (i === 0) d.style.fontWeight = '500'; return d; }));
          t.hidden = false;
          const r = box.getBoundingClientRect();
          const x = ev.clientX - r.left, y = ev.clientY - r.top;
          const w = t.offsetWidth, h = t.offsetHeight;
          t.style.left = `${Math.max(0, Math.min(x + 12, r.width - w))}px`;
          t.style.top = `${Math.max(0, y - h - 10)}px`;
        },
        hide: () => { t.hidden = true; },
      };
    },
    status: (el, ...ids) => {
      const st = ids.map((id) => dash.data(id).status);
      if (st.every((s) => s === 'ok')) return true;
      if (st.some((s) => s === 'error')) { el.replaceChildren(Object.assign(document.createElement('p'), { className: 'sp-note', textContent: 'No se pudo cargar.' })); }
      else el.replaceChildren();
      return false;
    },
    axisStyle: (g) => { g.selectAll('path,line').style('stroke', 'var(--cds-chart-axis)'); g.selectAll('text').style('fill', 'var(--cds-text-secondary)').style('font-size', '11px').style('font-family', 'var(--sp-font)'); },
    ejeM: (v) => Math.abs(v) >= 1e9 ? `${nf(1).format(v / 1e9)} mil M` : `${nf(0).format(v / 1e6)} M`,
  };
  window.SP = U;
})();


/* ---------- registros cargados en el tablero ---------- */
window.SP_HOY = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
window.SP_MAS_DIAS = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };

dash.calc('deuda_resumen', {
  title: 'Deuda bancaria por empresa',
  description: 'Suma la deuda y la calificación de cada banco por empresa y para el grupo; uso = deuda / calificación.',
  inputs: ['deudas_bancarias'],
  fn: (deudas) => {
    const g = d3.rollups(deudas, (v) => ({ deuda_total: d3.sum(v, (r) => Number(r.deuda_total) || 0), calificacion: d3.sum(v, (r) => Number(r.calificacion) || 0) }), (r) => r.empresa);
    const rows = g.map(([empresa, o]) => ({ empresa, ...o }));
    rows.push({ empresa: 'Grupo', deuda_total: d3.sum(rows, (r) => r.deuda_total), calificacion: d3.sum(rows, (r) => r.calificacion) });
    return rows.map((r) => ({ ...r, disponible: r.calificacion - r.deuda_total, uso: r.calificacion ? r.deuda_total / r.calificacion : null }));
  },
});

dash.calc('ctas_resumen', {
  title: 'Cuentas por cobrar y por pagar',
  description: 'Suma los comprobantes cargados que no están saldados; vencido = con vencimiento anterior a hoy.',
  inputs: ['cuentas'],
  fn: (cuentas) => {
    const hoy = window.SP_HOY();
    return ['Cobrar', 'Pagar'].map((tipo) => {
      const v = cuentas.filter((r) => r.tipo === tipo && r.estado !== 'Saldado');
      return { tipo, pendiente: d3.sum(v, (r) => Number(r.monto) || 0), vencido: d3.sum(v.filter((r) => (r.vencimiento || '') < hoy), (r) => Number(r.monto) || 0), n: v.length };
    });
  },
});

dash.calc('alertas', {
  title: 'Alertas',
  description: 'Bancos con más del 85% de la calificación usada, empresas con EBITDA negativo en el período elegido, cheques que debitan en 7 días o vencidos sin confirmar, planes de pago caducos, débitos de planes y préstamos de los próximos 30 días, y vencimientos, comprobantes, VTV y seguros cargados.',
  inputs: ['deudas_bancarias', 'pl_empresas_rangos', 'vencimientos', 'cuentas', 'flota', 'cheques_todos', 'planes_pago', 'lineas_bancarias'],
  fn: (deudas, rangos, venc, cuentas, flota, cheques, planes, lineas) => {
    const hoy = window.SP_HOY(), lim = window.SP_MAS_DIAS(hoy, 30);
    const f = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    const out = [];
    const fecha = (modulo, iso, texto, extra) => {
      if (!iso || iso > lim) return;
      out.push({ nivel: iso < hoy ? 'alta' : 'media', modulo, fecha: iso, texto: `${texto} · ${iso < hoy ? 'venció el' : 'vence el'} ${f(iso)}${extra || ''}` });
    };
    venc.filter((r) => r.estado !== 'Cumplido').forEach((r) => fecha('Vencimientos', r.fecha, `${r.titulo} (${r.estacion || 'Grupo'})`));
    cuentas.filter((r) => r.estado !== 'Saldado').forEach((r) => fecha(r.tipo === 'Cobrar' ? 'Por cobrar' : 'Por pagar', r.vencimiento, `${r.tercero} ${r.comprobante || ''}`.trim()));
    flota.forEach((r) => { fecha('Flota', r.vto_vtv, `VTV ${r.dominio}`); fecha('Flota', r.vto_seguro, `Seguro ${r.dominio}`); });
    deudas.forEach((r) => {
      const c = Number(r.calificacion) || 0, d = Number(r.deuda_total) || 0;
      if (c > 0 && d / c > 0.85) out.push({ nivel: d > c ? 'alta' : 'media', modulo: 'Deuda', fecha: '', texto: `${r.empresa} usa el ${Math.round(d / c * 100)}% de su calificación en ${r.banco}` });
    });
    const [a, b] = SP.rango();
    const nombres = { shell: 'Shell', ypf: 'YPF', tolosa: 'Alvemem Tolosa', olmos: 'Alvemem Olmos' };
    (Array.isArray(rangos) ? rangos : []).filter((r) => nombres[r.empresa] && r.desde === a && r.hasta === b && r.meses_con_datos > 0 && r.ebitda < 0)
      .forEach((r) => out.push({ nivel: 'alta', modulo: 'Rentabilidad', fecha: '', texto: `${nombres[r.empresa]} tiene EBITDA negativo en el período elegido` }));
    const m = (v) => window.SP.m(v);
    const ch = (Array.isArray(cheques) ? cheques : []).filter((r) => r.direccion !== 'Recibido' && ['Emitido', 'Entregado'].includes(r.estado));
    ch.filter((r) => r.fecha_debito < hoy).forEach((r) => out.push({ nivel: 'alta', modulo: 'Cheques', fecha: r.fecha_debito, texto: `${r.id} ${r.empresa} a ${r.beneficiario}: ${m(r.importe)} · debitó el ${f(r.fecha_debito)}, confirmar el pago` }));
    const lim7 = window.SP_MAS_DIAS(hoy, 7);
    ch.filter((r) => r.fecha_debito >= hoy && r.fecha_debito <= lim7).forEach((r) => out.push({ nivel: 'media', modulo: 'Cheques', fecha: r.fecha_debito, texto: `${r.empresa} · ${r.banco}: ${m(r.importe)} a ${r.beneficiario} · debita el ${f(r.fecha_debito)}` }));
    const pl = Array.isArray(planes) ? planes : [];
    pl.filter((r) => r.tipo === 'Plan' && r.estado === 'Caduco').forEach((r) => out.push({ nivel: 'alta', modulo: 'Planes', fecha: '', texto: `${r.empresa}: plan ${r.organismo} ${r.plan} caduco${r.nota.replace(/caduco/i, '').trim() ? ': ' + r.nota.replace(/caduco/i, '').trim().toLowerCase() : ''}` }));
    pl.filter((r) => r.tipo !== 'Plan').forEach((r) => fecha('Planes', r.fecha_debito, `${r.empresa}: pago "sí o sí" plan ${r.plan} por ${m(r.importe_cuota)}`));
    const prox = {};
    pl.filter((r) => r.tipo === 'Plan' && r.estado !== 'Caduco' && r.cuotas_pendientes > 0 && r.fecha_debito).forEach((r) => {
      const n = window.SP_PROX_DEBITO(r.fecha_debito, hoy);
      if (n > lim) return;
      const o = (prox[r.empresa] ??= { total: 0, n: 0, fecha: n });
      o.total += r.importe_cuota; o.n += 1; if (n < o.fecha) o.fecha = n;
    });
    Object.entries(prox).forEach(([e, o]) => out.push({ nivel: 'media', modulo: 'Planes', fecha: o.fecha, texto: `${e}: ${o.n} cuotas de planes por ${m(o.total)} en los próximos 30 días (primera el ${f(o.fecha)})` }));
    (Array.isArray(lineas) ? lineas : []).filter((r) => r.vencimiento).forEach((r) => fecha('Préstamos', r.vencimiento, `${r.empresa} · ${r.banco}: ${r.linea} por ${m(r.saldo)}`));
    const orden = { alta: 0, media: 1 };
    return out.sort((p, q) => (orden[p.nivel] - orden[q.nivel]) || (p.fecha || '9').localeCompare(q.fecha || '9'));
  },
});

window.SP_PROX_DEBITO = (iso, hoy) => {
  let [y, mo, d] = iso.split('-').map(Number);
  let s = iso;
  while (s < hoy) { mo += 1; if (mo > 12) { mo = 1; y += 1; } const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate(); s = `${y}-${String(mo).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`; }
  return s;
};
const SP_EMP_CH = { shell: ['Shell (DSB)'], ypf: ['YPF (Comb. Magdalena)'], alvemem: ['Alvemem'], tolosa: ['Alvemem'], olmos: ['Alvemem'] };
window.SP_EMP_CH = SP_EMP_CH;

dash.calc('cheques_resumen', {
  title: 'Cheques emitidos: resumen',
  description: 'Comprometido = todos menos anulados y reemplazados; pendiente = estado Emitido; próximos 7 días y vencidos según la fecha de débito estimada contra hoy. Filtra por la empresa elegida.',
  inputs: ['cheques_todos'],
  fn: (cheques) => {
    cheques = cheques.filter((r) => r.direccion !== 'Recibido' && r.estado !== 'Planificado');
    const emp = dash.params().emp || 'shell';
    const hoy = window.SP_HOY(), lim7 = window.SP_MAS_DIAS(hoy, 7);
    const v = cheques.filter((r) => !SP_EMP_CH[emp] || SP_EMP_CH[emp].includes(r.empresa));
    const pend = v.filter((r) => ['Emitido', 'Entregado'].includes(r.estado));
    const s = (a) => d3.sum(a, (r) => Number(r.importe) || 0);
    return [{
      comprometido: s(v.filter((r) => !['Anulado', 'Reemplazado'].includes(r.estado))),
      pendiente: s(pend), n_pendientes: pend.length,
      debitado: s(v.filter((r) => r.estado === 'Debitado / Pagado')),
      rechazado: s(v.filter((r) => r.estado === 'Rechazado')),
      proximos_7: s(pend.filter((r) => r.fecha_debito >= hoy && r.fecha_debito <= lim7)), n_proximos_7: pend.filter((r) => r.fecha_debito >= hoy && r.fecha_debito <= lim7).length,
      vencidos: s(pend.filter((r) => r.fecha_debito < hoy)), n_vencidos: pend.filter((r) => r.fecha_debito < hoy).length,
    }];
  },
});

dash.calc('cheques_semana', {
  title: 'Cheques pendientes por semana',
  description: 'Importe de los cheques en estado Emitido por semana (lunes) de débito estimado y empresa emisora.',
  inputs: ['cheques_todos'],
  fn: (cheques) => {
    const lunes = (iso) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
    const out = {};
    cheques.filter((r) => r.direccion !== 'Recibido' && ['Emitido', 'Entregado'].includes(r.estado) && r.fecha_debito).forEach((r) => {
      const k = lunes(r.fecha_debito);
      const o = (out[k] ??= { semana: k, 'Shell (DSB)': 0, 'YPF (Comb. Magdalena)': 0, Alvemem: 0, total: 0, cheques: 0 });
      if (r.empresa in o) o[r.empresa] += Number(r.importe); o.total += Number(r.importe); o.cheques += 1;
    });
    return Object.values(out).sort((a, b) => a.semana.localeCompare(b.semana));
  },
});

dash.calc('planes_resumen', {
  title: 'Planes de pago ARCA y ARBA por empresa',
  description: 'Cuota mensual = suma de la cuota de los planes vigentes con cuotas pendientes; saldo nominal = cuotas pendientes × cuota, sin intereses futuros. Los pagos "sí o sí" se cuentan aparte.',
  inputs: ['planes_pago'],
  fn: (planes) => {
    const g = {};
    const add = (e, r) => {
      const o = (g[e] ??= { empresa: e, planes: 0, caducos: 0, cuota_mensual: 0, saldo_nominal: 0, pagos_puntuales: 0 });
      if (r.tipo !== 'Plan') { o.pagos_puntuales += r.importe_cuota; return; }
      o.planes += 1;
      if (r.estado === 'Caduco') o.caducos += 1;
      if (r.cuotas_pendientes > 0) { o.saldo_nominal += r.cuotas_pendientes * r.importe_cuota; if (r.estado !== 'Caduco') o.cuota_mensual += r.importe_cuota; }
    };
    planes.forEach((r) => { add(r.empresa, r); add('Total', r); });
    return Object.values(g);
  },
});

dash.calc('deuda_situacion', {
  title: 'Situación bancaria por empresa',
  description: 'De la planilla Situación: saldo usado de acuerdos y valores negociados, saldo de préstamos y suma de las cuotas mensuales informadas.',
  inputs: ['lineas_bancarias'],
  fn: (lineas) => {
    const g = {};
    const add = (e, r) => {
      const o = (g[e] ??= { empresa: e, calificacion_lineas: 0, saldo_lineas: 0, saldo_prestamos: 0, cuota_prestamos: 0, total: 0 });
      if (r.tipo === 'Línea') { o.calificacion_lineas += r.calificacion || 0; o.saldo_lineas += r.saldo || 0; } else { o.saldo_prestamos += r.saldo || 0; o.cuota_prestamos += r.cuota || 0; }
      o.total = o.saldo_lineas + o.saldo_prestamos;
    };
    lineas.forEach((r) => { add(r.empresa, r); add('Grupo', r); });
    return Object.values(g);
  },
});

/* ================= ampliación: sistema de gestión ================= */
window.ERP_CFG_DEF = {
  amarillo_dias: 7, alta_dias: 2, cumple_dias: [7, 3, 1, 0], cheque_dias: [7, 3, 1],
  eventos: {
    cumple: { activo: true, prioridad: 'Automática', destinatarios: ['Administración', 'Recursos Humanos', 'Gerencia'], obligatoria: false },
    cheques: { activo: true, prioridad: 'Automática', destinatarios: ['Finanzas', 'Gerencia'], obligatoria: true },
    venc: { activo: true, prioridad: 'Automática', destinatarios: ['Administración', 'Gerencia'], obligatoria: true },
    cuentas: { activo: true, prioridad: 'Automática', destinatarios: ['Finanzas', 'Administración'], obligatoria: false },
    planes: { activo: true, prioridad: 'Automática', destinatarios: ['Finanzas', 'Gerencia'], obligatoria: true },
    prestamos: { activo: true, prioridad: 'Automática', destinatarios: ['Finanzas', 'Gerencia'], obligatoria: true },
    deuda: { activo: true, prioridad: 'Automática', destinatarios: ['Finanzas', 'Gerencia'], obligatoria: false },
    rentabilidad: { activo: true, prioridad: 'Automática', destinatarios: ['Gerencia'], obligatoria: false },
    flota: { activo: true, prioridad: 'Automática', destinatarios: ['Operaciones', 'Administración'], obligatoria: false },
    mant: { activo: true, prioridad: 'Automática', destinatarios: ['Operaciones'], obligatoria: false },
    ordenes: { activo: true, prioridad: 'Automática', destinatarios: ['Operaciones', 'Gerencia'], obligatoria: false },
    compras: { activo: true, prioridad: 'Automática', destinatarios: ['Administración', 'Finanzas'], obligatoria: false },
  },
};
window.ERP_CFG = (config) => {
  const d = window.ERP_CFG_DEF;
  const doc = (Array.isArray(config) ? config : []).find((r) => r.id === 'avisos') || {};
  const ev = {};
  Object.keys(d.eventos).forEach((k) => { ev[k] = { ...d.eventos[k], ...((doc.eventos || {})[k] || {}) }; });
  const num = (v, def) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : def);
  const lista = (v, def) => (Array.isArray(v) ? v.map(Number).filter((x) => Number.isFinite(x)) : def);
  return { amarillo_dias: num(doc.amarillo_dias, d.amarillo_dias), alta_dias: num(doc.alta_dias, d.alta_dias), cumple_dias: lista(doc.cumple_dias, d.cumple_dias), cheque_dias: lista(doc.cheque_dias, d.cheque_dias), eventos: ev };
};
window.ERP_DIAS = (desde, hasta) => {
  const p = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(hasta) - p(desde)) / 86400000);
};
/* estado visual unificado: verde pagado, amarillo por vencer, rojo vencido, azul programado, naranja pendiente, gris anulado */
window.ERP_OK = { venc: ['Cumplido'], cuenta: ['Saldado'], orden: ['Finalizada'], compra: ['Pagada'], mant: ['Realizado'], cheque: ['Acreditado', 'Debitado / Pagado'] };
window.ERP_SIT = (fecha, estado, tipo, cfg, extra) => {
  const C = cfg || window.ERP_CFG_DEF;
  if (['Anulado', 'Anulada', 'Cancelado', 'Cancelada', 'Perdida'].includes(estado)) return { c: 'gris', t: 'ANULADO' };
  if ((window.ERP_OK[tipo] || []).includes(estado)) return { c: 'verde', t: tipo === 'venc' || tipo === 'orden' ? 'CUMPLIDO' : tipo === 'mant' ? 'REALIZADO' : (extra === 'Cobrar' || extra === 'Recibido') ? 'COBRADO' : 'PAGADO' };
  if (estado === 'Rechazado') return { c: 'rojo', t: 'RECHAZADO' };
  if (estado === 'Pendiente de gestión' || estado === 'En revisión') return { c: 'naranja', t: 'PENDIENTE' };
  if (!fecha) return { c: 'naranja', t: 'PENDIENTE' };
  const dias = window.ERP_DIAS(window.SP_HOY(), fecha);
  if (dias < 0) return { c: 'rojo', t: 'VENCIDO', dias };
  if (dias <= C.alta_dias) return { c: 'amarillo', t: dias === 0 ? 'VENCE HOY' : 'POR VENCER', alta: true, dias };
  if (dias <= C.amarillo_dias) return { c: 'amarillo', t: 'POR VENCER', dias };
  return { c: 'azul', t: 'PROGRAMADO', dias };
};

dash.calc('cheques_todos', {
  title: 'Cheques: base completa',
  description: 'Los cheques del archivo de gestión con los cambios de estado registrados en el sistema, más los cheques planificados, emitidos y recibidos cargados en el tablero.',
  inputs: ['cheques', 'cheques_reg', 'cheques_estado'],
  fn: (archivo, cargados, cambios) => {
    const ov = Object.fromEntries((cambios || []).map((r) => [r.id, r]));
    const a = (archivo || []).map((r) => {
      const o = ov[r.id] || {};
      return { ...r, ...Object.fromEntries(Object.entries(o).filter(([k]) => !['id', 'creado', 'creado_por'].includes(k))), id: r.id, origen: 'Archivo', direccion: 'Emitido', moneda: 'ARS', fecha_debito: o.fecha_pago || r.fecha_debito };
    });
    const b = (cargados || []).map((r) => ({
      ...r, origen: 'Carga', direccion: r.direccion || 'Emitido', importe: Number(r.importe) || 0, moneda: r.moneda || 'ARS',
      fecha_debito: r.fecha_pago || null, beneficiario: r.beneficiario || '(sin dato)',
    }));
    return [...a, ...b];
  },
});

const ERP_FILTRO_CH = (rows) => {
  const p = dash.params();
  const q = String(p.chq_benef || '').toLowerCase();
  return rows.filter((r) => (!p.chq_emp || r.empresa === p.chq_emp) && (!p.chq_banco || r.banco === p.chq_banco) && (!p.chq_estado || r.estado === p.chq_estado)
    && (!p.chq_dir || r.direccion === p.chq_dir) && (!q || String(r.beneficiario || '').toLowerCase().includes(q)));
};
window.ERP_FILTRO_CH = ERP_FILTRO_CH;
dash.calc('cheques_mes', {
  title: 'Resumen mensual de cheques',
  description: 'Para el mes elegido en el calendario y los filtros aplicados: cantidades e importes de cheques planificados, emitidos, pendientes y vencidos por fecha de pago.',
  inputs: ['cheques_todos'],
  fn: (todos) => {
    const mes = dash.params().cal_mes || window.SP_HOY().slice(0, 7);
    const hoy = window.SP_HOY();
    const v = ERP_FILTRO_CH(todos).filter((r) => (r.fecha_debito || '').slice(0, 7) === mes && !['Anulado'].includes(r.estado));
    const s = (a) => d3.sum(a, (r) => Number(r.importe) || 0);
    const plan = v.filter((r) => r.estado === 'Planificado');
    const emit = v.filter((r) => r.estado !== 'Planificado');
    const pend = v.filter((r) => ['Emitido', 'Entregado', 'Pendiente de cobro', 'Depositado'].includes(r.estado));
    const venc = pend.filter((r) => r.fecha_debito < hoy);
    return [{ mes, planificados_n: plan.length, planificados: s(plan), emitidos_n: emit.length, emitidos: s(emit), pendientes_n: pend.length, pendientes: s(pend), vencidos_n: venc.length, vencidos: s(venc), compromisos: s(v.filter((r) => r.direccion !== 'Recibido' && !['Acreditado', 'Debitado / Pagado', 'Rechazado'].includes(r.estado))) }];
  },
});
dash.calc('cheques_mes_banco', {
  title: 'Cheques del mes por banco',
  description: 'Importe y cantidad por banco de los cheques del mes elegido (sin anulados), con los filtros aplicados.',
  inputs: ['cheques_todos'],
  fn: (todos) => {
    const mes = dash.params().cal_mes || window.SP_HOY().slice(0, 7);
    const v = ERP_FILTRO_CH(todos).filter((r) => (r.fecha_debito || '').slice(0, 7) === mes && r.estado !== 'Anulado');
    return d3.rollups(v, (a) => ({ importe: d3.sum(a, (r) => Number(r.importe) || 0), n: a.length }), (r) => r.banco || '(sin banco)').map(([banco, o]) => ({ banco, ...o })).sort((a, b) => b.importe - a.importe);
  },
});
dash.calc('cheques_mes_dia', {
  title: 'Cheques del mes por fecha de pago',
  description: 'Importe y cantidad por día de pago de los cheques del mes elegido (sin anulados), con los filtros aplicados.',
  inputs: ['cheques_todos'],
  fn: (todos) => {
    const mes = dash.params().cal_mes || window.SP_HOY().slice(0, 7);
    const v = ERP_FILTRO_CH(todos).filter((r) => (r.fecha_debito || '').slice(0, 7) === mes && r.estado !== 'Anulado');
    return d3.rollups(v, (a) => ({ importe: d3.sum(a, (r) => Number(r.importe) || 0), n: a.length }), (r) => r.fecha_debito).map(([fecha, o]) => ({ fecha, ...o })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  },
});

dash.calc('cumpleanos', {
  title: 'Cumpleaños del personal',
  description: 'Próximo cumpleaños, días que faltan y edad que cumple cada empleado activo o de licencia, según la fecha de nacimiento del legajo.',
  inputs: ['legajos'],
  fn: (legajos) => {
    const hoy = window.SP_HOY(), y = Number(hoy.slice(0, 4));
    return (legajos || []).filter((r) => r.fecha_nac && r.estado !== 'Baja').map((r) => {
      const md = r.fecha_nac.slice(5, 10);
      const ajusta = (yy) => (md === '02-29' && !((yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0) ? `${yy}-02-28` : `${yy}-${md}`);
      let prox = ajusta(y);
      if (prox < hoy) prox = ajusta(y + 1);
      return { id: r.id, nombre: `${r.nombre || ''} ${r.apellido || ''}`.trim(), sector: r.sector || '', estacion: r.estacion || '', fecha_nac: r.fecha_nac, mes: Number(md.slice(0, 2)), dia: Number(md.slice(3, 5)), proximo: prox, dias: window.ERP_DIAS(hoy, prox), edad: Number(prox.slice(0, 4)) - Number(r.fecha_nac.slice(0, 4)) };
    }).sort((a, b) => a.dias - b.dias);
  },
});

const ERP_HASH = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'n' + (h >>> 0).toString(36); };
dash.calc('notificaciones', {
  title: 'Centro de notificaciones',
  description: 'Avisos de todos los módulos (cheques, planes, préstamos, deuda, vencimientos, cuentas, flota, órdenes, compras y cumpleaños) con su prioridad, fecha límite y estado de gestión. Los anticipos y eventos activos salen de la configuración de avisos.',
  inputs: ['alertas', 'cumpleanos', 'cheques_todos', 'config', 'notif_estado', 'ordenes_trabajo', 'ordenes_compra', 'mantenimientos'],
  fn: (alertas, cumple, cheques, config, estados, ot, oc, mant) => {
    const C = window.ERP_CFG(config), hoy = window.SP_HOY();
    const est = Object.fromEntries((estados || []).map((r) => [r.id, r]));
    const f = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
    const out = [];
    const push = (ev, n) => {
      const cfg = C.eventos[ev] || { activo: true, prioridad: 'Automática' };
      if (cfg.activo === false && !cfg.obligatoria) return;
      const id = ERP_HASH(`${ev}|${n.clave || n.titulo + n.descripcion}`);
      const e = est[id] || {};
      let estado = e.estado || 'Pendiente';
      if (estado !== 'Resuelta' && n.limite && n.limite < hoy) estado = estado === 'Pendiente' ? 'Vencida' : estado;
      out.push({ id, evento: ev, destinatarios: cfg.destinatarios || [], obligatoria: !!cfg.obligatoria, ...n, prioridad: cfg.prioridad && cfg.prioridad !== 'Automática' ? cfg.prioridad : n.prioridad, estado, gestion_fecha: e.fecha || '', gestion_usuario: e.usuario || '' });
    };
    const mapa = { Vencimientos: ['venc', 'adm-venc'], 'Por cobrar': ['cuentas', 'fin-ctas'], 'Por pagar': ['cuentas', 'fin-ctas'], Flota: ['flota', 'flota-unid'], Deuda: ['deuda', 'fin-deudas'], Rentabilidad: ['rentabilidad', 'est-comp'], Planes: ['planes', 'fin-planes'], 'Préstamos': ['prestamos', 'fin-deudas'] };
    (Array.isArray(alertas) ? alertas : []).filter((a) => a.modulo !== 'Cheques').forEach((a) => {
      const [ev, ir] = mapa[a.modulo] || ['venc', 'adm-venc'];
      const pasado = a.fecha && a.fecha < hoy;
      push(ev, { titulo: a.modulo === 'Deuda' ? 'Uso alto de la calificación bancaria' : a.modulo === 'Rentabilidad' ? 'EBITDA negativo' : `${a.modulo}: ${pasado ? 'vencido' : 'próximo vencimiento'}`, descripcion: a.texto, modulo: a.modulo, ir, fecha: a.fecha || hoy, limite: a.fecha || '', prioridad: pasado ? 'Crítica' : a.nivel === 'alta' ? 'Alta' : (a.fecha && window.ERP_DIAS(hoy, a.fecha) <= C.alta_dias ? 'Alta' : 'Media'), clave: a.texto });
    });
    const maxCh = Math.max(0, ...C.cheque_dias);
    (cheques || []).forEach((r) => {
      if (['Anulado', 'Acreditado', 'Debitado / Pagado'].includes(r.estado)) return;
      const quien = r.direccion === 'Recibido' ? `de ${r.beneficiario}` : `a ${r.beneficiario}`;
      const desc = `${r.empresa || ''} · ${r.banco || ''}: ${window.SP.m(r.importe)} ${quien}${r.numero ? ' · Nº ' + r.numero : ''}`;
      if (r.estado === 'Rechazado') { push('cheques', { titulo: 'Cheque rechazado', descripcion: desc, modulo: 'Cheques', ir: 'fin-cheques', fecha: r.fecha_debito || hoy, limite: '', prioridad: 'Alta', clave: `rech|${r.id}` }); return; }
      if (r.estado === 'Planificado') {
        const fe = r.fecha_emision || r.fecha_debito; if (!fe) return;
        const d = window.ERP_DIAS(hoy, fe);
        if (d < 0) push('cheques', { titulo: 'Cheque planificado sin emitir', descripcion: `${desc} · debía emitirse el ${f(fe)}`, modulo: 'Cheques', ir: 'fin-chcal', fecha: fe, limite: fe, prioridad: 'Alta', clave: `plan|${r.id}` });
        else if (d <= maxCh) { const etapa = Math.min(...C.cheque_dias.filter((x) => x >= d)); push('cheques', { titulo: d === 0 ? 'Emitir cheque hoy' : `Cheque a emitir en ${d} día(s)`, descripcion: desc, modulo: 'Cheques', ir: 'fin-chcal', fecha: fe, limite: fe, prioridad: d <= C.alta_dias ? 'Alta' : 'Media', clave: `plan|${r.id}|${etapa}` }); }
        return;
      }
      if (!r.fecha_debito) return;
      const d = window.ERP_DIAS(hoy, r.fecha_debito);
      const recibido = r.direccion === 'Recibido';
      if (d < 0) push('cheques', { titulo: recibido ? 'Cheque recibido sin acreditar' : 'Cheque vencido sin confirmar el débito', descripcion: `${desc} · fecha de pago ${f(r.fecha_debito)}`, modulo: 'Cheques', ir: 'fin-cheques', fecha: r.fecha_debito, limite: r.fecha_debito, prioridad: 'Crítica', clave: `venc|${r.id}` });
      else if (d <= maxCh) { const etapa = Math.min(...C.cheque_dias.filter((x) => x >= d)); push('cheques', { titulo: recibido ? `Cheque a cobrar en ${d} día(s)` : d === 0 ? 'Cheque que debita hoy' : `Cheque que debita en ${d} día(s)`, descripcion: desc, modulo: 'Cheques', ir: 'fin-chcal', fecha: r.fecha_debito, limite: r.fecha_debito, prioridad: d <= C.alta_dias ? 'Alta' : 'Media', clave: `prox|${r.id}|${etapa}` }); }
      if (r.direccion === 'Emitido' && r.estado === 'Emitido' && d >= 0 && d <= C.alta_dias) push('cheques', { titulo: 'Cheque pendiente de entrega', descripcion: desc, modulo: 'Cheques', ir: 'fin-cheques', fecha: r.fecha_debito, limite: r.fecha_debito, prioridad: 'Media', clave: `entrega|${r.id}` });
    });
    const maxCu = Math.max(0, ...C.cumple_dias);
    (cumple || []).forEach((r) => {
      if (r.dias > maxCu) return;
      const etapa = Math.min(...C.cumple_dias.filter((x) => x >= r.dias));
      push('cumple', { titulo: r.dias === 0 ? `Hoy cumple años ${r.nombre}` : r.dias === 1 ? `Mañana cumple años ${r.nombre}` : `${r.nombre} cumple años en ${r.dias} días`, descripcion: `${r.sector || 'Sin sector'}${r.estacion ? ' · ' + r.estacion : ''} · ${f(r.proximo)} · cumple ${r.edad}`, modulo: 'RRHH', ir: 'rrhh-cumple', fecha: r.proximo, limite: r.proximo, prioridad: r.dias === 0 ? 'Media' : 'Informativa', clave: `${r.id}|${r.proximo}|${etapa}` });
    });
    const venceDoc = (rows, ev, ok, campo, mod, ir, titulo, desc) => (rows || []).forEach((r) => {
      if (ok.includes(r.estado) || ['Anulado', 'Anulada', 'Cancelada'].includes(r.estado) || !r[campo]) return;
      const d = window.ERP_DIAS(hoy, r[campo]);
      if (d > C.amarillo_dias) return;
      push(ev, { titulo: `${titulo}${d < 0 ? ' vencida' : d === 0 ? ' vence hoy' : ` vence en ${d} día(s)`}`, descripcion: desc(r), modulo: mod, ir, fecha: r[campo], limite: r[campo], prioridad: d < 0 ? 'Crítica' : d <= C.alta_dias ? 'Alta' : 'Media', clave: `${r.id}|${r[campo]}` });
    });
    venceDoc(ot, 'ordenes', ['Finalizada'], 'vence', 'Operativo', 'ope-ot', 'Orden de trabajo', (r) => `${r.titulo || ''} · ${r.estacion || ''}${r.responsable ? ' · ' + r.responsable : ''}`);
    venceDoc(oc, 'compras', ['Pagada'], 'fecha_pago', 'Compras', 'compras-oc', 'Pago de orden de compra', (r) => `${r.proveedor || ''} · ${window.SP.m(Number(r.monto) || 0)}`);
    venceDoc(mant, 'mant', ['Realizado'], 'proximo', 'Flota', 'flota-mant', 'Mantenimiento', (r) => `${r.dominio || ''} · ${r.tipo || ''}${r.taller ? ' · ' + r.taller : ''}`);
    const pr = { 'Crítica': 0, Alta: 1, Media: 2, Baja: 3, Informativa: 4 };
    return out.sort((a, b) => (pr[a.prioridad] - pr[b.prioridad]) || String(a.limite || '9').localeCompare(String(b.limite || '9')));
  },
});
