/* Fetch wrapper. One token per portal kind (staff / trainer / trainee / company). */
const LS = (() => { try { return localStorage; } catch { return {}; } })();
export const KINDS = ['staff', 'trainer', 'trainee', 'company'];
export const tokenOf = k => LS['kvet.' + k] || '';
export const setToken = (k, v) => { try { v ? (LS['kvet.' + k] = v) : delete LS['kvet.' + k]; } catch {} };
export const setRefresh = v => { try { v ? (LS['kvet.staff.r'] = v) : delete LS['kvet.staff.r']; } catch {} };

async function refreshStaff() {
  const r = LS['kvet.staff.r']; if (!r) return false;
  try {
    const res = await fetch('/api/staff/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh: r }) });
    const d = await res.json(); if (!res.ok || !d.access) return false;
    setToken('staff', d.access); setRefresh(d.refresh); return true;
  } catch { return false; }
}
/* Activity feedback. Any request that takes longer than a moment shows a thin progress bar at the top of the page; the
   button that started a save shows a spinner and ignores further clicks until the server answers (no double submits).
   Background polling (/rev) stays silent. */
/** @type {any} */ let lastBtn = null; let busyN = 0, barT = 0, lastAt = 0;
if (typeof document !== 'undefined') document.addEventListener('click', e => { const b = e.target?.closest?.('button,.btn'); if (b) { lastBtn = b; lastAt = Date.now(); } }, true);
const bar = () => { let b = document.getElementById('kvet-bar'); if (!b) { b = document.createElement('div'); b.id = 'kvet-bar'; b.setAttribute('aria-hidden', 'true'); document.body.appendChild(b); } return b; };
function begin(write) {
  if (++busyN === 1) { clearTimeout(barT); barT = setTimeout(() => { bar().className = 'on'; document.body.setAttribute('aria-busy', 'true'); }, 120); }
  const btn = write && lastBtn && Date.now() - lastAt < 1500 && lastBtn.isConnected ? lastBtn : null;
  if (btn) btn.classList.add('is-busy');
  return () => {
    if (btn) btn.classList.remove('is-busy');
    if (--busyN <= 0) { busyN = 0; clearTimeout(barT); document.body.removeAttribute('aria-busy'); const b = document.getElementById('kvet-bar'); if (b && b.className === 'on') { b.className = 'done'; setTimeout(() => { if (!busyN) b.className = ''; }, 350); } }
  };
}
export class ApiError extends Error { constructor(msg, status, data) { super(msg); this.status = status; this.data = data; } }

/* api('/state', {kind:'staff'})            -> GET
   api('/x', {kind, body:{..}})             -> POST json
   api('/upload?kind=logo', {kind, raw:bytes}) -> POST binary
   api(path, {kind, blob:true})             -> Blob result */
export async function api(path, o = {}) {
  const quiet = o.quiet || /\/rev(\?|$)/.test(path), end = quiet || typeof document === 'undefined' ? () => {} : begin(o.body !== undefined || o.raw !== undefined);
  try { return await call(path, o); } finally { end(); }
}
async function call(path, o) {
  const kind = o.kind || 'staff';
  const go = () => {
    const h = {}; const t = tokenOf(kind); if (t) h.authorization = 'Bearer ' + t;
    const init = { headers: h };
    if (o.raw !== undefined) { init.method = 'POST'; init.body = o.raw; }
    else if (o.body !== undefined) { init.method = 'POST'; h['content-type'] = 'application/json'; init.body = JSON.stringify(o.body); }
    return fetch('/api' + path, init);
  };
  // no connection (or the request never reached the server): one recognisable error, so callers can wait and try again
  const send = () => go().catch(e => { throw new ApiError('offline', 0, { offline: true, cause: String(e?.message || e) }); });
  let r = await send();
  if (r.status === 401 && kind === 'staff' && await refreshStaff()) r = await send();
  if (!r.ok) {
    // not an answer of the application (no JSON): the hosting service refused or failed the request (rate limit, block,
    // resource limit, outage). Told apart so the person sees what happened, with the reference the host gives.
    const ct = r.headers.get('content-type') || '', ray = (r.headers.get('cf-ray') || '').split('-')[0];
    if (!ct.includes('json')) {
      const host = r.status === 429 ? 'hostLimited' : r.status === 403 ? 'hostBlocked' : r.status >= 500 ? 'hostDown' : '';
      if (host) throw new ApiError(host, r.status, { ref: ray, host: true });
    }
    const d = await r.json().catch(() => ({})); if (!d.ref && ray && r.status >= 500) d.ref = ray;
    if (r.status === 401 && o.kind !== undefined && !o.noRedirect) { setToken(kind, ''); document.dispatchEvent(new CustomEvent('kvet:signedout')); }
    throw new ApiError(d.error || String(r.status), r.status, d);
  }
  if (o.body !== undefined || o.raw !== undefined) document.dispatchEvent(new Event('kvet:wrote'));    // live.js: own change, no reload needed
  if (o.blob) return r.blob(); if (o.buffer) return r.arrayBuffer();
  return r.json();
}
