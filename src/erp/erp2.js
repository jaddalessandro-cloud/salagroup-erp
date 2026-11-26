/* ================= Sala Group · etapa 2: Drive, Tesorería, deudas, administración, operación, comercial, proyectos ================= */
const E2 = window.ERP;
const h2 = () => window.SP_HOY();
const e2 = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
const f2 = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso || '');
const n2 = (v) => Number(v) || 0;
const rows2 = (id) => { const d = dash.data(id); return d.status === 'ok' && Array.isArray(d.data) ? d.data : []; };
const enU = (r) => E2.enUnidad(r);
const unidadTxt = () => ({ grupo: 'Grupo (consolidado)', shell: 'Shell', ypf: 'YPF', alvemem: 'Alvemem (Tolosa + Olmos)', tolosa: 'Alvemem · Tolosa', olmos: 'Alvemem · Olmos' }[dash.params().emp || 'grupo'] || 'Grupo');
const addDias = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const addMeses = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const dim = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`; };

/* ---------- registros nuevos: rutas, prefijos, estados ---------- */
const NUEVOS = { pagos_prov: 'PAG', egresos: 'EGR', caja: 'CAJ', cuentas_banco: 'BCO', extractos: 'EXT', extracto_mov: 'MOV', planes_fin: 'PLF', clientes: 'CLI', proveedores: 'PRV', facturas: 'FAC', contratos: 'CON', societaria: 'SOC', seguros: 'SEG', tramites: 'TRA', ventas_fisicas: 'VF', precios: 'PRE', tienda: 'TIE', proyectos: 'PRY' };
Object.entries(NUEVOS).forEach(([ds, p]) => { window.ERP_PATHS[ds] = `data/erp/${ds}`; window.ERP_PREF[ds] = p; });
Object.assign(window.ERP_ETIQ, { sesion: 'Sesión', pagos_prov: 'Pagos a proveedores', egresos: 'Egresos', caja: 'Caja', cuentas_banco: 'Cuentas bancarias', extractos: 'Extractos', extracto_mov: 'Movimientos de extracto', planes_fin: 'Planes de pago propios', clientes: 'Clientes', proveedores: 'Proveedores', facturas: 'Facturación', contratos: 'Contratos', societaria: 'Documentación societaria', seguros: 'Seguros', tramites: 'Trámites', ventas_fisicas: 'Operación diaria', precios: 'Precios', tienda: 'Tienda', proyectos: 'Proyectos', conciliacion: 'Conciliación' });
Object.assign(window.ERP_OK, { pago: ['Pagado'], factura: ['Pagada', 'Cobrada'], contrato: ['Renovado', 'Finalizado'], poliza: ['Renovada'], doc: ['Presentado'], tramite: ['Finalizado'], plan: ['Cancelado'], proyecto: ['Finalizado'] });
window.ERP_ESTADOS.compra = ['Pendiente de pago', 'Pago parcial', 'Pendiente de gestión', 'Pagada', 'Anulada'];
Object.assign(window.ERP_ESTADOS, {
  pago: ['Pendiente', 'Programado', 'Pendiente de gestión', 'Pagado', 'Anulado'],
  factura: ['Pendiente', 'Pendiente de gestión', 'Pagada', 'Cobrada', 'Anulada'],
  contrato: ['Vigente', 'Pendiente de gestión', 'Renovado', 'Finalizado', 'Cancelado'],
  poliza: ['Vigente', 'Pendiente de gestión', 'Renovada', 'Anulada'],
  doc: ['Vigente', 'Pendiente de gestión', 'Presentado', 'Anulado'],
  tramite: ['Iniciado', 'En curso', 'Pendiente de gestión', 'Finalizado', 'Anulado'],
  proyecto: ['Planificado', 'En ejecución', 'Pendiente de gestión', 'Finalizado', 'Cancelado'],
});
/* planes propios: al darlos de alta se arma el calendario de cuotas */
E2.antes = E2.antes || {};
E2.antes.planes_fin = (fila, prev, edicion) => {
  if (edicion && Array.isArray(prev.cuotas) && prev.cuotas.length) return;
  const n = Math.max(1, Math.min(240, n2(fila.cuotas_n) || 1));
  const cap = n2(fila.capital), int = n2(fila.interes_total);
  const imp = n2(fila.importe_cuota) || Math.round(((cap + int) / n) * 100) / 100;
  const paso = fila.frecuencia === 'Semanal' ? 7 : fila.frecuencia === 'Quincenal' ? 15 : 0;
  const ini = fila.primer_vencimiento || h2();
  fila.cuotas = Array.from({ length: n }, (_, i) => ({ n: i + 1, vence: paso ? addDias(ini, paso * i) : addMeses(ini, i), capital: Math.round((cap / n) * 100) / 100, interes: Math.round((int / n) * 100) / 100, importe: imp, pagado: 0, fecha_pago: '' }));
};
E2.antes.cuentas_banco = (fila) => { if (!fila.fecha_actualizacion) fila.fecha_actualizacion = h2(); };

/* ---------- Google Drive: carpeta ESTACIONES (en vivo) ---------- */
const DRIVE_RAIZ = '1tS741373VbJ-Gl39qvAm5n2EdYrOZeFR';
dash.loader('drive_archivos', {
  description: 'Recorre hasta 5 páginas de 100 archivos de la carpeta ESTACIONES (los más recientes primero) y deja una fila por archivo.',
  fn: async ({ answer, call, args }) => {
    let a = answer; const out = []; let pag = 1;
    const leer = (x) => (x && Array.isArray(x.files) ? x.files : []);
    out.push(...leer(a));
    while (a && a.nextPageToken && pag < 5) { a = await call('search_files', { ...args, pageToken: a.nextPageToken }); out.push(...leer(a)); pag += 1; }
    if (a && a.error) throw new Error(typeof a.error === 'string' ? a.error : a.error.message);
    const rows = out.map((f) => ({ id: f.id, nombre: f.title, tipo: f.mimeType, carpeta_id: f.parentId || '', creado: f.createdTime || '', modificado: f.modifiedTime || '', url: f.viewUrl || '', tamano: f.fileSize ? Number(f.fileSize) : null }));
    return { rows, columns: ['id', 'nombre', 'tipo', 'carpeta_id', 'creado', 'modificado', 'url', 'tamano'], truncated: !!(a && a.nextPageToken) };
  },
});
dash.loader('drive_carpetas', {
  description: 'Lista todas las carpetas de ESTACIONES (hasta 3 páginas de 100) con su carpeta madre.',
  fn: async ({ answer, call, args }) => {
    let a = answer; const out = []; let pag = 1;
    const leer = (x) => (x && Array.isArray(x.files) ? x.files : []);
    out.push(...leer(a));
    while (a && a.nextPageToken && pag < 3) { a = await call('search_files', { ...args, pageToken: a.nextPageToken }); out.push(...leer(a)); pag += 1; }
    if (a && a.error) throw new Error(typeof a.error === 'string' ? a.error : a.error.message);
    return { rows: out.map((f) => ({ id: f.id, nombre: f.title, carpeta_id: f.parentId || '', url: f.viewUrl || '', modificado: f.modifiedTime || '' })), columns: ['id', 'nombre', 'carpeta_id', 'url', 'modificado'], truncated: !!(a && a.nextPageToken) };
  },
});
dash.calc('drive_docs', {
  title: 'Documentos de ESTACIONES clasificados',
  description: 'Cada archivo con su ruta de carpetas, la unidad de negocio y la categoría que surgen de los nombres de carpeta y de archivo, y el módulo del sistema con el que se relaciona.',
  inputs: ['drive_archivos', 'drive_carpetas'],
  fn: (archivos, carpetas) => {
    const raiz = '1tS741373VbJ-Gl39qvAm5n2EdYrOZeFR';
    const por = Object.fromEntries((carpetas || []).map((c) => [c.id, c]));
    const ruta = (id) => { const p = []; let c = por[id]; let g = 0; while (c && g++ < 12) { p.unshift(c.nombre); c = por[c.carpeta_id]; } return p; };
    const clas = [
      [/RESUMENES BANCARIOS/, 'Extractos bancarios', 'Tesorería', 'teso-extractos'], [/CAJAS/, 'Planillas de caja', 'Tesorería', 'teso-caja'], [/ACUERDOS CHEQUES/, 'Cheques', 'Finanzas', 'fin-cheques'],
      [/PRESTAMOS/, 'Deudas y financiamiento', 'Finanzas', 'fin-deudas'], [/PLANES AFIP|PLANES DE PAGO/, 'Planes de pago', 'Finanzas', 'fin-planes'], [/BANCO SANTA FE REQUISITOS/, 'Bancos', 'Finanzas', 'fin-deudas'],
      [/BALANCES|DDJJ|IVA|ESTATUTO|ESCRITURA|CESION/, 'Documentación societaria e impositiva', 'Administración', 'adm-soc'], [/BMW|MERCEDES/, 'Vehículos', 'Flota', 'flota-unid'],
      [/CARPETAS MEDICAS|DATOS PERSONALES|CUOTA ALIMENTARIA|CARTAS DOCUMENTO/, 'RRHH · confidencial', 'RRHH', 'rrhh-leg'], [/SUELDOS|FRANCOS|VACACIONES|ALTAS Y BAJAS|FONDOS FAL|PEDIDOS DE ROPA|EMPLEADOS/, 'Recursos humanos', 'RRHH', 'rrhh-leg'],
      [/CUENTAS CORRIENTES MAYORISTAS|RECIBOS/, 'Clientes', 'Administración', 'adm-cli'], [/PROVEEDORES|BELPE|ANDREANI|FACTURAS/, 'Proveedores y facturas', 'Administración', 'adm-prov'], [/GASTOS FIJOS/, 'Egresos', 'Finanzas', 'fin-egresos'],
      [/SECRETARIA DE ENERGIA|SEGURIDAD Y AMBIENTE/, 'Trámites y habilitaciones', 'Administración', 'adm-tra'], [/TIENDA/, 'Tienda', 'Comercial', 'com-tienda'], [/VENTAS COMB/, 'Ventas', 'Comercial', 'com-ventas'],
      [/YPF EN RUTA|CAMPUS|INCIDENCIAS|NLP|SISTEMA UNICO/, 'Operaciones', 'Operativo', 'ope-ot'],
    ];
    const uni = (t) => (/OLMOS/.test(t) ? 'Olmos' : /TOLOSA/.test(t) ? 'Tolosa' : /ALVEMEM/.test(t) ? 'Alvemem' : /COMB(USTIBLES)?\.? ?MAG|MAGDALENA|\bYPF\b|\bCM\b|TIENDA FULL/.test(t) ? 'YPF' : /\bDSB\b|SHELL/.test(t) ? 'Shell' : 'Grupo');
    return (archivos || []).filter((f) => f.carpeta_id === raiz || por[f.carpeta_id]).map((f) => {
      const r = ruta(f.carpeta_id);
      const t = `${r.join(' / ')} / ${f.nombre}`.toUpperCase();
      const c = clas.find(([re]) => re.test(t)) || [null, 'Otros', 'Documentación', 'docs-drive'];
      return { ...f, ruta: r.length ? r.join(' / ') : 'ESTACIONES', unidad: uni(t), categoria: c[1], modulo: c[2], ir: c[3], confidencial: c[1] === 'RRHH · confidencial' };
    });
  },
});
const docsFiltrados = (cat, q) => rows2('drive_docs').filter((r) => E2.enUnidad({ unidad: r.unidad }) && (!cat || r.categoria === cat || r.modulo === cat) && (!q || `${r.nombre} ${r.ruta}`.toLowerCase().includes(q.toLowerCase())));
E2.dq = { cat: '', q: '' };
dash.draw('tb_drive', (tb) => {
  const d = dash.data('drive_docs');
  if (d.status === 'connect' || d.status === 'declined') return window.spVacia(tb, 7, 'Hace falta permitir el conector de Google Drive para ver la carpeta ESTACIONES.');
  if (d.status === 'error') return window.spVacia(tb, 7, 'No se pudo leer la carpeta ESTACIONES de Google Drive.');
  if (d.status !== 'ok') return window.spVacia(tb, 7, 'Leyendo Google Drive…');
  const cat = tb.dataset.cat || E2.dq.cat;
  const lim = Number(tb.dataset.max || 400);
  const rows = docsFiltrados(cat, tb.dataset.cat ? '' : E2.dq.q).slice(0, lim);
  if (!rows.length) return window.spVacia(tb, 7, 'No hay documentos de esta categoría para la unidad elegida.');
  tb.replaceChildren(...rows.map((r) => {
    const tr = e2('tr'); tr.dataset.key = encodeURIComponent(r.id);
    const td = e2('td'); const a = e2('a', null, r.nombre); if (/^https:\/\//.test(r.url)) { a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; } td.appendChild(a); td.style.whiteSpace = 'normal'; td.style.minWidth = '220px';
    const ir = e2('td'); const b = e2('button', 'gs-act', r.modulo); b.type = 'button'; b.onclick = () => E2.ir(r.ir); ir.appendChild(b);
    const ru = e2('td', null, r.ruta); ru.style.whiteSpace = 'normal'; ru.style.minWidth = '180px';
    tr.append(td, e2('td', null, r.categoria), e2('td', null, r.unidad), ru, e2('td', null, f2(r.modificado.slice(0, 10))), e2('td', null, f2(r.creado.slice(0, 10))), ir);
    return tr;
  }));
});
dash.draw('drive_res', (el) => {
  const d = dash.data('drive_docs');
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  const rows = docsFiltrados('', '');
  const k = el.dataset.k, hace7 = addDias(h2(), -7);
  const v = k === 'total' ? rows.length : k === 'nuevos' ? rows.filter((r) => r.creado.slice(0, 10) >= hace7).length : k === 'modif' ? rows.filter((r) => r.modificado.slice(0, 10) >= hace7).length : rows2('drive_carpetas').length;
  el.textContent = window.SP.n(v) + (k === 'total' && d.truncated ? '+' : '');
});
dash.draw('drive_cats', (ul) => {
  const d = dash.data('drive_docs');
  if (d.status !== 'ok') { ul.replaceChildren(e2('li', 'gs-vacio', d.status === 'connect' ? 'Permití el conector de Google Drive para clasificar la carpeta.' : '—')); return; }
  const g = d3.rollups(docsFiltrados('', ''), (a) => a.length, (r) => r.categoria).sort((a, b) => b[1] - a[1]);
  ul.replaceChildren(...g.map(([c, n]) => { const li = e2('li'); const b = e2('button', `gs-act${E2.dq.cat === c ? ' gs-act-on' : ''}`, `${c} · ${n}`); b.type = 'button'; b.onclick = () => { E2.dq.cat = E2.dq.cat === c ? '' : c; dash.draw('tb_drive'); dash.draw('drive_cats'); }; li.appendChild(b); return li; }));
});
dash.draw('drive_arbol', (ul) => {
  const c = rows2('drive_carpetas');
  if (!c.length) { ul.replaceChildren(e2('li', 'gs-vacio', dash.data('drive_carpetas').status === 'ok' ? 'Sin carpetas.' : '—')); return; }
  const hijos = {}; c.forEach((x) => { (hijos[x.carpeta_id] ??= []).push(x); });
  const armar = (pid, nivel) => (hijos[pid] || []).sort((a, b) => a.nombre.localeCompare(b.nombre)).flatMap((x) => {
    const li = e2('li', 'gs-arbol-i'); li.style.paddingLeft = `${nivel * 16}px`;
    const a = e2('a', null, x.nombre); if (/^https:\/\//.test(x.url)) { a.href = x.url; a.target = '_blank'; a.rel = 'noopener'; }
    li.appendChild(a);
    return [li, ...armar(x.id, nivel + 1)];
  });
  ul.replaceChildren(...armar('1tS741373VbJ-Gl39qvAm5n2EdYrOZeFR', 0));
});

/* ---------- egresos consolidados ---------- */
dash.calc('egresos_todos', {
  title: 'Egresos consolidados',
  description: 'Egresos cargados en Finanzas, órdenes de compra y facturas recibidas no anuladas, y los pagos de la planilla de gastos fijos 2026 (DSB, YPF y Alvemem). Cada operación aparece una sola vez: las órdenes de compra y facturas vinculadas a un egreso no se repiten.',
  inputs: ['egresos', 'ordenes_compra', 'facturas', 'gastos_fijos', 'gastos_empresas', 'pagos_prov'],
  fn: (egr, oc, fac, gf, ge, pagos) => {
    const vinc = new Set((egr || []).map((r) => r.origen_id).filter(Boolean));
    const a = (egr || []).filter((r) => r.estado !== 'Anulado').map((r) => ({ id: r.id, fecha: r.fecha, concepto: r.concepto, categoria: r.categoria || 'Otros conceptos', beneficiario: r.beneficiario || '', importe: n2(r.importe), estacion: r.estacion || 'Grupo', estado: r.estado, medio: r.medio || '', origen: 'Egresos' }));
    const pag = (pagos || []).filter((p) => p.estado !== 'Anulado');
    const ocs = (oc || []).filter((r) => !vinc.has(r.id) && !['Anulada'].includes(r.estado));
    const porOC = d3.rollup(pag, (a) => d3.sum(a, (p) => n2(p.importe)), (p) => p.oc_id);
    const catOC = (r) => (r && r.categoria === 'Mantenimiento' ? 'Mantenimiento' : 'Compras');
    const b = [
      ...ocs.filter((r) => n2(r.monto) - (porOC.get(r.id) || 0) > 0.005).map((r) => ({ id: r.id, fecha: r.fecha_pago || r.fecha, concepto: r.concepto || r.proveedor, categoria: catOC(r), beneficiario: r.proveedor || '', importe: n2(r.monto) - (porOC.get(r.id) || 0), estacion: r.estacion || 'Grupo', estado: 'Pendiente', medio: '', banco: '', origen: 'Compras (saldo de OC)' })),
      ...pag.map((p) => { const o = (oc || []).find((x) => x.id === p.oc_id); return { id: p.id, fecha: p.fecha, concepto: `Pago ${o ? o.numero || o.id : p.oc_id}${o && o.concepto ? ' · ' + o.concepto : ''}`, categoria: catOC(o), beneficiario: o ? o.proveedor : '', importe: n2(p.importe), estacion: o ? o.estacion || 'Grupo' : 'Grupo', estado: 'Pagado', medio: p.medio || '', banco: p.banco || '', origen: 'Pago a proveedores' }; }),
    ];
    const c = (fac || []).filter((r) => r.tipo === 'Recibida' && !vinc.has(r.id) && !['Anulada'].includes(r.estado)).map((r) => ({ id: r.id, fecha: r.vence || r.fecha, concepto: `${r.comprobante || 'Factura'} ${r.numero || ''}`.trim(), categoria: r.categoria || 'Proveedores', beneficiario: r.tercero || '', importe: n2(r.total), estacion: r.estacion || 'Grupo', estado: r.estado === 'Pagada' ? 'Pagado' : 'Pendiente', medio: '', origen: 'Facturación' }));
    const cat = { energia: 'Servicios', servicios: 'Servicios', honorarios: 'Honorarios', cargas_sociales: 'Sueldos y cargas sociales', iibb_pagado: 'Impuestos', iva: 'Impuestos', ganancias_anticipo: 'Impuestos', tarjeta: 'Gastos bancarios', prestamos: 'Deudas y préstamos', planes_fiscales: 'Impuestos', costo_gnc: 'Compras', alquiler: 'Alquileres', seguros: 'Seguros', otros_excluidos: 'Otros conceptos' };
    const ult = (m) => `${m}-28`;
    const d = (gf || []).map((r, i) => ({ id: `GF-DSB-${i}`, fecha: ult(r.mes), concepto: r.concepto, categoria: cat[r.categoria] || 'Otros conceptos', beneficiario: '', importe: n2(r.monto), estacion: 'Shell', estado: 'Pagado', medio: '', origen: 'Planilla gastos fijos' }));
    const e = (ge || []).map((r, i) => ({ id: `GF-${r.unidad}-${i}`, fecha: ult(r.mes), concepto: r.concepto, categoria: cat[r.categoria] || 'Otros conceptos', beneficiario: '', importe: n2(r.monto), estacion: r.unidad === 'YPF' ? 'YPF' : r.unidad, estado: 'Pagado', medio: '', origen: 'Planilla gastos fijos' }));
    return [...a, ...b, ...c, ...d, ...e].filter((r) => r.fecha);
  },
});
const enRango = (iso) => { const p = dash.params(); const d = (iso || '').slice(0, 10); if (p.fecha_desde && p.fecha_hasta) return d >= p.fecha_desde && d <= p.fecha_hasta; const [a, b] = window.SP.rango(); const m = d.slice(0, 7); return m >= a && m <= b; };
dash.calc('egresos_resumen', {
  title: 'Egresos por concepto',
  description: 'Total, pagado y pendiente por categoría en el período y la unidad elegidos, con su participación sobre el total.',
  inputs: ['egresos_todos'],
  fn: (todos) => {
    const v = todos.filter((r) => window.ERP.enUnidad(r) && enRango(r.fecha));
    const tot = d3.sum(v, (r) => r.importe);
    return d3.rollups(v, (a) => ({ total: d3.sum(a, (r) => r.importe), pagado: d3.sum(a.filter((r) => r.estado === 'Pagado'), (r) => r.importe), n: a.length }), (r) => r.categoria)
      .map(([categoria, o]) => ({ categoria, ...o, pendiente: o.total - o.pagado, participacion: tot ? o.total / tot : 0 })).sort((a, b) => b.total - a.total);
  },
});
dash.calc('egresos_mes', {
  title: 'Egresos por mes',
  description: 'Total mensual de egresos de la unidad elegida, separado en pagado y pendiente.',
  inputs: ['egresos_todos'],
  fn: (todos) => d3.rollups(todos.filter((r) => window.ERP.enUnidad(r) && enRango(r.fecha)), (a) => ({ total: d3.sum(a, (r) => r.importe), pagado: d3.sum(a.filter((r) => r.estado === 'Pagado'), (r) => r.importe) }), (r) => r.fecha.slice(0, 7)).map(([mes, o]) => ({ mes, ...o })).sort((a, b) => a.mes.localeCompare(b.mes)),
});
dash.calc('egresos_prov', {
  title: 'Egresos por proveedor o beneficiario',
  description: 'Los 15 beneficiarios con más egresos en el período y la unidad elegidos.',
  inputs: ['egresos_todos'],
  fn: (todos) => d3.rollups(todos.filter((r) => window.ERP.enUnidad(r) && enRango(r.fecha) && r.beneficiario), (a) => ({ total: d3.sum(a, (r) => r.importe), n: a.length }), (r) => r.beneficiario).map(([beneficiario, o]) => ({ beneficiario, ...o })).sort((a, b) => b.total - a.total).slice(0, 15),
});
dash.draw('tb_egr_todos', (tb) => {
  const cols = tb.dataset.cols.split(',').map((c) => c.split(':'));
  const d = dash.data('egresos_todos');
  if (d.status !== 'ok') return window.spVacia(tb, cols.length + 1, d.status === 'error' ? 'No se pudieron calcular los egresos.' : '—');
  const rows = E2.filtrar('egresos_todos', d.data.filter((r) => enRango(r.fecha)), 'pago', 'fecha').sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 500);
  E2.tabla(tb, rows, { cols, kind: 'pago', ds: 'egresos_todos', stfecha: 'fecha', editable: false, anchas: ['concepto', 'beneficiario'] });
  tb.querySelectorAll('.gs-st').forEach((b) => { b.disabled = true; });
});
const tablaSimple = (tb, rows, cols, n) => {
  if (!rows.length) return window.spVacia(tb, n || cols.length, 'Sin datos para la unidad y el período elegidos.');
  tb.replaceChildren(...rows.map((r) => { const tr = e2('tr'); cols.forEach(([c, f]) => tr.appendChild(e2('td', f === 'm' || f === 'p' || f === 'n' ? 'gs-num' : null, f === 'm' ? window.SP.$(r[c]) : f === 'p' ? window.SP.p(r[c]) : f === 'n' ? window.SP.n(r[c]) : f === 'd' ? f2(r[c]) : f === 'mes' ? window.SP.mes(r[c]) : r[c]))); return tr; }));
};
dash.draw('tb_egr_cat', (tb) => tablaSimple(tb, rows2('egresos_resumen'), [['categoria'], ['total', 'm'], ['pagado', 'm'], ['pendiente', 'm'], ['participacion', 'p']]));
dash.draw('tb_egr_prov', (tb) => tablaSimple(tb, rows2('egresos_prov'), [['beneficiario'], ['n', 'n'], ['total', 'm']]));
dash.draw('ch_egr_mes', (el) => {
  const rows = rows2('egresos_mes');
  el.replaceChildren();
  if (!rows.length) { el.appendChild(e2('p', 'sp-note', 'Sin egresos en el período.')); return; }
  const width = el.clientWidth || 600, height = 240;
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.total) || 1]).nice();
  const m = { t: 10, r: 8, b: 24, l: window.spMargen(el, y.ticks(5).map(window.SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.mes)).range([0, W]).padding(0.25);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Egresos por mes, pagados y pendientes');
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  window.spGrid(g, y, W, window.SP.ejeM);
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickFormat(window.SP.mes).tickSizeOuter(0)).call(window.SP.axisStyle);
  const tip = window.SP.tip(el);
  g.selectAll('rect.p').data(rows).join('rect').attr('class', 'p').attr('x', (r) => x(r.mes)).attr('width', x.bandwidth()).attr('y', (r) => y(r.pagado)).attr('height', (r) => H - y(r.pagado)).style('fill', 'var(--sp-c0)')
    .on('mousemove', (ev, r) => tip.show(ev, [window.SP.mesLargo(r.mes), `Total: ${window.SP.m(r.total)}`, `Pagado: ${window.SP.m(r.pagado)}`, `Pendiente: ${window.SP.m(r.total - r.pagado)}`])).on('mouseleave', tip.hide);
  g.selectAll('rect.q').data(rows).join('rect').attr('class', 'q').attr('x', (r) => x(r.mes)).attr('width', x.bandwidth()).attr('y', (r) => y(r.total)).attr('height', (r) => y(r.pagado) - y(r.total)).style('fill', 'var(--sp-c1)')
    .on('mousemove', (ev, r) => tip.show(ev, [window.SP.mesLargo(r.mes), `Total: ${window.SP.m(r.total)}`, `Pendiente: ${window.SP.m(r.total - r.pagado)}`])).on('mouseleave', tip.hide);
});

/* ---------- deudas por banco y planes propios ---------- */
const bancoNorm = (b) => { const s = String(b || '').replace(/^Banco\s+/i, '').trim(); const k = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return { nacion: 'Nación', 'santa fe': 'Santa Fe', frances: 'BBVA (Francés)', bbva: 'BBVA (Francés)', provincia: 'Provincia', galicia: 'Galicia', macro: 'Macro', santander: 'Santander' }[k] || s || '(sin banco)'; };
window.ERP_BANCO = bancoNorm;
dash.calc('deuda_bancos', {
  title: 'Deuda por banco',
  description: 'Por entidad: calificación y saldo usado de acuerdos y valores negociados, capital original, saldo, cuota y cuotas pagadas y pendientes de préstamos (planilla Situación), más las financiaciones cargadas en el sistema con ese banco. Filtra por la unidad elegida.',
  inputs: ['lineas_bancarias', 'planes_fin'],
  fn: (lineas, planes) => {
    const g = {};
    const o = (b) => (g[b] ??= { banco: b, calificacion: 0, saldo_lineas: 0, capital_original: 0, saldo_prestamos: 0, cuota_mensual: 0, cuotas_pagadas: 0, cuotas_pendientes: 0, intereses_pendientes: 0, proximo_vto: '', operaciones: 0 });
    (lineas || []).filter((r) => window.ERP.enUnidad(r)).forEach((r) => {
      const x = o(bancoNorm(r.banco)); x.operaciones += 1;
      if (r.tipo === 'Línea') { x.calificacion += n2(r.calificacion); x.saldo_lineas += n2(r.saldo); return; }
      x.capital_original += n2(r.monto); x.saldo_prestamos += n2(r.saldo); x.cuota_mensual += n2(r.cuota);
      const m = /(\d+)\s*de\s*(\d+)/.exec(r.plazo || '');
      if (m) { x.cuotas_pagadas += Number(m[1]) - 1; x.cuotas_pendientes += Number(m[2]) - Number(m[1]) + 1; }
      if (r.vencimiento && (!x.proximo_vto || r.vencimiento < x.proximo_vto)) x.proximo_vto = r.vencimiento;
    });
    (planes || []).filter((p) => window.ERP.enUnidad(p) && p.estado !== 'Cancelado' && p.estado !== 'Anulado' && (p.tipo === 'Préstamo bancario' || p.banco)).forEach((p) => {
      const x = o(bancoNorm(p.banco || p.acreedor)); x.operaciones += 1;
      const cu = Array.isArray(p.cuotas) ? p.cuotas : [];
      x.capital_original += n2(p.capital);
      const pend = cu.filter((c) => n2(c.pagado) < n2(c.importe));
      x.saldo_prestamos += d3.sum(pend, (c) => n2(c.importe) - n2(c.pagado));
      x.cuotas_pagadas += cu.length - pend.length; x.cuotas_pendientes += pend.length;
      x.intereses_pendientes += d3.sum(pend, (c) => n2(c.interes));
      if (pend[0]) { x.cuota_mensual += n2(pend[0].importe); if (!x.proximo_vto || pend[0].vence < x.proximo_vto) x.proximo_vto = pend[0].vence; }
    });
    const rows = Object.values(g).map((x) => ({ ...x, deuda_total: x.saldo_lineas + x.saldo_prestamos }));
    rows.sort((a, b) => b.deuda_total - a.deuda_total);
    if (rows.length) rows.push(rows.reduce((t, r) => { Object.keys(r).forEach((k) => { if (typeof r[k] === 'number') t[k] = (t[k] || 0) + r[k]; }); if (r.proximo_vto && (!t.proximo_vto || r.proximo_vto < t.proximo_vto)) t.proximo_vto = r.proximo_vto; return t; }, { banco: 'Total' }));
    return rows;
  },
});
E2.bancoSel = '';
dash.draw('sel_bancos', (div) => {
  const rows = rows2('deuda_bancos').filter((r) => r.banco !== 'Total');
  const mk = (b, txt) => { const x = e2('button', `sp-chip${E2.bancoSel === b ? ' on' : ''}`, txt); x.type = 'button'; x.onclick = () => { E2.bancoSel = b; ['sel_bancos', 'tb_banco_ops', 'dbk', 'banco_tit'].forEach((d) => dash.draw(d)); }; return x; };
  div.replaceChildren(mk('', 'Todos (consolidado)'), ...rows.map((r) => mk(r.banco, r.banco)));
});
dash.draw('banco_tit', (el) => { el.textContent = E2.bancoSel || 'Todos los bancos'; });
dash.draw('dbk', (el) => {
  const r = rows2('deuda_bancos').find((x) => x.banco === (E2.bancoSel || 'Total'));
  el.setAttribute('data-where', `banco=${encodeURIComponent(E2.bancoSel || 'Total')}`);
  if (!r) { el.textContent = '—'; return; }
  window.spFmt(el, r[el.dataset.field]);
});
dash.draw('tb_deuda_bancos', (tb) => {
  const rows = rows2('deuda_bancos');
  if (!rows.length) return window.spVacia(tb, 9, 'Sin deudas registradas para la unidad elegida.');
  tb.replaceChildren(...rows.map((r) => {
    const tr = e2('tr', r.banco === 'Total' ? 'sp-tot' : null); tr.dataset.key = encodeURIComponent(r.banco);
    const b = e2('td'); if (r.banco !== 'Total') { const x = e2('button', 'gs-link', r.banco); x.type = 'button'; x.onclick = () => { E2.bancoSel = r.banco; ['sel_bancos', 'tb_banco_ops', 'dbk', 'banco_tit'].forEach((d) => dash.draw(d)); document.querySelectorAll('#banco-ficha').forEach((c) => c.scrollIntoView({ behavior: 'smooth' })); }; b.appendChild(x); } else b.textContent = 'Total';
    tr.append(b, ...[['capital_original', 'm'], ['saldo_prestamos', 'm'], ['saldo_lineas', 'm'], ['deuda_total', 'm'], ['cuota_mensual', 'm'], ['cuotas_pagadas', 'n'], ['cuotas_pendientes', 'n']].map(([c, f]) => e2('td', 'gs-num', f === 'm' ? window.SP.m(r[c]) : window.SP.n(r[c]))), e2('td', null, f2(r.proximo_vto)));
    return tr;
  }));
});
dash.draw('tb_banco_ops', (tb) => {
  const lin = rows2('lineas_bancarias').filter((r) => E2.enUnidad(r) && (!E2.bancoSel || bancoNorm(r.banco) === E2.bancoSel));
  const pl = rows2('planes_fin').filter((p) => E2.enUnidad(p) && (p.tipo === 'Préstamo bancario' || p.banco) && (!E2.bancoSel || bancoNorm(p.banco || p.acreedor) === E2.bancoSel));
  const rows = [...lin.map((r) => ({ origen: 'Planilla Situación', empresa: r.empresa, banco: bancoNorm(r.banco), op: r.linea, cal: r.calificacion, orig: r.monto, saldo: r.saldo, cuota: r.cuota, plazo: r.plazo, tasa: r.tasa, vto: r.vencimiento })),
    ...pl.map((p) => { const cu = Array.isArray(p.cuotas) ? p.cuotas : []; const pend = cu.filter((c) => n2(c.pagado) < n2(c.importe)); return { origen: 'Cargado en el sistema', empresa: p.estacion, banco: bancoNorm(p.banco || p.acreedor), op: p.nombre, cal: null, orig: n2(p.capital), saldo: d3.sum(pend, (c) => n2(c.importe) - n2(c.pagado)), cuota: pend[0] ? n2(pend[0].importe) : null, plazo: `${cu.length - pend.length} de ${cu.length} pagas`, tasa: p.tasa ? n2(p.tasa) / 100 : null, vto: pend[0] ? pend[0].vence : '' }; })];
  if (!rows.length) return window.spVacia(tb, 10, 'Sin operaciones para el banco y la unidad elegidos.');
  tb.replaceChildren(...rows.map((r) => { const tr = e2('tr'); tr.append(e2('td', null, r.empresa), e2('td', null, r.banco), e2('td', null, r.op), e2('td', 'gs-num', r.cal == null ? '' : window.SP.m(r.cal)), e2('td', 'gs-num', r.orig == null ? '' : window.SP.m(r.orig)), e2('td', 'gs-num', r.saldo == null ? '' : window.SP.m(r.saldo)), e2('td', 'gs-num', r.cuota == null ? '' : window.SP.m(r.cuota)), e2('td', null, r.plazo || ''), e2('td', 'gs-num', r.tasa == null ? '' : window.SP.p(r.tasa)), e2('td', null, f2(r.vto)), e2('td', null, r.origen)); return tr; }));
});
/* planes propios: comparación y ficha con calendario de cuotas */
dash.calc('planes_fin_res', {
  title: 'Planes de pago propios',
  description: 'Por plan cargado en el sistema: total, pagado, saldo restante, cuotas pagadas y pendientes, próximo vencimiento y relación interés sobre capital.',
  inputs: ['planes_fin'],
  fn: (planes) => (planes || []).map((p) => {
    const cu = Array.isArray(p.cuotas) ? p.cuotas : [];
    const total = d3.sum(cu, (c) => n2(c.importe)), pagado = d3.sum(cu, (c) => n2(c.pagado));
    const pend = cu.filter((c) => n2(c.pagado) < n2(c.importe));
    return { id: p.id, nombre: p.nombre, tipo: p.tipo, acreedor: p.acreedor || p.banco || '', estacion: p.estacion, total, pagado, saldo: total - pagado, cuotas: cu.length, pagas: cu.length - pend.length, pendientes: pend.length, proximo: pend[0] ? pend[0].vence : '', proxima_cuota: pend[0] ? n2(pend[0].importe) - n2(pend[0].pagado) : 0, interes_sobre_capital: n2(p.capital) ? n2(p.interes_total) / n2(p.capital) : null, vencidas: pend.filter((c) => c.vence < window.SP_HOY()).length, estado: p.estado };
  }),
});
E2.planSel = '';
dash.draw('tb_planes_fin', (tb) => {
  const rows = rows2('planes_fin_res').filter((r) => E2.enUnidad(r));
  if (!rows.length) return window.spVacia(tb, 11, 'Todavía no hay planes cargados. Creá el primero con el formulario.');
  tb.replaceChildren(...rows.map((r) => {
    const tr = e2('tr'); tr.dataset.key = encodeURIComponent(r.id);
    const n = e2('td'); const b = e2('button', 'gs-link', r.nombre || r.id); b.type = 'button'; b.onclick = () => { E2.planSel = r.id; dash.draw('plan_ficha'); document.querySelectorAll('#plan-ficha').forEach((c) => c.scrollIntoView({ behavior: 'smooth' })); }; n.appendChild(b);
    const st = e2('td'); const s = r.saldo <= 0 ? ['verde', 'CANCELADO'] : r.vencidas ? ['rojo', `${r.vencidas} VENCIDA(S)`] : r.proximo && window.ERP_DIAS(h2(), r.proximo) <= 7 ? ['amarillo', 'POR VENCER'] : ['azul', 'AL DÍA']; st.appendChild(e2('span', `gs-st ${s[0]}`, s[1]));
    tr.append(n, e2('td', null, r.tipo), e2('td', null, r.acreedor), e2('td', null, r.estacion), e2('td', 'gs-num', window.SP.$(r.total)), e2('td', 'gs-num', window.SP.$(r.pagado)), e2('td', 'gs-num', window.SP.$(r.saldo)), e2('td', 'gs-num', `${r.pagas} / ${r.cuotas}`), e2('td', null, f2(r.proximo)), e2('td', 'gs-num', r.interes_sobre_capital == null ? '' : window.SP.p(r.interes_sobre_capital)), st);
    return tr;
  }));
});
dash.draw('plan_ficha', (div) => {
  const p = rows2('planes_fin').find((x) => x.id === E2.planSel);
  if (!p) { div.replaceChildren(e2('p', 'gs-vacio', 'Elegí un plan de la lista para ver su calendario de cuotas, registrar pagos o reprogramar vencimientos.')); return; }
  const cu = Array.isArray(p.cuotas) ? p.cuotas : [];
  const cab = e2('div', 'gs-ficha-cab');
  cab.append(e2('h3', null, `${p.nombre} · ${p.tipo || ''}`), e2('p', 'sp-note', `${p.acreedor || p.banco || ''} · ${p.estacion || ''} · capital ${window.SP.$(n2(p.capital))} · interés ${window.SP.$(n2(p.interes_total))} · ${cu.length} cuotas ${p.frecuencia || 'mensuales'}`));
  if (Array.isArray(p.adjuntos)) p.adjuntos.forEach((a) => { if (a && typeof a.url === 'string' && /^(\/_blob\/|\/adjunto\/)/.test(a.url)) { const l = e2('a', 'gs-adj', a.nombre); l.href = a.url; l.target = '_blank'; cab.appendChild(l); } });
  const tabla = e2('table', 'sp-table gs-left');
  const th = e2('thead'); const trh = e2('tr'); ['Cuota', 'Vence', 'Capital', 'Interés', 'Importe', 'Pagado', 'Saldo', 'Estado', ''].forEach((t) => trh.appendChild(e2('th', null, t))); th.appendChild(trh);
  const tb = e2('tbody');
  const guardar = async (nuevas, detalle, msg) => {
    try { const db = await E2.db(); await db.doc(`data/erp/planes_fin/${p.id}`).update({ cuotas: nuevas, modificado: new Date().toISOString(), modificado_por: E2.uid || '' }); await E2.log(db, 'planes_fin', p.id, 'Cuotas', detalle); } catch { msg.textContent = 'No se guardó: hace falta ser editor del tablero.'; }
  };
  cu.forEach((c, i) => {
    const tr = e2('tr');
    const saldo = n2(c.importe) - n2(c.pagado);
    const sit = saldo <= 0 ? ['verde', 'PAGADA'] : c.vence < h2() ? ['rojo', 'VENCIDA'] : window.ERP_DIAS(h2(), c.vence) <= 7 ? ['amarillo', 'POR VENCER'] : n2(c.pagado) > 0 ? ['naranja', 'PAGO PARCIAL'] : ['azul', 'PROGRAMADA'];
    const acc = e2('td', 'gs-acciones');
    const msg = e2('span', 'gs-pop-err');
    if (saldo > 0 && E2.puedeEditar()) {
      const imp = e2('input'); imp.type = 'number'; imp.min = '0'; imp.step = '0.01'; imp.value = String(Math.round(saldo * 100) / 100); imp.className = 'gs-inp-s'; imp.setAttribute('aria-label', 'Importe a pagar');
      const pagar = e2('button', 'gs-act', 'Registrar pago'); pagar.type = 'button';
      pagar.onclick = () => { const v = n2(imp.value); if (v <= 0) return; const nuevas = cu.map((x, j) => (j === i ? { ...x, pagado: Math.round((n2(x.pagado) + v) * 100) / 100, fecha_pago: h2() } : x)); guardar(nuevas, `Pago cuota ${c.n}: ${window.SP.$(v)}`, msg); };
      const fe = e2('input'); fe.type = 'date'; fe.value = c.vence; fe.className = 'gs-inp-s'; fe.setAttribute('aria-label', 'Nuevo vencimiento');
      const rep = e2('button', 'gs-act', 'Reprogramar'); rep.type = 'button';
      rep.onclick = () => { if (!fe.value || fe.value === c.vence) return; const nuevas = cu.map((x, j) => (j === i ? { ...x, vence: fe.value, reprogramada: c.vence } : x)); guardar(nuevas, `Cuota ${c.n}: vencimiento ${f2(c.vence)} → ${f2(fe.value)}`, msg); };
      acc.append(imp, pagar, fe, rep, msg);
    }
    tr.append(e2('td', null, String(c.n)), e2('td', null, f2(c.vence) + (c.reprogramada ? ` (antes ${f2(c.reprogramada)})` : '')), e2('td', 'gs-num', window.SP.$(c.capital)), e2('td', 'gs-num', window.SP.$(c.interes)), e2('td', 'gs-num', window.SP.$(c.importe)), e2('td', 'gs-num', window.SP.$(n2(c.pagado))), e2('td', 'gs-num', window.SP.$(saldo)));
    const st = e2('td'); st.appendChild(e2('span', `gs-st ${sit[0]}`, sit[1])); tr.append(st, acc);
    tb.appendChild(tr);
  });
  tabla.append(th, tb);
  const w = e2('div', 'sp-tw'); w.appendChild(tabla);
  div.replaceChildren(cab, w);
});

/* ---------- Tesorería ---------- */
const SIGNO_CAJA = { 'Saldo inicial': 1, Ingreso: 1, 'Depósito recibido': 1, Egreso: -1, Retiro: -1, 'Depósito en banco': -1 };
const signoCaja = (r) => (SIGNO_CAJA[r.tipo] != null ? SIGNO_CAJA[r.tipo] : r.sentido === 'Salida' ? -1 : 1);
dash.calc('caja_saldos', {
  title: 'Saldos de caja por estación',
  description: 'Suma con signo de los movimientos de caja de cada estación: saldo inicial, ingresos y depósitos recibidos suman; egresos, retiros y depósitos en banco restan; transferencias y ajustes según su sentido.',
  inputs: ['caja'],
  fn: (caja) => {
    const g = d3.rollups(caja || [], (a) => { const s = [...a].sort((x, y) => x.fecha.localeCompare(y.fecha)); return { saldo: d3.sum(a, (r) => signoCaja(r) * n2(r.importe)), ingresos: d3.sum(a.filter((r) => signoCaja(r) > 0 && r.tipo !== 'Saldo inicial'), (r) => n2(r.importe)), egresos: d3.sum(a.filter((r) => signoCaja(r) < 0), (r) => n2(r.importe)), ultimo: s[s.length - 1].fecha, n: a.length }; }, (r) => r.estacion || 'Grupo');
    return g.map(([estacion, o]) => ({ estacion, ...o }));
  },
});
dash.calc('posicion', {
  title: 'Posición financiera',
  description: 'Para la unidad elegida: efectivo (saldos de caja), bancos (último saldo disponible de cada cuenta), cheques recibidos en cartera, cheques emitidos pendientes, deuda financiera (planilla Situación más planes propios), pagos y cobros pendientes, compromisos de los próximos 90 días y la disponibilidad neta. "n" cuenta los registros que respaldan cada cifra.',
  inputs: ['caja_saldos', 'cuentas_banco', 'cheques_todos', 'deuda_bancos', 'cuentas', 'egresos_todos', 'facturas', 'planes_pago', 'planes_fin'],
  fn: (caja, bancos, ch, deuda, cuentas, egr, fac, planes, pfin) => {
    const U = window.ERP;
    const hoy = window.SP_HOY(), lim = (() => { const [y, m, d] = hoy.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + 90)).toISOString().slice(0, 10); })();
    const cj = (caja || []).filter((r) => U.enUnidad(r));
    const bc = (bancos || []).filter((r) => U.enUnidad(r));
    const ultimos = Object.values(bc.reduce((o, r) => { const k = `${r.banco}|${r.cuenta}`; if (!o[k] || (r.fecha_actualizacion || '') > (o[k].fecha_actualizacion || '')) o[k] = r; return o; }, {}));
    const c = (ch || []).filter((r) => U.enUnidad(r));
    const cart = c.filter((r) => r.direccion === 'Recibido' && ['Emitido', 'Entregado', 'Pendiente de cobro', 'Depositado'].includes(r.estado));
    const emit = c.filter((r) => r.direccion !== 'Recibido' && ['Emitido', 'Entregado'].includes(r.estado));
    const plan = c.filter((r) => r.estado === 'Planificado' && (r.fecha_debito || '') <= lim);
    const tot = (deuda || []).find((r) => r.banco === 'Total');
    const cu = (cuentas || []).filter((r) => U.enUnidad(r) && r.estado !== 'Saldado' && r.estado !== 'Anulado');
    const eg = (egr || []).filter((r) => U.enUnidad(r) && r.estado !== 'Pagado' && r.estado !== 'Anulado' && r.origen !== 'Planilla gastos fijos');
    const fe = (fac || []).filter((r) => U.enUnidad(r) && r.tipo === 'Emitida' && !['Cobrada', 'Anulada'].includes(r.estado));
    const pl = (planes || []).filter((r) => r.tipo === 'Plan' && r.estado !== 'Caduco' && r.cuotas_pendientes > 0 && U.enUnidad({ empresa: r.empresa }));
    const cuotas90 = d3.sum(pl, (r) => { let s = window.SP_PROX_DEBITO(r.fecha_debito || hoy, hoy), k = 0, t = 0; while (s <= lim && k < r.cuotas_pendientes) { t += r.importe_cuota; k += 1; const [y, m, d] = s.split('-').map(Number); s = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10); } return t; })
      + d3.sum((pfin || []).filter((p) => U.enUnidad(p)), (p) => d3.sum((p.cuotas || []).filter((x) => x.vence <= lim && n2(x.pagado) < n2(x.importe)), (x) => n2(x.importe) - n2(x.pagado)));
    const r = {
      efectivo: d3.sum(cj, (x) => x.saldo), efectivo_n: cj.length,
      bancos: d3.sum(ultimos, (x) => n2(x.saldo_disponible)), bancos_n: ultimos.length,
      cheques_cartera: d3.sum(cart, (x) => n2(x.importe)), cheques_cartera_n: cart.length,
      cheques_emitidos: d3.sum(emit, (x) => n2(x.importe)), cheques_emitidos_n: emit.length,
      deuda_financiera: tot ? tot.deuda_total : 0, deuda_financiera_n: tot ? tot.operaciones : 0,
      pagos_pendientes: d3.sum(cu.filter((x) => x.tipo === 'Pagar'), (x) => n2(x.monto)) + d3.sum(eg, (x) => x.importe), pagos_pendientes_n: cu.filter((x) => x.tipo === 'Pagar').length + eg.length,
      cobros_pendientes: d3.sum(cu.filter((x) => x.tipo === 'Cobrar'), (x) => n2(x.monto)) + d3.sum(fe, (x) => n2(x.total)), cobros_pendientes_n: cu.filter((x) => x.tipo === 'Cobrar').length + fe.length,
      compromisos_90: d3.sum(plan, (x) => n2(x.importe)) + cuotas90, compromisos_90_n: plan.length + pl.length,
    };
    r.disponibilidad_neta = r.efectivo + r.bancos + r.cheques_cartera + r.cobros_pendientes - r.cheques_emitidos - r.pagos_pendientes;
    r.disponibilidad_neta_n = r.efectivo_n + r.bancos_n;
    return [r];
  },
});
dash.draw('pos', (el) => {
  el.setAttribute('data-row', '0');
  const r = rows2('posicion')[0];
  if (!r) { el.textContent = '—'; return; }
  const f = el.dataset.field;
  el.classList.toggle('gs-sin', !r[`${f}_n`]);
  if (!r[`${f}_n`]) { el.textContent = 'Sin datos'; return; }
  window.spFmt(el, r[f]);
});
/* flujo de fondos */
dash.calc('flujo', {
  title: 'Flujo de fondos',
  description: 'Por período (día, semana o mes, según la vista elegida) desde hoy: ingresos y egresos proyectados (cheques, cuotas de planes y préstamos, cuentas, facturas, órdenes de compra y egresos pendientes con fecha) y realizados (caja, egresos pagados y cheques cumplidos), con el saldo inicial de caja y bancos. Las cuotas de préstamos sin día informado se ubican el día 1 de cada mes.',
  inputs: ['cheques_todos', 'planes_pago', 'planes_fin', 'lineas_bancarias', 'cuentas', 'facturas', 'egresos_todos', 'caja', 'posicion'],
  fn: (ch, planes, pfin, lineas, cuentas, fac, egr, caja, pos) => {
    const U = window.ERP, p = dash.params();
    const g = p.flujo_g || 'semana';
    const hoy = window.SP_HOY();
    const nPer = g === 'dia' ? 30 : g === 'semana' ? 13 : 12;
    const mas = (iso, k) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10); };
    const lunes = (iso) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
    const clave = (iso) => (g === 'dia' ? iso : g === 'semana' ? lunes(iso) : iso.slice(0, 7));
    const per = []; let c = g === 'mes' ? hoy.slice(0, 7) : clave(hoy);
    for (let i = 0; i < nPer; i++) { per.push(c); if (g === 'dia') c = mas(c, 1); else if (g === 'semana') c = mas(c, 7); else { const [y, m] = c.split('-').map(Number); c = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7); } }
    const fin = g === 'mes' ? `${per[per.length - 1]}-31` : g === 'semana' ? mas(per[per.length - 1], 6) : per[per.length - 1];
    const ini = g === 'mes' ? `${per[0]}-01` : per[0];
    const o = Object.fromEntries(per.map((k) => [k, { periodo: k, ing_proy: 0, ing_real: 0, egr_proy: 0, egr_real: 0 }]));
    const add = (iso, campo, v) => { if (!iso || iso < ini || iso > fin) return; const k = clave(iso); if (o[k]) o[k][campo] += v; };
    (ch || []).filter((r) => U.enUnidad(r)).forEach((r) => {
      const rec = r.direccion === 'Recibido';
      if (['Acreditado', 'Debitado / Pagado'].includes(r.estado)) add(r.fecha_cobro || r.fecha_debito, rec ? 'ing_real' : 'egr_real', n2(r.importe));
      else if (!['Anulado', 'Rechazado'].includes(r.estado)) add(r.fecha_debito, rec ? 'ing_proy' : 'egr_proy', n2(r.importe));
    });
    (planes || []).filter((r) => r.tipo === 'Plan' && r.estado !== 'Caduco' && r.cuotas_pendientes > 0 && U.enUnidad({ empresa: r.empresa })).forEach((r) => {
      let s = window.SP_PROX_DEBITO(r.fecha_debito || hoy, hoy), k = 0;
      while (s <= fin && k < r.cuotas_pendientes) { add(s, 'egr_proy', r.importe_cuota); k += 1; const [y, m, d] = s.split('-').map(Number); s = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10); }
      if (r.tipo !== 'Plan' && r.fecha_debito) add(r.fecha_debito, 'egr_proy', r.importe_cuota);
    });
    (pfin || []).filter((x) => U.enUnidad(x)).forEach((x) => (x.cuotas || []).forEach((q) => { const s = n2(q.importe) - n2(q.pagado); if (s > 0) add(q.vence, 'egr_proy', s); if (n2(q.pagado) > 0 && q.fecha_pago) add(q.fecha_pago, 'egr_real', n2(q.pagado)); }));
    (lineas || []).filter((r) => U.enUnidad(r) && r.tipo === 'Préstamo').forEach((r) => {
      const m = /(\d+)\s*de\s*(\d+)/.exec(r.plazo || '');
      if (r.vencimiento) add(r.vencimiento, 'egr_proy', n2(r.saldo));
      else if (m && r.cuota) { const rest = Number(m[2]) - Number(m[1]) + 1; let s = `${hoy.slice(0, 7)}-01`; if (s < hoy) { const [y, mm] = hoy.split('-').map(Number); s = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 10); } for (let i = 0; i < rest && s <= fin; i++) { add(s, 'egr_proy', n2(r.cuota)); const [y, mm] = s.split('-').map(Number); s = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 10); } }
    });
    (cuentas || []).filter((r) => U.enUnidad(r) && !['Saldado', 'Anulado'].includes(r.estado)).forEach((r) => add(r.vencimiento, r.tipo === 'Cobrar' ? 'ing_proy' : 'egr_proy', n2(r.monto)));
    (fac || []).filter((r) => U.enUnidad(r) && r.tipo === 'Emitida' && !['Cobrada', 'Anulada'].includes(r.estado)).forEach((r) => add(r.vence, 'ing_proy', n2(r.total)));
    (egr || []).filter((r) => U.enUnidad(r) && r.origen !== 'Planilla gastos fijos').forEach((r) => add(r.fecha, r.estado === 'Pagado' ? 'egr_real' : 'egr_proy', r.importe));
    (caja || []).filter((r) => U.enUnidad(r) && r.tipo !== 'Saldo inicial').forEach((r) => { if (['Ingreso', 'Depósito recibido'].includes(r.tipo) || (r.sentido === 'Entrada' && !['Egreso', 'Retiro', 'Depósito en banco'].includes(r.tipo))) add(r.fecha, 'ing_real', n2(r.importe)); else if (['Egreso', 'Retiro'].includes(r.tipo)) add(r.fecha, 'egr_real', n2(r.importe)); });
    const p0 = (pos || [])[0] || {};
    let saldo = n2(p0.efectivo) + n2(p0.bancos);
    return per.map((k) => { const r = o[k]; const neto = r.ing_proy + r.ing_real - r.egr_proy - r.egr_real; const si = saldo; saldo += neto; return { ...r, saldo_inicial: si, neto, saldo_final: saldo }; });
  },
});
dash.draw('tb_flujo', (tb) => {
  const rows = rows2('flujo');
  if (!rows.length) return window.spVacia(tb, 8, '—');
  const g = dash.params().flujo_g || 'semana';
  tb.replaceChildren(...rows.map((r) => { const tr = e2('tr'); tr.dataset.key = r.periodo; tr.append(e2('td', null, g === 'mes' ? window.SP.mesLargo(r.periodo) : g === 'semana' ? `Semana del ${f2(r.periodo)}` : f2(r.periodo)), ...['saldo_inicial', 'ing_proy', 'ing_real', 'egr_proy', 'egr_real', 'neto', 'saldo_final'].map((c) => { const td = e2('td', 'gs-num', window.SP.m(r[c])); if (r[c] < 0) td.classList.add('sp-neg'); return td; })); return tr; }));
});
dash.draw('ch_flujo_f', (el) => {
  const rows = rows2('flujo');
  el.replaceChildren();
  if (!rows.length) return;
  const width = el.clientWidth || 600, height = 260;
  const y = d3.scaleLinear().domain([Math.min(0, d3.min(rows, (r) => Math.min(-r.egr_proy - r.egr_real, r.saldo_final))), Math.max(1, d3.max(rows, (r) => Math.max(r.ing_proy + r.ing_real, r.saldo_final)))]).nice();
  const m = { t: 10, r: 8, b: 24, l: window.spMargen(el, y.ticks(5).map(window.SP.ejeM)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scaleBand().domain(rows.map((r) => r.periodo)).range([0, W]).padding(0.25);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Flujo de fondos: ingresos, egresos y saldo proyectado');
  const gg = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  window.spGrid(gg, y, W, window.SP.ejeM);
  const cada = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(W / 60))));
  const gr = dash.params().flujo_g || 'semana';
  gg.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % cada === 0)).tickFormat((k) => (gr === 'mes' ? window.SP.mes(k) : `${k.slice(8, 10)}/${k.slice(5, 7)}`)).tickSizeOuter(0)).call(window.SP.axisStyle);
  const tip = window.SP.tip(el);
  const on = (ev, r) => tip.show(ev, [r.periodo, `Ingresos: ${window.SP.m(r.ing_proy + r.ing_real)}`, `Egresos: ${window.SP.m(r.egr_proy + r.egr_real)}`, `Saldo final: ${window.SP.m(r.saldo_final)}`]);
  gg.selectAll('rect.i').data(rows).join('rect').attr('class', 'i').attr('x', (r) => x(r.periodo)).attr('width', x.bandwidth() / 2).attr('y', (r) => y(r.ing_proy + r.ing_real)).attr('height', (r) => y(0) - y(r.ing_proy + r.ing_real)).style('fill', 'var(--st-verde)').on('mousemove', on).on('mouseleave', tip.hide);
  gg.selectAll('rect.e').data(rows).join('rect').attr('class', 'e').attr('x', (r) => x(r.periodo) + x.bandwidth() / 2).attr('width', x.bandwidth() / 2).attr('y', y(0)).attr('height', (r) => y(-(r.egr_proy + r.egr_real)) - y(0)).style('fill', 'var(--st-rojo)').on('mousemove', on).on('mouseleave', tip.hide);
  gg.append('path').datum(rows).attr('d', d3.line().x((r) => x(r.periodo) + x.bandwidth() / 2).y((r) => y(r.saldo_final))).style('fill', 'none').style('stroke', 'var(--st-azul)').style('stroke-width', 2).style('pointer-events', 'none');
});
/* conciliación bancaria */
dash.calc('conciliacion_res', {
  title: 'Conciliación bancaria',
  description: 'Cada movimiento del extracto elegido contra los cheques y egresos del sistema del mismo banco: mismo importe y fecha a ±3 días concilia; importe a menos de 1% marca diferencia de importe; mismo importe a 4 a 15 días marca diferencia de fecha; si no, es un débito o crédito no registrado. Las conciliaciones manuales mandan.',
  inputs: ['extracto_mov', 'extractos', 'cheques_todos', 'egresos', 'conciliacion', 'pagos_prov'],
  fn: (movs, exts, ch, egr, man, pagos) => {
    const sel = dash.params().conc_ext || '';
    const ext = (exts || []).find((x) => x.id === sel);
    if (!ext) return [];
    const B = window.ERP_BANCO;
    const banco = B(ext.banco);
    const cand = [
      ...(ch || []).filter((r) => B(r.banco) === banco && r.estado !== 'Anulado').map((r) => ({ id: r.id, tipo: 'Cheque', fecha: r.fecha_debito, importe: (r.direccion === 'Recibido' ? 1 : -1) * n2(r.importe), desc: `${r.beneficiario}` })),
      ...(egr || []).filter((r) => B(r.banco) === banco && r.estado !== 'Anulado').map((r) => ({ id: r.id, tipo: 'Egreso', fecha: r.fecha, importe: -n2(r.importe), desc: r.concepto })),
      ...(pagos || []).filter((r) => B(r.banco) === banco && r.estado !== 'Anulado').map((r) => ({ id: r.id, tipo: 'Pago a proveedor', fecha: r.fecha, importe: -n2(r.importe), desc: r.oc_id })),
    ];
    const man2 = Object.fromEntries((man || []).map((m) => [m.id, m]));
    const usados = new Set();
    const dd = (a, b) => Math.abs(window.ERP_DIAS(a, b));
    return (movs || []).filter((m) => m.extracto === sel).sort((a, b) => a.fecha.localeCompare(b.fecha)).map((m) => {
      const imp = n2(m.importe);
      const x = man2[m.id];
      if (x && x.estado) return { ...m, estado: x.estado, registro: x.registro || '', obs: x.obs || '' };
      let c = cand.find((k) => !usados.has(k.id) && Math.abs(k.importe - imp) < 0.01 && dd(k.fecha, m.fecha) <= 3);
      if (c) { usados.add(c.id); return { ...m, estado: 'Conciliado', registro: `${c.tipo} ${c.id}`, obs: '' }; }
      c = cand.find((k) => !usados.has(k.id) && dd(k.fecha, m.fecha) <= 3 && Math.abs(k.importe - imp) <= Math.abs(imp) * 0.01);
      if (c) return { ...m, estado: 'Diferencia de importe', registro: `${c.tipo} ${c.id} (${window.SP.$(c.importe)})`, obs: '' };
      c = cand.find((k) => !usados.has(k.id) && Math.abs(k.importe - imp) < 0.01 && dd(k.fecha, m.fecha) <= 15);
      if (c) return { ...m, estado: 'Diferencia de fecha', registro: `${c.tipo} ${c.id} (${c.fecha})`, obs: '' };
      return { ...m, estado: imp < 0 ? 'Débito no registrado' : 'Crédito no registrado', registro: '', obs: '' };
    });
  },
});
dash.draw('sel_extracto', (sel) => {
  const ex = rows2('extractos').filter((r) => E2.enUnidad(r)).sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)));
  sel.replaceChildren(new Option('Elegí un extracto', ''), ...ex.map((x) => new Option(`${x.banco} · ${x.cuenta || ''} · ${x.periodo || ''}`, x.id)));
  sel.value = dash.params().conc_ext || '';
  sel.onchange = () => dash.setParams({ conc_ext: sel.value || null });
});
dash.draw('sel_extracto_imp', (sel) => {
  const ex = rows2('extractos').filter((r) => E2.enUnidad(r));
  const v = sel.value;
  sel.replaceChildren(new Option('Elegí el extracto', ''), ...ex.map((x) => new Option(`${x.banco} · ${x.cuenta || ''} · ${x.periodo || ''}`, x.id)));
  sel.value = v;
});
const COL_CONC = { Conciliado: 'verde', 'Conciliado manual': 'verde', 'Diferencia de importe': 'naranja', 'Diferencia de fecha': 'amarillo', 'Débito no registrado': 'rojo', 'Crédito no registrado': 'rojo', Pendiente: 'naranja' };
dash.draw('tb_conc', (tb) => {
  const rows = rows2('conciliacion_res');
  if (!dash.params().conc_ext) return window.spVacia(tb, 7, 'Elegí un extracto para conciliar.');
  if (!rows.length) return window.spVacia(tb, 7, 'El extracto no tiene movimientos importados. Importalos desde un CSV.');
  tb.replaceChildren(...rows.map((r) => {
    const tr = e2('tr'); tr.dataset.key = encodeURIComponent(r.id);
    const st = e2('td'); st.appendChild(e2('span', `gs-st ${COL_CONC[r.estado] || 'gris'}`, r.estado.toUpperCase()));
    const acc = e2('td', 'gs-acciones');
    if (E2.puedeEditar()) {
      const obs = e2('input'); obs.className = 'gs-inp-s'; obs.placeholder = 'Observación'; obs.value = r.obs || '';
      const ok = e2('button', 'gs-act', 'Conciliar'); ok.type = 'button';
      const pe = e2('button', 'gs-act', 'Pendiente'); pe.type = 'button';
      const msg = e2('span', 'gs-pop-err');
      const guardar = async (estado) => { try { const db = await E2.db(); await db.doc(`data/erp/conciliacion/${r.id}`).set({ estado, registro: r.registro, obs: obs.value.trim(), fecha: new Date().toISOString(), usuario: E2.uid || '' }); await E2.log(db, 'conciliacion', r.id, 'Conciliación', `${estado}${obs.value ? ' · ' + obs.value : ''}`); } catch { msg.textContent = 'Sin permiso de editor.'; } };
      ok.onclick = () => guardar('Conciliado manual'); pe.onclick = () => guardar('Pendiente');
      acc.append(obs, ok, pe, msg);
    }
    const c = e2('td', null, r.concepto); c.style.whiteSpace = 'normal'; c.style.minWidth = '200px';
    const tdI = e2('td', 'gs-num', window.SP.$(r.importe)); if (r.importe < 0) tdI.classList.add('sp-neg');
    tr.append(e2('td', null, f2(r.fecha)), c, tdI, st, e2('td', null, r.registro), acc);
    return tr;
  }));
});
dash.draw('conc_res', (el) => {
  const rows = rows2('conciliacion_res');
  const k = el.dataset.k;
  el.textContent = window.SP.n(k === 'ok' ? rows.filter((r) => r.estado.startsWith('Conciliado')).length : k === 'dif' ? rows.filter((r) => r.estado.startsWith('Diferencia')).length : rows.filter((r) => r.estado.includes('no registrado') || r.estado === 'Pendiente').length);
});
/* importación de movimientos de extracto (CSV) */
const parseNum = (s) => { let t = String(s || '').replace(/[$\s]/g, ''); if (!t) return 0; const neg = /^\(.*\)$/.test(t) || t.startsWith('-'); t = t.replace(/[()-]/g, ''); if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, ''); const v = Number(t); return Number.isFinite(v) ? (neg ? -v : v) : 0; };
const parseFecha = (s) => { const t = String(s || '').trim(); let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(t); if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; } m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); return m ? m[0] : ''; };
E2.importarCSV = async (texto, extId) => {
  const lineas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lineas.length < 2) throw new Error('El archivo no tiene movimientos.');
  const sep = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
  const split = (l) => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
  const cab = split(lineas[0]).map((x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  const idx = (re) => cab.findIndex((c) => re.test(c));
  const iF = idx(/fecha/), iC = idx(/concepto|descrip|detalle|referencia/), iI = idx(/^importe|monto/), iD = idx(/debito|debe/), iCr = idx(/credito|haber/);
  if (iF < 0 || (iI < 0 && iD < 0 && iCr < 0)) throw new Error('No se encontraron las columnas Fecha e Importe (o Débito/Crédito).');
  const movs = lineas.slice(1).map(split).map((c) => ({ fecha: parseFecha(c[iF]), concepto: iC >= 0 ? c[iC] : '', importe: iI >= 0 ? parseNum(c[iI]) : parseNum(c[iCr]) - Math.abs(parseNum(c[iD])) })).filter((m) => m.fecha && m.importe);
  const db = await E2.db();
  for (let i = 0; i < movs.length; i++) await db.collection('data/erp/extracto_mov').doc(`MOV-${extId}-${String(i + 1).padStart(4, '0')}`).set({ ...movs[i], extracto: extId, creado: new Date().toISOString(), creado_por: E2.uid || '' });
  await E2.log(db, 'extracto_mov', extId, 'Importación de extracto', `${movs.length} movimientos`);
  return movs.length;
};

/* ---------- operación diaria (sólo cantidades) y ventas calculadas ---------- */
const enRangoDia = (iso) => enRango(iso);
const UNID = { GNC: 'm³', Lubricantes: 'Unidades' };
dash.calc('vf_resumen', {
  title: 'Cantidades vendidas por producto y estación',
  description: 'Suma de las cantidades físicas cargadas en Operación del período, por estación y producto, para el período y la unidad elegidos. Sin valores en pesos.',
  inputs: ['ventas_fisicas'],
  fn: (vf) => d3.rollups((vf || []).filter((r) => window.ERP.enUnidad(r) && enRangoDia(r.fecha)), (a) => ({ cantidad: d3.sum(a, (r) => n2(r.cantidad)), dias: new Set(a.map((r) => r.fecha)).size, unidad: a[0].unidad }), (r) => r.estacion, (r) => r.producto)
    .flatMap(([estacion, ps]) => ps.map(([producto, o]) => ({ estacion, producto, ...o, promedio_diario: o.dias ? o.cantidad / o.dias : 0 }))).sort((a, b) => a.estacion.localeCompare(b.estacion) || b.cantidad - a.cantidad),
});
dash.calc('vf_dia', {
  title: 'Cantidades por día y producto',
  description: 'Cantidades diarias por producto en el período y la unidad elegidos.',
  inputs: ['ventas_fisicas'],
  fn: (vf) => d3.rollups((vf || []).filter((r) => window.ERP.enUnidad(r) && enRangoDia(r.fecha)), (a) => d3.sum(a, (r) => n2(r.cantidad)), (r) => r.fecha, (r) => r.producto).map(([fecha, ps]) => ({ fecha, ...Object.fromEntries(ps) })).sort((a, b) => a.fecha.localeCompare(b.fecha)),
});
dash.calc('ventas_calc', {
  title: 'Ventas en pesos calculadas',
  description: 'Cada cantidad de Operación del período multiplicada por el precio vigente ese día para el mismo producto y estación (el último precio con fecha de vigencia igual o anterior). Las cantidades sin precio cargado quedan marcadas y no suman.',
  inputs: ['ventas_fisicas', 'precios'],
  fn: (vf, pr) => {
    const idx = {};
    (pr || []).forEach((p) => { (idx[`${p.estacion}|${p.producto}`] ??= []).push(p); });
    Object.values(idx).forEach((a) => a.sort((x, y) => x.fecha_vigencia.localeCompare(y.fecha_vigencia)));
    return (vf || []).filter((r) => window.ERP.enUnidad(r) && enRangoDia(r.fecha)).map((r) => {
      const lista = idx[`${r.estacion}|${r.producto}`] || [];
      let p = null; for (const x of lista) { if (x.fecha_vigencia <= r.fecha) p = x; else break; }
      return { id: r.id, fecha: r.fecha, estacion: r.estacion, producto: r.producto, cantidad: n2(r.cantidad), unidad: r.unidad, precio: p ? n2(p.precio) : null, vigente_desde: p ? p.fecha_vigencia : '', importe: p ? n2(r.cantidad) * n2(p.precio) : null, rubro: r.producto === 'GNC' ? 'GNC' : r.producto === 'Lubricantes' ? 'Lubricantes' : 'Combustibles líquidos' };
    });
  },
});
dash.calc('ventas_calc_res', {
  title: 'Ventas en pesos por producto y estación',
  description: 'Importe calculado y participación de cada producto, por estación, en el período y la unidad elegidos.',
  inputs: ['ventas_calc'],
  fn: (vc) => { const ok = vc.filter((r) => r.importe != null); const tot = d3.sum(ok, (r) => r.importe); return d3.rollups(ok, (a) => d3.sum(a, (r) => r.importe), (r) => r.estacion, (r) => r.producto).flatMap(([estacion, ps]) => ps.map(([producto, importe]) => ({ estacion, producto, importe, participacion: tot ? importe / tot : 0 }))).sort((a, b) => b.importe - a.importe); },
});
dash.calc('tienda_res', {
  title: 'Ventas de tienda',
  description: 'Ventas de tienda cargadas por estación y categoría en el período y la unidad elegidos.',
  inputs: ['tienda'],
  fn: (t) => { const v = (t || []).filter((r) => window.ERP.enUnidad(r) && enRango(r.fecha)); const tot = d3.sum(v, (r) => n2(r.importe)); return d3.rollups(v, (a) => ({ importe: d3.sum(a, (r) => n2(r.importe)), dias: new Set(a.map((r) => r.fecha)).size }), (r) => r.estacion, (r) => r.categoria).flatMap(([estacion, cs]) => cs.map(([categoria, o]) => ({ estacion, categoria, ...o, participacion: tot ? o.importe / tot : 0 }))).sort((a, b) => b.importe - a.importe); },
});
dash.draw('tb_vf_res', (tb) => tablaSimple(tb, rows2('vf_resumen'), [['estacion'], ['producto'], ['cantidad', 'n'], ['unidad'], ['dias', 'n'], ['promedio_diario', 'n']]));
dash.draw('tb_vc_res', (tb) => tablaSimple(tb, rows2('ventas_calc_res'), [['estacion'], ['producto'], ['importe', 'm'], ['participacion', 'p']]));
dash.draw('tb_tienda_res', (tb) => tablaSimple(tb, rows2('tienda_res'), [['estacion'], ['categoria'], ['importe', 'm'], ['dias', 'n'], ['participacion', 'p']]));
dash.draw('vc_sinprecio', (el) => { const n = rows2('ventas_calc').filter((r) => r.importe == null).length; el.textContent = n ? `${n} registro(s) de cantidades no tienen precio vigente cargado y no suman: cargá el precio en Precios.` : ''; });
const chLineas = (el, rows, keys, fmt, aria) => {
  el.replaceChildren();
  if (!rows.length) { el.appendChild(e2('p', 'sp-note', 'Sin registros en el período.')); return; }
  const width = el.clientWidth || 600, height = 260;
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => d3.max(keys, (k) => n2(r[k]))) || 1]).nice();
  const m = { t: 10, r: 8, b: 24, l: window.spMargen(el, y.ticks(5).map(fmt)) }, W = width - m.l - m.r, H = height - m.t - m.b;
  y.range([H, 0]);
  const x = d3.scalePoint().domain(rows.map((r) => r.fecha)).range([0, W]).padding(0.3);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', aria);
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  window.spGrid(g, y, W, fmt);
  const cada = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(W / 56))));
  g.append('g').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % cada === 0)).tickFormat((k) => `${k.slice(8, 10)}/${k.slice(5, 7)}`).tickSizeOuter(0)).call(window.SP.axisStyle);
  const tip = window.SP.tip(el);
  keys.forEach((k, i) => {
    g.append('path').datum(rows.filter((r) => r[k] != null)).attr('d', d3.line().x((r) => x(r.fecha)).y((r) => y(n2(r[k])))).style('fill', 'none').style('stroke', `var(--sp-c${i % 5})`).style('stroke-width', 2);
    g.append('g').selectAll('circle').data(rows.filter((r) => r[k] != null)).join('circle').attr('cx', (r) => x(r.fecha)).attr('cy', (r) => y(n2(r[k]))).attr('r', 3).style('fill', `var(--sp-c${i % 5})`).on('mousemove', (ev, r) => tip.show(ev, [f2(r.fecha), `${k}: ${fmt(n2(r[k]))}`])).on('mouseleave', tip.hide);
  });
};
dash.draw('ch_vf_dia', (el) => { const rows = rows2('vf_dia'); const keys = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => k !== 'fecha')))].slice(0, 5); chLineas(el, rows, keys, (v) => window.SP.n(v), 'Cantidades vendidas por día y producto'); });
dash.draw('lg_vf', (div) => { const rows = rows2('vf_dia'); const keys = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => k !== 'fecha')))].slice(0, 5); div.replaceChildren(...keys.map((k, i) => { const s = e2('span'); const ii = e2('i'); ii.style.background = `var(--sp-c${i % 5})`; s.append(ii, document.createTextNode(k)); return s; })); });
dash.draw('ch_vc_dia', (el) => { const rows = d3.rollups(rows2('ventas_calc').filter((r) => r.importe != null), (a) => d3.sum(a, (r) => r.importe), (r) => r.fecha).map(([fecha, v]) => ({ fecha, Ventas: v })).sort((a, b) => a.fecha.localeCompare(b.fecha)); chLineas(el, rows, ['Ventas'], window.SP.ejeM, 'Ventas diarias en pesos calculadas'); });
dash.draw('ch_tienda_dia', (el) => { const rows = d3.rollups(rows2('tienda').filter((r) => E2.enUnidad(r) && enRango(r.fecha)), (a) => d3.sum(a, (r) => n2(r.importe)), (r) => r.fecha).map(([fecha, v]) => ({ fecha, Tienda: v })).sort((a, b) => a.fecha.localeCompare(b.fecha)); chLineas(el, rows, ['Tienda'], window.SP.ejeM, 'Ventas diarias de tienda'); });

/* ---------- proyectos ---------- */
dash.calc('proyectos_res', {
  title: 'Seguimiento de proyectos',
  description: 'Por proyecto: presupuesto aprobado, ejecutado (gastos cargados en el proyecto más egresos vinculados), desvío, beneficio anual esperado y real, ROI (beneficio anual real o esperado sobre inversión ejecutada o aprobada) y recupero en años.',
  inputs: ['proyectos', 'egresos'],
  fn: (pr, egr) => (pr || []).map((p) => {
    const vinc = d3.sum((egr || []).filter((e) => e.proyecto === p.id && e.estado !== 'Anulado'), (e) => n2(e.importe));
    const ejec = n2(p.ejecutado) + vinc;
    const pres = n2(p.presupuesto) || n2(p.inversion);
    const benef = n2(p.beneficio_real) || 0;
    const benefE = n2(p.beneficio_esperado);
    const base = ejec || pres;
    return { id: p.id, nombre: p.nombre, estacion: p.estacion, estado: p.estado, inversion: n2(p.inversion), presupuesto: pres, ejecutado: ejec, egresos_vinculados: vinc, desvio: ejec - pres, desvio_pct: pres ? (ejec - pres) / pres : null, avance: n2(p.avance) / 100, beneficio_esperado: benefE, beneficio_real: benef, roi_esperado: pres ? benefE / pres : null, roi_real: base && benef ? benef / base : null, recupero_anios: (benef || benefE) ? (pres || ejec) / (benef || benefE) : null, inicio: p.inicio, fin: p.fin };
  }),
});
E2.pry = '';
dash.draw('sel_proyecto', (sel) => {
  const pr = rows2('proyectos_res');
  if (!E2.pry && pr[0]) E2.pry = pr[0].id;
  sel.replaceChildren(...(pr.length ? pr.map((p) => new Option(p.nombre, p.id)) : [new Option('Sin proyectos', '')]));
  sel.value = E2.pry;
  sel.onchange = () => { E2.pry = sel.value; ['pk', 'pry_tit'].forEach((d) => dash.draw(d)); };
});
dash.draw('pry_tit', (el) => { const p = rows2('proyectos_res').find((x) => x.id === E2.pry); el.textContent = p ? `${p.nombre} · ${p.estacion || ''} · ${p.estado || ''}` : 'Sin proyectos cargados'; });
dash.draw('pk', (el) => {
  const p = rows2('proyectos_res').find((x) => x.id === E2.pry);
  el.setAttribute('data-where', `id=${encodeURIComponent(E2.pry || '')}`);
  if (!p) { el.textContent = '—'; return; }
  const v = p[el.dataset.field];
  if (v == null) { el.textContent = 'Sin datos'; return; }
  window.spFmt(el, v);
  if (el.dataset.field === 'desvio' || el.dataset.field === 'desvio_pct') el.classList.toggle('sp-neg', v > 0);
});

/* ---------- tableros por área ---------- */
dash.calc('kpis', {
  title: 'Indicadores de los tableros por área',
  description: 'Indicadores de cada área para la unidad elegida, con su color de estado: verde al día, amarillo atención, rojo crítico, azul programado, naranja requiere gestión y gris sin datos.',
  inputs: ['posicion', 'deuda_bancos', 'cheques_todos', 'egresos_resumen', 'vencimientos', 'facturas', 'contratos', 'seguros', 'societaria', 'tramites', 'clientes', 'proveedores', 'vf_resumen', 'ventas_calc', 'tienda_res', 'legajos', 'cumpleanos', 'flota', 'mantenimientos', 'proyectos_res', 'planes_pago', 'planes_fin_res', 'conciliacion', 'extracto_mov', 'notificaciones'],
  fn: (pos, deuda, ch, egr, venc, fac, con, seg, soc, tra, cli, prov, vf, vc, ti, leg, cum, flota, mant, pry, planes, pfin, conc, movs, notif) => {
    const U = window.ERP, hoy = window.SP_HOY(), C = window.ERP_CFG_DEF;
    const out = [];
    const k = (area, label, valor, fmt, color, ir, nota, n) => out.push({ area, label, valor, fmt, color: n === 0 ? 'gris' : color, ir, nota: n === 0 ? 'Sin datos cargados' : nota || '', n: n == null ? 1 : n });
    const dias = (iso) => (iso ? window.ERP_DIAS(hoy, iso) : null);
    const venceCol = (rows, campo, ok) => { const v = rows.filter((r) => r[campo] && !ok.includes(r.estado) && !['Anulado', 'Anulada'].includes(r.estado)); const venc2 = v.filter((r) => dias(r[campo]) < 0).length; const prox = v.filter((r) => dias(r[campo]) >= 0 && dias(r[campo]) <= C.amarillo_dias).length; return { venc: venc2, prox, color: venc2 ? 'rojo' : prox ? 'amarillo' : 'verde' }; };
    const p = (pos || [])[0] || {};
    const tot = (deuda || []).find((r) => r.banco === 'Total') || {};
    const chU = (ch || []).filter((r) => U.enUnidad(r));
    const chPend = chU.filter((r) => r.direccion !== 'Recibido' && ['Emitido', 'Entregado'].includes(r.estado));
    const chVenc = chPend.filter((r) => r.fecha_debito < hoy);
    const ch7 = chPend.filter((r) => dias(r.fecha_debito) >= 0 && dias(r.fecha_debito) <= 7);
    const egrT = d3.sum(egr || [], (r) => r.total), egrP = d3.sum(egr || [], (r) => r.pendiente);
    /* Finanzas */
    k('fin', 'Egresos del período', egrT, 'm', egrP > 0 ? 'amarillo' : 'verde', 'fin-egresos', `${window.SP.m(egrP)} pendiente`, (egr || []).length);
    k('fin', 'Concepto con más gasto', (egr || [])[0] ? (egr || [])[0].total : 0, 'm', 'azul', 'fin-egresos', (egr || [])[0] ? `${egr[0].categoria} · ${window.SP.p(egr[0].participacion)}` : '', (egr || []).length);
    k('fin', 'Deuda financiera', tot.deuda_total || 0, 'm', tot.proximo_vto && dias(tot.proximo_vto) <= 30 ? 'amarillo' : 'azul', 'fin-deudas', tot.proximo_vto ? `próximo vencimiento ${tot.proximo_vto.split('-').reverse().join('/')}` : '', tot.operaciones || 0);
    k('fin', 'Compromisos próximos 90 días', p.compromisos_90 || 0, 'm', 'azul', 'teso-flujo', '', p.compromisos_90_n || 0);
    k('fin', 'Cheques emitidos pendientes', d3.sum(chPend, (r) => n2(r.importe)), 'm', chVenc.length ? 'rojo' : ch7.length ? 'amarillo' : 'azul', 'fin-cheques', `${chPend.length} cheques · ${ch7.length} en 7 días`, chPend.length);
    /* Tesorería */
    k('teso', 'Saldos bancarios', p.bancos || 0, 'm', 'verde', 'teso-bancos', `${p.bancos_n || 0} cuentas`, p.bancos_n || 0);
    k('teso', 'Caja disponible', p.efectivo || 0, 'm', (p.efectivo || 0) < 0 ? 'rojo' : 'verde', 'teso-caja', '', p.efectivo_n || 0);
    k('teso', 'Disponibilidad neta', p.disponibilidad_neta || 0, 'm', (p.disponibilidad_neta || 0) < 0 ? 'rojo' : 'verde', 'teso-pos', 'caja + bancos + cartera + cobros − cheques − pagos', p.disponibilidad_neta_n || 0);
    k('teso', 'Cheques pendientes de débito', d3.sum(chPend, (r) => n2(r.importe)), 'm', chVenc.length ? 'rojo' : ch7.length ? 'amarillo' : 'azul', 'fin-chcal', `${chVenc.length} vencidos sin confirmar`, chPend.length);
    const sinConc = (movs || []).length - (conc || []).filter((x) => String(x.estado).startsWith('Conciliado')).length;
    k('teso', 'Movimientos de extracto sin conciliar manualmente', sinConc, 'n', sinConc ? 'naranja' : 'verde', 'teso-conc', '', (movs || []).length);
    /* Administración */
    const fU = (fac || []).filter((r) => U.enUnidad(r)); const fV = venceCol(fU, 'vence', ['Pagada', 'Cobrada']);
    k('adm', 'Facturas pendientes', fU.filter((r) => !['Pagada', 'Cobrada', 'Anulada'].includes(r.estado)).length, 'n', fV.color, 'adm-fac', `${fV.venc} vencidas · ${fV.prox} por vencer`, fU.length);
    k('adm', 'Proveedores registrados', (prov || []).length, 'n', 'azul', 'adm-prov', '', (prov || []).length);
    k('adm', 'Clientes registrados', (cli || []).length, 'n', 'azul', 'adm-cli', '', (cli || []).length);
    const cV = venceCol((con || []).filter((r) => U.enUnidad(r)), 'fin', ['Renovado', 'Finalizado']);
    k('adm', 'Contratos por vencer o vencidos', cV.venc + cV.prox, 'n', cV.color, 'adm-con', `${cV.venc} vencidos`, (con || []).length);
    const vV = venceCol([...(venc || []), ...(seg || []).map((r) => ({ ...r, fecha: r.vigencia_hasta })), ...(soc || []).map((r) => ({ ...r, fecha: r.vence })), ...(tra || []).map((r) => ({ ...r, fecha: r.vence }))].filter((r) => U.enUnidad(r)), 'fecha', ['Cumplido', 'Renovada', 'Presentado', 'Finalizado']);
    k('adm', 'Vencimientos y documentación', vV.venc + vV.prox, 'n', vV.color, 'adm-venc', `${vV.venc} vencidos · ${vV.prox} por vencer`, (venc || []).length + (seg || []).length + (soc || []).length + (tra || []).length);
    /* Operaciones */
    const vfL = (vf || []).filter((r) => r.unidad === 'Litros'), vfG = (vf || []).filter((r) => r.producto === 'GNC');
    k('ope', 'Litros vendidos (período)', d3.sum(vfL, (r) => r.cantidad), 'n', 'azul', 'ope-per', '', vfL.length);
    k('ope', 'GNC vendido (m³)', d3.sum(vfG, (r) => r.cantidad), 'n', 'azul', 'ope-per', '', vfG.length);
    k('ope', 'Lubricantes', d3.sum((vf || []).filter((r) => r.producto === 'Lubricantes'), (r) => r.cantidad), 'n', 'azul', 'ope-per', '', (vf || []).filter((r) => r.producto === 'Lubricantes').length);
    /* Comercial */
    const vcOk = (vc || []).filter((r) => r.importe != null);
    const sum = (f) => d3.sum(vcOk.filter(f), (r) => r.importe);
    k('com', 'Ventas de combustibles líquidos', sum((r) => r.rubro === 'Combustibles líquidos'), 'm', 'verde', 'com-calc', '', vcOk.filter((r) => r.rubro === 'Combustibles líquidos').length);
    k('com', 'Ventas de GNC', sum((r) => r.rubro === 'GNC'), 'm', 'verde', 'com-calc', '', vcOk.filter((r) => r.rubro === 'GNC').length);
    k('com', 'Ventas de lubricantes', sum((r) => r.rubro === 'Lubricantes'), 'm', 'verde', 'com-calc', '', vcOk.filter((r) => r.rubro === 'Lubricantes').length);
    k('com', 'Ventas de tienda', d3.sum(ti || [], (r) => r.importe), 'm', 'verde', 'com-tienda', '', (ti || []).length);
    const sinP = (vc || []).filter((r) => r.importe == null).length;
    k('com', 'Cantidades sin precio cargado', sinP, 'n', sinP ? 'naranja' : 'verde', 'com-precios', '', (vc || []).length);
    /* RRHH */
    const lU = (leg || []).filter((r) => U.enUnidad(r) && r.estado !== 'Baja');
    k('rrhh', 'Empleados activos', lU.length, 'n', 'verde', 'rrhh-leg', '', (leg || []).length);
    k('rrhh', 'Contratación RRHH B', lU.filter((r) => r.contratacion === 'RRHH B').length, 'n', 'azul', 'rrhh-leg', '', (leg || []).length);
    k('rrhh', 'Licencias y vacaciones', lU.filter((r) => ['Licencia', 'Vacaciones'].includes(r.estado)).length, 'n', 'naranja', 'rrhh-leg', '', (leg || []).length);
    const c7 = (cum || []).filter((r) => r.dias <= 7);
    k('rrhh', 'Cumpleaños próximos 7 días', c7.length, 'n', c7.some((r) => r.dias === 0) ? 'amarillo' : 'azul', 'rrhh-cumple', c7.slice(0, 3).map((r) => r.nombre).join(', '), (leg || []).length);
    /* Flota */
    const fl = (flota || []).filter((r) => U.enUnidad(r));
    const vtv = venceCol(fl.map((r) => ({ ...r, f: r.vto_vtv })), 'f', []), segF = venceCol(fl.map((r) => ({ ...r, f: r.vto_seguro })), 'f', []);
    k('flota', 'Unidades registradas', fl.length, 'n', 'azul', 'flota-unid', '', fl.length);
    k('flota', 'VTV vencidas o por vencer', vtv.venc + vtv.prox, 'n', vtv.color, 'flota-unid', `${vtv.venc} vencidas`, fl.length);
    k('flota', 'Seguros vencidos o por vencer', segF.venc + segF.prox, 'n', segF.color, 'flota-unid', `${segF.venc} vencidos`, fl.length);
    const mV = venceCol((mant || []).filter((r) => U.enUnidad(r)), 'proximo', ['Realizado']);
    k('flota', 'Mantenimientos pendientes', mV.venc + mV.prox, 'n', mV.color, 'flota-mant', '', (mant || []).length);
    /* Proyectos */
    const pr = (pry || []).filter((r) => U.enUnidad(r));
    k('pry', 'Inversión aprobada', d3.sum(pr, (r) => r.presupuesto), 'm', 'azul', 'pry-lista', '', pr.length);
    k('pry', 'Inversión ejecutada', d3.sum(pr, (r) => r.ejecutado), 'm', d3.sum(pr, (r) => r.ejecutado) > d3.sum(pr, (r) => r.presupuesto) ? 'rojo' : 'verde', 'pry-tablero', '', pr.length);
    k('pry', 'Avance promedio', pr.length ? d3.mean(pr, (r) => r.avance) : 0, 'p', 'azul', 'pry-tablero', '', pr.length);
    /* Deudas y financiamiento */
    k('deudas', 'Deuda total', tot.deuda_total || 0, 'm', 'azul', 'fin-deudas', '', tot.operaciones || 0);
    k('deudas', 'Cuotas pendientes (préstamos y planes propios)', tot.cuotas_pendientes || 0, 'n', 'azul', 'fin-deudas', '', tot.operaciones || 0);
    k('deudas', 'Próximo vencimiento', tot.proximo_vto ? dias(tot.proximo_vto) : 0, 'dias', tot.proximo_vto && dias(tot.proximo_vto) <= 7 ? 'amarillo' : 'azul', 'fin-deudas', tot.proximo_vto ? tot.proximo_vto.split('-').reverse().join('/') : '', tot.proximo_vto ? 1 : 0);
    const plU = (planes || []).filter((r) => r.tipo === 'Plan' && U.enUnidad({ empresa: r.empresa }));
    k('deudas', 'Planes ARCA/ARBA caducos', plU.filter((r) => r.estado === 'Caduco').length, 'n', plU.some((r) => r.estado === 'Caduco') ? 'rojo' : 'verde', 'fin-planes', `${plU.length} planes en la planilla`, plU.length);
    const pv = (pfin || []).filter((r) => U.enUnidad(r));
    k('deudas', 'Planes propios con cuotas vencidas', pv.filter((r) => r.vencidas).length, 'n', pv.some((r) => r.vencidas) ? 'rojo' : 'verde', 'fin-planes', '', pv.length);
    return out;
  },
});
dash.draw('kpi_area', (div) => {
  const area = div.dataset.area;
  const rows = rows2('kpis').filter((r) => r.area === area);
  if (!rows.length) { div.replaceChildren(e2('p', 'gs-vacio', dash.data('kpis').status === 'ok' ? 'Sin indicadores.' : '—')); return; }
  div.replaceChildren(...rows.map((r, i) => {
    const c = e2('button', `sp-card sp-tile gs-kpi k-${r.color}`); c.type = 'button';
    c.setAttribute('data-source', 'kpis'); c.setAttribute('data-where', `area=${area}&label=${encodeURIComponent(r.label)}`); c.setAttribute('data-field', 'valor');
    c.onclick = () => E2.ir(r.ir);
    const v = r.n === 0 ? 'Sin datos' : r.fmt === 'm' ? window.SP.m(r.valor) : r.fmt === 'p' ? window.SP.p(r.valor) : r.fmt === 'dias' ? (r.valor < 0 ? `venció hace ${-r.valor} d` : `en ${r.valor} días`) : window.SP.n(r.valor);
    c.append(e2('span', `gs-kpi-dot ${r.color}`), e2('p', 'k', r.label), e2('p', 'v', v), e2('p', 's', r.nota || ' '));
    return c;
  }));
});
dash.draw('unidad_nombre', (el) => { el.textContent = unidadTxt(); });

/* ---------- ficha individual ---------- */
E2.ficha = null;
E2.abrirFicha = (ds, fila) => { E2.ficha = { ds, id: fila.id, fila }; dash.draw('ficha'); document.querySelectorAll('#ficha').forEach((x) => x.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
dash.draw('ficha', (div) => {
  if (!E2.ficha) { div.replaceChildren(); return; }
  const { ds, id } = E2.ficha;
  const fila = (rows2(ds).find((r) => r.id === id)) || E2.ficha.fila;
  const card = e2('div', 'sp-card gs-ficha');
  const cerrar = e2('button', 'gs-act', 'Cerrar ficha'); cerrar.type = 'button'; cerrar.onclick = () => { E2.ficha = null; dash.draw('ficha'); };
  const cab = e2('div', 'gs-ficha-cab'); cab.append(e2('h3', null, `${window.ERP_ETIQ[ds] || ds} · ${id}`), cerrar);
  const dl = e2('dl', 'gs-ficha-dl');
  Object.entries(fila).filter(([k, v]) => !['id', 'cuotas', 'adjuntos'].includes(k) && v !== '' && v != null && typeof v !== 'object').forEach(([k, v]) => { dl.append(e2('dt', null, k.replace(/_/g, ' ')), e2('dd', null, /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? (String(v).length > 10 ? `${f2(String(v).slice(0, 10))} ${String(v).slice(11, 16)}` : f2(String(v))) : typeof v === 'number' && /importe|monto|total|saldo|capital|precio|remuner|costo|presupuesto|inversion/.test(k) ? window.SP.$(v) : String(v))); });
  const adj = e2('div');
  (Array.isArray(fila.adjuntos) ? fila.adjuntos : []).forEach((a) => { if (a && typeof a.url === 'string' && /^(\/_blob\/|\/adjunto\/)/.test(a.url)) { const l = e2('a', 'gs-adj', a.nombre); l.href = a.url; l.target = '_blank'; adj.appendChild(l); } });
  const nombre = String(fila.razon_social || fila.proveedor || fila.tercero || fila.cliente || fila.beneficiario || '').toLowerCase().trim();
  const rel = e2('ul', 'gs-dia-lista');
  if (nombre && ['clientes', 'proveedores'].includes(ds)) {
    const fuentes = [['facturas', 'tercero', 'total', 'fecha'], ['egresos', 'beneficiario', 'importe', 'fecha'], ['ordenes_compra', 'proveedor', 'monto', 'fecha'], ['cuentas', 'tercero', 'monto', 'vencimiento'], ['cheques_todos', 'beneficiario', 'importe', 'fecha_debito'], ['contratos', 'contraparte', 'monto', 'inicio']];
    fuentes.forEach(([src, campo, imp, fe]) => rows2(src).filter((r) => String(r[campo] || '').toLowerCase().trim() === nombre).forEach((r) => rel.appendChild(e2('li', 'gs-dia-item', `${window.ERP_ETIQ[src] || 'Cheques'} · ${f2(r[fe])} · ${r[imp] != null ? window.SP.$(n2(r[imp])) : ''} · ${r.estado || ''} · ${r.id}`))));
    if (!rel.children.length) rel.appendChild(e2('li', 'gs-vacio', 'Sin operaciones relacionadas con este nombre.'));
  }
  const hist = e2('ul', 'gs-dia-lista');
  rows2('historial').filter((h) => h.registro === id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 20).forEach((h) => hist.appendChild(e2('li', 'gs-dia-item', `${String(h.fecha).slice(0, 16).replace('T', ' ')} · ${E2.nombre(h.usuario)} · ${h.accion} · ${h.detalle}`)));
  if (!hist.children.length) hist.appendChild(e2('li', 'gs-vacio', 'Sin movimientos en el historial.'));
  card.append(cab, dl, adj);
  if (rel.children.length) card.append(e2('h4', null, 'Historial de operaciones relacionadas'), rel);
  card.append(e2('h4', null, 'Historial de cambios'), hist);
  div.replaceChildren(card);
});

/* ---------- exportación a PDF (documento generado en el navegador) ---------- */
const pdfEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const aWin = (s) => { const out = []; for (const ch of String(s)) { const c = ch.charCodeAt(0); out.push(c < 256 ? ch : ch === '€' ? '\x80' : ch === '–' || ch === '—' ? '-' : ch === '“' || ch === '”' ? '"' : ch === '’' ? "'" : ch === '…' ? '...' : '?'); } return out.join(''); };
E2.pdf = (titulo, sub, cols, filas, totales) => {
  const W = 842, H = 595, M = 30, fs = 7.5, lh = 11;
  const anchos = cols.map((c, i) => Math.max(c.length, ...filas.slice(0, 200).map((f) => String(f[i] ?? '').length)));
  const tot = anchos.reduce((a, b) => a + Math.min(b, 40), 0) || 1;
  const px = anchos.map((a) => (Math.min(a, 40) / tot) * (W - 2 * M));
  const corta = (s, w) => { const max = Math.max(3, Math.floor(w / (fs * 0.5))); const t = aWin(String(s ?? '')); return t.length > max ? t.slice(0, max - 1) + '.' : t; };
  const paginas = []; let ops = []; let y = H - M;
  const linea = (txt, x, yy, size, bold) => ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${pdfEsc(txt)}) Tj ET`);
  const cabecera = () => { linea(aWin(titulo), M, y, 13, true); y -= 16; linea(aWin(sub), M, y, 8, false); y -= 14; let x = M; cols.forEach((c, i) => { linea(corta(c, px[i]), x, y, fs, true); x += px[i]; }); y -= 4; ops.push(`${M} ${y.toFixed(1)} m ${W - M} ${y.toFixed(1)} l S`); y -= lh - 2; };
  cabecera();
  const filasT = totales ? [...filas, totales] : filas;
  filasT.forEach((f, j) => {
    if (y < M + 14) { paginas.push(ops); ops = []; y = H - M; cabecera(); }
    let x = M; f.forEach((v, i) => { linea(corta(v, px[i]), x, y, fs, totales && j === filasT.length - 1); x += px[i]; }); y -= lh;
  });
  paginas.push(ops);
  const objs = []; const add = (s) => { objs.push(s); return objs.length; };
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2b = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pagesId = objs.length + 1; objs.push(null);
  const kids = paginas.map((po, i) => { const pie = `BT /F1 7 Tf ${M} 14 Td (${pdfEsc(aWin(`Sala Group · ${titulo} · página ${i + 1} de ${paginas.length}`))}) Tj ET`; const s = [...po, pie].join('\n'); const c = add(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`); return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2b} 0 R >> >> /Contents ${c} 0 R >>`); });
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const cat = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: 'application/pdf' });
};
E2.exportarPDF = async (ds, btn) => {
  await E2.exportar(ds, null, true);
  const x = E2.ultimaExport; if (!x) return;
  const fmtV = (r, c, f) => { if (f === 'st') { const s = x.kind ? window.ERP_SIT(r[x.stfecha || 'fecha'] || r.fecha_debito, r.estado, x.kind, null, r.tipo || r.direccion) : null; return s ? s.t : ''; } if (f === 'adj') return (Array.isArray(r[c]) ? r[c].length : 0) ? `${r[c].length} doc.` : ''; if (f === 'd') return f2(r[c]); if (f === 'm') return r[c] == null || r[c] === '' ? '' : window.SP.$(n2(r[c])); if (f === 'n') return r[c] == null ? '' : window.SP.n(n2(r[c])); return r[c] == null ? '' : String(r[c]); };
  const filas = x.rows.map((r) => x.cols.map(([c, f]) => fmtV(r, c, f)));
  const mon = x.cols.map(([c, f]) => (f === 'm' ? d3.sum(x.rows, (r) => n2(r[c])) : null));
  const totales = mon.some((v) => v != null) ? x.cols.map(([, f], i) => (i === 0 ? 'TOTAL' : f === 'm' ? window.SP.$(mon[i]) : '')) : null;
  const blob = E2.pdf(window.ERP_ETIQ[ds] || ds, `Unidad: ${unidadTxt()} · ${x.rows.length} registros · generado el ${f2(h2())} ${new Date().toTimeString().slice(0, 5)}${(E2.f[ds] || {}).q ? ' · búsqueda: ' + E2.f[ds].q : ''}`, x.ths, filas, totales);
  try { const dl = await claude.use('downloads'); if (!dl) throw new Error('no'); await dl.save({ filename: `${ds}_${h2()}.pdf`, data: blob }); } catch { if (btn) btn.classList.add('gs-act-warn'); }
};


/* ---------- bloques que se arman una sola vez (herramientas, leyenda, pie de formulario, configuración) ---------- */
const montar = (name, fn) => dash.draw(name, { mount: (el) => { fn(el); return true; }, update: () => {} });
const COL_OPTS = [['', 'Todos los estados'], ['rojo', 'Vencido / impago'], ['amarillo', 'Por vencer'], ['azul', 'Programado'], ['naranja', 'Pendiente de gestión'], ['verde', 'Pagado / cumplido'], ['gris', 'Anulado']];
const TB_DRAW = { cheques_todos: 'tb_cheques', historial: 'tb_hist', egresos_todos: 'tb_egr_todos' };
montar('tools', (el) => {
  const ds = el.dataset.for;
  const redraw = () => dash.draw(TB_DRAW[ds] || 'tb_store');
  const l1 = e2('label', 'gs-sel gs-q-wrap', 'Buscar'); const q = e2('input'); q.type = 'search'; q.placeholder = 'Palabra clave'; q.setAttribute('aria-label', 'Buscar'); q.value = (E2.f[ds] || {}).q || ''; l1.appendChild(q);
  q.addEventListener('input', () => { (E2.f[ds] ??= {}).q = q.value; redraw(); });
  el.appendChild(l1);
  if (el.dataset.col === '1') {
    const l2 = e2('label', 'gs-sel', 'Estado'); const s = e2('select', 'dash-select'); s.setAttribute('aria-label', 'Filtrar por estado'); COL_OPTS.forEach(([v, t]) => s.appendChild(new Option(t, v))); l2.appendChild(s);
    s.addEventListener('change', () => { (E2.f[ds] ??= {}).col = s.value; redraw(); });
    el.appendChild(l2);
  }
  const ex = e2('span', 'gs-exp'); ex.appendChild(e2('span', 'gs-exp-lab', 'Exportar en →'));
  const bx = e2('button', 'gs-act gs-export', 'Excel'); bx.type = 'button'; bx.addEventListener('click', () => E2.exportar(ds, bx));
  const bp = e2('button', 'gs-act gs-export-pdf', 'PDF'); bp.type = 'button'; bp.addEventListener('click', () => E2.exportarPDF(ds, bp));
  ex.append(bx, bp); el.appendChild(ex);
});
montar('ley', (el) => {
  [['verde', 'PAGADO'], ['amarillo', 'POR VENCER'], ['rojo', 'VENCIDO'], ['azul', 'PROGRAMADO'], ['naranja', 'PENDIENTE'], ['gris', 'ANULADO']].forEach(([c, t]) => el.appendChild(e2('span', `gs-st ${c}`, t)));
  el.appendChild(e2('span', 'gs-ley-t', 'Tocá el botón de estado para actualizarlo y el código de un registro para ver su ficha.'));
});
montar('pie', (el) => {
  const rid = e2('input'); rid.type = 'hidden'; rid.name = '_rid';
  const foot = e2('div', 'gs-form-foot');
  const b1 = e2('button', 'gs-btn gs-btn-new', 'Guardar'); b1.type = 'submit';
  const b2 = e2('button', 'gs-btn gs-btn-edit', 'Guardar cambios'); b2.type = 'submit'; b2.hidden = true;
  const b3 = e2('button', 'gs-act gs-btn-cancel', 'Cancelar edición'); b3.type = 'button'; b3.hidden = true;
  const s1 = e2('span', 'gs-editando', 'Editando: los cambios quedan en el historial de operaciones.'); s1.hidden = true;
  const s2 = e2('span', 'gs-saved', 'Guardado.'); s2.hidden = true;
  const s3 = e2('span', 'gs-unsaved', 'No se guardó: solo los editores del tablero pueden cargar o modificar registros.'); s3.hidden = true;
  foot.append(b1, b2, b3, s1, s2, s3);
  el.append(rid, foot);
});
/* detalle de impuestos: subtotal, IVA por alícuota, percepciones y otros; el total se calcula solo */
const IMP_IVA = [['21', 0.21], ['105', 0.105], ['27', 0.27]];
const IMP_OTROS = [['no_gravado', 'No gravado'], ['exento', 'Exento'], ['perc_iva', 'Percepción IVA'], ['perc_iibb', 'Percepción IIBB'], ['imp_internos', 'Impuestos internos'], ['otros_imp', 'Otros impuestos y tasas (ITC, etc.)']];
const IMP_CAMPOS = [...IMP_IVA.flatMap(([k]) => [`neto_${k}`, `iva_${k}`]), ...IMP_OTROS.map(([k]) => k)];
const r2 = (x) => Math.round(x * 100) / 100;
montar('impuestos', (box) => {
  const form = box.closest('form'); if (!form) return;
  const campoTotal = box.dataset.total || 'total';
  const num = (name, label, ro) => { const l = e2('label', null, label); const i = e2('input'); i.type = 'number'; i.step = '0.01'; i.name = name; i.inputMode = 'decimal'; if (ro) { i.readOnly = true; i.tabIndex = -1; i.className = 'gs-imp-calc'; } else i.min = '0'; l.appendChild(i); return [l, i]; };
  box.appendChild(e2('p', 'gs-imp-tit', 'Importes e impuestos'));
  box.appendChild(e2('p', 'gs-imp-ayuda', 'Escribí el subtotal y los impuestos directamente, o completá el detalle por alícuota y se calculan solos. El total siempre se calcula.'));
  // carga directa: subtotal, impuestos y total
  const g3 = e2('div', 'gs-imp-grid gs-imp-tot');
  const [lS, sub] = num('neto', 'Subtotal (neto) $');
  const [lI, imp] = num('impuestos', 'Impuestos $');
  const [lT, tot] = num(campoTotal, 'Total $', true);
  const lD = e2('label', 'gs-imp-det', 'Detalle de impuestos'); const det = e2('input'); det.name = 'detalle_impuestos'; det.maxLength = 200; det.placeholder = 'Ej.: IVA 21 %, percepción IIBB 3 %'; lD.appendChild(det);
  g3.append(lS, lI, lT, lD);
  // detalle por alícuota (opcional)
  const sum = e2('details', 'gs-imp-mas'); sum.appendChild(e2('summary', null, 'Detalle por alícuota y percepciones (opcional)'));
  const g1 = e2('div', 'gs-imp-grid');
  const ivas = {};
  IMP_IVA.forEach(([k, t]) => {
    const pct = String(t * 100).replace('.', ',');
    const [l1, n] = num(`neto_${k}`, `Neto gravado ${pct}%`);
    const [l2, iva] = num(`iva_${k}`, `IVA ${pct}%`);
    ivas[k] = { n, iva, t };
    iva.addEventListener('input', () => { iva.dataset.manual = '1'; delete imp.dataset.manual; calc(); });
    n.addEventListener('input', () => { if (!iva.dataset.manual) iva.value = n.value === '' ? '' : r2(Number(n.value) * t); delete sub.dataset.manual; delete imp.dataset.manual; calc(); });
    g1.append(l1, l2);
  });
  const g2 = e2('div', 'gs-imp-grid');
  const otros = IMP_OTROS.map(([k, t]) => { const [l, i] = num(k, t); i.addEventListener('input', () => { if (!['no_gravado', 'exento'].includes(k)) delete imp.dataset.manual; calc(); }); g2.appendChild(l); return i; });
  sum.append(g1, g2);
  const nota = e2('p', 'gs-imp-nota'); nota.hidden = true;
  box.append(g3, sum, nota);
  sub.addEventListener('input', () => { sub.dataset.manual = '1'; calc(); });
  imp.addEventListener('input', () => { imp.dataset.manual = '1'; calc(); });
  const v = (i) => Number(i.value) || 0;
  const conDetalle = () => IMP_CAMPOS.some((k) => form.elements.namedItem(k) && form.elements.namedItem(k).value !== '');
  function calc() {
    const netoDet = Object.values(ivas).reduce((a, x) => a + v(x.n), 0);
    const ivaDet = Object.values(ivas).reduce((a, x) => a + v(x.iva), 0);
    const [ng, ex, pi, pb, ii, oi] = otros.map(v);
    const neto = sub.dataset.manual ? v(sub) : netoDet;
    const impuestos = imp.dataset.manual ? v(imp) : ivaDet + pi + pb + ii + oi;
    if (!sub.dataset.manual) sub.value = netoDet ? r2(netoDet) : '';
    if (!imp.dataset.manual) imp.value = impuestos ? r2(impuestos) : '';
    tot.value = r2(neto + impuestos + ng + ex);
    nota.hidden = true;
  }
  form.addEventListener('reset', () => setTimeout(() => { [sub, imp, ...Object.values(ivas).map((x) => x.iva)].forEach((x) => { delete x.dataset.manual; }); sum.open = false; nota.hidden = true; }));
  form.addEventListener('gs-cargado', () => {
    [sub, imp].forEach((x) => { delete x.dataset.manual; });
    Object.values(ivas).forEach((x) => { delete x.iva.dataset.manual; if (x.iva.value !== '' && x.n.value !== '' && Math.abs(v(x.iva) - r2(v(x.n) * x.t)) > 0.01) x.iva.dataset.manual = '1'; });
    sum.open = conDetalle();
    if (!conDetalle()) {
      // registro cargado sin detalle: se respetan subtotal e impuestos tal como están
      if (sub.value === '' && v(tot) > 0) sub.value = r2(v(tot) - v(imp));
      sub.dataset.manual = '1'; imp.dataset.manual = '1';
    }
    calc();
  });
  // el total es obligatorio y mayor a cero (el navegador no valida los campos calculados)
  form.addEventListener('submit', (e) => {
    if (v(tot) > 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    nota.textContent = 'Cargá al menos el subtotal o un importe: el total no puede ser cero.'; nota.hidden = false;
    sub.focus();
  }, true);
});
/* estado del compromiso elegido con botones al cargarlo o editarlo */
montar('estado_sel', (box) => {
  const form = box.closest('form'); if (!form) return;
  const ds = form.dataset.ds;
  const tb = document.querySelector(`tbody[data-ds="${ds}"][data-st]`);
  const estados = tb && window.ERP_ESTADOS[tb.dataset.st];
  if (!estados) return;
  const def = form.dataset.estado || estados[0];
  const inp = e2('input'); inp.type = 'hidden'; inp.name = 'estado'; inp.setAttribute('value', def);
  box.append(e2('span', 'gs-estado-lab', 'Estado'), inp);
  const grupo = e2('div', 'gs-estado-btns'); grupo.setAttribute('role', 'radiogroup'); grupo.setAttribute('aria-label', 'Estado');
  const botones = estados.map((s) => { const b = e2('button', 'gs-chip-st', s); b.type = 'button'; b.setAttribute('role', 'radio'); b.onclick = () => { inp.value = s; sync(); }; return b; });
  const sync = () => botones.forEach((b) => { const on = b.textContent === (inp.value || def); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  grupo.append(...botones); box.appendChild(grupo);
  // si el estado es pagado o cobrado, se pide la fecha y el medio de pago
  const ok = window.ERP_OK[tb.dataset.st] || [];
  const pago = e2('div', 'gs-estado-pago'); pago.hidden = true;
  const lf = e2('label'); const tf = e2('span', null, 'Fecha de pago'); const fp = e2('input'); fp.type = 'date'; fp.name = 'fecha_pago'; lf.append(tf, fp);
  const lm = e2('label', null, 'Medio'); const mp = e2('select', 'dash-select'); mp.name = 'medio_pago';
  ['', 'Transferencia', 'Cheque', 'E-Cheq', 'Efectivo', 'Débito automático', 'Tarjeta', 'Compensación'].forEach((x) => mp.add(new Option(x || '—', x))); lm.appendChild(mp);
  const lo = e2('label', null, 'Nº de operación'); const op = e2('input'); op.name = 'operacion_pago'; op.maxLength = 40; lo.appendChild(op);
  pago.append(lf, lm, lo); box.appendChild(pago);
  const syncPago = () => {
    const est = inp.value || def; const si = ok.includes(est);
    pago.hidden = !si; fp.required = si; tf.textContent = est === 'Cobrada' ? 'Fecha de cobro' : 'Fecha de pago';
    if (si && !fp.value) fp.value = window.SP_HOY();
    if (!si) { fp.value = ''; mp.value = ''; op.value = ''; }
  };
  botones.forEach((b) => b.addEventListener('click', syncPago));
  form.addEventListener('reset', () => setTimeout(() => { inp.value = def; sync(); syncPago(); }));
  form.addEventListener('gs-cargado', () => { sync(); const si = ok.includes(inp.value); pago.hidden = !si; fp.required = si; });
  sync(); syncPago();
});
const EVS = [['cumple', 'Cumpleaños'], ['cheques', 'Cheques (a emitir, a vencer, vencidos, rechazados)'], ['venc', 'Vencimientos administrativos'], ['cuentas', 'Cobros y pagos pendientes'], ['planes', 'Planes de pago ARCA/ARBA'], ['prestamos', 'Vencimiento de préstamos'], ['deuda', 'Uso de la calificación bancaria'], ['rentabilidad', 'Caídas de rentabilidad (EBITDA negativo)'], ['flota', 'VTV y seguros de flota'], ['mant', 'Mantenimientos de flota'], ['ordenes', 'Órdenes de trabajo'], ['compras', 'Pagos a proveedores']];
const PERFS = ['Administración', 'Finanzas', 'Tesorería', 'Recursos Humanos', 'Operaciones', 'Comercial', 'Gerencia'];
montar('cfg_filas', (tb) => {
  const C = window.ERP_CFG(rows2('config'));
  EVS.forEach(([k, lab]) => {
    const v = C.eventos[k] || {};
    const tr = e2('tr');
    const a = e2('input'); a.type = 'checkbox'; a.name = `ev_${k}_activo`; a.checked = v.activo !== false; a.setAttribute('aria-label', 'Activo');
    const p = e2('select', 'dash-select'); p.name = `ev_${k}_prio`; ['Automática', 'Informativa', 'Baja', 'Media', 'Alta', 'Crítica'].forEach((x) => p.appendChild(new Option(x, x))); p.value = v.prioridad || 'Automática';
    const d = e2('td', 'gs-dest');
    PERFS.forEach((pf) => { const l = e2('label'); const c = e2('input'); c.type = 'checkbox'; c.name = `ev_${k}_dest`; c.value = pf; c.checked = (v.destinatarios || []).includes(pf); l.append(c, document.createTextNode(pf)); d.appendChild(l); });
    const o = e2('input'); o.type = 'checkbox'; o.name = `ev_${k}_oblig`; o.checked = !!v.obligatoria; o.setAttribute('aria-label', 'Obligatorio');
    const t1 = e2('td'); t1.appendChild(a); const t2 = e2('td'); t2.appendChild(p); const t3 = e2('td'); t3.appendChild(o);
    tr.append(e2('td', null, lab), t1, t2, d, t3);
    tb.appendChild(tr);
  });
});
/* tabla comparativa de empresas (antes escrita celda por celda) */
const FILAS_EMP = [["Ventas netas", "sp-tot", "ventas_netas", "m", 0], ["Margen bruto", "sp-tot", "margen_bruto", "m", 0], ["Margen bruto %", "sp-sub", "pct_margen_bruto", "p", 0], ["Personal (sueldos est. + cargas)", "", "personal", "m", 0], ["Energía, servicios, alquiler y seguros", "", "estructura", "m", 0], ["IIBB y gastos bancarios", "", "comerciales", "m", 0], ["Otros gastos (Shell)", "", "otros_gastos", "m", 0], ["Gastos operativos", "sp-tot", "gastos_operativos", "m", 0], ["EBITDA", "sp-tot", "ebitda", "m", 1], ["EBITDA %", "sp-sub", "pct_ebitda", "p", 1], ["Resultado financiero (intereses est.)", "", "resultado_financiero", "m", 1], ["Ganancias", "", "ganancias", "m", 1], ["Resultado neto", "sp-tot", "resultado_neto", "m", 1], ["Neto %", "sp-sub", "pct_resultado_neto", "p", 1], ["Memo: cuotas de préstamos y planes (caja)", "sp-memo", "servicio_deuda", "m", 0], ["Meses con datos", "sp-memo", "meses_con_datos", "n", 0]];
const EMPS = ['shell', 'ypf', 'tolosa', 'olmos', 'alvemem', 'grupo'];
dash.draw('tb_empresas', (tb) => {
  const d = dash.data('pl_empresas_rangos');
  const [a, b] = window.SP.rango();
  const rows = d.status === 'ok' && Array.isArray(d.data) ? d.data : [];
  tb.replaceChildren(...FILAS_EMP.map(([lab, cls, campo, fmt, signo]) => {
    const tr = e2('tr', cls || null);
    tr.appendChild(e2('td', null, lab));
    EMPS.forEach((emp) => {
      const td = e2('td');
      td.setAttribute('data-source', 'pl_empresas_rangos'); td.setAttribute('data-field', campo); td.setAttribute('data-where', window.SP.where({ empresa: emp, desde: a, hasta: b }));
      td.dataset.fmt = fmt; if (signo) td.dataset.signo = '1';
      const r = rows.find((x) => x.empresa === emp && x.desde === a && x.hasta === b);
      if (r && (r.meses_con_datos > 0 || campo === 'meses_con_datos')) window.spFmt(td, r[campo]); else td.textContent = '—';
      tr.appendChild(td);
    });
    return tr;
  }));
});
/* bloque de documentos de Drive dentro de cada módulo */
dash.draw('drive_mod', (div) => {
  const card = [e2('h3', null, div.dataset.tit || 'Documentos en Google Drive')];
  const t = e2('table', 'sp-table gs-left'); t.setAttribute('data-source', 'drive_docs'); t.setAttribute('data-row-key', 'id');
  const th = e2('thead'); const tr = e2('tr'); [['nombre', 'Archivo'], ['unidad', 'Unidad'], ['ruta', 'Carpeta'], ['modificado', 'Modificado']].forEach(([f, x]) => { const c = e2('th', null, x); c.setAttribute('data-field', f); tr.appendChild(c); }); th.appendChild(tr);
  const tb = e2('tbody');
  const d = dash.data('drive_docs');
  const vac = (txt) => { const r = e2('tr', 'gs-empty'); const c = e2('td', null, txt); c.colSpan = 4; r.appendChild(c); tb.appendChild(r); };
  if (d.status === 'connect' || d.status === 'declined') vac('Hace falta permitir el conector de Google Drive para ver estos documentos.');
  else if (d.status === 'error') vac('No se pudo leer Google Drive.');
  else if (d.status !== 'ok') vac('Leyendo Google Drive…');
  else {
    const rows = docsFiltrados(div.dataset.cat, '').slice(0, 15);
    if (!rows.length) vac('Sin documentos de esta categoría para la unidad elegida.');
    rows.forEach((r) => { const x = e2('tr'); x.dataset.key = encodeURIComponent(r.id); const c = e2('td'); const a = e2('a', null, r.nombre); if (/^https:\/\//.test(r.url)) { a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; } c.appendChild(a); c.style.whiteSpace = 'normal'; const ru = e2('td', null, r.ruta); ru.style.whiteSpace = 'normal'; x.append(c, e2('td', null, r.unidad), ru, e2('td', null, f2(r.modificado.slice(0, 10)))); tb.appendChild(x); });
  }
  t.append(th, tb);
  const w = e2('div', 'sp-tw'); w.appendChild(t);
  card.push(w, e2('p', 'sp-note', 'Se lee en vivo de la carpeta ESTACIONES con tu acceso a Google Drive. Los archivos se abren en Drive; el sistema no los modifica.'));
  div.replaceChildren(...card);
});
/* RRHH: contratación por estación */
dash.calc('legajos_contr', {
  title: 'Empleados por tipo de contratación',
  description: 'Cantidad de legajos activos, de licencia o de vacaciones por tipo de contratación (incluye RRHH B) y estación.',
  inputs: ['legajos'],
  fn: (leg) => d3.rollups((leg || []).filter((r) => r.estado !== 'Baja' && window.ERP.enUnidad(r)), (a) => { const o = { Shell: 0, YPF: 0, Tolosa: 0, Olmos: 0, Grupo: 0 }; a.forEach((r) => { o[r.estacion in o ? r.estacion : 'Grupo'] += 1; }); return { ...o, total: a.length }; }, (r) => r.contratacion || 'Sin dato').map(([contratacion, o]) => ({ contratacion, ...o })).sort((a, b) => b.total - a.total),
});
dash.draw('tb_contr', (tb) => tablaSimple(tb, rows2('legajos_contr'), [['contratacion'], ['Shell', 'n'], ['YPF', 'n'], ['Tolosa', 'n'], ['Olmos', 'n'], ['Grupo', 'n'], ['total', 'n']]));
dash.draw('tb_caja_saldos', (tb) => tablaSimple(tb, rows2('caja_saldos').filter((r) => E2.enUnidad(r)), [['estacion'], ['ingresos', 'm'], ['egresos', 'm'], ['saldo', 'm'], ['ultimo', 'd']]));


/* ---------- Compras: órdenes de compra y pago a proveedores ---------- */
dash.calc('oc_saldos', {
  title: 'Obligaciones con proveedores',
  description: 'Por orden de compra: importe, pagado (suma de los pagos registrados), saldo y estado: pagada si no queda saldo, pago parcial si hay pagos, vencida si pasó el vencimiento con saldo, pendiente de pago en otro caso.',
  inputs: ['ordenes_compra', 'pagos_prov'],
  fn: (oc, pagos) => {
    const hoy = window.SP_HOY();
    const pag = d3.rollup((pagos || []).filter((p) => p.estado !== 'Anulado'), (a) => ({ total: d3.sum(a, (p) => n2(p.importe)), ultimo: d3.max(a, (p) => p.fecha), n: a.length }), (p) => p.oc_id);
    return (oc || []).map((r) => {
      const p = pag.get(r.id) || { total: 0, ultimo: '', n: 0 };
      const saldo = Math.round((n2(r.monto) - p.total) * 100) / 100;
      const estado = ['Anulada'].includes(r.estado) ? 'Anulada' : saldo <= 0.005 ? 'Pagada' : (r.fecha_pago && r.fecha_pago < hoy) ? 'Vencida' : p.total > 0 ? 'Pago parcial' : 'Pendiente de pago';
      return { id: r.id, numero: r.numero || r.id, proveedor: r.proveedor, cuit: r.cuit || '', estacion: r.estacion || 'Grupo', concepto: r.concepto || '', moneda: r.moneda || 'ARS', monto: n2(r.monto), pagado: p.total, saldo: Math.max(0, saldo), vence: r.fecha_pago || '', estado, pagos: p.n, ultimo_pago: p.ultimo || '' };
    }).sort((a, b) => String(a.vence || '9').localeCompare(String(b.vence || '9')));
  },
});
const COL_OC = { Pagada: 'verde', 'Pago parcial': 'naranja', Vencida: 'rojo', 'Pendiente de pago': 'azul', Anulada: 'gris' };
dash.draw('tb_oc_saldos', (tb) => {
  const d = dash.data('oc_saldos');
  if (d.status !== 'ok') return window.spVacia(tb, 10, '—');
  const soloPend = tb.dataset.pend === '1';
  const rows = d.data.filter((r) => E2.enUnidad(r) && (!soloPend || !['Pagada', 'Anulada'].includes(r.estado)));
  if (!rows.length) return window.spVacia(tb, 10, soloPend ? 'No hay obligaciones pendientes con proveedores.' : 'Sin órdenes de compra.');
  tb.replaceChildren(...rows.map((r) => {
    const tr = e2('tr'); tr.dataset.key = encodeURIComponent(r.id);
    const st = e2('td'); let col = COL_OC[r.estado] || 'gris'; if (r.estado === 'Pendiente de pago' && r.vence && window.ERP_DIAS(h2(), r.vence) <= 7) col = 'amarillo'; st.appendChild(e2('span', `gs-st ${col}`, r.estado.toUpperCase()));
    const acc = e2('td', 'gs-acciones');
    if (r.saldo > 0 && r.estado !== 'Anulada' && E2.puedeEditar()) { const b = e2('button', 'gs-act', 'Registrar pago'); b.type = 'button'; b.onclick = () => document.querySelectorAll('#form-pago').forEach((f) => { const s = f.elements.namedItem('oc_id'); if (s) s.value = r.id; const i = f.elements.namedItem('importe'); if (i) i.value = String(r.saldo); const fe = f.elements.namedItem('fecha'); if (fe && !fe.value) fe.value = h2(); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); acc.appendChild(b); }
    tr.append(e2('td', null, r.numero), e2('td', null, r.proveedor), e2('td', null, r.estacion), e2('td', 'gs-num', `${r.moneda === 'USD' ? 'US' : ''}${window.SP.$(r.monto)}`), e2('td', 'gs-num', window.SP.$(r.pagado)), e2('td', 'gs-num', window.SP.$(r.saldo)), e2('td', null, f2(r.vence)), e2('td', 'gs-num', String(r.pagos)), st, acc);
    return tr;
  }));
});
dash.draw('sel_oc', (sel) => {
  const v = sel.value;
  const rows = rows2('oc_saldos').filter((r) => E2.enUnidad(r) && r.saldo > 0 && r.estado !== 'Anulada');
  sel.replaceChildren(new Option('Elegí la orden de compra', ''), ...rows.map((r) => new Option(`${r.numero} · ${r.proveedor} · saldo ${window.SP.$(r.saldo)}`, r.id)));
  sel.value = v;
});
dash.draw('ock', (el) => {
  const rows = rows2('oc_saldos').filter((r) => E2.enUnidad(r) && r.estado !== 'Anulada');
  const k = el.dataset.k;
  const v = k === 'pend' ? d3.sum(rows, (r) => r.saldo) : k === 'venc' ? d3.sum(rows.filter((r) => r.estado === 'Vencida'), (r) => r.saldo) : k === 'parc' ? rows.filter((r) => r.estado === 'Pago parcial').length : d3.sum(rows, (r) => r.pagado);
  el.textContent = k === 'parc' ? window.SP.n(v) : window.SP.m(v);
});
E2.despues = E2.despues || {};
E2.despues.pagos_prov = async (db, pago) => {
  const oc = rows2('ordenes_compra').find((r) => r.id === pago.oc_id);
  if (!oc) return;
  const otros = rows2('pagos_prov').filter((p) => p.oc_id === oc.id && p.id !== pago.id && p.estado !== 'Anulado');
  const total = d3.sum(otros, (p) => n2(p.importe)) + n2(pago.importe);
  const estado = total + 0.005 >= n2(oc.monto) ? 'Pagada' : total > 0 ? 'Pago parcial' : 'Pendiente de pago';
  if (estado !== oc.estado) { await db.doc(`data/erp/ordenes_compra/${oc.id}`).update({ estado, modificado: new Date().toISOString(), modificado_por: E2.uid || '' }); await E2.log(db, 'ordenes_compra', oc.id, 'Cambio de estado', `${oc.estado || '—'} → ${estado} (pagos ${window.SP.$(total)} de ${window.SP.$(n2(oc.monto))})`); }
};

/* facturas: proveedor (recibidas) o cliente (emitidas) elegido de los cargados */
dash.draw('sel_tercero', (s) => {
  const f = s.form; const t = f && f.elements.namedItem('tipo');
  const emitida = !!t && t.value === 'Emitida';
  const lista = [...new Set(rows2(emitida ? 'clientes' : 'proveedores').map((r) => String(r.razon_social || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const actual = s.value;
  const ops = [new Option(lista.length ? (emitida ? 'Elegí un cliente…' : 'Elegí un proveedor…') : (emitida ? 'No hay clientes cargados' : 'No hay proveedores cargados'), '')];
  lista.forEach((n) => ops.push(new Option(n, n)));
  if (actual && !lista.includes(actual)) ops.push(new Option(`${actual} (no está en la lista)`, actual));
  s.replaceChildren(...ops); s.value = actual;
});
document.querySelectorAll('select[data-draw="sel_tercero"]').forEach((s) => {
  const t = s.form && s.form.elements.namedItem('tipo');
  if (t) t.addEventListener('change', () => { s.value = ''; dash.draw('sel_tercero'); });
});
dash.draw('lista_prov', (dl) => {
  const n = [...new Set([...rows2('proveedores').map((r) => r.razon_social), ...rows2('ordenes_compra').map((r) => r.proveedor)].filter(Boolean))].sort();
  dl.replaceChildren(...n.map((x) => { const o = document.createElement('option'); o.value = x; return o; }));
});
/* ---------- bienvenida y saludo según la hora de Buenos Aires ---------- */
E2.miNombre = '';
const saludoTxt = () => {
  const hh = Number(new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return hh >= 6 && hh < 12 ? 'Buenos días,' : hh >= 12 && hh < 20 ? 'Buenas tardes,' : 'Buenas noches,';
};
dash.draw('saludo', (el) => {
  const s = e2('span', 'gs-sal-t', `${saludoTxt()} `);
  const n = e2('span', 'gs-sal-n', E2.miNombre || '…');
  el.replaceChildren(s, n);
});

/* ---------- listeners de esta etapa (sólo escuchan) ---------- */
(() => {
  document.querySelectorAll('.gs-export-pdf[data-for]').forEach((b) => b.addEventListener('click', () => E2.exportarPDF(b.dataset.for, b)));
  document.querySelectorAll('[data-flujo]').forEach((b) => b.addEventListener('click', () => dash.setParams({ flujo_g: b.dataset.flujo })));
  document.querySelectorAll('#drive-q').forEach((i) => i.addEventListener('input', () => { E2.dq.q = i.value; dash.draw('tb_drive'); }));
  document.querySelectorAll('form#form-importar').forEach((form) => form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const ok = form.querySelectorAll('.gs-saved'), err = form.querySelectorAll('.gs-unsaved');
    ok.forEach((m) => { m.hidden = true; }); err.forEach((m) => { m.hidden = true; });
    const ext = form.elements.namedItem('extracto').value, file = form.elements.namedItem('archivo').files[0];
    if (!ext || !file) { err.forEach((m) => { m.hidden = false; }); return; }
    try { await E2.importarCSV(await file.text(), ext); form.reset(); ok.forEach((m) => { m.hidden = false; }); dash.setParams({ conc_ext: ext }); } catch { err.forEach((m) => { m.hidden = false; }); }
  }));
  document.querySelectorAll('#btn-nuevo-cheque').forEach((b) => b.addEventListener('click', () => { E2.abrir('fin', 'fin-chcal', true); setTimeout(() => document.querySelectorAll('#form-cheque').forEach((f) => { f.reset(); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); const s = f.elements.namedItem('estado'); if (s) s.value = 'Emitido'; }), 50); }));
  /* ficha individual: clic en el código de cualquier tabla de registros */
  document.addEventListener('click', (ev) => {
    const td = ev.target.closest && ev.target.closest('tbody[data-ds] tr td:first-child');
    if (!td || ev.target.closest('button, a, input')) return;
    const tb = td.closest('tbody[data-ds]'); const tr = td.closest('tr');
    const ds = tb.dataset.ds; const id = decodeURIComponent(tr.dataset.key || '');
    const fila = rows2(ds).find((r) => r.id === id);
    if (fila) E2.abrirFicha(ds, fila);
  });

  /* bienvenida: una vez por sesión del navegador, y registro del ingreso */
  let vista = false; try { vista = sessionStorage.getItem('sg_bienvenida') === '1'; } catch { vista = false; }
  document.querySelectorAll('#bienvenida').forEach((b) => { if (vista) b.hidden = true; });
  document.querySelectorAll('#btn-ingresar').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#bienvenida').forEach((x) => { x.hidden = true; });
    try { sessionStorage.setItem('sg_bienvenida', '1'); } catch { /* sin almacenamiento */ }
  }));
  claude.use('user').then(async (u) => {
    if (!u) return;
    const me = await u.me();
    E2.miNombre = String((me && me.name) || '').trim().split(/\s+/)[0] || 'equipo';
    dash.draw('saludo');
    let reg = false; try { reg = sessionStorage.getItem('sg_ingreso') === '1'; } catch { reg = false; }
    if (!reg) { try { const db = await E2.db(); await E2.log(db, 'sesion', await u.id(), 'Ingreso al sistema', `${me && me.name ? me.name : ''}`); sessionStorage.setItem('sg_ingreso', '1'); } catch { /* lectores sin permiso de escritura */ } }
  }).catch(() => {});
  setInterval(() => dash.draw('saludo'), 5 * 60 * 1000);
  /* filtros de fechas: desde, hasta y todo */
  const setFechas = (d, h) => { if (d > h) [d, h] = [h, d]; dash.setParams({ fecha_desde: d, fecha_hasta: h, desde: d.slice(0, 7), hasta: h.slice(0, 7) }); };
  document.querySelectorAll('#f-desde, #f-hasta').forEach((inp) => {
    inp.addEventListener('change', () => { if (!inp.value || !inp.validity.valid) return; const p = dash.params(); setFechas(inp.id === 'f-desde' ? inp.value : (p.fecha_desde || '2026-01-01'), inp.id === 'f-hasta' ? inp.value : (p.fecha_hasta || '2026-12-31')); });
    inp.addEventListener('blur', () => { const p = dash.params(); inp.value = inp.id === 'f-desde' ? (p.fecha_desde || '2026-01-01') : (p.fecha_hasta || '2026-12-31'); });
  });
  document.querySelectorAll('#f-todo').forEach((b) => b.addEventListener('click', () => setFechas('2000-01-01', '2099-12-31')));
  document.querySelectorAll('#f-2026').forEach((b) => b.addEventListener('click', () => setFechas('2026-01-01', '2026-12-31')));
  const sync2 = () => {
    const g = dash.params().flujo_g || 'semana';
    const pf = dash.params(); const todo = (pf.fecha_desde || '') <= '2000-01-01' && (pf.fecha_hasta || '') >= '2099-12-31';
    document.querySelectorAll('#f-desde').forEach((i) => { if (document.activeElement !== i) i.value = todo ? '' : (pf.fecha_desde || '2026-01-01'); });
    document.querySelectorAll('#f-hasta').forEach((i) => { if (document.activeElement !== i) i.value = todo ? '' : (pf.fecha_hasta || '2026-12-31'); });
    document.querySelectorAll('#f-todo').forEach((b) => b.classList.toggle('on', todo));
    document.querySelectorAll('#f-2026').forEach((b) => b.classList.toggle('on', pf.fecha_desde === '2026-01-01' && pf.fecha_hasta === '2026-12-31'));
    document.querySelectorAll('[data-flujo]').forEach((b) => b.classList.toggle('on', b.dataset.flujo === g));
  };
  sync2(); dash.onData(sync2);
})();
