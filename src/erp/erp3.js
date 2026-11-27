/* ================= Sala Group · calendario de planes de pago =================
   Cuotas de los planes de la planilla (ARCA / ARBA) y de los planes propios en un
   calendario mensual con colores por estado. Cada cuota se toca para registrar el pago,
   indicando si se pagó con intereses: los intereses se suman a la cuota y se calcula
   el total pagado. */
(() => {
  const ERP = window.ERP;
  const hoy = () => window.SP_HOY();
  const n = (v) => Number(v) || 0;
  const r2 = (x) => Math.round(x * 100) / 100;
  const $ = (v) => window.SP.$(v);
  const ff = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso || '');
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const rows = (id) => { const d = dash.data(id); return d.status === 'ok' && Array.isArray(d.data) ? d.data : []; };
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const ANCLA = '2026-11-24'; // fecha de actualización de la planilla PLANES DE PAGO
  const sumarMes = (iso, k) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + k, 1)); const dim = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`; };
  const clave = (s) => String(s).replace(/[^\w-]+/g, '_').slice(0, 120);
  const UNI = { shell: ['Shell (DSB)'], ypf: ['YPF (Comb. Magdalena)'], alvemem: ['Alvemem'], tolosa: ['Alvemem'], olmos: ['Alvemem'] };
  const deUnidad = (empresa, estacion) => {
    const u = dash.params().emp || 'grupo';
    if (u === 'grupo') return true;
    if (estacion) return ERP.enUnidad({ estacion });
    return !UNI[u] || UNI[u].includes(empresa);
  };

  /* todas las cuotas, con su estado */
  dash.calc('planes_cuotas', {
    title: 'Cuotas de planes de pago',
    description: 'Cuotas de la planilla de planes (mensuales desde el próximo débito informado a la fecha de la planilla) y de los planes propios, con lo pagado, los intereses y el estado.',
    inputs: ['planes_pago', 'planes_fin', 'plan_cuotas'],
    fn: (planilla, propios, estados) => {
      const est = Object.fromEntries((estados || []).map((e) => [e.id, { pagado: e.pagado, intereses: e.intereses, fecha_pago: e.fecha_pago, medio: e.medio, operacion: e.operacion }]));
      const out = [];
      (planilla || []).forEach((r) => {
        if (r.estado === 'Caduco') return;
        const base = { origen: 'Planilla', plan: `${r.organismo || ''} ${r.plan}`.trim(), plan_id: r.plan, empresa: r.empresa, acreedor: r.organismo || '', obligaciones: r.obligaciones || '', banco: r.banco_debito || '' };
        if (r.tipo === 'Plan') {
          const pend = n(r.cuotas_pendientes); if (!pend || !r.fecha_debito) return;
          const primero = window.SP_PROX_DEBITO(r.fecha_debito, r.ref || ANCLA);
          for (let k = 0; k < pend; k++) {
            const nro = n(r.cuotas_total) - pend + 1 + k;
            const id = clave(`PP-${r.plan}-${nro}`);
            out.push({ ...base, id, n: nro, de: n(r.cuotas_total), vence: sumarMes(primero, k), importe: n(r.importe_cuota), ...(est[id] || {}), id });
          }
        } else if (r.fecha_debito) {
          const id = clave(`PP-${r.plan}-unico`);
          out.push({ ...base, id, n: 1, de: 1, vence: r.fecha_debito, importe: n(r.importe_cuota), puntual: true, ...(est[id] || {}), id });
        }
      });
      (propios || []).forEach((p) => (Array.isArray(p.cuotas) ? p.cuotas : []).forEach((c, i) => {
        out.push({ origen: 'Propio', id: clave(`PF-${p.id}-${c.n}`), plan: p.nombre || p.id, plan_id: p.id, idx: i, empresa: '', estacion: p.estacion || '', acreedor: p.acreedor || p.banco || '', obligaciones: p.tipo || '', banco: p.banco || '',
          n: c.n, de: p.cuotas.length, vence: c.vence, importe: n(c.importe), pagado: n(c.pagado), intereses: n(c.intereses), fecha_pago: c.fecha_pago || '', medio: c.medio || '', operacion: c.operacion || '', reprogramada: c.reprogramada || '' });
      }));
      const h = hoy();
      out.forEach((c) => {
        c.pagado = n(c.pagado); c.intereses = n(c.intereses);
        c.saldo = r2(Math.max(0, c.importe - c.pagado));
        c.total_pagado = r2(c.pagado + c.intereses);
        c.estado = c.saldo <= 0.005 && c.pagado > 0 ? 'Pagada' : c.pagado > 0 ? 'Pago parcial' : c.vence < h ? 'Vencida' : window.ERP_DIAS(h, c.vence) <= 7 ? 'Por vencer' : 'Programada';
        c.color = { Pagada: 'verde', 'Pago parcial': 'naranja', Vencida: 'rojo', 'Por vencer': 'amarillo', Programada: 'azul' }[c.estado];
      });
      return out.sort((a, b) => a.vence.localeCompare(b.vence) || String(a.plan).localeCompare(String(b.plan)));
    },
  });
  const cuotas = () => rows('planes_cuotas').filter((c) => deUnidad(c.empresa, c.estacion));
  const mesSel = () => dash.params().plcal_mes || hoy().slice(0, 7);
  const setMes = (m) => dash.setParams({ plcal_mes: m });
  let diaSel = null; let abierta = null;

  dash.draw('planes_fuente', (e) => { const r = rows('planes_pago').find((x) => x.ref); e.textContent = r ? `(Drive, versión del ${ff(r.ref)}, se actualiza sola)` : '(Drive, actualizada el 24/11/2026)'; });

  /* ---------- gastos bancarios reales según los extractos cargados ---------- */
  const EMPRESA_DE = { Shell: 'shell', YPF: 'ypf', Tolosa: 'tolosa', Olmos: 'olmos' };
  const CLASES = [
    ['intereses', /inter[eé]s|descubierto|acuerdo|adelanto/i],
    ['imp_dc', /25\.?413|deb\.?\s*y?\s*cred|d[eé]b(ito)?s?\s*\/?\s*cr[eé]d|imp\.?\s*ley|ley\s*25/i],
    ['iva', /\biva\b|i\.v\.a/i],
    ['comisiones', /comisi|manten|mant\.|serv(icio)?\.?\s*(de\s*)?(cuenta|paquete)|paquete|chequera|cargo|gasto|costo|arancel|emisi[oó]n|seguro\s*(de\s*)?(saldo|cuenta)|cuota\s*(de\s*)?(cuenta|paquete|tarjeta)/i],
  ];
  const clasificar = (concepto) => { for (const [k, re] of CLASES) if (re.test(concepto)) return k; return null; };
  window.ERP_CLASIF_BANC = clasificar;
  dash.calc('gastos_banc_extractos', {
    title: 'Gastos bancarios según extractos',
    description: 'Débitos de los extractos bancarios cargados en Tesorería clasificados por concepto: comisiones y mantenimiento, IVA sobre comisiones, impuesto a los débitos y créditos e intereses. Gastos bancarios = comisiones + IVA (el impuesto a los débitos y créditos y los intereses se muestran aparte). Por empresa y mes.',
    inputs: ['extractos', 'extracto_mov'],
    fn: (extractos, movs) => {
      const est = Object.fromEntries((extractos || []).map((x) => [x.id, x]));
      const acc = {};
      (movs || []).forEach((m) => {
        const ex = est[m.extracto]; const emp = ex && EMPRESA_DE[ex.estacion];
        if (!emp || !m.fecha || !(n(m.importe) < 0)) return;
        const k = clasificar(String(m.concepto || '')); if (!k) return;
        const mes = m.fecha.slice(0, 7);
        const o = (acc[`${emp}|${mes}`] ??= { empresa: emp, mes, comisiones: 0, iva: 0, imp_dc: 0, intereses: 0, movimientos: 0 });
        o[k] += -n(m.importe); o.movimientos += 1;
      });
      return Object.values(acc).map((o) => ({ ...o, total: r2(o.comisiones + o.iva) })).sort((a, b) => a.mes.localeCompare(b.mes) || a.empresa.localeCompare(b.empresa));
    },
  });
  const EMP_TXT = { shell: 'Shell', ypf: 'YPF', tolosa: 'Alvemem Tolosa', olmos: 'Alvemem Olmos' };
  dash.draw('tb_banc_ext', (tb) => {
    const u = dash.params().emp || 'grupo';
    const filtro = u === 'grupo' ? null : u === 'alvemem' ? ['tolosa', 'olmos'] : [u];
    const rs = rows('gastos_banc_extractos').filter((r) => !filtro || filtro.includes(r.empresa));
    if (!rs.length) { const tr = el('tr'); const td = el('td', 'gs-vacio', 'Todavía no hay extractos con gastos bancarios. Al importar el CSV de movimientos de un extracto, los débitos por comisiones, mantenimiento, IVA, impuesto a los débitos y créditos e intereses se clasifican solos.'); td.colSpan = 8; tr.appendChild(td); tb.replaceChildren(tr); return; }
    tb.replaceChildren(...rs.map((r) => { const tr = el('tr'); [MESES[Number(r.mes.slice(5)) - 1].slice(0, 3) + ' ' + r.mes.slice(0, 4), EMP_TXT[r.empresa] || r.empresa].forEach((x) => tr.appendChild(el('td', null, x))); ['comisiones', 'iva', 'total', 'imp_dc', 'intereses'].forEach((k) => tr.appendChild(el('td', 'gs-num', $(r[k])))); tr.appendChild(el('td', 'gs-num', String(r.movimientos))); return tr; }));
  });

  /* calendario */
  dash.draw('plcal_titulo', (e) => { const [y, m] = mesSel().split('-'); e.textContent = `${MESES[Number(m) - 1]} ${y}`; });
  dash.draw('plcal', (cont) => {
    const mes = mesSel();
    const [y, m] = mes.split('-').map(Number);
    const desplaz = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const porDia = {};
    cuotas().filter((c) => c.vence.startsWith(mes)).forEach((c) => { (porDia[c.vence] = porDia[c.vence] || []).push(c); });
    const grid = el('div', 'gs-cal-grid');
    for (let i = 0; i < desplaz; i++) grid.appendChild(el('div', 'gs-cal-dia vacio'));
    for (let d = 1; d <= dias; d++) {
      const iso = `${mes}-${String(d).padStart(2, '0')}`;
      const c = el('div', 'gs-cal-dia');
      if (iso === hoy()) c.classList.add('hoy');
      if (iso === diaSel) c.classList.add('sel');
      if ((desplaz + d - 1) % 7 >= 5) c.classList.add('finde');
      c.appendChild(el('span', 'gs-cal-n', String(d)));
      const evs = porDia[iso] || [];
      evs.slice(0, 3).forEach((q) => {
        const b = el('button', `gs-cal-ev ${q.color}`, `${q.empresa || q.acreedor} · ${q.plan_id}`);
        b.type = 'button'; b.title = `${q.plan} · cuota ${q.n} de ${q.de} · ${$(q.importe)} · ${q.estado}`;
        b.onclick = (ev) => { ev.stopPropagation(); diaSel = iso; abierta = q.id; redibujar(true); };
        c.appendChild(b);
      });
      if (evs.length > 3) c.appendChild(el('span', 'gs-cal-mas', `+${evs.length - 3} más`));
      if (evs.length) c.appendChild(el('span', 'gs-cal-tot', $(evs.reduce((a, q) => a + q.importe + q.intereses, 0))));
      c.tabIndex = 0; c.setAttribute('role', 'button');
      const elegir = () => { diaSel = iso; abierta = null; redibujar(true); };
      c.onclick = elegir; c.onkeydown = (ev) => { if (ev.key === 'Enter') elegir(); };
      grid.appendChild(c);
    }
    cont.replaceChildren(grid);
  });
  const redibujar = (ir) => {
    ['plcal', 'plcal_dia', 'plcal_dia_tit'].forEach((x) => dash.draw(x));
    if (ir) setTimeout(() => document.querySelectorAll('#plcal-dia-card').forEach((x) => x.scrollIntoView({ behavior: 'smooth', block: 'nearest' })), 50);
  };

  /* resumen del mes */
  dash.draw('plcal_k', (e) => {
    const mes = mesSel(); const cs = cuotas().filter((c) => c.vence.startsWith(mes));
    const k = e.dataset.k;
    const v = k === 'total' ? cs.reduce((a, c) => a + c.importe, 0) : k === 'pagado' ? cs.reduce((a, c) => a + c.pagado, 0) : k === 'intereses' ? cs.reduce((a, c) => a + c.intereses, 0)
      : k === 'pendiente' ? cs.reduce((a, c) => a + c.saldo, 0) : k === 'vencido' ? cs.filter((c) => c.estado === 'Vencida' || (c.estado === 'Pago parcial' && c.vence < hoy())).reduce((a, c) => a + c.saldo, 0) : cs.length;
    e.textContent = k === 'n' ? String(v) : $(v);
  });

  /* cuotas del día elegido, con registro de pago */
  dash.draw('plcal_dia_tit', (e) => { e.textContent = diaSel ? ff(diaSel) : 'Elegí un día del calendario'; });
  dash.draw('plcal_dia', (ul) => {
    if (!diaSel) { ul.replaceChildren(el('li', 'gs-vacio', 'Tocá un día o una cuota del calendario para ver el detalle y registrar el pago.')); return; }
    const cs = cuotas().filter((c) => c.vence === diaSel);
    if (!cs.length) { ul.replaceChildren(el('li', 'gs-vacio', 'No hay cuotas este día.')); return; }
    ul.replaceChildren(...cs.map((c) => {
      const li = el('li', 'gs-dia-item gs-plc-item');
      li.dataset.cuota = c.id;
      const t = el('div', 'gs-dia-txt');
      t.append(el('b', null, `${c.plan} · cuota ${c.n} de ${c.de} · ${$(c.importe)}`),
        el('span', null, `${c.empresa || c.estacion || ''}${c.acreedor ? ` · ${c.acreedor}` : ''}${c.obligaciones ? ` · ${c.obligaciones}` : ''}${c.banco ? ` · débito en ${c.banco}` : ''}${c.reprogramada ? ` · reprogramada (antes ${ff(c.reprogramada)})` : ''}`));
      if (c.pagado > 0) t.appendChild(el('span', 'gs-plc-pago', `Pagado el ${ff(c.fecha_pago)}: cuota ${$(c.pagado)}${c.intereses ? ` + intereses ${$(c.intereses)} = ${$(c.total_pagado)}` : ' (sin intereses)'}${c.medio ? ` · ${c.medio}` : ''}${c.operacion ? ` · op. ${c.operacion}` : ''}${c.saldo > 0 ? ` · saldo ${$(c.saldo)}` : ''}`));
      const st = el('span', `gs-st ${c.color}`, c.estado.toUpperCase());
      li.append(el('span', `gs-dot ${c.color}`), t, st);
      if (ERP.puedeEditar()) {
        if (c.saldo > 0) { const b = el('button', 'gs-act gs-act-estado', c.pagado > 0 ? 'Completar pago' : 'Registrar pago'); b.type = 'button'; b.onclick = () => { abierta = abierta === c.id ? null : c.id; dash.draw('plcal_dia'); }; li.appendChild(b); }
        if (c.pagado > 0) { const b = el('button', 'gs-act', 'Volver a pendiente'); b.type = 'button'; b.onclick = async () => { if (!b.dataset.ok) { b.dataset.ok = '1'; b.textContent = '¿Seguro? Confirmar'; b.classList.add('gs-act-warn'); return; } b.disabled = true; try { await guardar(c, null); } catch (e) { b.textContent = ERP.motivo(e); } }; li.appendChild(b); }
      }
      if (abierta === c.id && c.saldo > 0 && ERP.puedeEditar()) li.appendChild(formPago(c));
      return li;
    }));
  });

  const formPago = (c) => {
    const f = el('form', 'gs-plc-form'); f.noValidate = true;
    const campo = (label, input) => { const l = el('label', null, label); l.appendChild(input); return l; };
    const fecha = el('input'); fecha.type = 'date'; fecha.required = true; fecha.value = hoy();
    const cuota = el('input'); cuota.type = 'number'; cuota.min = '0'; cuota.step = '0.01'; cuota.value = String(c.saldo);
    const conInt = el('div', 'gs-plc-si'); conInt.setAttribute('role', 'radiogroup');
    const pregunta = el('span', 'gs-plc-preg', '¿Se pagó con intereses?');
    const si = el('button', 'gs-chip-st', 'Sí'); si.type = 'button';
    const no = el('button', 'gs-chip-st', 'No'); no.type = 'button';
    conInt.append(pregunta, si, no);
    const inter = el('input'); inter.type = 'number'; inter.min = '0'; inter.step = '0.01'; inter.placeholder = '0,00';
    const lInt = campo('Intereses $', inter);
    const medio = el('select', 'dash-select'); ['Débito automático', 'Transferencia', 'VEP', 'Cheque', 'E-Cheq', 'Efectivo'].forEach((x) => medio.add(new Option(x, x)));
    const op = el('input'); op.maxLength = 40;
    const total = el('p', 'gs-plc-total');
    const msg = el('p', 'gs-pop-err'); msg.style.display = 'none';
    let conIntereses = fecha.value > c.vence;
    const marcar = () => { si.classList.toggle('on', conIntereses); no.classList.toggle('on', !conIntereses); si.setAttribute('aria-checked', String(conIntereses)); no.setAttribute('aria-checked', String(!conIntereses)); lInt.style.display = conIntereses ? '' : 'none'; calc(); };
    const calc = () => {
      const v = n(cuota.value), i = conIntereses ? n(inter.value) : 0;
      total.replaceChildren(el('span', null, `Cuota ${$(v)}`), el('span', null, ` + intereses ${$(i)}`), el('b', null, ` = total pagado ${$(r2(v + i))}`));
      if (v < c.saldo - 0.005 && v > 0) total.appendChild(el('span', 'gs-plc-parcial', ` · pago parcial: queda un saldo de ${$(r2(c.saldo - v))}`));
    };
    si.onclick = () => { conIntereses = true; marcar(); inter.focus(); };
    no.onclick = () => { conIntereses = false; marcar(); };
    [cuota, inter].forEach((x) => x.addEventListener('input', calc));
    fecha.addEventListener('change', () => { if (fecha.value > c.vence && !conIntereses) { conIntereses = true; marcar(); } });
    const ok = el('button', 'gs-btn', 'Confirmar pago'); ok.type = 'submit';
    const cancelar = el('button', 'gs-act', 'Cancelar'); cancelar.type = 'button'; cancelar.onclick = () => { abierta = null; dash.draw('plcal_dia'); };
    const grid = el('div', 'gs-plc-grid');
    grid.append(campo('Fecha de pago', fecha), campo('Importe de la cuota pagado $', cuota), lInt, campo('Medio', medio), campo('Nº de operación (opcional)', op));
    f.append(el('p', 'gs-plc-tit', `Pago de la cuota ${c.n} · vence ${ff(c.vence)}${fecha.value > c.vence ? ' (vencida)' : ''}`), conInt, grid, total, el('div', 'gs-plc-acc'), msg);
    f.lastChild.previousSibling.append(ok, cancelar);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = n(cuota.value), i = conIntereses ? n(inter.value) : 0;
      const err = (t) => { msg.textContent = t; msg.style.display = ''; };
      if (!fecha.value) return err('Indicá la fecha de pago.');
      if (v <= 0) return err('Indicá el importe de la cuota que se pagó.');
      if (conIntereses && i <= 0) return err('Indicá el importe de los intereses, o marcá que no hubo.');
      ok.disabled = true;
      try { await guardar(c, { fecha_pago: fecha.value, pagado: r2(c.pagado + v), intereses: r2(c.intereses + i), medio: medio.value, operacion: op.value.trim() }); abierta = null; } catch (ex) { err(ERP.motivo(ex)); ok.disabled = false; }
    });
    marcar();
    return f;
  };

  /* guarda el pago (o lo anula si pago = null) */
  const guardar = async (c, pago) => {
    const db = await ERP.db();
    const ahora = new Date().toISOString();
    const detalle = pago ? `Cuota ${c.n} de ${c.plan}: pagado ${$(pago.pagado - c.pagado)}${pago.intereses > c.intereses ? ` + intereses ${$(pago.intereses - c.intereses)}` : ' sin intereses'} el ${ff(pago.fecha_pago)}` : `Cuota ${c.n} de ${c.plan}: vuelve a pendiente`;
    if (c.origen === 'Propio') {
      const p = rows('planes_fin').find((x) => x.id === c.plan_id); if (!p) throw new Error('No se encontró el plan.');
      const nuevas = p.cuotas.map((x, j) => {
        if (j !== c.idx) return x;
        if (!pago) { const { fecha_pago: _f, medio: _m, operacion: _o, ...resto } = x; return { ...resto, pagado: 0, intereses: 0 }; }
        return { ...x, pagado: pago.pagado, intereses: pago.intereses, fecha_pago: pago.fecha_pago, medio: pago.medio, operacion: pago.operacion };
      });
      await db.doc(`data/erp/planes_fin/${p.id}`).update({ cuotas: nuevas, modificado: ahora, modificado_por: ERP.uid || '' });
      await ERP.log(db, 'planes_fin', p.id, pago ? 'Pago de cuota' : 'Pago anulado', detalle);
    } else {
      const ref = db.doc(`data/erp/plan_cuotas/${c.id}`);
      if (!pago) await ref.delete();
      else await ref.set({ plan_id: c.plan_id, plan: c.plan, empresa: c.empresa, n: c.n, vence: c.vence, importe: c.importe, ...pago, modificado: ahora, modificado_por: ERP.uid || '' });
      await ERP.log(db, 'plan_cuotas', c.id, pago ? 'Pago de cuota' : 'Pago anulado', detalle);
    }
  };

  /* navegación del calendario */
  const mover = (k) => { const [y, m] = mesSel().split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); setMes(d.toISOString().slice(0, 7)); };
  document.querySelectorAll('#plcal-prev').forEach((b) => b.addEventListener('click', () => mover(-1)));
  document.querySelectorAll('#plcal-next').forEach((b) => b.addEventListener('click', () => mover(1)));
  document.querySelectorAll('#plcal-hoy').forEach((b) => b.addEventListener('click', () => { diaSel = hoy(); setMes(hoy().slice(0, 7)); redibujar(false); }));
})();
