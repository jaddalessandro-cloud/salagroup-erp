/* ================= Sala Group · ampliación del sistema de gestión =================
   Navegación con submenús, registros con alta/edición/baja e historial, estados por
   colores, calendario de cheques, legajos y cumpleaños, y centro de notificaciones. */
const ERP = (window.ERP = window.ERP || {});
ERP.nav = { mod: 'dash', sub: null };
ERP.f = {};            // filtros por tabla: { q, col }
ERP.nf = { estado: 'abiertas', prioridad: '', modulo: '' };
ERP.nombres = {};      // id de usuario -> nombre
ERP.uid = null; ERP.canEdit = false; ERP.perfil = null;
ERP.diaSel = null; ERP.cumMes = null;

const MODS_PERFIL = window.ERP_MODS_PERFIL = {
  Administrador: null, Gerencia: null, Consulta: null,
  'Administración': ['dash', 'fin', 'teso', 'adm', 'docs', 'rep', 'compras', 'pry'],
  Finanzas: ['dash', 'fin', 'teso', 'est', 'docs', 'rep', 'compras', 'pry'],
  'Tesorería': ['dash', 'teso', 'fin', 'docs', 'rep'],
  'Recursos Humanos': ['dash', 'rrhh', 'adm', 'docs'],
  Operaciones: ['dash', 'ope', 'flota', 'compras', 'est', 'docs', 'pry'],
  Comercial: ['dash', 'com', 'ope', 'est', 'docs', 'rep'],
};
const ESTADOS = window.ERP_ESTADOS = {
  venc: ['Pendiente', 'Pendiente de gestión', 'Cumplido', 'Anulado'],
  cuenta: ['Pendiente', 'Pendiente de gestión', 'Saldado', 'Anulado'],
  orden: ['Pendiente', 'En proceso', 'Pendiente de gestión', 'Finalizada', 'Anulada'],
  compra: ['Pendiente', 'Aprobada', 'Pendiente de gestión', 'Pagada', 'Anulada'],
  mant: ['Programado', 'Pendiente de gestión', 'Realizado', 'Cancelado'],
  cheque: ['Planificado', 'Emitido', 'Entregado', 'Pendiente de cobro', 'Depositado', 'Acreditado', 'Debitado / Pagado', 'Rechazado', 'Anulado'],
};
const hoy = () => window.SP_HOY();
const fmtF = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso || '');
const fmtFH = (iso) => (iso ? `${fmtF(iso.slice(0, 10))} ${iso.slice(11, 16)}` : '');
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const cfg = () => window.ERP_CFG(dash.data('config').status === 'ok' ? dash.data('config').data : []);
const sumaDias = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const nuevoId = (pref) => `${pref}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

ERP.nombre = (id) => (id ? ERP.nombres[id] || '…' : '');
ERP.pedirNombres = (ids, draw) => {
  const faltan = [...new Set(ids.filter((x) => x && !(x in ERP.nombres)))];
  if (!faltan.length) return;
  faltan.forEach((x) => { ERP.nombres[x] = '…'; });
  claude.use('user').then((u) => (u ? u.profiles(faltan) : {})).then((ps) => {
    faltan.forEach((x) => { ERP.nombres[x] = (ps && ps[x] && ps[x].name) || 'Usuario'; });
    (Array.isArray(draw) ? draw : [draw]).forEach((d) => dash.draw(d));
  }).catch(() => {});
};
ERP.puedeEditar = () => ERP.perfil !== 'Consulta';
ERP.quitarAdjunto = async (path, ds, fila, i) => {
  const db = await ERP.db();
  const lista = Array.isArray(fila.adjuntos) ? fila.adjuntos.slice() : [];
  const [x] = lista.splice(i, 1);
  await db.doc(`${path}/${fila.id}`).update({ adjuntos: lista, modificado: new Date().toISOString(), modificado_por: ERP.uid || '' });
  await ERP.log(db, ds, fila.id, 'Adjunto eliminado', (x && x.nombre) || '');
  try { const as = await claude.use('assets'); if (as && as.remove && x) await as.remove(x.url); } catch { /* el registro ya no lo muestra; el archivo queda en el depósito */ }
};
ERP.motivo = (ex) => {
  const c = String((ex && ex.code) || '');
  if (/permission-denied/.test(c)) return 'No se guardó: tu perfil no tiene permiso para cargar o modificar este registro. Si te cambiaron el perfil, cerrá sesión y volvé a ingresar.';
  if (/unavailable|network|deadline/.test(c)) return 'No se guardó: sin conexión con el servidor. Revisá internet y volvé a intentar.';
  return `No se guardó: ${(ex && ex.message) || 'error inesperado'}. Volvé a intentar.`;
};

/* ---------- escritura con historial ---------- */
ERP.db = async () => { const db = await claude.use('db'); if (!db) throw new Error('sin db'); return db; };
ERP.log = async (db, ds, registro, accion, detalle) => {
  try { await db.collection('data/erp/historial').add({ fecha: new Date().toISOString(), usuario: ERP.uid || '', coleccion: ds, registro, accion, detalle: String(detalle || '').slice(0, 900) }); } catch { /* el historial no frena la operación */ }
};
ERP.cambios = (prev, nuevo) => Object.keys(nuevo).filter((k) => !['modificado', 'modificado_por'].includes(k) && JSON.stringify(prev[k] ?? '') !== JSON.stringify(nuevo[k] ?? ''))
  .map((k) => `${k}: ${typeof prev[k] === 'object' ? '[…]' : prev[k] ?? '—'} → ${typeof nuevo[k] === 'object' ? '[…]' : nuevo[k]}`).join('; ');
ERP.subirAdjunto = async (file) => {
  const assets = await claude.use('assets');
  if (!assets) throw new Error('adjuntos no disponibles');
  const r = await assets.upload(file);
  return { url: r.url, nombre: file.name };
};
const ETIQ_DS = window.ERP_ETIQ = { vencimientos: 'Vencimientos', cuentas: 'Cuentas corrientes', flota: 'Flota', oportunidades: 'Oportunidades', legajos: 'Legajos', cheques_reg: 'Cheques', cheques_estado: 'Cheques (archivo)', ordenes_trabajo: 'Órdenes de trabajo', ordenes_compra: 'Órdenes de compra', mantenimientos: 'Mantenimientos', config: 'Configuración', notif_estado: 'Notificaciones' };
const PATH_DS = window.ERP_PATHS = { vencimientos: 'data/erp/vencimientos', cuentas: 'data/erp/cuentas', flota: 'data/erp/flota', oportunidades: 'data/erp/oportunidades', legajos: 'data/erp/legajos', cheques_reg: 'data/erp/cheques', ordenes_trabajo: 'data/erp/ordenes_trabajo', ordenes_compra: 'data/erp/ordenes_compra', mantenimientos: 'data/erp/mantenimientos' };
const PREF_DS = window.ERP_PREF = { vencimientos: 'VEN', cuentas: 'CTA', flota: 'UNI', oportunidades: 'OPO', legajos: 'LEG', cheques_reg: 'CHQ', ordenes_trabajo: 'OT', ordenes_compra: 'OC', mantenimientos: 'MAN' };

/* cambio de estado de un registro (o de un cheque del archivo, que se guarda aparte) */
ERP.cambiarEstado = async (ds, fila, estado, extra) => {
  const db = await ERP.db();
  const ahora = new Date().toISOString();
  const datos = { estado, modificado: ahora, modificado_por: ERP.uid || '', ...(extra || {}) };
  if (ds === 'cheques_todos' && fila.origen === 'Archivo') {
    const prev = (dash.data('cheques_estado').data || []).find((r) => r.id === fila.id) || {};
    const { id: _x, ...resto } = prev;
    await db.doc(`data/erp/cheques_estado/${fila.id}`).set({ ...resto, ...datos });
    await ERP.log(db, 'cheques_estado', fila.id, 'Cambio de estado', `${fila.estado} → ${estado}`);
    return;
  }
  const real = ds === 'cheques_todos' ? 'cheques_reg' : ds;
  const paso = { estado, anterior: fila.estado || '', fecha: ahora, usuario: ERP.uid || '' };
  ['fecha_pago', 'medio_pago', 'operacion_pago'].forEach((k) => { if (extra && extra[k]) paso[k] = extra[k]; });
  datos.estados_hist = [...(Array.isArray(fila.estados_hist) ? fila.estados_hist : []), paso].slice(-40);
  await db.doc(`${PATH_DS[real]}/${fila.id}`).update(datos);
  await ERP.log(db, real, fila.id, 'Cambio de estado', `${fila.estado || '—'} → ${estado}${paso.fecha_pago ? ` · ${estado === 'Cobrada' ? 'cobrada' : 'pagada'} el ${fmtF(paso.fecha_pago)}` : ''}${paso.medio_pago ? ` · ${paso.medio_pago}` : ''}${paso.operacion_pago ? ` · op. ${paso.operacion_pago}` : ''}`);
};

/* ---------- botón de estado por colores ---------- */
ERP.boton = (fila, kind, ds, opts = {}) => {
  const C = cfg();
  let sit;
  if (kind === 'flota') {
    const fs = [fila.vto_vtv, fila.vto_seguro].filter(Boolean).sort();
    sit = window.ERP_SIT(fs[0] || null, fila.estado, 'flota', C);
    if (!fs.length) sit = { c: 'gris', t: 'SIN VENCIMIENTOS' };
  } else if (kind === 'cheque') {
    sit = window.ERP_SIT(fila.estado === 'Planificado' ? fila.fecha_emision || fila.fecha_debito : fila.fecha_debito, fila.estado, 'cheque', C, fila.direccion);
  } else {
    const campo = opts.fecha || 'fecha';
    sit = window.ERP_SIT(fila[campo], fila.estado, kind, C, fila.tipo);
  }
  const wrap = el('span', 'gs-stwrap');
  const b = el('button', `gs-st ${sit.c}${sit.alta ? ' alta' : ''}`, sit.t);
  b.type = 'button';
  b.title = `${fila.estado || 'Sin estado'}${sit.dias != null ? ` · ${sit.dias < 0 ? `venció hace ${-sit.dias} día(s)` : `faltan ${sit.dias} día(s)`}` : ''}`;
  wrap.appendChild(b);
  if (!ESTADOS[kind] || opts.soloVer) { b.disabled = !ESTADOS[kind]; return wrap; }
  b.onclick = (ev) => {
    ev.stopPropagation();
    const abierto = wrap.querySelector('.gs-pop');
    document.querySelectorAll('.gs-pop').forEach((p) => p.remove());
    if (abierto) return;
    const pop = el('div', 'gs-pop');
    pop.onclick = (e) => e.stopPropagation();
    pop.appendChild(el('p', 'gs-pop-k', `Estado actual: ${fila.estado || '—'}`));
    if (fila.fecha_pago && (window.ERP_OK[kind] || []).includes(fila.estado)) pop.appendChild(el('p', 'gs-pop-s', `${fila.estado === 'Cobrada' ? 'Cobrada' : 'Pagada'} el ${fmtF(fila.fecha_pago)}${fila.medio_pago ? ` · ${fila.medio_pago}` : ''}${fila.operacion_pago ? ` · op. ${fila.operacion_pago}` : ''}`));
    if (Array.isArray(fila.estados_hist) && fila.estados_hist.length) {
      const det = el('details', 'gs-pop-hist'); det.appendChild(el('summary', null, `Cambios de estado (${fila.estados_hist.length})`));
      const ul = el('ul');
      fila.estados_hist.slice(-8).reverse().forEach((h) => ul.appendChild(el('li', null, `${fmtFH(h.fecha)} · ${h.anterior || '—'} → ${h.estado}${h.fecha_pago ? ` (${fmtF(h.fecha_pago)})` : ''} · ${ERP.nombre(h.usuario)}`)));
      det.appendChild(ul); pop.appendChild(det);
      ERP.pedirNombres(fila.estados_hist.map((h) => h.usuario), []);
    }
    pop.appendChild(el('p', 'gs-pop-s', 'Elegí el nuevo estado:'));
    if (fila.estado_fecha || fila.modificado) pop.appendChild(el('p', 'gs-pop-s', `Último cambio: ${fmtFH(fila.modificado || fila.estado_fecha)}${fila.modificado_por ? ' · ' + ERP.nombre(fila.modificado_por) : ''}`));
    if (typeof fila.comprobante === 'string' && /^(\/|https:\/\/)/.test(fila.comprobante)) { const a = el('a', null, 'Ver comprobante'); a.href = fila.comprobante; a.target = '_blank'; a.rel = 'noopener'; pop.appendChild(a); }
    const msg = el('p', 'gs-pop-err');
    msg.style.display = "none";
    if (!ERP.puedeEditar()) { pop.appendChild(el('p', 'gs-pop-s', 'Tu perfil es de consulta: no puede cambiar estados.')); wrap.appendChild(pop); ERP.ubicarPop(pop, b); return; }
    const lista = el('div', 'gs-pop-ops');
    ESTADOS[kind].filter((s) => s !== fila.estado).forEach((s) => {
      const o = el('button', 'gs-act', s); o.type = 'button';
      o.onclick = async () => {
        const esPago = (window.ERP_OK[kind] || []).includes(s);
        const conPago = esPago && ['pago', 'factura', 'cuenta'].includes(kind);
        if (esPago && !o.dataset.ok) {
          o.dataset.ok = '1';
          o.textContent = `Confirmar: ${s}`;
          o.classList.add('gs-act-warn');
          lista.querySelectorAll('button').forEach((x) => { if (x !== o) x.style.display = 'none'; });
          const caja = el('div', 'gs-pop-pago');
          if (conPago) {
            const cobro = s === 'Cobrada';
            const lf = el('label', null, cobro ? 'Fecha de cobro' : 'Fecha de pago'); const fp = el('input'); fp.type = 'date'; fp.name = 'fecha_pago'; fp.required = true; fp.value = hoy(); lf.appendChild(fp);
            const lm = el('label', null, 'Medio'); const mp = el('select', 'dash-select'); mp.name = 'medio_pago';
            ['Transferencia', 'Cheque', 'E-Cheq', 'Efectivo', 'Débito automático', 'Tarjeta', 'Compensación'].forEach((x) => mp.add(new Option(x, x))); lm.appendChild(mp);
            const lo = el('label', null, 'Nº de operación (opcional)'); const op = el('input'); op.name = 'operacion_pago'; op.maxLength = 40; lo.appendChild(op);
            caja.append(lf, lm, lo);
          }
          const lab = el('label', 'gs-pop-file', 'Comprobante (opcional) ');
          const inp = el('input'); inp.type = 'file'; lab.appendChild(inp);
          caja.appendChild(lab);
          const cancelar = el('button', 'gs-act', 'Volver'); cancelar.type = 'button';
          cancelar.onclick = () => { caja.remove(); cancelar.remove(); delete o.dataset.ok; o.textContent = s; o.classList.remove('gs-act-warn'); lista.querySelectorAll('button').forEach((x) => { x.style.display = ''; }); };
          o.before(caja); o.after(cancelar);
          return;
        }
        o.disabled = true;
        let aviso = '';
        try {
          const extra = {};
          if (esPago) {
            extra.fecha_confirmacion = new Date().toISOString();
            const g = (n) => pop.querySelector(`[name="${n}"]`);
            if (g('fecha_pago')) {
              if (!g('fecha_pago').value) { msg.style.display = ""; msg.textContent = 'Indicá la fecha.'; o.disabled = false; return; }
              extra.fecha_pago = g('fecha_pago').value; extra.medio_pago = g('medio_pago').value;
              if (g('operacion_pago').value.trim()) extra.operacion_pago = g('operacion_pago').value.trim();
            }
          } else if (fila.fecha_pago && (window.ERP_OK[kind] || []).includes(fila.estado)) {
            extra.fecha_pago = ''; extra.medio_pago = ''; extra.operacion_pago = '';
            const f = pop.querySelector('.gs-pop-file input');
            if (f && f.files && f.files[0]) { try { extra.comprobante = (await ERP.subirAdjunto(f.files[0])).url; } catch (ex) { aviso = `Estado actualizado, pero sin el comprobante: ${ex.message}`; } }
          }
          await ERP.cambiarEstado(ds, fila, s, extra);
          if (aviso) { lista.remove(); msg.style.display = ""; msg.textContent = aviso; setTimeout(() => pop.remove(), 6000); } else pop.remove();
        } catch (ex) {
          msg.style.display = ""; msg.textContent = ERP.motivo(ex); o.disabled = false;
        }
      };
      lista.appendChild(o);
    });
    pop.append(lista, msg);
    wrap.appendChild(pop); ERP.ubicarPop(pop, b);
  };
  return wrap;
};
document.addEventListener('click', () => document.querySelectorAll('.gs-pop').forEach((p) => p.remove()));
/* la ventana de estado flota sobre la página (no la recorta la tabla) */
ERP.ubicarPop = (pop, ancla) => {
  const ub = () => {
    if (!pop.isConnected) return;
    const r = ancla.getBoundingClientRect(); const w = pop.offsetWidth, h = pop.offsetHeight;
    let top = r.bottom + 4; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    pop.style.top = `${top}px`; pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
  };
  pop.classList.add('gs-pop-flota'); pop.__ub = ub; ub();
  new ResizeObserver(ub).observe(pop);
};
window.addEventListener('scroll', () => document.querySelectorAll('.gs-pop-flota').forEach((p) => { if (p.__ub) p.__ub(); }), true);

/* ---------- tablas de registros ---------- */
const sitDe = (r, kind, stfecha) => {
  const C = cfg();
  if (kind === 'flota') { const fs = [r.vto_vtv, r.vto_seguro].filter(Boolean).sort(); return fs.length ? window.ERP_SIT(fs[0], r.estado, 'flota', C) : { c: 'gris' }; }
  if (kind === 'cheque') return window.ERP_SIT(r.estado === 'Planificado' ? r.fecha_emision || r.fecha_debito : r.fecha_debito, r.estado, 'cheque', C, r.direccion);
  return window.ERP_SIT(r[stfecha || 'fecha'], r.estado, kind, C, r.tipo);
};
const UNI = { shell: ['Shell', 'Shell (DSB)', 'DSB'], ypf: ['YPF', 'YPF (Comb. Magdalena)', 'Comb. Magdalena'], alvemem: ['Alvemem', 'Tolosa', 'Olmos', 'Alvemem · Tolosa', 'Alvemem · Olmos'], tolosa: ['Tolosa', 'Alvemem · Tolosa'], olmos: ['Olmos', 'Alvemem · Olmos'] };
ERP.UNI = window.ERP_UNI = UNI;
ERP.enUnidad = (r) => { const u = dash.params().emp || 'grupo'; if (!UNI[u]) return true; const v = r.estacion || r.empresa || r.unidad || ''; return UNI[u].includes(v); };
ERP.filtrar = (ds, rows, kind, stfecha) => {
  const f = ERP.f[ds] || {};
  const q = norm(f.q);
  return rows.filter((r) => ERP.enUnidad(r) && (!q || norm(Object.values(r).filter((v) => typeof v !== 'object').join(' ')).includes(q)) && (!f.col || (kind && sitDe(r, kind, stfecha).c === f.col)));
};
ERP.modoEdicion = (f, on) => modoEdicion(f, on);
ERP.editar = (ds, fila) => {
  const form = document.querySelector(`form.gs-form[data-ds="${ds}"]`);
  if (!form) return;
  for (const e of form.elements) {
    if (!e.name || e.name.startsWith('_') || e.type === 'file') continue;
    const v = fila[e.name] ?? '';
    e.value = v;
    if (e.tagName === 'SELECT' && v !== '' && e.value !== String(v)) { e.add(new Option(String(v), String(v))); e.value = String(v); }
  }
  form.querySelectorAll('select[data-draw]').forEach((s) => dash.draw(s.dataset.draw));
  form.dispatchEvent(new Event('gs-cargado'));
  form.querySelectorAll('input[name="_rid"]').forEach((i) => { i.value = fila.id; });
  modoEdicion(form, true);
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
const modoEdicion = (form, on) => {
  form.querySelectorAll('.gs-btn-new').forEach((b) => { b.hidden = on; });
  form.querySelectorAll('.gs-btn-edit, .gs-btn-cancel, .gs-editando').forEach((b) => { b.hidden = !on; });
  form.classList.toggle('gs-form-edit', on);
};
ERP.tabla = (tb, rows, o) => {
  const cols = o.cols;
  const n = cols.length + 1;
  if (!rows.length) return window.spVacia(tb, n, o.vacio || 'No hay registros que coincidan.');
  tb.replaceChildren(...rows.map((r) => {
    const tr = el('tr');
    tr.dataset.key = encodeURIComponent(r.id);
    cols.forEach(([c, f]) => {
      const td = el('td');
      const v = r[c];
      if (f === 'm') { td.textContent = v == null || v === '' ? '' : window.SP.$(Number(v)); td.className = 'gs-num'; }
      else if (f === 'n') { td.textContent = v == null || v === '' ? '' : window.SP.n(Number(v)); td.className = 'gs-num'; }
      else if (f === 'd') td.textContent = fmtF(v);
      else if (f === 'st') td.appendChild(ERP.boton(r, o.kind, o.ds, { fecha: o.stfecha }));
      else if (f === 'l') { if (typeof v === 'string' && /^https?:\/\//.test(v)) { const a = el('a', null, 'Abrir'); a.href = v; a.target = '_blank'; a.rel = 'noopener'; td.appendChild(a); } }
      else if (f === 'adj') {
        const adj = Array.isArray(v) ? v : [];
        adj.forEach((x, i) => {
          if (!(x && typeof x.url === 'string' && /^(\/_blob\/|\/adjunto\/|https:\/\/)/.test(x.url))) return;
          const a = el('a', 'gs-adj', x.nombre || `Doc ${i + 1}`); a.href = x.url; a.target = '_blank'; a.rel = 'noopener';
          const w = el('span', 'gs-adj-w'); w.appendChild(a);
          if (ERP.puedeEditar() && o.path) {
            const q = el('button', 'gs-adj-x', '×'); q.type = 'button'; q.title = `Quitar ${x.nombre || 'adjunto'}`; q.setAttribute('aria-label', q.title);
            q.onclick = async (ev) => {
              ev.stopPropagation();
              if (!q.dataset.ok) { q.dataset.ok = '1'; q.textContent = '¿Quitar?'; q.classList.add('gs-adj-x-ok'); setTimeout(() => { if (q.isConnected) { delete q.dataset.ok; q.textContent = '×'; q.classList.remove('gs-adj-x-ok'); } }, 5000); return; }
              q.disabled = true;
              try { await ERP.quitarAdjunto(o.path, o.formDs || o.ds, r, i); } catch (e) { q.textContent = 'No se pudo'; q.title = ERP.motivo(e); }
            };
            w.appendChild(q);
          }
          td.appendChild(w);
        });
        if (typeof r.link === 'string' && /^https?:\/\//.test(r.link)) { const a = el('a', 'gs-adj', 'Drive'); a.href = r.link; a.target = '_blank'; a.rel = 'noopener'; td.appendChild(a); }
        if (typeof r.comprobante === 'string' && /^(\/|https:\/\/)/.test(r.comprobante)) { const a = el('a', 'gs-adj', 'Comprobante'); a.href = r.comprobante; a.target = '_blank'; a.rel = 'noopener'; td.appendChild(a); }
      } else if (f === 'u') td.textContent = ERP.nombre(v);
      else { td.textContent = v == null ? '' : String(v); if (o.anchas && o.anchas.includes(c)) { td.style.whiteSpace = 'normal'; td.style.minWidth = '170px'; } }
      tr.appendChild(td);
    });
    const ta = el('td', 'gs-acciones');
    if (ERP.puedeEditar() && o.editable !== false && (!o.editableSi || o.editableSi(r))) {
      const e = el('button', 'gs-act', 'Editar'); e.type = 'button';
      e.onclick = () => ERP.editar(o.formDs || o.ds, r);
      const x = el('button', 'gs-act', 'Borrar'); x.type = 'button';
      x.onclick = async () => {
        if (!x.dataset.ok) { x.dataset.ok = '1'; x.textContent = '¿Borrar? Confirmar'; x.classList.add('gs-act-warn'); setTimeout(() => { if (x.isConnected) { delete x.dataset.ok; x.textContent = 'Borrar'; x.classList.remove('gs-act-warn'); } }, 5000); return; }
        try { const db = await ERP.db(); await db.doc(`${o.path}/${r.id}`).delete(); await ERP.log(db, o.formDs || o.ds, r.id, 'Baja', JSON.stringify(r).slice(0, 600)); } catch { x.textContent = 'No se pudo borrar'; }
      };
      ta.append(e, x);
    }
    if (ERP.puedeEditar() && ESTADOS[o.kind] && o.kind !== 'compra') {
      const s = el('button', 'gs-act gs-act-estado', 'Cambiar estado ▾'); s.type = 'button';
      s.onclick = (ev) => { ev.stopPropagation(); const st = tr.querySelector('.gs-st'); if (st) st.click(); };
      ta.prepend(s);
    }
    tr.appendChild(ta);
    return tr;
  }));
};
const colsDe = (tb) => tb.dataset.cols.split(',').map((c) => c.split(':'));
dash.draw('tb_store', (tb) => {
  const ds = tb.dataset.ds, kind = tb.dataset.st || null, stfecha = tb.dataset.stfecha || null;
  const cols = colsDe(tb);
  const d = dash.data(ds);
  if (d.status === 'error') return window.spVacia(tb, cols.length + 1, 'No se pudieron leer los registros.');
  if (d.status !== 'ok') return window.spVacia(tb, cols.length + 1, '—');
  if (!d.data.length) return window.spVacia(tb, cols.length + 1, 'Todavía no hay registros. Cargá el primero con el formulario.');
  const orden = tb.dataset.orden;
  const rows = ERP.filtrar(ds, [...d.data], kind, stfecha).sort((p, q) => String(p[orden] || '9').localeCompare(String(q[orden] || '9')));
  ERP.pedirNombres(rows.map((r) => r.modificado_por).filter(Boolean), 'tb_store');
  ERP.tabla(tb, rows, { cols, kind, ds, stfecha, path: tb.dataset.path, anchas: ['titulo', 'tercero', 'cliente', 'servicio', 'descripcion', 'concepto', 'observaciones', 'proveedor'] });
});

/* listado de cheques (archivo + cargados) */
dash.draw('tb_cheques', (tb) => {
  const cols = colsDe(tb);
  const d = dash.data('cheques_todos');
  if (d.status === 'error') return window.spVacia(tb, cols.length + 1, 'No se pudo leer la base de cheques.');
  if (d.status !== 'ok' || !Array.isArray(d.data)) return window.spVacia(tb, cols.length + 1, '—');
  const rows = ERP.filtrar('cheques_todos', window.ERP_FILTRO_CH(d.data), 'cheque').sort((a, b) => String(a.fecha_debito || '9').localeCompare(String(b.fecha_debito || '9')));
  ERP.tabla(tb, rows, { cols, kind: 'cheque', ds: 'cheques_todos', formDs: 'cheques_reg', path: 'data/erp/cheques', editableSi: (r) => r.origen === 'Carga', anchas: ['observaciones', 'beneficiario', 'concepto'] });
});

/* exportación a Excel (CSV) */
ERP.exportar = async (ds, btn, soloPreparar) => {
  const tb = document.querySelector(`tbody[data-ds="${ds}"]`);
  if (!tb) return;
  const cols = colsDe(tb);
  const ths = [...tb.closest('table').querySelectorAll('thead th')].map((t) => t.textContent.trim());
  let rows = dash.data(ds).data || [];
  if (ds === 'cheques_todos') rows = window.ERP_FILTRO_CH(rows);
  rows = ERP.filtrar(ds, rows, tb.dataset.st || (ds === 'cheques_todos' ? 'cheque' : null), tb.dataset.stfecha);
  const kind = tb.dataset.st || (ds === 'cheques_todos' ? 'cheque' : null);
  ERP.ultimaExport = { ds, cols, ths: ths.slice(0, cols.length), rows, kind, stfecha: tb.dataset.stfecha };
  if (soloPreparar) return;
  const val = (r, c, f) => {
    if (f === 'st') return kind ? sitDe(r, kind, tb.dataset.stfecha).t || '' : '';
    if (f === 'adj') return (Array.isArray(r[c]) ? r[c].map((x) => x.nombre).join(' / ') : '');
    if (f === 'd') return fmtF(r[c]);
    if (f === 'm' || f === 'n') return r[c] == null ? '' : String(r[c]).replace('.', ',');
    return r[c] == null ? '' : String(r[c]);
  };
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const lineas = [ths.slice(0, cols.length).map(esc).join(';'), ...rows.map((r) => cols.map(([c, f]) => esc(val(r, c, f))).join(';'))];
  try {
    const dl = await claude.use('downloads');
    if (!dl) throw new Error('no');
    await dl.save({ filename: `${ds}_${hoy()}.csv`, data: '﻿' + lineas.join('\r\n') });
  } catch { if (btn) btn.classList.add('gs-act-warn'); }
};

/* ---------- cheques: calendario mensual ---------- */
const colorCheque = (r) => {
  if (r.estado === 'Anulado') return 'gris';
  if (r.estado === 'Rechazado') return 'rojo';
  if (['Acreditado', 'Debitado / Pagado'].includes(r.estado)) return 'verde';
  const s = window.ERP_SIT(r.estado === 'Planificado' ? r.fecha_emision || r.fecha_debito : r.fecha_debito, r.estado, 'cheque', cfg(), r.direccion);
  if (s.c === 'rojo') return 'rojo';
  if (s.c === 'amarillo') return 'amarillo';
  return r.estado === 'Planificado' ? 'azul' : 'violeta';
};
ERP.calendario = (cont, mes, eventos, opts) => {
  const [y, m] = mes.split('-').map(Number);
  const primero = new Date(Date.UTC(y, m - 1, 1));
  const desplaz = (primero.getUTCDay() + 6) % 7;
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const h = hoy();
  const grid = el('div', 'gs-cal-grid');
  for (let i = 0; i < desplaz; i++) grid.appendChild(el('div', 'gs-cal-dia vacio'));
  for (let d = 1; d <= dias; d++) {
    const iso = `${mes}-${String(d).padStart(2, '0')}`;
    const c = el('div', 'gs-cal-dia');
    if (iso === h) c.classList.add('hoy');
    if (opts.sel === iso) c.classList.add('sel');
    const wd = (desplaz + d - 1) % 7;
    if (wd >= 5) c.classList.add('finde');
    c.appendChild(el('span', 'gs-cal-n', String(d)));
    const evs = eventos[iso] || [];
    evs.slice(0, opts.max || 3).forEach((e) => c.appendChild(el('span', `gs-cal-ev ${e.c}`, e.t)));
    if (evs.length > (opts.max || 3)) c.appendChild(el('span', 'gs-cal-mas', `+${evs.length - (opts.max || 3)} más`));
    if (opts.total && opts.total[iso]) c.appendChild(el('span', 'gs-cal-tot', opts.total[iso]));
    if (opts.onClick) { c.tabIndex = 0; c.setAttribute('role', 'button'); c.onclick = () => opts.onClick(iso); c.onkeydown = (ev) => { if (ev.key === 'Enter') opts.onClick(iso); }; }
    grid.appendChild(c);
  }
  cont.replaceChildren(grid);
};
const mesActual = () => dash.params().cal_mes || hoy().slice(0, 7);
dash.draw('cal_titulo', (e) => { const [y, m] = mesActual().split('-'); e.textContent = `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][Number(m) - 1]} ${y}`; });
dash.draw('cal_cheques', (cont) => {
  const d = dash.data('cheques_todos');
  if (d.status !== 'ok' || !Array.isArray(d.data)) { cont.textContent = d.status === 'error' ? 'No se pudo leer la base de cheques.' : '—'; return; }
  const mes = mesActual();
  const ev = {}, tot = {};
  window.ERP_FILTRO_CH(d.data).filter((r) => (r.fecha_debito || '').slice(0, 7) === mes).sort((a, b) => b.importe - a.importe).forEach((r) => {
    (ev[r.fecha_debito] ??= []).push({ c: colorCheque(r), t: `${window.SP.m(r.importe).replace('$ ', '$')} ${r.beneficiario && r.beneficiario !== '(sin dato)' ? r.beneficiario : r.empresa || ''}` });
    if (r.estado !== 'Anulado') tot[r.fecha_debito] = (tot[r.fecha_debito] || 0) + (Number(r.importe) || 0);
  });
  Object.keys(tot).forEach((k) => { tot[k] = `Total ${window.SP.m(tot[k])}`; });
  ERP.calendario(cont, mes, ev, { sel: ERP.diaSel, total: tot, onClick: (iso) => { ERP.diaSel = iso; dash.draw('cal_cheques'); dash.draw('cal_dia'); dash.draw('cal_dia_tit'); document.querySelectorAll('#cal-dia-card').forEach((x) => x.scrollIntoView({ behavior: 'smooth', block: 'nearest' })); } });
});
dash.draw('cal_dia_tit', (e) => { e.textContent = ERP.diaSel ? fmtF(ERP.diaSel) : 'Elegí un día del calendario'; });
dash.draw('cal_dia', (ul) => {
  const d = dash.data('cheques_todos');
  if (!ERP.diaSel || d.status !== 'ok') { ul.replaceChildren(el('li', 'gs-vacio', 'Tocá un día para ver sus cheques o planificar uno nuevo.')); return; }
  const rows = window.ERP_FILTRO_CH(d.data).filter((r) => r.fecha_debito === ERP.diaSel || (r.estado === 'Planificado' && r.fecha_emision === ERP.diaSel));
  if (!rows.length) { ul.replaceChildren(el('li', 'gs-vacio', 'No hay cheques este día.')); return; }
  ul.replaceChildren(...rows.map((r) => {
    const li = el('li', 'gs-dia-item');
    const i = el('span', `gs-dot ${colorCheque(r)}`);
    const t = el('div', 'gs-dia-txt');
    t.append(el('b', null, `${window.SP.$(r.importe)} · ${r.direccion === 'Recibido' ? 'de' : 'a'} ${r.beneficiario}`), el('span', null, `${r.empresa || ''} · ${r.banco || ''}${r.numero ? ' · Nº ' + r.numero : ''} · ${r.estado}${r.estado === 'Planificado' && r.fecha_emision ? ' · emitir el ' + fmtF(r.fecha_emision) : ''}`));
    li.append(i, t, ERP.boton(r, 'cheque', 'cheques_todos'));
    if (r.origen === 'Carga' && ERP.puedeEditar()) { const b = el('button', 'gs-act', 'Editar'); b.type = 'button'; b.onclick = () => ERP.editar('cheques_reg', r); li.appendChild(b); }
    return li;
  }));
});
dash.draw('chm', (e) => {
  e.setAttribute('data-row', '0');
  const d = dash.data('cheques_mes');
  if (d.status !== 'ok' || !Array.isArray(d.data) || !d.data[0]) { e.textContent = '—'; return; }
  window.spFmt(e, d.data[0][e.dataset.field]);
});
dash.draw('tb_chm_banco', (tb) => {
  const d = dash.data('cheques_mes_banco');
  if (d.status !== 'ok' || !Array.isArray(d.data)) return window.spVacia(tb, 3, '—');
  if (!d.data.length) return window.spVacia(tb, 3, 'Sin cheques en el mes.');
  tb.replaceChildren(...d.data.map((r) => { const tr = el('tr'); tr.dataset.key = encodeURIComponent(r.banco); tr.append(el('td', null, r.banco), el('td', 'gs-num', window.SP.n(r.n)), el('td', 'gs-num', window.SP.$(r.importe))); return tr; }));
});
dash.draw('tb_chm_dia', (tb) => {
  const d = dash.data('cheques_mes_dia');
  if (d.status !== 'ok' || !Array.isArray(d.data)) return window.spVacia(tb, 3, '—');
  if (!d.data.length) return window.spVacia(tb, 3, 'Sin cheques en el mes.');
  tb.replaceChildren(...d.data.map((r) => { const tr = el('tr'); tr.dataset.key = encodeURIComponent(r.fecha); tr.append(el('td', null, fmtF(r.fecha)), el('td', 'gs-num', window.SP.n(r.n)), el('td', 'gs-num', window.SP.$(r.importe))); return tr; }));
});
dash.draw('sel_chq_banco', (sel) => {
  const d = dash.data('cheques_todos');
  const bancos = d.status === 'ok' && Array.isArray(d.data) ? [...new Set(d.data.map((r) => r.banco).filter(Boolean))].sort() : [];
  sel.replaceChildren(new Option('Todos los bancos', ''), ...bancos.map((b) => new Option(b, b)));
  sel.value = dash.params().chq_banco || '';
});

/* ---------- RRHH: cumpleaños ---------- */
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const mesCum = () => dash.params().cum_mes || hoy().slice(0, 7);
const itemCum = (r, extra) => {
  const li = el('li', 'gs-dia-item');
  li.append(el('span', `gs-dot ${r.dias === 0 ? 'amarillo' : 'azul'}`));
  const t = el('div', 'gs-dia-txt');
  t.append(el('b', null, r.nombre), el('span', null, `${r.sector || 'Sin sector'}${r.estacion ? ' · ' + r.estacion : ''} · ${String(r.dia).padStart(2, '0')}/${String(r.mes).padStart(2, '0')} · cumple ${extra != null ? extra : r.edad}`));
  li.append(t);
  if (r.dias > 0 && r.dias <= 31) li.append(el('span', 'gs-chip-mini', r.dias === 1 ? 'mañana' : `en ${r.dias} días`));
  if (r.dias === 0) li.append(el('span', 'gs-chip-mini hoy', 'HOY'));
  return li;
};
const listaCum = (ul, filtro, vacio, edadPara) => {
  const d = dash.data('cumpleanos');
  if (d.status !== 'ok' || !Array.isArray(d.data)) { ul.replaceChildren(el('li', 'gs-vacio', d.status === 'error' ? 'No se pudieron leer los legajos.' : '—')); return; }
  const rows = d.data.filter(filtro);
  ul.replaceChildren(...(rows.length ? rows.map((r) => itemCum(r, edadPara ? edadPara(r) : null)) : [el('li', 'gs-vacio', vacio)]));
};
dash.draw('cum_hoy', (ul) => listaCum(ul, (r) => r.dias === 0, 'Hoy no cumple años nadie.'));
dash.draw('cum_prox', (ul) => listaCum(ul, (r) => r.dias > 0 && r.dias <= 30, 'No hay cumpleaños en los próximos 30 días.'));
dash.draw('cum_mes_tit', (e) => { const [y, m] = mesCum().split('-'); e.textContent = `${MESES[Number(m) - 1]} ${y}`; });
dash.draw('cum_mes', (ul) => {
  const [y, m] = mesCum().split('-').map(Number);
  listaCum(ul, (r) => r.mes === m, 'Nadie cumple años este mes.', (r) => y - Number(r.fecha_nac.slice(0, 4)));
  [...ul.children].sort((a, b) => a.textContent.localeCompare(b.textContent));
});
dash.draw('cal_cumple', (cont) => {
  const d = dash.data('cumpleanos');
  const mes = mesCum();
  const [y, m] = mes.split('-').map(Number);
  const ev = {};
  (d.status === 'ok' && Array.isArray(d.data) ? d.data : []).filter((r) => r.mes === m).forEach((r) => {
    const dd = m === 2 && r.dia === 29 && !((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 28 : r.dia;
    (ev[`${mes}-${String(dd).padStart(2, '0')}`] ??= []).push({ c: 'azul', t: `${r.nombre} (${y - Number(r.fecha_nac.slice(0, 4))})` });
  });
  ERP.calendario(cont, mes, ev, { max: 4 });
});

/* ---------- centro de notificaciones ---------- */
const notifVisibles = () => {
  const d = dash.data('notificaciones');
  if (d.status !== 'ok' || !Array.isArray(d.data)) return null;
  const p = ERP.perfil;
  return d.data.filter((n) => (!p || ['Administrador', 'Gerencia'].includes(p) || n.obligatoria || (n.destinatarios || []).includes(p)));
};
const abiertas = (n) => ['Pendiente', 'Vencida', 'Leída', 'En proceso'].includes(n.estado);
dash.draw('notif_count', (e) => {
  const v = notifVisibles();
  const k = v ? v.filter((n) => ['Pendiente', 'Vencida'].includes(n.estado)).length : 0;
  const t = k > 99 ? '99+' : String(k);
  if (e.textContent !== t) e.textContent = t;
  e.classList.toggle('cero', !k);
});
ERP.marcar = async (n, estado, btn) => {
  try {
    const db = await ERP.db();
    await db.doc(`data/erp/notif_estado/${n.id}`).set({ estado, fecha: new Date().toISOString(), usuario: ERP.uid || '', titulo: n.titulo.slice(0, 120) });
    await ERP.log(db, 'notif_estado', n.id, 'Estado de aviso', `${n.estado} → ${estado} · ${n.titulo}`);
  } catch { if (btn) { btn.textContent = 'Sin permiso'; btn.disabled = true; } }
};
ERP.ir = (destino) => {
  const s = document.querySelector(`[data-subpanel="${destino}"]`) || document.querySelector(`[data-panel="${destino}"]`);
  if (!s) return;
  const mod = s.closest('[data-panel]').dataset.panel;
  ERP.abrir(mod, s.dataset.subpanel ? destino : null, true);
  document.querySelectorAll('#panel-notif').forEach((p) => { p.hidden = true; });
};
dash.draw('notif_lista', (ul) => {
  const modo = ul.dataset.modo || 'panel';
  let v = notifVisibles();
  if (!v) { ul.replaceChildren(el('li', 'gs-vacio', '—')); return; }
  if (modo === 'full') {
    const f = ERP.nf;
    v = v.filter((n) => (f.estado === 'abiertas' ? abiertas(n) : !f.estado || n.estado === f.estado) && (!f.prioridad || n.prioridad === f.prioridad) && (!f.modulo || n.modulo === f.modulo));
  } else v = v.filter((n) => ['Pendiente', 'Vencida', 'En proceso'].includes(n.estado)).slice(0, modo === 'dash' ? 6 : 8);
  if (!v.length) { ul.replaceChildren(el('li', 'gs-vacio', modo === 'full' ? 'No hay avisos con estos filtros.' : 'No hay avisos pendientes.')); return; }
  ERP.pedirNombres(v.map((n) => n.gestion_usuario).filter(Boolean), 'notif_lista');
  ul.replaceChildren(...v.map((n) => {
    const li = el('li', `gs-notif ${n.estado === 'Resuelta' ? 'resuelta' : ''}`);
    li.setAttribute('data-source', 'notificaciones'); li.setAttribute('data-where', `id=${n.id}`); li.setAttribute('data-field', 'titulo');
    const cab = el('div', 'gs-notif-cab');
    cab.append(el('span', `gs-prio p-${norm(n.prioridad)}`, n.prioridad), el('b', null, n.titulo));
    const desc = el('p', 'gs-notif-desc', n.descripcion);
    const meta = el('p', 'gs-notif-meta', `${n.modulo}${n.limite ? ' · límite ' + fmtF(n.limite) : ''} · ${n.estado}${n.gestion_usuario ? ` por ${ERP.nombre(n.gestion_usuario)} el ${fmtFH(n.gestion_fecha)}` : ''}${n.destinatarios && n.destinatarios.length ? ' · para ' + n.destinatarios.join(', ') : ''}`);
    const acc = el('div', 'gs-notif-acc');
    const ir = el('button', 'gs-act', 'Ir al registro'); ir.type = 'button'; ir.onclick = () => ERP.ir(n.ir); acc.appendChild(ir);
    ['Leída', 'En proceso', 'Resuelta', 'Pendiente'].filter((s) => s !== n.estado && !(s === 'Pendiente' && ['Pendiente', 'Vencida'].includes(n.estado))).forEach((s) => {
      const b = el('button', 'gs-act', s === 'Pendiente' ? 'Reabrir' : s); b.type = 'button'; b.onclick = () => ERP.marcar(n, s, b); acc.appendChild(b);
    });
    li.append(cab, desc, meta, acc);
    return li;
  }));
});
dash.draw('notif_res', (e) => {
  const v = notifVisibles();
  const k = e.dataset.k;
  if (!v) { e.textContent = '—'; return; }
  const n = k === 'criticas' ? v.filter((x) => x.prioridad === 'Crítica' && abiertas(x)).length : k === 'pendientes' ? v.filter((x) => ['Pendiente', 'Vencida'].includes(x.estado)).length : k === 'proceso' ? v.filter((x) => x.estado === 'En proceso').length : v.filter((x) => x.estado === 'Resuelta').length;
  e.textContent = window.SP.n(n);
});

/* ---------- historial de operaciones ---------- */
dash.draw('tb_hist', (tb) => {
  const d = dash.data('historial');
  if (d.status !== 'ok' || !Array.isArray(d.data)) return window.spVacia(tb, 5, d.status === 'error' ? 'No se pudo leer el historial.' : '—');
  const q = norm((ERP.f.historial || {}).q);
  const rows = d.data.filter((r) => !q || norm(`${r.coleccion} ${r.registro} ${r.accion} ${r.detalle} ${ERP.nombre(r.usuario)}`).includes(q)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 300);
  if (!rows.length) return window.spVacia(tb, 5, 'Todavía no hay operaciones registradas.');
  ERP.pedirNombres(rows.map((r) => r.usuario), 'tb_hist');
  tb.replaceChildren(...rows.map((r) => {
    const tr = el('tr'); tr.dataset.key = encodeURIComponent(r.id);
    const det = el('td', null, r.detalle); det.style.whiteSpace = 'normal'; det.style.minWidth = '260px';
    tr.append(el('td', null, fmtFH(r.fecha)), el('td', null, ERP.nombre(r.usuario)), el('td', null, `${ETIQ_DS[r.coleccion] || r.coleccion} · ${r.registro}`), el('td', null, r.accion), det);
    return tr;
  }));
});

/* ---------- perfiles ---------- */
const asignaciones = () => { const d = dash.data('config'); const doc = d.status === 'ok' && Array.isArray(d.data) ? d.data.find((r) => r.id === 'perfiles') : null; return (doc && doc.asignaciones) || {}; };
dash.draw('mi_perfil', (e) => { e.textContent = ERP.perfil ? `${ERP.perfil}${asignaciones()[ERP.uid] ? '' : ' (por defecto)'}` : '—'; });
dash.draw('tb_perfiles', (tb) => {
  const a = Object.entries(asignaciones());
  if (!a.length) return window.spVacia(tb, 3, 'Sin asignaciones: los editores del tablero ven todo como Administrador y el resto como Consulta.');
  ERP.pedirNombres(a.map(([id]) => id), 'tb_perfiles');
  tb.replaceChildren(...a.map(([id, p]) => {
    const tr = el('tr');
    const acc = el('td');
    if (ERP.canEdit) { const x = el('button', 'gs-act', 'Quitar'); x.type = 'button'; x.onclick = async () => { try { const db = await ERP.db(); const n = { ...asignaciones() }; delete n[id]; await db.doc('data/erp/config/perfiles').set({ asignaciones: n }); await ERP.log(db, 'config', 'perfiles', 'Quitar perfil', `${ERP.nombre(id)}: ${p}`); } catch { x.textContent = 'Sin permiso'; } }; acc.appendChild(x); }
    tr.append(el('td', null, ERP.nombre(id)), el('td', null, p), acc);
    return tr;
  }));
});
ERP.busqueda = [];
dash.draw('perfil_busq', (ul) => {
  if (!ERP.busqueda.length) { ul.replaceChildren(); return; }
  ul.replaceChildren(...ERP.busqueda.map((h) => {
    const li = el('li');
    const b = el('button', 'gs-act', `Asignar a ${h.name}`); b.type = 'button';
    b.onclick = async () => {
      const sel = document.querySelector('#perfil-sel');
      const p = sel ? sel.value : 'Consulta';
      try { const db = await ERP.db(); await db.doc('data/erp/config/perfiles').set({ asignaciones: { ...asignaciones(), [h.id]: p } }); ERP.nombres[h.id] = h.name; await ERP.log(db, 'config', 'perfiles', 'Asignar perfil', `${h.name}: ${p}`); ERP.busqueda = []; dash.draw('perfil_busq'); } catch { b.textContent = 'Sin permiso'; }
    };
    li.appendChild(b);
    return li;
  }));
});

/* ---------- navegación, submenús y controles (sólo escuchan y marcan estado) ---------- */
dash.draw('migas', (nav) => {
  const tab = document.querySelector(`.sp-tab[data-tab="${ERP.nav.mod}"] span`);
  const sub = ERP.nav.sub ? document.querySelector(`.gs-subtab[data-sub="${ERP.nav.sub}"]`) : null;
  const a = el('button', 'gs-miga', 'Inicio'); a.type = 'button'; a.onclick = () => ERP.abrir('dash', null, true);
  const parts = [a];
  if (ERP.nav.mod !== 'dash' && tab) { parts.push(el('span', 'gs-miga-sep', '›')); const m = el('button', 'gs-miga', tab.textContent); m.type = 'button'; m.onclick = () => ERP.abrir(ERP.nav.mod, null, true); parts.push(m); }
  if (sub) { parts.push(el('span', 'gs-miga-sep', '›')); parts.push(el('span', 'gs-miga act', sub.textContent)); }
  nav.replaceChildren(...parts);
});
(() => {
  const app = document.querySelector('#app');
  document.querySelectorAll('[data-rango]').forEach((b) => b.addEventListener('click', () => { const [d, h] = b.dataset.rango.split(','); dash.setParams({ desde: d, hasta: h }); }));
  document.querySelectorAll('.sp-mes[data-mes]').forEach((b) => b.addEventListener('click', () => {
    const p = dash.params(), m = b.dataset.mes;
    if (p.desde === m && p.hasta === m) dash.setParams({ desde: '2026-01', hasta: '2026-09' }); else dash.setParams({ desde: m, hasta: m });
  }));
  const tabs = [...document.querySelectorAll('.sp-tab[data-tab]')];
  const marcarNav = () => {
    tabs.forEach((t) => { t.setAttribute('aria-selected', String(t.dataset.tab === ERP.nav.mod)); });
    document.querySelectorAll('.gs-subnav-btn[data-go]').forEach((b) => { const on = b.dataset.go === ERP.nav.sub; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  };
  const abrirSub = (mod, sub) => {
    document.querySelectorAll(`[data-panel="${mod}"] .gs-subtab`).forEach((t) => t.setAttribute('aria-selected', String(t.dataset.sub === sub)));
    document.querySelectorAll(`[data-panel="${mod}"] [data-subpanel]`).forEach((s) => { s.hidden = s.dataset.subpanel !== sub; });
  };
  const subActual = (mod) => { const t = document.querySelector(`[data-panel="${mod}"] .gs-subtab[aria-selected="true"]`); return t ? t.dataset.sub : null; };
  const expandir = (mod, on) => {
    document.querySelectorAll(`.gs-subnav[data-subnav="${mod}"]`).forEach((s) => { s.hidden = !on; });
    tabs.filter((t) => t.dataset.tab === mod).forEach((t) => { t.setAttribute('aria-expanded', String(on)); t.classList.toggle('abierto', on); });
  };
  ERP.unidad = ERP.unidad || {};
  ERP.abrir = (mod, sub, link) => {
    if (!sub) sub = subActual(mod);
    if (mod !== ERP.nav.mod) { const u = ERP.unidad[mod] || 'grupo'; if ((dash.params().emp || 'grupo') !== u) dash.setParams({ emp: u }); }
    document.querySelectorAll('[data-panel]').forEach((s) => { s.hidden = s.dataset.panel !== mod; });
    if (sub) abrirSub(mod, sub);
    ERP.nav = { mod, sub };
    tabs.forEach((t) => { if (t.dataset.tab !== mod) expandir(t.dataset.tab, false); });
    expandir(mod, true);
    marcarNav();
    dash.draw('migas');
    if (link) dash.setLink(sub || mod);
  };
  const modDe = (sub) => { const s = document.querySelector(`[data-subpanel="${sub}"]`); const p = s && s.closest('[data-panel]'); return p ? p.dataset.panel : null; };
  ERP.modDe = modDe;
  document.querySelectorAll('.gs-emp[data-emp]').forEach((b) => b.addEventListener('click', () => {
    const sn = b.closest('[data-subnav]');
    const mod = sn ? sn.dataset.subnav : ERP.nav.mod;
    ERP.unidad[mod] = b.dataset.emp;
    if (mod !== ERP.nav.mod) ERP.abrir(mod, null, true);
    dash.setParams({ emp: b.dataset.emp });
  }));
  tabs.forEach((t) => t.addEventListener('click', () => {
    if (ERP.nav.mod === t.dataset.tab && t.getAttribute('aria-expanded') === 'true' && !app.classList.contains('gs-min')) { expandir(t.dataset.tab, false); return; }
    ERP.abrir(t.dataset.tab, null, true);
  }));
  document.querySelectorAll('.gs-subnav-btn[data-go]').forEach((b) => b.addEventListener('click', () => ERP.abrir(modDe(b.dataset.go), b.dataset.go, true)));
  document.querySelectorAll('.gs-subtab[data-sub]').forEach((t) => t.addEventListener('click', () => ERP.abrir(modDe(t.dataset.sub), t.dataset.sub, true)));
  document.querySelectorAll('.gs-go[data-go]').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('#panel-notif').forEach((p) => { p.hidden = true; }); const m = modDe(b.dataset.go); if (m) ERP.abrir(m, b.dataset.go, true); else ERP.abrir(b.dataset.go, null, true); }));
  const viejos = { 'grupo-res': 'dash', empresa: 'est-ind', resumen: 'ope-res', pyl: 'fin-resultados', dia: 'ope-dia', roi: 'rep-roi', grupo: 'com', flota: 'flota-unid', rrhh: 'rrhh-costo', compras: 'compras-costos', com: 'com-ventas' };
  let h = (location.hash || '').slice(1);
  h = viejos[h] || h;
  if (modDe(h)) ERP.abrir(modDe(h), h, false);
  else if (tabs.some((t) => t.dataset.tab === h)) ERP.abrir(h, null, false);
  else ERP.abrir('dash', null, false);
  window.addEventListener('popstate', () => { const x = (location.hash || '').slice(1); if (modDe(x)) ERP.abrir(modDe(x), x, false); else if (tabs.some((t) => t.dataset.tab === x)) ERP.abrir(x, null, false); });

  document.querySelectorAll('#btn-menu').forEach((b) => b.addEventListener('click', () => { const min = !app.classList.contains('gs-min'); app.classList.toggle('gs-min', min); b.setAttribute('aria-expanded', String(!min)); }));
  document.querySelectorAll('#buscar').forEach((inp) => {
    inp.addEventListener('input', () => {
      const q = norm(inp.value.trim());
      document.querySelectorAll('.gs-navgrp').forEach((g) => {
        const t = g.querySelector('.sp-tab');
        const subs = [...g.querySelectorAll('.gs-subnav-btn')];
        const subOk = subs.filter((s) => !q || norm(s.textContent).includes(q));
        const modOk = !q || norm(`${t.textContent} ${t.dataset.busca || ''}`).includes(q);
        g.hidden = !modOk && !subOk.length;
        subs.forEach((s) => { s.hidden = !!q && !modOk && !subOk.includes(s); });
        const sn = g.querySelector('.gs-subnav');
        if (sn) sn.hidden = q ? !subOk.length : t.dataset.tab !== ERP.nav.mod;
      });
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const s = [...document.querySelectorAll('.gs-navgrp:not([hidden]) .gs-subnav-btn:not([hidden])')].find((x) => !x.closest('[hidden]'));
      if (s) ERP.abrir(modDe(s.dataset.go), s.dataset.go, true);
      else { const t = [...document.querySelectorAll('.gs-navgrp:not([hidden]) .sp-tab')][0]; if (t) ERP.abrir(t.dataset.tab, null, true); }
    });
  });

  /* notificaciones: campana y filtros */
  document.querySelectorAll('#btn-notif').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); document.querySelectorAll('#panel-notif').forEach((p) => { p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); }); }));
  document.querySelectorAll('#panel-notif').forEach((p) => p.addEventListener('click', (e) => e.stopPropagation()));
  document.addEventListener('click', () => document.querySelectorAll('#panel-notif').forEach((p) => { p.hidden = true; }));
  document.querySelectorAll('.gs-nf[data-f]').forEach((s) => s.addEventListener('change', () => { ERP.nf[s.dataset.f] = s.value; dash.draw('notif_lista'); }));

  /* calendario de cheques: navegación y filtros */
  const setMes = (m) => dash.setParams({ cal_mes: m });
  const mover = (n) => { const [y, m] = mesActual().split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMes(d.toISOString().slice(0, 7)); };
  document.querySelectorAll('#cal-prev').forEach((b) => b.addEventListener('click', () => mover(-1)));
  document.querySelectorAll('#cal-next').forEach((b) => b.addEventListener('click', () => mover(1)));
  document.querySelectorAll('#cal-hoy').forEach((b) => b.addEventListener('click', () => { ERP.diaSel = hoy(); setMes(hoy().slice(0, 7)); dash.draw('cal_dia'); dash.draw('cal_dia_tit'); }));
  document.querySelectorAll('#cal-mes').forEach((s) => s.addEventListener('change', () => setMes(`${mesActual().slice(0, 4)}-${s.value}`)));
  document.querySelectorAll('#cal-anio').forEach((s) => s.addEventListener('change', () => setMes(`${s.value}-${mesActual().slice(5, 7)}`)));
  document.querySelectorAll('.gs-calmes[data-m]').forEach((b) => b.addEventListener('click', () => setMes(`${mesActual().slice(0, 4)}-${b.dataset.m}`)));
  document.querySelectorAll('[data-chq]').forEach((s) => s.addEventListener(s.tagName === 'INPUT' ? 'input' : 'change', () => dash.setParams({ [s.dataset.chq]: s.value || null })));
  document.querySelectorAll('#cal-planificar').forEach((b) => b.addEventListener('click', () => {
    const form = document.querySelector('form[data-ds="cheques_reg"]');
    if (!form) return;
    const d = ERP.diaSel || hoy();
    for (const e of form.elements) { if (e.name === 'fecha_pago') e.value = d; if (e.name === 'fecha_emision' && !e.value) e.value = hoy() <= d ? hoy() : d; if (e.name === 'estado') e.value = 'Planificado'; }
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  /* cumpleaños: navegación */
  const moverCum = (n) => { const [y, m] = mesCum().split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); dash.setParams({ cum_mes: d.toISOString().slice(0, 7) }); };
  document.querySelectorAll('#cum-prev').forEach((b) => b.addEventListener('click', () => moverCum(-1)));
  document.querySelectorAll('#cum-next').forEach((b) => b.addEventListener('click', () => moverCum(1)));
  document.querySelectorAll('#cum-hoy').forEach((b) => b.addEventListener('click', () => dash.setParams({ cum_mes: hoy().slice(0, 7) })));
  document.querySelectorAll('#cum-mes').forEach((s) => s.addEventListener('change', () => dash.setParams({ cum_mes: `${mesCum().slice(0, 4)}-${s.value}` })));

  /* formularios: alta, edición (con historial) y adjuntos */
  document.querySelectorAll('form.gs-form[data-ds]').forEach((form) => {
    const ds = form.dataset.ds;
    form.addEventListener('click', (ev) => { if (!ev.target.closest || !ev.target.closest('.gs-btn-cancel')) return; form.reset(); form.querySelectorAll('input[name="_rid"]').forEach((i) => { i.value = ''; }); modoEdicion(form, false); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelectorAll('.gs-unsaved'), ok = form.querySelectorAll('.gs-saved');
      err.forEach((m) => { m.hidden = true; }); ok.forEach((m) => { m.hidden = true; });
      const fila = {};
      let rid = '', repetir = 1, cada = 30, archivo = null;
      for (const x of form.elements) {
        if (!x.name) continue;
        if (x.name === '_rid') { rid = x.value; continue; }
        if (x.name === '_repetir') { repetir = Math.min(24, Math.max(1, Number(x.value) || 1)); continue; }
        if (x.name === '_cada') { cada = Math.max(1, Number(x.value) || 30); continue; }
        if (x.type === 'file') { if (x.files && x.files[0]) archivo = x.files[0]; continue; }
        if (x.value === '' && !rid) continue;
        fila[x.name] = x.type === 'number' && x.value !== '' ? Number(x.value) : x.value.trim();
      }
      if (fila.link && !/^https:\/\//.test(fila.link)) delete fila.link;
      const botones = form.querySelectorAll('button[type="submit"]');
      botones.forEach((b) => { b.disabled = true; });
      try {
        const db = await ERP.db();
        const ahora = new Date().toISOString();
        const prev = rid ? ((dash.data(ds).data || []).find((r) => r.id === rid) || {}) : {};
        let sinAdj = '';
        if (archivo) { try { fila.adjuntos = [...(Array.isArray(prev.adjuntos) ? prev.adjuntos : []), await ERP.subirAdjunto(archivo)]; } catch (ex) { sinAdj = (ex && ex.message) || 'no se pudo subir el archivo'; } }
        form.dataset.sinAdj = sinAdj;
        if (ERP.antes && ERP.antes[ds]) ERP.antes[ds](fila, prev, !!rid);
        if (rid) {
          const datos = { ...fila, modificado: ahora, modificado_por: ERP.uid || '' };
          await db.doc(`${PATH_DS[ds]}/${rid}`).update(datos);
          await ERP.log(db, ds, rid, 'Modificación', ERP.cambios(prev, fila) || 'Sin cambios de datos');
          if (ERP.despues && ERP.despues[ds]) await ERP.despues[ds](db, { ...prev, ...fila, id: rid });
        } else {
          if (!fila.estado) fila.estado = form.dataset.estado || 'Pendiente';
          for (let i = 0; i < repetir; i++) {
            const id = nuevoId(PREF_DS[ds] || 'REG');
            const f = { ...fila };
            if (i > 0) ['fecha_pago', 'fecha_emision', 'fecha', 'vence', 'proximo'].forEach((k) => { if (f[k]) f[k] = sumaDias(f[k], cada * i); });
            if (repetir > 1) f.serie = `${i + 1} de ${repetir}`;
            await db.collection(PATH_DS[ds]).doc(id).set({ ...f, creado: ahora, creado_por: ERP.uid || '', modificado: ahora, modificado_por: ERP.uid || '' });
            await ERP.log(db, ds, id, 'Alta', Object.entries(f).filter(([k]) => k !== 'adjuntos').map(([k, v]) => `${k}: ${v}`).join('; '));
            if (ERP.despues && ERP.despues[ds]) await ERP.despues[ds](db, { ...f, id });
          }
        }
        form.reset();
        form.querySelectorAll('input[name="_rid"]').forEach((i) => { i.value = ''; });
        modoEdicion(form, false);
        ok.forEach((m) => { m.textContent = form.dataset.sinAdj ? `Guardado, pero sin el adjunto: ${form.dataset.sinAdj}` : 'Guardado.'; m.style.color = form.dataset.sinAdj ? 'var(--color-warn)' : ''; m.hidden = false; });
      } catch (ex) { err.forEach((m) => { m.textContent = ERP.motivo(ex); m.hidden = false; }); }
      botones.forEach((b) => { b.disabled = false; });
    });
  });

  /* configuración de avisos */
  document.querySelectorAll('form#form-avisos').forEach((form) => {
    form.addEventListener('input', () => { ERP.cfgSucio = true; });
    form.addEventListener('change', () => { ERP.cfgSucio = true; form.classList.add('gs-form-edit'); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const lista = (s) => String(s || '').split(/[,; ]+/).map(Number).filter((x) => Number.isFinite(x) && x >= 0 && x <= 60);
      const g = (n) => form.elements.namedItem(n);
      const doc = { amarillo_dias: Number(g('amarillo_dias').value) || 7, alta_dias: Number(g('alta_dias').value) || 2, cumple_dias: lista(g('cumple_dias').value), cheque_dias: lista(g('cheque_dias').value), eventos: {} };
      Object.keys(window.ERP_CFG_DEF.eventos).forEach((k) => {
        const dest = [...form.querySelectorAll(`input[name="ev_${k}_dest"]:checked`)].map((c) => c.value);
        doc.eventos[k] = { activo: !!(g(`ev_${k}_activo`) && g(`ev_${k}_activo`).checked), obligatoria: !!(g(`ev_${k}_oblig`) && g(`ev_${k}_oblig`).checked), prioridad: g(`ev_${k}_prio`) ? g(`ev_${k}_prio`).value : 'Automática', destinatarios: dest };
      });
      const err = form.querySelectorAll('.gs-unsaved'), ok = form.querySelectorAll('.gs-saved');
      try { const db = await ERP.db(); await db.doc('data/erp/config/avisos').set(doc); await ERP.log(db, 'config', 'avisos', 'Configuración de avisos', `amarillo ${doc.amarillo_dias} d · alta ${doc.alta_dias} d · cumpleaños ${doc.cumple_dias.join(',')} · cheques ${doc.cheque_dias.join(',')}`); ERP.cfgSucio = false; form.classList.remove('gs-form-edit'); ok.forEach((m) => { m.hidden = false; }); err.forEach((m) => { m.hidden = true; }); } catch { err.forEach((m) => { m.hidden = false; }); }
    });
  });
  document.querySelectorAll('#perfil-q').forEach((inp) => {
    const buscar = async () => { const u = await claude.use('user'); ERP.busqueda = u ? (await u.search(inp.value.trim())).slice(0, 6) : []; dash.draw('perfil_busq'); };
    inp.addEventListener('focus', buscar); inp.addEventListener('input', buscar);
  });

  /* identidad del usuario y perfil */
  claude.use('user').then(async (u) => {
    if (!u) return;
    ERP.uid = await u.id();
    try { ERP.canEdit = !!(await u.canEdit()); } catch { ERP.canEdit = false; }
    sync();
  }).catch(() => {});

  const sync = () => {
    const p = dash.params(), emp = p.emp || 'shell';
    const [a, b] = window.SP.rango();
    const toca = (lista) => (lista || '').split(' ').includes(emp);
    const setH = (x, v) => { if (x.hidden !== v) x.hidden = v; };
    document.querySelectorAll('[data-solo]').forEach((x) => setH(x, !toca(x.dataset.solo)));
    document.querySelectorAll('[data-nota]').forEach((x) => setH(x, !toca(x.dataset.nota)));
    document.querySelectorAll('.gs-emp[data-emp]').forEach((x) => { const on = x.dataset.emp === emp; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    if (ERP.nav && ERP.nav.mod) ERP.unidad[ERP.nav.mod] = emp;
    document.querySelectorAll('.sp-mes[data-mes]').forEach((x) => { const on = a === b && a === x.dataset.mes; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    document.querySelectorAll('.sp-chip[data-rango]').forEach((x) => { x.classList.toggle('on', x.dataset.rango === `${a},${b}`); });
    document.querySelectorAll('#sel-esc').forEach((s) => { if (document.activeElement !== s) s.value = p.escenario || 'base'; });
    document.querySelectorAll('#inp-dia').forEach((i) => { if (document.activeElement !== i) i.value = p.dia || '2026-09-22'; });
    document.querySelectorAll('#inp-dia-alv').forEach((i) => { if (document.activeElement !== i) i.value = p.dia_alv || '2026-10-07'; });
    const cm = mesActual();
    document.querySelectorAll('#cal-mes').forEach((s) => { s.value = cm.slice(5, 7); });
    document.querySelectorAll('#cal-anio').forEach((s) => { s.value = cm.slice(0, 4); });
    document.querySelectorAll('.gs-calmes[data-m]').forEach((x) => { x.classList.toggle('on', x.dataset.m === cm.slice(5, 7)); });
    document.querySelectorAll('[data-chq]').forEach((s) => { if (document.activeElement !== s && !s.dataset.draw) s.value = p[s.dataset.chq] || ''; });
    document.querySelectorAll('#cum-mes').forEach((s) => { s.value = mesCum().slice(5, 7); });
    /* perfil del usuario: ordena menús y avisos (la seguridad real es el permiso del tablero) */
    const asig = asignaciones();
    ERP.perfil = (ERP.uid && asig[ERP.uid]) || (ERP.canEdit ? 'Administrador' : 'Consulta');
    const mods = MODS_PERFIL[ERP.perfil];
    document.querySelectorAll('.gs-navgrp').forEach((g) => { const t = g.querySelector('.sp-tab'); if (!document.querySelector('#buscar') || !document.querySelector('#buscar').value) setH(g, !!(mods && t && !mods.includes(t.dataset.tab))); });
    document.querySelectorAll('form.gs-form[data-ds], .gs-solo-form').forEach((f) => setH(f, ERP.perfil === 'Consulta'));
    document.querySelectorAll('.gs-solo-editor').forEach((x) => setH(x, !ERP.canEdit));
    /* configuración: cargar valores si nadie está editando */
    document.querySelectorAll('form#form-avisos').forEach((form) => {
      if (ERP.cfgSucio || form.contains(document.activeElement)) return;
      const C = cfg();
      const g = (n) => form.elements.namedItem(n);
      if (g('amarillo_dias')) g('amarillo_dias').value = C.amarillo_dias;
      if (g('alta_dias')) g('alta_dias').value = C.alta_dias;
      if (g('cumple_dias')) g('cumple_dias').value = C.cumple_dias.join(', ');
      if (g('cheque_dias')) g('cheque_dias').value = C.cheque_dias.join(', ');
      Object.entries(C.eventos).forEach(([k, v]) => {
        if (g(`ev_${k}_activo`)) g(`ev_${k}_activo`).checked = v.activo !== false;
        if (g(`ev_${k}_oblig`)) g(`ev_${k}_oblig`).checked = !!v.obligatoria;
        if (g(`ev_${k}_prio`)) g(`ev_${k}_prio`).value = v.prioridad || 'Automática';
        form.querySelectorAll(`input[name="ev_${k}_dest"]`).forEach((c) => { c.checked = (v.destinatarios || []).includes(c.value); });
      });
    });
  };
  sync();
  dash.onData(sync);

  /* al imprimir se muestran todos los módulos y submódulos */
  let ocultas = [];
  window.addEventListener('beforeprint', () => {
    if (ocultas.length) return;
    ocultas = [...document.querySelectorAll('[data-panel], [data-subpanel]')].filter((s) => s.hidden);
    ocultas.forEach((s) => { s.hidden = false; });
  });
  window.addEventListener('afterprint', () => { ocultas.forEach((s) => { s.hidden = true; }); ocultas = []; });
})();
