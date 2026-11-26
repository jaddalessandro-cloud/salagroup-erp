/* ---------- dibujos: textos y cifras ---------- */
dash.draw('lbl_desde', (el) => { el.textContent = SP.mesLargo(SP.rango()[0]); });
dash.draw('lbl_hasta', (el) => { el.textContent = SP.mesLargo(SP.rango()[1]); });

const spFmt = (el, v) => {
  const f = SP[el.dataset.fmt || 'n'] || SP.n;
  let val = v;
  if (el.dataset.neg && v != null) val = -v;
  el.textContent = f(val);
  el.classList.toggle('sp-neg', !!el.dataset.signo && v != null && v < 0);
};
const spFila = (el, id, where, fila) => {
  el.setAttribute('data-where', SP.where(where));
  const d = dash.data(id);
  if (d.status !== 'ok' || !fila) { el.textContent = '—'; el.classList.remove('sp-neg'); return; }
  spFmt(el, fila[el.dataset.field]);
};

dash.draw('rk', (el) => {
  const [a, b] = SP.rango();
  const d = dash.data('pl_rangos');
  spFila(el, 'pl_rangos', { desde: a, hasta: b }, d.status === 'ok' ? d.data.find((r) => r.desde === a && r.hasta === b) : null);
});
dash.draw('aviso_est', (el) => {
  const [a, b] = SP.rango();
  const d = dash.data('pl_rangos');
  const r = d.status === 'ok' ? d.data.find((x) => x.desde === a && x.hasta === b) : null;
  el.textContent = r && r.meses_estimados > 0 ? 'Incluye octubre 2026, que es estimado.' : '';
});
dash.draw('gk', (el) => {
  let [a, b] = SP.rango();
  const d = dash.data('grupo_rangos');
  const rows = d.status === 'ok' ? d.data : [];
  if (a < '2025-01') a = '2025-01';
  spFila(el, 'grupo_rangos', { desde: a, hasta: b }, rows.find((r) => r.desde === a && r.hasta === b));
});
dash.draw('dk', (el) => {
  const dia = dash.params().dia || '2026-09-22';
  const d = dash.data('diario');
  spFila(el, 'diario', { fecha: dia }, d.status === 'ok' ? d.data.find((r) => r.fecha === dia) : null);
});
dash.draw('rr', (el) => {
  const e = dash.params().escenario || 'base';
  const d = dash.data('roi');
  spFila(el, 'roi', { escenario: e }, d.status === 'ok' ? d.data.find((r) => r.escenario === e) : null);
});
dash.draw('rq', (el) => {
  const d = dash.data('roi');
  const e = new URLSearchParams(el.dataset.where || '').get('escenario');
  const r = d.status === 'ok' ? d.data.find((x) => x.escenario === e) : null;
  if (!r) { el.textContent = '—'; return; }
  spFmt(el, r[el.dataset.field]);
});
dash.draw('bk', (el) => {
  el.setAttribute('data-row', '0');
  const d = dash.data('balance_kpis');
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  spFmt(el, d.data[0][el.dataset.field]);
});
dash.draw('sp', (el) => {
  const k = el.dataset.clave;
  el.setAttribute('data-field', 'valor');
  const d = dash.data('supuestos');
  spFila(el, 'supuestos', { clave: k }, d.status === 'ok' ? d.data.find((r) => r.clave === k) : null);
});
dash.draw('cuota_nacion', (el) => {
  const d = dash.data('gastos_fijos');
  const r = d.status === 'ok' ? d.data.find((x) => x.mes === '2026-12' && x.categoria === 'prestamos') : null;
  if (r) el.setAttribute('data-where', SP.where({ mes: r.mes, concepto: r.concepto }));
  el.textContent = r ? SP.m(Number(r.monto)) : '—';
});


dash.draw('ek', (el) => {
  const [a, b] = SP.rango();
  const emp = el.dataset.empresa === 'sel' ? (dash.params().emp || 'shell') : el.dataset.empresa;
  const d = dash.data('pl_empresas_rangos');
  const r = d.status === 'ok' ? d.data.find((x) => x.empresa === emp && x.desde === a && x.hasta === b) : null;
  spFila(el, 'pl_empresas_rangos', { empresa: emp, desde: a, hasta: b }, r && (r.meses_con_datos > 0 || el.dataset.field === 'meses_con_datos') ? r : null);
});
dash.draw('aviso_emp', (el) => {
  const [a, b] = SP.rango();
  const t = [];
  if (a < '2026-01') t.push('YPF y Alvemem solo tienen P&L desde enero 2026.');
  if (b >= '2026-10') t.push('Octubre 2026 es estimado para la Shell y no tiene datos de YPF ni Alvemem.');
  el.textContent = t.join(' ');
});
dash.draw('part_t', (el) => {
  const d = dash.data('pl_empresas');
  el.textContent = d.status === 'ok' && d.data.length ? SP.p(d.data[0].participacion_tolosa) : '—';
});
dash.draw('tb_empresa', (tb) => {
  const d = dash.data('pl_empresas');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  const [a, b] = SP.rango();
  const emp = dash.params().emp || 'shell';
  const cols = [['ventas_netas', 'm'], ['margen_bruto', 'm'], ['gastos_operativos', 'm'], ['ebitda', 'm'], ['ebitda_pct', 'p'], ['resultado_financiero', 'm'], ['bancarios', 'm'], ['resultado_neto', 'm'], ['neto_sin_banc', 'm'], ['servicio_deuda', 'm']];
  tb.replaceChildren(...d.data.filter((r) => r.empresa === emp && r.mes >= a && r.mes <= b).map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = `${r.empresa},${r.mes}`;
    const td0 = document.createElement('td'); td0.textContent = SP.mes(r.mes) + (r.estimado ? ' (est.)' : ''); tr.appendChild(td0);
    cols.forEach(([c, f]) => { const td = document.createElement('td'); td.textContent = c === 'bancarios' ? SP[f](-r[c]) : SP[f](r[c]); if (c === 'bancarios') td.className = 'gs-col-banc'; else if (r[c] < 0) td.classList.add('sp-neg'); tr.appendChild(td); });
    return tr;
  }));
});


const SP_NOMBRE = { shell: 'DSB Asociados (Shell)', ypf: 'Combustibles Magdalena (YPF)', alvemem: 'Alvemem (Tolosa + Olmos)', tolosa: 'Alvemem Tolosa', olmos: 'Alvemem Olmos', grupo: 'el grupo' };
const SP_UNIDAD = { tolosa: 'Tolosa', olmos: 'Olmos', alvemem: 'Alvemem' };
dash.draw('emp_nombre', (el) => { el.textContent = SP_NOMBRE[dash.params().emp || 'shell'] || '—'; });
dash.draw('ak', (el) => {
  const u = SP_UNIDAD[dash.params().emp || 'shell'];
  const f = dash.params().dia_alv || '2026-10-07';
  const d = dash.data('diario_alv');
  spFila(el, 'diario_alv', { unidad: u || '', fecha: f }, d.status === 'ok' && u ? d.data.find((r) => r.unidad === u && r.fecha === f) : null);
});
dash.draw('tb_alv_litros', (tb) => {
  const d = dash.data('alv_litros');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  const u = SP_UNIDAD[dash.params().emp || 'shell'];
  tb.replaceChildren(...d.data.filter((r) => u === 'Alvemem' || r.unidad === u).map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = `${r.unidad},${encodeURIComponent(r.producto)}`;
    [[`${r.unidad} · ${r.producto} (${r.unidad_medida})`, 't'], [r.volumen, 'n'], [r.pesos, 'm'], [r.precio_promedio, '$']].forEach(([v, f]) => { const td = document.createElement('td'); td.textContent = f === 't' ? v : SP[f](v); tr.appendChild(td); });
    return tr;
  }));
});
const spGastosVista = () => {
  const emp = dash.params().emp || 'shell';
  const unidades = emp === 'ypf' ? ['YPF'] : emp === 'tolosa' ? ['Tolosa'] : emp === 'olmos' ? ['Olmos'] : ['Tolosa', 'Olmos'];
  const [a, b] = SP.rango();
  const d = dash.data('gastos_empresas');
  const rows = d.status === 'ok' ? d.data.filter((r) => unidades.includes(r.unidad) && r.mes >= a && r.mes <= b) : [];
  const meses = [...new Set(rows.map((r) => r.mes))].sort();
  return { rows, meses, multi: unidades.length > 1 };
};
dash.draw('th_gastos', (th) => {
  const { meses, multi } = spGastosVista();
  const tr = document.createElement('tr');
  [multi ? 'Estación · concepto' : 'Concepto', ...meses.map(SP.mes)].forEach((x) => { const h = document.createElement('th'); h.textContent = x; tr.appendChild(h); });
  th.replaceChildren(tr);
});
dash.draw('tb_gastos', (tb) => {
  const { rows, meses, multi } = spGastosVista();
  const orden = ['energia', 'servicios', 'alquiler', 'seguros', 'cargas_sociales', 'iibb_pagado', 'iva', 'ganancias_anticipo', 'tarjeta', 'prestamos', 'planes_fiscales', 'costo_gnc', 'otros_excluidos'];
  const claves = [...new Map(rows.map((r) => [`${r.unidad}|${r.concepto}`, r])).values()]
    .sort((p, q) => (p.unidad.localeCompare(q.unidad)) || (orden.indexOf(p.categoria) - orden.indexOf(q.categoria)) || p.concepto.localeCompare(q.concepto));
  tb.replaceChildren(...claves.map((k) => {
    const tr = document.createElement('tr');
    const td0 = document.createElement('td'); td0.textContent = multi ? `${k.unidad} · ${k.concepto}` : k.concepto; td0.style.whiteSpace = 'normal'; td0.style.minWidth = '220px'; tr.appendChild(td0);
    meses.forEach((m) => {
      const td = document.createElement('td');
      const r = rows.find((x) => x.unidad === k.unidad && x.concepto === k.concepto && x.mes === m);
      if (r) { td.textContent = SP.m(Number(r.monto)); td.setAttribute('data-source', 'gastos_empresas'); td.setAttribute('data-field', 'monto'); td.setAttribute('data-where', SP.where({ unidad: r.unidad, mes: r.mes, concepto: r.concepto })); }
      tr.appendChild(td);
    });
    return tr;
  }));
});

/* ---------- selects ---------- */
const spSelMes = (cual) => (sel) => {
  const d = dash.data('pl_mensual');
  const meses = d.status === 'ok' ? d.data.map((r) => r.mes) : [];
  sel.replaceChildren(...meses.map((m) => new Option(SP.mesLargo(m) + (m === '2026-10' ? ' (est.)' : ''), m)));
  const [a, b] = SP.rango();
  sel.value = cual === 'desde' ? a : b;
  sel.onchange = () => {
    let [x, y] = SP.rango();
    if (cual === 'desde') x = sel.value; else y = sel.value;
    if (x > y) [x, y] = [y, x];
    dash.setParams({ desde: x, hasta: y });
  };
};
dash.draw('sel_desde', spSelMes('desde'));
dash.draw('sel_hasta', spSelMes('hasta'));
dash.draw('sel_hoja', (sel) => {
  const d = dash.data('costos_litro');
  const fechas = d.status === 'ok' ? [...new Set(d.data.map((r) => r.actualizado))].sort() : [];
  sel.replaceChildren(...fechas.map((f) => new Option(`${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`, f)));
  sel.value = dash.params().hoja || fechas[fechas.length - 1] || '';
  sel.onchange = () => dash.setParams({ hoja: sel.value });
});

/* ---------- tablas ---------- */
dash.draw('tb_mensual', (tb) => {
  const d = dash.data('pl_mensual');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  const [a, b] = SP.rango();
  const cols = [['ventas_netas', 'm'], ['margen_bruto', 'm'], ['margen_bruto_pct', 'p'], ['gastos_operativos', 'm'], ['ebitda', 'm'], ['ebitda_pct', 'p'], ['resultado_financiero', 'm'], ['bancarios', 'm'], ['resultado_neto', 'm'], ['neto_sin_banc', 'm'], ['base', 't']];
  tb.replaceChildren(...d.data.filter((r) => r.mes >= a && r.mes <= b).map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = r.mes;
    const td0 = document.createElement('td'); td0.textContent = SP.mes(r.mes); tr.appendChild(td0);
    cols.forEach(([c, f]) => {
      const td = document.createElement('td');
      td.textContent = f === 't' ? r[c] : c === 'bancarios' ? SP[f](-r[c]) : SP[f](r[c]);
      if (c === 'bancarios') td.className = 'gs-col-banc';
      else if (f !== 't' && r[c] < 0) td.classList.add('sp-neg');
      tr.appendChild(td);
    });
    return tr;
  }));
});
dash.draw('tb_costos', (tb) => {
  const d = dash.data('costos_litro');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  const fechas = [...new Set(d.data.map((r) => r.actualizado))].sort();
  const h = dash.params().hoja || fechas[fechas.length - 1];
  tb.replaceChildren(...d.data.filter((r) => r.actualizado === h).map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = `${encodeURIComponent(r.actualizado)},${encodeURIComponent(r.producto)}`;
    [[r.producto, 't'], [r.costo_total, '$'], [r.precio_shell, '$'], [r.ganancia_litro, '$'], [r.margen_pct, 'p'], [r.sugerido_shell, '$'], [r.precio_ypf, '$']].forEach(([v, f]) => {
      const td = document.createElement('td'); td.textContent = f === 't' ? v : SP[f](v); tr.appendChild(td);
    });
    return tr;
  }));
});
dash.draw('tb_roi', (tb) => {
  const d = dash.data('roi');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  tb.replaceChildren(...d.data.map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = r.escenario;
    [[r.etiqueta, 't'], [r.aumento_ventas, 'p+'], [r.flujo_anual, 'm'], [r.acumulado_5, 'm'], [r.van_res15, 'm'], [r.van_res50, 'm'], [r.tir_res15, 'p']].forEach(([v, f]) => {
      const td = document.createElement('td'); td.textContent = f === 't' ? v : SP[f](v);
      if (f !== 't' && v < 0) td.classList.add('sp-neg');
      tr.appendChild(td);
    });
    return tr;
  }));
});
dash.draw('tb_rubros', (tb) => {
  const d = dash.data('inversion_rubros');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  tb.replaceChildren(...d.data.map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = encodeURIComponent(r.rubro);
    [[r.rubro, 't'], [r.cantidad, 't'], [r.origen, 't'], [r.monto, 'm'], [r.pct_total, 'p']].forEach(([v, f]) => {
      const td = document.createElement('td'); td.textContent = f === 't' ? v : SP[f](v); tr.appendChild(td);
    });
    tr.firstChild.style.whiteSpace = 'normal';
    tr.firstChild.style.minWidth = '200px';
    return tr;
  }));
});
dash.draw('tb_balance', (tb) => {
  const d = dash.data('balance_2025');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  const tot = new Set(['Margen bruto', 'Resultado de la explotación', 'Resultado antes de Ganancias', 'Resultado final', 'Activo total', 'Pasivo total', 'Patrimonio neto']);
  tb.replaceChildren(...d.data.filter((r) => r.seccion !== 'gastos').map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = encodeURIComponent(r.rubro);
    if (tot.has(r.rubro)) tr.className = 'sp-tot';
    [[r.rubro, 't'], [r.ejercicio_2025, 'm'], [r.ejercicio_2024, 'm']].forEach(([v, f]) => {
      const td = document.createElement('td'); td.textContent = f === 't' ? v : SP[f](v);
      if (f !== 't' && v < 0) td.classList.add('sp-neg');
      tr.appendChild(td);
    });
    return tr;
  }));
});
dash.draw('tb_deuda', (tb) => {
  const d = dash.data('deudas_bancarias');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  tb.replaceChildren(...d.data.filter((r) => Number(r.deuda_total) > 0).map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = `${encodeURIComponent(r.empresa)},${encodeURIComponent(r.banco)}`;
    [[`${r.empresa.split(' (')[0]} · ${r.banco}`, 't'], [r.deuda_acc, 'm'], [r.deuda_vn, 'm'], [r.deuda_prestamos, 'm'], [r.deuda_total, 'm']].forEach(([v, f]) => {
      const td = document.createElement('td'); td.textContent = f === 't' ? v : SP[f](v); tr.appendChild(td);
    });
    return tr;
  }));
});
dash.draw('tb_supuestos', (tb) => {
  const d = dash.data('supuestos');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  tb.replaceChildren(...d.data.map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = r.clave;
    const v = Number(r.valor);
    const txt = Math.abs(v) < 1 ? SP.p(v) : (Math.abs(v) >= 1e5 ? SP.n(v) : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(v));
    [r.descripcion, txt, r.unidad, r.origen].forEach((x) => { const td = document.createElement('td'); td.textContent = x; tr.appendChild(td); });
    tr.firstChild.style.whiteSpace = 'normal';
    tr.firstChild.style.minWidth = '260px';
    return tr;
  }));
});

/* ---------- gráficos ---------- */
const spEjeX = (g, x, H, cada) => {
  const ticks = x.domain().filter((_, i) => i % cada === 0);
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(ticks).tickFormat(SP.mes).tickSizeOuter(0)).call(SP.axisStyle);
};
const spGrid = (g, y, W, fmt) => {
  const ax = g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(-W).tickFormat(fmt));
  ax.select('.domain').remove();
  ax.selectAll('line').style('stroke', 'var(--cds-chart-grid)');
  ax.selectAll('text').style('fill', 'var(--cds-text-secondary)').style('font-size', '11px').style('font-family', 'var(--sp-font)');
};
const spMargen = (el, labels) => {
  const tmp = d3.select(el).append('svg').attr('width', 10).attr('height', 10);
  let w = 0;
  labels.forEach((l) => { const t = tmp.append('text').style('font-size', '11px').text(l); w = Math.max(w, t.node().getComputedTextLength()); });
  tmp.remove();
  return Math.ceil(w) + 10;
};
const spCadaX = (n, W) => Math.max(1, Math.ceil(n / Math.max(2, Math.floor(W / 52))));

dash.draw('ch_ventas', (el) => {
  if (!SP.status(el, 'pl_mensual')) return;
  const rows = dash.data('pl_mensual').data;
  const [a, b] = SP.rango();
  el.replaceChildren();
  const width = el.clientWidth || 600, height = 280;
  const y = d3.scaleLinear().domain([Math.min(0, d3.min(rows, (r) => r.ebitda)), d3.max(rows, (r) => r.ventas_netas)]).nice();
  const ml = spMargen(el, y.ticks(5).map(SP.ejeM));
  const m = { t: 10, r: 8, b: 24, l: ml }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.mes)).range([0, W]).padding(0.2);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Ventas netas y EBITDA por mes, enero 2025 a octubre 2026');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  spEjeX(g, x, H, spCadaX(rows.length, W));
  const tip = SP.tip(el);
  g.selectAll('rect.b').data(rows).join('rect').attr('class', 'b')
    .attr('x', (r) => x(r.mes)).attr('width', x.bandwidth()).attr('y', (r) => y(Math.max(0, r.ventas_netas))).attr('height', (r) => Math.abs(y(r.ventas_netas) - y(0)))
    .style('fill', (r) => r.mes >= a && r.mes <= b ? 'var(--sp-c0)' : 'var(--cds-chart-muted)')
    .style('opacity', (r) => r.estimado ? 0.55 : 1)
    .on('mousemove', (ev, r) => tip.show(ev, [SP.mesLargo(r.mes) + (r.estimado ? ' (estimado)' : ''), `Ventas: ${SP.m(r.ventas_netas)}`, `EBITDA: ${SP.m(r.ebitda)} (${SP.p(r.ebitda_pct)})`, `Resultado neto: ${SP.m(r.resultado_neto)}`]))
    .on('mouseleave', tip.hide);
  const line = d3.line().x((r) => x(r.mes) + x.bandwidth() / 2).y((r) => y(r.ebitda));
  g.append('path').datum(rows).attr('d', line).style('fill', 'none').style('stroke', 'var(--sp-c1)').style('stroke-width', 2).style('pointer-events', 'none');
  g.selectAll('circle').data(rows).join('circle').attr('cx', (r) => x(r.mes) + x.bandwidth() / 2).attr('cy', (r) => y(r.ebitda)).attr('r', 2.5).style('fill', 'var(--sp-c1)').style('pointer-events', 'none');
  g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-reference)');
});

dash.draw('ch_volumen', (el) => {
  if (!SP.status(el, 'volumenes')) return;
  const prods = ['Nafta Súper', 'V-Power Nafta', 'Evolux Diesel', 'V-Power Diesel'];
  const raw = dash.data('volumenes').data;
  const [a, b] = SP.rango();
  const meses = [...new Set(raw.map((r) => r.mes))].sort().filter((k) => k >= a && k <= b);
  el.replaceChildren();
  if (!meses.length) return;
  const rows = meses.map((k) => { const o = { mes: k }; prods.forEach((p) => { const f = raw.find((r) => r.mes === k && r.producto === p); o[p] = f ? Number(f.volumen) : 0; }); return o; });
  const st = d3.stack().keys(prods)(rows);
  const width = el.clientWidth || 400, height = 260;
  const y = d3.scaleLinear().domain([0, d3.max(st[st.length - 1], (d) => d[1]) || 1]).nice();
  const fmtk = (v) => `${new Intl.NumberFormat('es-AR').format(v / 1000)} mil`;
  const m = { t: 10, r: 8, b: 24, l: spMargen(el, y.ticks(5).map(fmtk)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(meses).range([0, W]).padding(0.2);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Litros vendidos por producto y mes');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, fmtk);
  spEjeX(g, x, H, spCadaX(meses.length, W));
  const tip = SP.tip(el);
  st.forEach((s, i) => {
    g.append('g').selectAll('rect').data(s).join('rect').attr('x', (d) => x(d.data.mes)).attr('width', x.bandwidth()).attr('y', (d) => y(d[1])).attr('height', (d) => y(d[0]) - y(d[1]))
      .style('fill', `var(--sp-c${i})`)
      .on('mousemove', (ev, d) => tip.show(ev, [SP.mesLargo(d.data.mes), ...prods.map((p) => `${p}: ${SP.n(d.data[p])} L`), `Total: ${SP.n(prods.reduce((t, p) => t + d.data[p], 0))} L`]))
      .on('mouseleave', tip.hide);
  });
});

dash.draw('ch_gnc', (el) => {
  if (!SP.status(el, 'volumenes')) return;
  const [a, b] = SP.rango();
  const rows = dash.data('volumenes').data.filter((r) => r.producto === 'GNC' && r.mes >= a && r.mes <= b).sort((p, q) => p.mes.localeCompare(q.mes));
  el.replaceChildren();
  if (!rows.length) return;
  const width = el.clientWidth || 400, height = 260;
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => Number(r.volumen))]).nice();
  const fmtk = (v) => `${new Intl.NumberFormat('es-AR').format(v / 1000)} mil`;
  const m = { t: 10, r: 8, b: 24, l: spMargen(el, y.ticks(5).map(fmtk)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.mes)).range([0, W]).padding(0.2);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'GNC vendido por mes en metros cúbicos');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, fmtk);
  spEjeX(g, x, H, spCadaX(rows.length, W));
  const tip = SP.tip(el);
  g.selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.mes)).attr('width', x.bandwidth()).attr('y', (r) => y(r.volumen)).attr('height', (r) => H - y(r.volumen))
    .style('fill', 'var(--sp-c4)')
    .on('mousemove', (ev, r) => tip.show(ev, [SP.mesLargo(r.mes), `${SP.n(r.volumen)} m³`])).on('mouseleave', tip.hide);
});

dash.draw('ch_margen', (el) => {
  if (!SP.status(el, 'pl_mensual')) return;
  const [a, b] = SP.rango();
  const rows = dash.data('pl_mensual').data.filter((r) => r.anio === 2026 && r.mes >= a && r.mes <= b);
  el.replaceChildren();
  if (!rows.length) { el.appendChild(Object.assign(document.createElement('p'), { className: 'sp-note', textContent: 'El período elegido no incluye meses de 2026.' })); return; }
  const keys = ['margen_liquidos', 'margen_gnc', 'margen_otros'], cols = ['var(--sp-c0)', 'var(--sp-c4)', 'var(--sp-c2)'], noms = ['Líquidos', 'GNC', 'Tienda y otros'];
  const st = d3.stack().keys(keys)(rows);
  const width = el.clientWidth || 600, height = 260;
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.margen_bruto)]).nice();
  const m = { t: 10, r: 8, b: 24, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.mes)).range([0, W]).padding(0.25);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Margen bruto 2026 por fuente: líquidos, GNC y tienda');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  spEjeX(g, x, H, spCadaX(rows.length, W));
  const tip = SP.tip(el);
  st.forEach((s, i) => {
    g.append('g').selectAll('rect').data(s).join('rect').attr('x', (d) => x(d.data.mes)).attr('width', x.bandwidth()).attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
      .style('fill', cols[i])
      .on('mousemove', (ev, d) => tip.show(ev, [SP.mesLargo(d.data.mes), ...keys.map((k, j) => `${noms[j]}: ${SP.m(d.data[k])}`), `Total: ${SP.m(d.data.margen_bruto)} (${SP.p(d.data.margen_bruto_pct)})`]))
      .on('mouseleave', tip.hide);
  });
});

dash.draw('ch_dias', (el) => {
  if (!SP.status(el, 'diario')) return;
  const rows = dash.data('diario').data;
  const sel = dash.params().dia || '2026-09-22';
  el.replaceChildren();
  const width = el.clientWidth || 400, height = 240;
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.total_pesos)]).nice();
  const m = { t: 10, r: 8, b: 24, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.fecha)).range([0, W]).padding(0.15);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Venta total diaria de septiembre 2026');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  const cada = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(W / 30))));
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % cada === 0)).tickFormat((f) => f.slice(8)).tickSizeOuter(0)).call(SP.axisStyle);
  const tip = SP.tip(el);
  g.selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.fecha)).attr('width', x.bandwidth()).attr('y', (r) => y(r.total_pesos)).attr('height', (r) => H - y(r.total_pesos))
    .style('fill', (r) => r.fecha === sel ? 'var(--sp-c0)' : 'var(--cds-chart-muted)').style('cursor', 'pointer')
    .on('mousemove', (ev, r) => tip.show(ev, [`${r.fecha.slice(8)}/09/2026`, `Total: ${SP.m(r.total_pesos)}`, `Líquidos: ${SP.n(r.liquidos_litros)} L`, `GNC: ${SP.n(r.gnc_m3)} m³`]))
    .on('mouseleave', tip.hide)
    .on('click', (ev, r) => dash.setParams({ dia: r.fecha }));
});

dash.draw('ch_flujo', (el) => {
  if (!SP.status(el, 'roi_flujos')) return;
  const rows = dash.data('roi_flujos').data;
  el.replaceChildren();
  const escs = ['20', 'base', 'equilibrio', 'optimista'];
  const width = el.clientWidth || 400, height = 260;
  const y = d3.scaleLinear().domain(d3.extent(rows, (r) => r.acumulado)).nice();
  const m = { t: 10, r: 12, b: 28, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleLinear().domain(d3.extent(rows, (r) => r.anio)).range([0, W]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Flujo acumulado de la inversión por año y escenario');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => `año ${v}`).tickSizeOuter(0)).call(SP.axisStyle);
  g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-reference)').style('stroke-dasharray', '4 3');
  const tip = SP.tip(el);
  const sel = dash.params().escenario || 'base';
  escs.forEach((e, i) => {
    const s = rows.filter((r) => r.escenario === e);
    g.append('path').datum(s).attr('d', d3.line().x((r) => x(r.anio)).y((r) => y(r.acumulado))).style('fill', 'none').style('stroke', `var(--sp-c${i})`).style('stroke-width', e === sel ? 3 : 1.5);
    g.append('g').selectAll('circle').data(s).join('circle').attr('cx', (r) => x(r.anio)).attr('cy', (r) => y(r.acumulado)).attr('r', 4).style('fill', `var(--sp-c${i})`)
      .on('mousemove', (ev, r) => tip.show(ev, [r.etiqueta, `Año ${r.anio}`, `Acumulado: ${SP.m(r.acumulado)}`])).on('mouseleave', tip.hide);
  });
});


const SP_EMP = [['shell', 'Shell'], ['ypf', 'YPF'], ['tolosa', 'Alvemem Tolosa'], ['olmos', 'Alvemem Olmos']];
dash.draw('ch_emp_ventas', (el) => {
  if (!SP.status(el, 'pl_empresas')) return;
  const [a, b] = SP.rango();
  const all = dash.data('pl_empresas').data.filter((r) => r.mes >= a && r.mes <= b);
  const meses = [...new Set(all.filter((r) => r.empresa === 'grupo').map((r) => r.mes))].sort();
  el.replaceChildren();
  if (!meses.length) return;
  const rows = meses.map((m) => { const o = { mes: m }; SP_EMP.forEach(([k]) => { const f = all.find((r) => r.empresa === k && r.mes === m); o[k] = f ? f.ventas_netas : 0; }); return o; });
  const st = d3.stack().keys(SP_EMP.map((e) => e[0]))(rows);
  const width = el.clientWidth || 500, height = 280;
  const y = d3.scaleLinear().domain([0, d3.max(st[st.length - 1], (d) => d[1]) || 1]).nice();
  const m = { t: 10, r: 8, b: 24, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(meses).range([0, W]).padding(0.2);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Ventas netas mensuales apiladas por empresa');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  spEjeX(g, x, H, spCadaX(meses.length, W));
  const tip = SP.tip(el);
  st.forEach((s, i) => {
    g.append('g').selectAll('rect').data(s).join('rect').attr('x', (d) => x(d.data.mes)).attr('width', x.bandwidth()).attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
      .style('fill', `var(--sp-c${i})`)
      .on('mousemove', (ev, d) => tip.show(ev, [SP.mesLargo(d.data.mes), ...SP_EMP.map(([k, n]) => `${n}: ${SP.m(d.data[k])}`), `Total: ${SP.m(SP_EMP.reduce((t, [k]) => t + d.data[k], 0))}`]))
      .on('mouseleave', tip.hide);
  });
});
dash.draw('ch_emp_barras', (el) => {
  if (!SP.status(el, 'pl_empresas_rangos')) return;
  const [a, b] = SP.rango();
  const d = dash.data('pl_empresas_rangos').data;
  const rows = SP_EMP.map(([k, n]) => { const r = d.find((x) => x.empresa === k && x.desde === a && x.hasta === b); return { k, n, ebitda: r && r.meses_con_datos ? r.ebitda : 0, neto: r && r.meses_con_datos ? r.resultado_neto : 0, meses: r ? r.meses_con_datos : 0 }; });
  el.replaceChildren();
  const width = el.clientWidth || 400, height = 280;
  const y = d3.scaleLinear().domain([Math.min(0, d3.min(rows, (r) => Math.min(r.ebitda, r.neto))), Math.max(0, d3.max(rows, (r) => Math.max(r.ebitda, r.neto)))]).nice();
  const m = { t: 10, r: 8, b: 24, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.k)).range([0, W]).padding(0.25);
  const x2 = d3.scaleBand().domain(['ebitda', 'neto']).range([0, x.bandwidth()]).padding(0.08);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'EBITDA y resultado neto del período por empresa');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickFormat((k) => SP_EMP.find((e) => e[0] === k)[1].replace('Alvemem ', '')).tickSizeOuter(0)).call(SP.axisStyle);
  g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-reference)');
  const tip = SP.tip(el);
  ['ebitda', 'neto'].forEach((c, i) => {
    g.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.k) + x2(c)).attr('width', x2.bandwidth()).attr('y', (r) => y(Math.max(0, r[c]))).attr('height', (r) => Math.abs(y(r[c]) - y(0)))
      .style('fill', `var(--sp-c${i})`)
      .on('mousemove', (ev, r) => tip.show(ev, [r.n, `EBITDA: ${SP.m(r.ebitda)}`, `Resultado neto: ${SP.m(r.neto)}`, `${r.meses} meses con datos`])).on('mouseleave', tip.hide);
  });
});
dash.draw('ch_emp_ebitda_mes', (el) => {
  if (!SP.status(el, 'pl_empresas')) return;
  const [a, b] = SP.rango();
  const all = dash.data('pl_empresas').data.filter((r) => r.mes >= a && r.mes <= b && SP_EMP.some((e) => e[0] === r.empresa));
  el.replaceChildren();
  if (!all.length) return;
  const meses = [...new Set(all.map((r) => r.mes))].sort();
  const width = el.clientWidth || 600, height = 260;
  const y = d3.scaleLinear().domain([Math.min(0, d3.min(all, (r) => r.ebitda)), Math.max(0, d3.max(all, (r) => r.ebitda))]).nice();
  const m = { t: 10, r: 10, b: 24, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scalePoint().domain(meses).range([0, W]).padding(0.3);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'EBITDA mensual por empresa');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  const cada = spCadaX(meses.length, W);
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(meses.filter((_, i) => i % cada === 0)).tickFormat(SP.mes).tickSizeOuter(0)).call(SP.axisStyle);
  g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-reference)');
  const tip = SP.tip(el);
  SP_EMP.forEach(([k, n], i) => {
    const s = all.filter((r) => r.empresa === k).sort((p, q) => p.mes.localeCompare(q.mes));
    g.append('path').datum(s).attr('d', d3.line().x((r) => x(r.mes)).y((r) => y(r.ebitda))).style('fill', 'none').style('stroke', `var(--sp-c${i})`).style('stroke-width', 2);
    g.append('g').selectAll('circle').data(s).join('circle').attr('cx', (r) => x(r.mes)).attr('cy', (r) => y(r.ebitda)).attr('r', 3).style('fill', `var(--sp-c${i})`)
      .on('mousemove', (ev, r) => tip.show(ev, [`${n} · ${SP.mesLargo(r.mes)}`, `EBITDA: ${SP.m(r.ebitda)} (${SP.p(r.ebitda_pct)})`, `Ventas: ${SP.m(r.ventas_netas)}`])).on('mouseleave', tip.hide);
  });
});
dash.draw('ch_empresa', (el) => {
  if (!SP.status(el, 'pl_empresas')) return;
  const [a, b] = SP.rango();
  const emp = dash.params().emp || 'shell';
  const rows = dash.data('pl_empresas').data.filter((r) => r.empresa === emp && r.mes >= a && r.mes <= b).sort((p, q) => p.mes.localeCompare(q.mes));
  el.replaceChildren();
  if (!rows.length) { el.appendChild(Object.assign(document.createElement('p'), { className: 'sp-note', textContent: 'No hay datos de esta empresa en el período elegido.' })); return; }
  const width = el.clientWidth || 500, height = 280;
  const y = d3.scaleLinear().domain([Math.min(0, d3.min(rows, (r) => r.ebitda)), d3.max(rows, (r) => r.ventas_netas)]).nice();
  const m = { t: 10, r: 8, b: 24, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.mes)).range([0, W]).padding(0.2);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Ventas netas y EBITDA por mes de la empresa elegida');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  spEjeX(g, x, H, spCadaX(rows.length, W));
  const tip = SP.tip(el);
  g.selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.mes)).attr('width', x.bandwidth()).attr('y', (r) => y(Math.max(0, r.ventas_netas))).attr('height', (r) => Math.abs(y(r.ventas_netas) - y(0)))
    .style('fill', 'var(--sp-c0)').style('opacity', (r) => r.estimado ? 0.55 : 1)
    .on('mousemove', (ev, r) => tip.show(ev, [SP.mesLargo(r.mes) + (r.estimado ? ' (estimado)' : ''), `Ventas: ${SP.m(r.ventas_netas)}`, `EBITDA: ${SP.m(r.ebitda)} (${SP.p(r.ebitda_pct)})`, `Resultado neto: ${SP.m(r.resultado_neto)}`]))
    .on('mouseleave', tip.hide);
  g.append('path').datum(rows).attr('d', d3.line().x((r) => x(r.mes) + x.bandwidth() / 2).y((r) => y(r.ebitda))).style('fill', 'none').style('stroke', 'var(--sp-c1)').style('stroke-width', 2).style('pointer-events', 'none');
  g.selectAll('circle').data(rows).join('circle').attr('cx', (r) => x(r.mes) + x.bandwidth() / 2).attr('cy', (r) => y(r.ebitda)).attr('r', 2.5).style('fill', 'var(--sp-c1)').style('pointer-events', 'none');
  g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-reference)');
});


dash.draw('ch_ypf_puntos', (el) => {
  if (!SP.status(el, 'ventas_ypf_puntos')) return;
  const [a, b] = SP.rango();
  const raw = dash.data('ventas_ypf_puntos').data.filter((r) => r.mes >= a && r.mes <= b);
  el.replaceChildren();
  if (!raw.length) { el.appendChild(Object.assign(document.createElement('p'), { className: 'sp-note', textContent: 'No hay ventas de YPF en el período elegido.' })); return; }
  const puntos = ['Playa 8', 'Playa 13', 'Full 14 (tienda)', 'Electrónicas'];
  const meses = [...new Set(raw.map((r) => r.mes))].sort();
  const rows = meses.map((m) => { const o = { mes: m }; puntos.forEach((p) => { const f = raw.find((r) => r.mes === m && r.punto_venta === p); o[p] = f ? Number(f.ventas_netas) : 0; }); return o; });
  const st = d3.stack().keys(puntos)(rows);
  const width = el.clientWidth || 500, height = 280;
  const y = d3.scaleLinear().domain([0, d3.max(st[st.length - 1], (d) => d[1]) || 1]).nice();
  const m = { t: 10, r: 8, b: 24, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(meses).range([0, W]).padding(0.2);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Ventas netas de YPF por punto de venta y mes');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  spEjeX(g, x, H, spCadaX(meses.length, W));
  const tip = SP.tip(el);
  st.forEach((s, i) => {
    g.append('g').selectAll('rect').data(s).join('rect').attr('x', (d) => x(d.data.mes)).attr('width', x.bandwidth()).attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
      .style('fill', `var(--sp-c${i})`)
      .on('mousemove', (ev, d) => tip.show(ev, [SP.mesLargo(d.data.mes), ...puntos.map((p) => `${p}: ${SP.m(d.data[p])}`)])).on('mouseleave', tip.hide);
  });
});
dash.draw('ch_alv_mix', (el) => {
  if (!SP.status(el, 'alv_resumen')) return;
  const u = SP_UNIDAD[dash.params().emp || 'shell'];
  const all = dash.data('alv_resumen').data;
  const unidades = u === 'Alvemem' ? ['Tolosa', 'Olmos'] : [u];
  const rubros = [...new Set(all.map((r) => r.rubro))];
  el.replaceChildren();
  const width = el.clientWidth || 400, bh = 34;
  const m = { t: 6, r: 12, b: 24, l: spMargen(el, rubros) };
  const height = m.t + m.b + rubros.length * bh, W = width - m.l - m.r, H = height - m.t - m.b;
  const rows = all.filter((r) => unidades.includes(r.unidad));
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.monto) || 1]).nice().range([0, W]);
  const yb = d3.scaleBand().domain(rubros).range([0, H]).padding(0.2);
  const y2 = d3.scaleBand().domain(unidades).range([0, yb.bandwidth()]).padding(0.08);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Venta por rubro de las cajas diarias de Alvemem');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).ticks(4).tickFormat(SP.ejeM).tickSizeOuter(0)).call(SP.axisStyle);
  g.append('g').call(d3.axisLeft(yb).tickSize(0)).call(SP.axisStyle).select('.domain').remove();
  const tip = SP.tip(el);
  g.selectAll('rect').data(rows).join('rect').attr('x', 0).attr('y', (r) => yb(r.rubro) + y2(r.unidad)).attr('height', y2.bandwidth()).attr('width', (r) => x(r.monto))
    .style('fill', (r) => r.unidad === 'Tolosa' ? 'var(--sp-c0)' : 'var(--sp-c1)')
    .on('mousemove', (ev, r) => tip.show(ev, [`${r.unidad} · ${r.rubro}`, SP.m(r.monto), `${r.dias} días cargados`])).on('mouseleave', tip.hide);
});
dash.draw('ch_alv_dias', (el) => {
  if (!SP.status(el, 'diario_alv')) return;
  const u = SP_UNIDAD[dash.params().emp || 'shell'];
  const rows = dash.data('diario_alv').data.filter((r) => r.unidad === u).sort((p, q) => p.fecha.localeCompare(q.fecha));
  const sel = dash.params().dia_alv || '2026-10-07';
  el.replaceChildren();
  if (!rows.length) return;
  const width = el.clientWidth || 400, height = 240;
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.total)]).nice();
  const m = { t: 10, r: 8, b: 24, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.fecha)).range([0, W]).padding(0.15);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Venta total diaria de Alvemem');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  const cada = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(W / 40))));
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % cada === 0)).tickFormat((f) => `${f.slice(8)}/${f.slice(5, 7)}`).tickSizeOuter(0)).call(SP.axisStyle);
  const tip = SP.tip(el);
  g.selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.fecha)).attr('width', x.bandwidth()).attr('y', (r) => y(r.total)).attr('height', (r) => H - y(r.total))
    .style('fill', (r) => r.fecha === sel ? 'var(--sp-c0)' : 'var(--cds-chart-muted)').style('cursor', 'pointer')
    .on('mousemove', (ev, r) => tip.show(ev, [`${r.fecha.slice(8)}/${r.fecha.slice(5, 7)}/2026`, `Total: ${SP.m(r.total)}`, `Playa: ${SP.m(r.ventas_playa)}`, `GNC: ${SP.m(r.gnc)}`]))
    .on('mouseleave', tip.hide)
    .on('click', (ev, r) => dash.setParams({ dia_alv: r.fecha }));
});

dash.draw('ch_rubros', (el) => {
  if (!SP.status(el, 'inversion_rubros')) return;
  const rows = [...dash.data('inversion_rubros').data].sort((p, q) => q.monto - p.monto);
  el.replaceChildren();
  const col = { 'Cotización': 'var(--sp-c0)', 'Estimado': 'var(--sp-c1)', 'Ajustado': 'var(--sp-c2)' };
  const corto = (s) => s.length > 30 ? s.slice(0, 29) + '…' : s;
  const width = el.clientWidth || 400, bh = 24;
  const m = { t: 4, r: 56, b: 22, l: spMargen(el, rows.map((r) => corto(r.rubro))) };
  const height = m.t + m.b + rows.length * bh, W = Math.max(40, width - m.l - m.r), H = height - m.t - m.b;
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.monto)]).nice().range([0, W]);
  const yb = d3.scaleBand().domain(rows.map((r) => r.rubro)).range([0, H]).padding(0.2);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Inversión de la remodelación por rubro');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).ticks(4).tickFormat(SP.ejeM).tickSizeOuter(0)).call(SP.axisStyle);
  g.append('g').call(d3.axisLeft(yb).tickSize(0).tickFormat(corto)).call(SP.axisStyle).select('.domain').remove();
  const tip = SP.tip(el);
  g.selectAll('rect').data(rows).join('rect').attr('x', 0).attr('y', (r) => yb(r.rubro)).attr('height', yb.bandwidth()).attr('width', (r) => x(r.monto)).style('fill', (r) => col[r.origen] || 'var(--cds-chart-muted)')
    .on('mousemove', (ev, r) => tip.show(ev, [r.rubro, `${SP.m(r.monto)} · ${SP.p(r.pct_total)}`, r.origen])).on('mouseleave', tip.hide);
  g.selectAll('text.lab').data(rows).join('text').attr('class', 'lab').attr('x', (r) => x(r.monto) + 4).attr('y', (r) => yb(r.rubro) + yb.bandwidth() / 2).attr('dy', '0.35em').text((r) => SP.p(r.pct_total));
});

dash.draw('ch_grupo', (el) => {
  if (!SP.status(el, 'ventas_netas')) return;
  const [a, b] = SP.rango();
  const raw = dash.data('ventas_netas').data.filter((r) => r.mes >= a && r.mes <= b);
  el.replaceChildren();
  if (!raw.length) return;
  const ests = ['Shell', 'YPF', 'Alvemem'];
  const meses = [...new Set(raw.map((r) => r.mes))].sort();
  const width = el.clientWidth || 600, height = 280;
  const y = d3.scaleLinear().domain([0, d3.max(raw, (r) => Number(r.ventas_netas))]).nice();
  const m = { t: 10, r: 10, b: 24, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scalePoint().domain(meses).range([0, W]).padding(0.3);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Ventas netas mensuales de Shell, YPF y Alvemem');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  const cada = spCadaX(meses.length, W);
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(meses.filter((_, i) => i % cada === 0)).tickFormat(SP.mes).tickSizeOuter(0)).call(SP.axisStyle);
  const tip = SP.tip(el);
  ests.forEach((e, i) => {
    const s = raw.filter((r) => r.estacion === e).sort((p, q) => p.mes.localeCompare(q.mes));
    g.append('path').datum(s).attr('d', d3.line().x((r) => x(r.mes)).y((r) => y(r.ventas_netas))).style('fill', 'none').style('stroke', `var(--sp-c${i})`).style('stroke-width', 2);
    g.append('g').selectAll('circle').data(s).join('circle').attr('cx', (r) => x(r.mes)).attr('cy', (r) => y(r.ventas_netas)).attr('r', 3).style('fill', `var(--sp-c${i})`)
      .on('mousemove', (ev, r) => tip.show(ev, [`${e} · ${SP.mesLargo(r.mes)}`, SP.m(r.ventas_netas)])).on('mouseleave', tip.hide);
  });
});

dash.draw('ch_deuda', (el) => {
  if (!SP.status(el, 'deudas_bancarias')) return;
  const rows = dash.data('deudas_bancarias').data.filter((r) => r.empresa.startsWith('DSB')).sort((p, q) => q.deuda_total - p.deuda_total);
  el.replaceChildren();
  const width = el.clientWidth || 400;
  const bh = 30, m = { t: 6, r: 12, b: 24, l: spMargen(el, rows.map((r) => r.banco)) };
  const height = m.t + m.b + rows.length * bh;
  const W = width - m.l - m.r, H = height - m.t - m.b;
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => Math.max(r.calificacion, r.deuda_total))]).nice().range([0, W]);
  const yb = d3.scaleBand().domain(rows.map((r) => r.banco)).range([0, H]).padding(0.25);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Deuda bancaria de la Shell frente a la calificación, por banco');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).ticks(4).tickFormat(SP.ejeM).tickSizeOuter(0)).call(SP.axisStyle);
  g.append('g').call(d3.axisLeft(yb).tickSize(0)).call(SP.axisStyle).select('.domain').remove();
  const tip = SP.tip(el);
  const on = (ev, r) => tip.show(ev, [r.banco, `Deuda: ${SP.m(r.deuda_total)}`, `Calificación: ${SP.m(r.calificacion)}`]);
  g.selectAll('rect.c').data(rows).join('rect').attr('class', 'c').attr('x', 0).attr('y', (r) => yb(r.banco)).attr('height', yb.bandwidth()).attr('width', (r) => x(r.calificacion)).style('fill', 'var(--cds-chart-muted)').on('mousemove', on).on('mouseleave', tip.hide);
  g.selectAll('rect.d').data(rows).join('rect').attr('class', 'd').attr('x', 0).attr('y', (r) => yb(r.banco) + yb.bandwidth() * 0.2).attr('height', yb.bandwidth() * 0.6).attr('width', (r) => x(r.deuda_total)).style('fill', 'var(--sp-c0)').on('mousemove', on).on('mouseleave', tip.hide);
});

/* ---------- módulos nuevos ---------- */
dash.draw('dr', (el) => {
  const e = el.dataset.empresa;
  const d = dash.data('deuda_resumen');
  spFila(el, 'deuda_resumen', { empresa: e }, d.status === 'ok' && Array.isArray(d.data) ? d.data.find((r) => r.empresa === e) : null);
});
dash.draw('cr', (el) => {
  const t = el.dataset.tipo;
  const d = dash.data('ctas_resumen');
  spFila(el, 'ctas_resumen', { tipo: t }, d.status === 'ok' && Array.isArray(d.data) ? d.data.find((r) => r.tipo === t) : null);
});
dash.draw('lst_alertas', (ul) => {
  const d = dash.data('alertas');
  if (d.status !== 'ok' || !Array.isArray(d.data)) {
    const li = document.createElement('li'); li.textContent = d.status === 'error' ? 'No se pudieron calcular las alertas.' : '—'; ul.replaceChildren(li); return;
  }
  if (!d.data.length) { const li = document.createElement('li'); li.className = 'ok'; li.textContent = 'Sin alertas: no hay vencimientos en los próximos 30 días ni desvíos detectados.'; ul.replaceChildren(li); return; }
  ul.replaceChildren(...d.data.map((r, i) => {
    const li = document.createElement('li'); li.className = r.nivel;
    li.setAttribute('data-source', 'alertas'); li.setAttribute('data-row', String(i)); li.setAttribute('data-field', 'texto');
    const m = document.createElement('span'); m.className = 'm'; m.textContent = r.modulo;
    const t = document.createElement('span'); t.textContent = r.texto;
    li.append(m, t); return li;
  }));
});

const spFecha = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : (iso || '');
dash.draw('ch_embudo', (el) => {
  const d = dash.data('oportunidades');
  if (d.status !== 'ok') { el.replaceChildren(); if (d.status === 'error') el.textContent = 'No se pudieron leer las oportunidades.'; return; }
  const etapas = ['Prospecto', 'Cotizada', 'En negociación', 'Ganada', 'Perdida'];
  const rows = etapas.map((e) => { const v = d.data.filter((r) => r.etapa === e); return { etapa: e, n: v.length, monto: d3.sum(v, (r) => Number(r.monto) || 0) }; });
  el.replaceChildren();
  if (!d.data.length) { const p = document.createElement('p'); p.className = 'sp-note'; p.textContent = 'Sin oportunidades cargadas todavía.'; el.appendChild(p); return; }
  const width = el.clientWidth || 400, height = 220;
  const m = { t: 6, r: 90, b: 6, l: 110 }, W = Math.max(40, width - m.l - m.r), H = height - m.t - m.b;
  const y = d3.scaleBand().domain(etapas).range([0, H]).padding(0.22);
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.n) || 1]).range([0, W]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Cantidad de oportunidades comerciales por etapa');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  const tip = SP.tip(el);
  g.selectAll('rect').data(rows).join('rect').attr('x', (r) => (W - x(r.n)) / 2).attr('y', (r) => y(r.etapa)).attr('width', (r) => Math.max(2, x(r.n))).attr('height', y.bandwidth()).attr('rx', 4)
    .style('fill', (r) => r.etapa === 'Perdida' ? 'var(--cds-chart-muted)' : r.etapa === 'Ganada' ? 'var(--sp-c4)' : 'var(--sp-c0)')
    .on('mousemove', (ev, r) => tip.show(ev, [r.etapa, `${r.n} oportunidades`, `${SP.$(r.monto)} por mes`])).on('mouseleave', tip.hide);
  g.selectAll('text.l').data(rows).join('text').attr('class', 'l').attr('x', -8).attr('y', (r) => y(r.etapa) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => r.etapa);
  g.selectAll('text.v').data(rows).join('text').attr('class', 'v').attr('x', W + 8).attr('y', (r) => y(r.etapa) + y.bandwidth() / 2).attr('dy', '0.35em').text((r) => `${r.n} · ${SP.m(r.monto)}`);
});

const spGastosShell = () => {
  const [a, b] = SP.rango();
  const d = dash.data('gastos_fijos');
  const rows = d.status === 'ok' ? d.data.filter((r) => r.mes >= a && r.mes <= b) : [];
  return { rows, meses: [...new Set(rows.map((r) => r.mes))].sort() };
};
dash.draw('th_gastos_shell', (th) => {
  const { meses } = spGastosShell();
  const tr = document.createElement('tr');
  ['Concepto', ...meses.map(SP.mes)].forEach((x) => { const h = document.createElement('th'); h.textContent = x; tr.appendChild(h); });
  th.replaceChildren(tr);
});
dash.draw('tb_gastos_shell', (tb) => {
  const { rows, meses } = spGastosShell();
  const orden = ['energia', 'servicios', 'honorarios', 'cargas_sociales', 'iibb_pagado', 'iva', 'ganancias_anticipo', 'tarjeta', 'prestamos', 'planes_fiscales', 'costo_gnc'];
  const claves = [...new Map(rows.map((r) => [r.concepto, r])).values()].sort((p, q) => (orden.indexOf(p.categoria) - orden.indexOf(q.categoria)) || p.concepto.localeCompare(q.concepto));
  if (!claves.length) { const tr = document.createElement('tr'); tr.className = 'gs-empty'; const td = document.createElement('td'); td.textContent = 'No hay gastos de la Shell cargados en el período elegido (la planilla cubre 2026).'; tr.appendChild(td); tb.replaceChildren(tr); return; }
  tb.replaceChildren(...claves.map((k) => {
    const tr = document.createElement('tr');
    const td0 = document.createElement('td'); td0.textContent = k.concepto; td0.style.whiteSpace = 'normal'; td0.style.minWidth = '220px'; tr.appendChild(td0);
    meses.forEach((m) => {
      const td = document.createElement('td');
      const r = rows.find((x) => x.concepto === k.concepto && x.mes === m);
      if (r) { td.textContent = SP.m(Number(r.monto)); td.setAttribute('data-source', 'gastos_fijos'); td.setAttribute('data-field', 'monto'); td.setAttribute('data-where', SP.where({ mes: r.mes, concepto: r.concepto })); }
      tr.appendChild(td);
    });
    return tr;
  }));
});

/* ---------- cheques, planes y situación bancaria ---------- */
dash.draw('chk', (el) => {
  el.setAttribute('data-row', '0');
  const d = dash.data('cheques_resumen');
  if (d.status !== 'ok' || !Array.isArray(d.data) || !d.data[0]) { el.textContent = '—'; return; }
  spFmt(el, d.data[0][el.dataset.field]);
});
dash.draw('plk', (el) => {
  const e = el.dataset.empresa;
  const d = dash.data('planes_resumen');
  spFila(el, 'planes_resumen', { empresa: e }, d.status === 'ok' && Array.isArray(d.data) ? d.data.find((r) => r.empresa === e) : null);
});
dash.draw('dsk', (el) => {
  const e = el.dataset.empresa;
  const d = dash.data('deuda_situacion');
  spFila(el, 'deuda_situacion', { empresa: e }, d.status === 'ok' && Array.isArray(d.data) ? d.data.find((r) => r.empresa === e) : null);
});
const spVacia = (tb, n, txt) => { const tr = document.createElement('tr'); tr.className = 'gs-empty'; const td = document.createElement('td'); td.colSpan = n; td.textContent = txt; tr.appendChild(td); tb.replaceChildren(tr); };
const spCelda = (tr, txt, cls) => { const td = document.createElement('td'); td.textContent = txt == null ? '' : txt; if (cls) td.className = cls; tr.appendChild(td); return td; };
dash.draw('ch_cheques_sem', (el) => {
  if (!SP.status(el, 'cheques_semana')) return;
  const emp = dash.params().emp || 'shell';
  const keys = window.SP_EMP_CH[emp] || ['Shell (DSB)', 'YPF (Comb. Magdalena)', 'Alvemem'];
  const all = ['Shell (DSB)', 'YPF (Comb. Magdalena)', 'Alvemem'];
  const rows = dash.data('cheques_semana').data;
  el.replaceChildren();
  if (!rows.length) { el.textContent = 'No hay cheques pendientes.'; return; }
  const width = el.clientWidth || 600, height = 280;
  const st = d3.stack().keys(keys)(rows);
  const y = d3.scaleLinear().domain([0, d3.max(st[st.length - 1], (p) => p[1]) || 1]).nice();
  const m = { t: 10, r: 8, b: 28, l: spMargen(el, y.ticks(5).map(SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.semana)).range([0, W]).padding(0.2);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Importe de cheques pendientes por semana de débito y empresa');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  spGrid(g, y, W, SP.ejeM);
  const cada = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(W / 60))));
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % cada === 0)).tickFormat((s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`).tickSizeOuter(0)).call(SP.axisStyle);
  const tip = SP.tip(el);
  st.forEach((s) => {
    const i = all.indexOf(s.key);
    g.append('g').selectAll('rect').data(s).join('rect').attr('x', (p) => x(p.data.semana)).attr('width', x.bandwidth()).attr('y', (p) => y(p[1])).attr('height', (p) => Math.max(0, y(p[0]) - y(p[1])))
      .style('fill', `var(--sp-c${i})`)
      .on('mousemove', (ev, p) => tip.show(ev, [`Semana del ${p.data.semana.slice(8, 10)}/${p.data.semana.slice(5, 7)}/${p.data.semana.slice(0, 4)}`, ...keys.map((k) => `${k}: ${SP.m(p.data[k])}`), `Total: ${SP.m(keys.reduce((t, k) => t + p.data[k], 0))} · ${p.data.cheques} cheques`]))
      .on('mouseleave', tip.hide);
  });
});
dash.draw('tb_planes', (tb) => {
  const d = dash.data('planes_pago');
  if (d.status === 'error') return spVacia(tb, 10, 'No se pudo leer la planilla de planes.');
  if (d.status !== 'ok') return spVacia(tb, 10, '—');
  const emp = dash.params().emp || 'shell';
  const rows = d.data.filter((r) => !window.SP_EMP_CH[emp] || window.SP_EMP_CH[emp].includes(r.empresa));
  if (!rows.length) return spVacia(tb, 10, 'No hay planes de esta empresa en la planilla.');
  const hoy = window.SP_HOY();
  tb.replaceChildren(...rows.map((r) => {
    const tr = document.createElement('tr'); tr.dataset.key = `${encodeURIComponent(r.plan)},${encodeURIComponent(r.tipo)}`;
    spCelda(tr, r.empresa); spCelda(tr, `${r.organismo} ${r.plan}`); spCelda(tr, r.tipo === 'Plan' ? `${r.cuota_actual ?? '—'} de ${r.cuotas_total}` : 'Pago puntual');
    spCelda(tr, r.cuotas_pendientes == null ? '' : SP.n(r.cuotas_pendientes), 'gs-num'); spCelda(tr, SP.$(r.importe_cuota), 'gs-num');
    spCelda(tr, r.tipo === 'Plan' && r.cuotas_pendientes ? SP.$(r.cuotas_pendientes * r.importe_cuota) : '', 'gs-num');
    const prox = r.tipo === 'Plan' ? (r.fecha_debito && r.cuotas_pendientes > 0 ? window.SP_PROX_DEBITO(r.fecha_debito, hoy) : null) : r.fecha_debito;
    const f = spCelda(tr, prox ? spFecha(prox) : (r.fecha_debito ? '' : 'sin fecha'));
    if (r.tipo !== 'Plan' && prox && prox < hoy) f.classList.add('sp-neg');
    spCelda(tr, r.banco_debito);
    const td = document.createElement('td'); const s = document.createElement('span'); s.className = 'gs-estado' + (r.estado === 'Caduco' ? ' mal' : r.cuotas_pendientes === 0 ? ' ok' : ''); s.textContent = r.cuotas_pendientes === 0 ? 'Cancelado' : r.estado; td.appendChild(s); tr.appendChild(td);
    const o = spCelda(tr, [r.obligaciones, r.nota].filter(Boolean).join(' · ')); o.style.whiteSpace = 'normal'; o.style.minWidth = '240px';
    return tr;
  }));
});
dash.draw('tb_lineas', (tb) => {
  const d = dash.data('lineas_bancarias');
  if (d.status === 'error') return spVacia(tb, 9, 'No se pudo leer la planilla Situación.');
  if (d.status !== 'ok') return spVacia(tb, 9, '—');
  const emp = dash.params().emp || 'shell';
  const rows = d.data.filter((r) => !window.SP_EMP_CH[emp] || window.SP_EMP_CH[emp].includes(r.empresa));
  tb.replaceChildren(...rows.map((r) => {
    const tr = document.createElement('tr');
    spCelda(tr, `${r.empresa} · ${r.banco}`); spCelda(tr, r.linea); spCelda(tr, r.calificacion == null ? '' : SP.m(r.calificacion), 'gs-num');
    spCelda(tr, r.saldo == null ? '' : SP.m(r.saldo), 'gs-num'); spCelda(tr, r.plazo); spCelda(tr, r.cuota == null ? '' : SP.m(r.cuota), 'gs-num');
    spCelda(tr, r.tasa == null ? '' : SP.p(r.tasa), 'gs-num'); spCelda(tr, spFecha(r.vencimiento));
    const o = spCelda(tr, r.nota); o.style.whiteSpace = 'normal'; o.style.minWidth = '200px'; if (r.nota) o.classList.add('sp-warn');
    return tr;
  }));
});

/* helpers compartidos con erp.js */
Object.assign(window, { spFmt, spFila, spFecha, spMargen, spGrid, spVacia, spCelda });
