/**
 * Adaptador `dash`: la misma interfaz que usaba el tablero original
 * (dash.data, dash.calc, dash.draw, dash.params, dash.setParams, dash.onData…),
 * para que el código del ERP corra sin cambios fuera de Claude.
 */
const PARAMS_INICIALES = {
  emp: 'grupo', fecha_desde: '2026-01-01', fecha_hasta: '2026-12-31', desde: '2026-01', hasta: '2026-12',
  dia: '2026-09-22', dia_alv: '2026-10-07', escenario: 'base', hoja: '2026-10-27',
};
const CLAVE_PARAMS = 'sg_params_v1';

export function instalarDash(datos) {
  const calcs = {}, draws = {}, ons = [];
  let params = { ...PARAMS_INICIALES };
  try { Object.assign(params, JSON.parse(localStorage.getItem(CLAVE_PARAMS) || '{}')); } catch { /* sin almacenamiento */ }
  let cache = {}, cacheVer = -1;

  const data = (id) => {
    const t = datos.leer(id);
    if (t) return t;
    const c = calcs[id];
    if (!c) return { status: 'missing', data: [] };
    if (cacheVer !== datos.version()) { cache = {}; cacheVer = datos.version(); }
    const key = `${id}|${JSON.stringify(params)}`;
    if (!(key in cache)) {
      const ins = (c.inputs || []).map((i) => { const d = data(i); return d && d.status === 'ok' ? d.data : []; });
      try { cache[key] = { status: 'ok', data: c.fn(...ins) }; } catch (e) { console.error(`cálculo ${id}:`, e); cache[key] = { status: 'error', data: null, error: String(e.message || e) }; }
    }
    return cache[key];
  };

  const dibujar = (n, el) => {
    const f = draws[n];
    if (!f || el.closest('[hidden]')) return;
    try {
      if (typeof f === 'object' && f.mount) {
        if (!el.__montado) { el.replaceChildren(); el.__montado = f.mount(el) || true; }
        if (f.update) f.update(el, el.__montado);
      } else f(el);
    } catch (e) { console.error(`dibujo ${n}:`, e); }
  };
  const nombres = new Set(); let todo = false, pedido = false;
  const programar = () => { if (pedido) return; pedido = true; queueMicrotask(() => setTimeout(correrPendientes, 0)); };
  const correrPendientes = () => {
    pedido = false;
    const lista = todo ? Object.keys(draws) : [...nombres];
    const conOn = todo; todo = false; nombres.clear();
    if (conOn) ons.forEach((f) => { try { f(); } catch (e) { console.error('onData:', e); } });
    lista.forEach((n) => document.querySelectorAll(`[data-draw="${CSS.escape(n)}"]`).forEach((el) => dibujar(n, el)));
  };
  const correr = () => { todo = true; programar(); };

  const dash = {
    data,
    calc: (id, o) => { calcs[id] = o; cache = {}; },
    loader: () => {},
    draw: (n, f) => {
      if (f) { draws[n] = f; document.querySelectorAll(`[data-draw="${CSS.escape(n)}"]`).forEach((el) => dibujar(n, el)); return; }
      nombres.add(n); programar();
    },
    onData: (f) => { ons.push(f); try { f(); } catch (e) { console.error('onData:', e); } },
    params: () => ({ ...params }),
    setParams: (p) => {
      params = { ...params, ...p };
      try { localStorage.setItem(CLAVE_PARAMS, JSON.stringify(params)); } catch { /* */ }
      correr();
    },
    resetParams: () => { params = { ...PARAMS_INICIALES }; correr(); },
    setLink: (x) => { try { history.replaceState(null, '', x ? `#${encodeURIComponent(x)}` : location.pathname); } catch { /* */ } },
    refresh: () => correr(),
    colors: ['var(--sp-c0)', 'var(--sp-c1)', 'var(--sp-c2)', 'var(--sp-c3)', 'var(--sp-c4)'],
    correr,
  };
  window.dash = dash;

  datos.alCambiar(correr);
  // al mostrarse una sección oculta, se dibuja
  let t;
  // solo cuando algo realmente se muestra u oculta (no cuando se reescribe el mismo valor)
  new MutationObserver((ms) => {
    if (!ms.some((m) => (m.oldValue !== null) !== m.target.hasAttribute('hidden'))) return;
    clearTimeout(t); t = setTimeout(correr, 0);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true, subtree: true });
  let r; let ancho = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth === ancho) return; ancho = window.innerWidth; clearTimeout(r); r = setTimeout(correr, 150); });
  return dash;
}
