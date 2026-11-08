/* Live updates for the portals: polls the page's revision counter (GET …/rev, one cheap read) every few seconds while the tab
   is visible. When something changed:
   - the page refreshes itself, unless the person is busy (a dialog is open, they are typing, or the page says so);
   - while busy, a small "New changes · Refresh" button appears instead, so nothing typed is lost.
   The ↻ button in the top bar refreshes at once. */
import { api } from './api.js';
import { $, esc, t } from './ui.js';

/** @type {any} */ let cur = null;
export function live({ kind, path, onChange, busy = () => false, quiet = () => false, every = 10000 }) {
  cur?.stop();
  /** @type {any} */ let base = null; let pending = false, timer = 0, running = false, stopped = false;
  const typing = () => { const a = document.activeElement; return !!a && a.closest('#app') && (a.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]),textarea,select') || a.isContentEditable); };
  const isBusy = () => !!document.querySelector('dialog[open]') || typing() || busy();
  const read = async () => (await api(path(), { kind, noRedirect: true, quiet: true })).rev;
  const pill = on => {
    let p = $('#livePill');
    if (!on) return p?.remove();
    if (p) return;
    p = Object.assign(document.createElement('button'), { id: 'livePill', className: 'btn sm live-pill', type: 'button' });
    p.innerHTML = `↻ ${esc(t('liveChanges'))}`; p.onclick = () => apply(true); document.body.append(p);
  };
  async function apply(force = false) {
    if (running) return; running = true; pending = false; pill(false);
    try { await onChange(); base = await read().catch(() => base); } catch {} finally { running = false; }
  }
  async function tick() {
    if (stopped || document.hidden) return;
    try {
      const r = await read();
      if (base === null) base = r;
      else if (r !== base) { base = r; pending = true; }
      if (pending) { if (!isBusy()) apply(); else if (!quiet()) pill(true); }      // quiet: e.g. during a test, no distraction
    } catch { /* offline for a moment: try again next time */ }
  }
  const loop = () => { clearInterval(timer); timer = setInterval(tick, every); };
  const vis = () => { if (!document.hidden) tick(); };
  // after the person's own change the page already shows it: take the new counter as the base (no second reload)
  const own = () => setTimeout(async () => { try { base = await read(); } catch {} }, 300);
  document.addEventListener('visibilitychange', vis); document.addEventListener('kvet:wrote', own);
  loop(); tick();
  cur = { refresh: () => apply(true), stop() { stopped = true; clearInterval(timer); pill(false); document.removeEventListener('visibilitychange', vis); document.removeEventListener('kvet:wrote', own); } };
  return cur;
}
/* the ↻ button in the top bar */
document.addEventListener('click', e => { const b = e.target?.closest('#liveBtn'); if (!b || !cur) return; b.classList.add('spinning'); cur.refresh().finally(() => setTimeout(() => b.classList.remove('spinning'), 400)); });
