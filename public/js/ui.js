/* Small UI toolkit: escaping, toasts, modal dialogs, busy buttons, downloads. No framework. */
import { t, tr, lang, setLang, langSwitch } from './i18n.js';
import { icon } from './icons.js';
import { foldText as S_fold } from './shared.js';
export { t, tr, lang, setLang, langSwitch };

/** @returns {any} */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Known error codes are translated; anything else says what went wrong instead of a bare "server error". */
export const errMsg = e => {
  const ref = e?.data?.ref ? ` (${t('errorRef')}: ${e.data.ref} · ${e.status})` : '';
  if (e?.message && tr(e.message) !== e.message) return tr(e.message) + (e.status >= 429 ? ref : '');
  if (e instanceof TypeError || e?.message === 'Failed to fetch') return t('offline');
  if (!e?.status || e.status >= 500) return t('server');
  return `${t('errorCode')}: ${e.message || e.status} (${e.status})`;
};
export const debounce = (f, ms = 200) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => f(...a), ms); }; };
export const norm = s => S_fold(s);

export function toast(msg, type = '') {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.append(box); }
  const d = document.createElement('div'); d.className = 'toast ' + type; d.textContent = msg; box.append(d);
  setTimeout(() => d.remove(), type === 'bad' ? 6000 : 3200);
}
export const fail = e => { console.error(e); toast(errMsg(e), 'bad'); };

/* Disables a button while an async action runs. */
export async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (/** @type {any} */ e) { fail(e); } finally { if (btn) btn.disabled = false; }
}

/* openModal({title, html, buttons:[{label, cls, id, close:true}], wide, onMount(dlg), onClose})
   resolves with the id of the clicked button (or null when dismissed). A button's `fn(dlg)` may return false to keep the dialog open. */
/* "No downloads" mode (auditors): file, print and export buttons are left out everywhere and download() refuses. */
export const noDownload = () => !!globalThis.KVET_NODL;
const isFileBtn = b => /^(⬇|🖨)|\b(PDF|ZIP|Excel|XLSX)\b/i.test(String(b.label || ''));
/** @param {{ title?: any, html?: any, buttons?: Array<{ label?: any, cls?: string, id?: any, fn?: (d: any, b?: any) => any }>, wide?: boolean, onMount?: (d: any) => any }} o @returns {any} */
export function openModal({ title, html, buttons = /** @type {any[]} */ ([]), wide = false, onMount }) {
  if (noDownload()) buttons = buttons.filter(b => !isFileBtn(b));
  const dlg = document.createElement('dialog'); if (wide) dlg.className = 'wide';
  dlg.innerHTML = `<form method="dialog" class="mh"><h2>${esc(title || '')}</h2><button class="btn ghost ic" value="" aria-label="${esc(t('close'))}">✕</button></form><div class="mb">${html}</div>${buttons.length ? `<div class="mf">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>` : ''}`;
  document.body.append(dlg);
  const p = new Promise(res => {
    dlg.addEventListener('close', () => { res(dlg._v ?? null); dlg.remove(); });
    dlg.addEventListener('click', async e => {
      const b = e.target?.closest('.mf [data-i]'); if (!b || !dlg.contains(b)) return;
      const def = buttons[+b.dataset.i];
      if (def.fn) { b.disabled = true; let keep; try { keep = await def.fn(dlg, b); } catch (/** @type {any} */ x) { fail(x); keep = false; } b.disabled = false; if (keep === false) return; }
      dlg._v = def.id ?? true; dlg.close();
    });
  });
  dlg.showModal(); onMount?.(dlg);
  const first = dlg.querySelector('input:not([type=hidden]),select,textarea'); if (first && !wide) first.focus();
  return { dlg, close: v => { dlg._v = v ?? null; dlg.close(); }, promise: p };
}
// html: true -> text is already safe HTML (built with esc by the caller)
export const confirmDlg = (text, { ok = t('yes'), danger = false, title = t('confirm'), html = false } = {}) =>
  openModal({ title, html: `<div>${html ? text : `<p>${esc(text)}</p>`}</div>`, buttons: [{ label: t('cancel'), cls: 'ghost', id: false }, { label: ok, cls: danger ? 'bad' : '', id: true }] }).promise.then(v => v === true);

export const badge = (cls, text) => `<span class="bd ${esc(cls)}">${esc(text)}</span>`;
export function download(blob, name) {
  if (noDownload()) { toast(t('noDownload'), 'bad'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
export const csvCell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
export const empty = (icon, text, extra = '') => `<div class="empty"><div class="big">${icon}</div><div>${esc(text)}</div>${extra}</div>`;
export const loading = () => `<div class="load"><span class="spin" role="status" aria-label="${esc(t('loading'))}"></span></div>`;

/* Form helpers: read a container's named inputs into an object. */
export function readForm(root) {
  const o = {};
  $$('[name]', root).forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
  return o;
}
export function setLangHandlers(rerender) {
  document.addEventListener('click', e => { const b = e.target?.closest('[data-lang]'); if (b) { setLang(b.dataset.lang).then(rerender); } });
}
/* Selectable <option> list */
export const opts = (list, sel = '', blank) => (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') + list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`).join('');

/* ------------------------------------------------------------ automatic touches on everything rendered
   - icon-only buttons (🗑 🖨 🔑) get a drawn icon and an accessible name
   - list tables (inside .tw) get data-label on every cell, so on phones each row becomes a card ("Label: value") */
const ICON_BTN = { '🗑': ['trash', 'delete'], '🖨': ['print', 'print'], '🔑': ['lock', 'resetPassword'] };
function touch(root) {
  if (!(root instanceof Element)) return;
  for (const b of root.matches?.('button') ? [root] : root.querySelectorAll('button')) {
    const txt = b.textContent.trim(), m = ICON_BTN[txt];
    if (m && !b.querySelector('svg')) { b.innerHTML = icon(m[0], 16); if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', b.title || t(m[1])); }
    else if (!b.getAttribute('aria-label') && !txt && b.title) b.setAttribute('aria-label', b.title);
  }
  for (const tb of root.matches?.('.tw table') ? [root] : root.querySelectorAll('.tw table')) {
    const heads = [...tb.querySelectorAll('thead th')].map(th => th.textContent.trim());
    for (const tr_ of tb.querySelectorAll('tbody tr')) { let i = 0; for (const td of tr_.children) { if (td.colSpan > 1) td.classList.add('wide'); else if (heads[i] && !td.dataset.label) td.dataset.label = heads[i]; i += td.colSpan || 1; } }
  }
}
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) touch(n.nodeType === 1 ? (n.closest?.('.tw') || n) : null); }).observe(document.documentElement, { childList: true, subtree: true });
}

/* Light / dark mode: follows the device unless the person chose one (top bar button: auto -> dark -> light). */
const THEMES = ['auto', 'dark', 'light'];
const themeOf = () => { try { return THEMES.includes(localStorage.kvetTheme) ? localStorage.kvetTheme : 'auto'; } catch { return 'auto'; } };
export function applyTheme(v = themeOf()) { if (v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v; }
export const themeButton = () => { const v = themeOf(), icon = { auto: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>', dark: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>', light: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' }[v]; return `<button class="btn ghost sm ic" id="themeBtn" type="button" aria-label="${esc(t('theme_' + v))}" title="${esc(t('theme_' + v))}">${icon}</button>`; };
applyTheme();
document.addEventListener('click', e => {
  const b = e.target?.closest('#themeBtn'); if (!b) return;
  const next = THEMES[(THEMES.indexOf(themeOf()) + 1) % THEMES.length]; try { localStorage.kvetTheme = next; } catch {}
  applyTheme(next); b.outerHTML = themeButton(); document.getElementById('themeBtn')?.focus();
});

/* Every table: click a column heading to sort (again to reverse). Cells may give their sort value in data-sort.
   Tables with 6+ rows and no search box of their own get a quick filter above them. Mark a table "nosort" / "nofilter" to opt out. */
const sortVal = td => {
  const raw = (td?.dataset.sort ?? td?.innerText ?? '').trim(), dm = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(raw);
  if (dm) return { n: Number(dm[3] + dm[2] + dm[1] + (dm[4] || '00') + (dm[5] || '00')) };
  const num = raw.replace(/\s/g, '').replace(',', '.').match(/^-?\d+(\.\d+)?%?$/); if (num) return { n: parseFloat(raw.replace(',', '.')) };
  return { s: raw.toLowerCase() };
};
document.addEventListener('click', e => {
  const th = e.target?.closest('.tw table thead th'); if (!th || e.target?.closest('button,a,input,select,label')) return;
  const table = th.closest('table'); if (table.classList.contains('nosort') || !th.textContent.trim()) return;
  const tb = table.tBodies[0]; if (!tb) return;
  const col = [...th.parentElement.children].indexOf(th), dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
  const rows = [...tb.rows].filter(r => r.cells.length > 1);
  if (rows.length < 2) return;
  rows.sort((a, b) => { const x = sortVal(a.cells[col]), y = sortVal(b.cells[col]); return dir * (x.n !== undefined && y.n !== undefined ? x.n - y.n : String(x.s ?? x.n).localeCompare(String(y.s ?? y.n), lang)); });
  rows.forEach(r => tb.append(r));
  th.parentElement.querySelectorAll('th').forEach(h => h.removeAttribute('aria-sort')); th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending');
});
const addFilters = root => {
  for (const tw of root.querySelectorAll?.('.tw') || []) {
    const table = tw.querySelector('table'); if (!table || tw.dataset.f || table.classList.contains('nofilter')) continue;
    const rows = table.tBodies[0]?.rows; if (!rows || rows.length < 6) continue;
    const scope = tw.closest('dialog') || tw.closest('main') || tw.parentElement;
    if (scope.querySelector('input[type=search]:not(.tfilter)')) { tw.dataset.f = '1'; continue; }
    tw.dataset.f = '1';
    const inp = Object.assign(document.createElement('input'), { type: 'search', className: 'sr-in tfilter', placeholder: t('filter') + '…' }); inp.setAttribute('aria-label', t('filter'));
    inp.oninput = () => { const q = norm(inp.value).trim(); for (const r of rows) r.style.display = !q || norm(r.innerText).includes(q) ? '' : 'none'; };
    tw.before(inp);
  }
};
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) addFilters(n.matches?.('.tw') ? n.parentElement : n); }).observe(document.documentElement, { childList: true, subtree: true });

/* ------------------------------------------------------------------ pages of a list
   Long lists show one page at a time: 25 / 50 / 100 rows (50 by default; the choice is remembered per list in this browser).
   Numbered pages, previous / next, and "go to page". A list that fits on one page shows no pager.
     const P = paged('trainers', rows, key); ... P.rows ... P.html  (rows already filtered; key = the search / filters:
                                                                    when it changes the list starts again at page 1)
     pagerHtml('trainees', total)  + pageState('trainees')         (lists paged by the server: it gets page and size)
     onPage('trainers', draw)      redraw when the page or the size changes;  resetPage('trainers') when filters change */
export const PAGE_SIZES = [25, 50, 100];
const PG = new Map(), PGCB = new Map();
export function pageState(id) {
  if (!PG.has(id)) { let size = 50; try { const n = +localStorage['kvetPage.' + id]; if (PAGE_SIZES.includes(n)) size = n; } catch {} PG.set(id, { page: 0, size }); }
  return PG.get(id);
}
export const resetPage = id => { pageState(id).page = 0; };
export const onPage = (id, fn) => { PGCB.set(id, fn); };
export function pagerHtml(id, total) {
  const s = pageState(id), pages = Math.max(1, Math.ceil(total / s.size));
  if (s.page > pages - 1) s.page = pages - 1;
  if (total <= PAGE_SIZES[0]) return '';
  const p = s.page, from = total ? p * s.size + 1 : 0, to = Math.min(total, (p + 1) * s.size);
  const nums = [...new Set([0, p - 2, p - 1, p, p + 1, p + 2, pages - 1].filter(n => n >= 0 && n < pages))].sort((a, b) => a - b);
  const btns = nums.map((n, i) => `${i && n - nums[i - 1] > 1 ? '<span class="pg-gap">…</span>' : ''}<button type="button" class="btn ghost sm ${n === p ? 'on' : ''}" data-pg="${n}" ${n === p ? 'aria-current="page"' : ''}>${n + 1}</button>`).join('');
  return `<nav class="pager" data-pid="${esc(id)}" aria-label="${esc(t('pages'))}"><span class="mute sm">${esc(t('pageRange', from.toLocaleString(), to.toLocaleString(), total.toLocaleString()))}</span><span class="grow"></span>
    <button type="button" class="btn ghost sm" data-pg="${p - 1}" ${p ? '' : 'disabled'} aria-label="${esc(t('prevPage'))}">‹</button>${btns}<button type="button" class="btn ghost sm" data-pg="${p + 1}" ${p < pages - 1 ? '' : 'disabled'} aria-label="${esc(t('nextPage'))}">›</button>
    ${pages > 7 ? `<label class="pg-go">${esc(t('goToPage'))} <input type="number" min="1" max="${pages}" data-pgjump inputmode="numeric"></label>` : ''}
    <select data-pgsize aria-label="${esc(t('perPage'))}">${PAGE_SIZES.map(n => `<option value="${n}" ${n === s.size ? 'selected' : ''}>${n} ${esc(t('perPageShort'))}</option>`).join('')}</select></nav>`;
}
export function paged(id, rows, key) {
  const s = pageState(id); if (key !== undefined && s.key !== key) { s.key = key; s.page = 0; }   // other search / filters: back to page 1
  const html = pagerHtml(id, rows.length);
  return { rows: rows.slice(s.page * s.size, (s.page + 1) * s.size), html, offset: s.page * s.size };
}
const goPage = (id, page, size) => {
  const s = pageState(id); if (size) { s.size = size; s.page = 0; try { localStorage['kvetPage.' + id] = size; } catch {} } else s.page = Math.max(0, page);
  const fn = PGCB.get(id); if (fn) { fn(); document.querySelector(`.pager[data-pid="${CSS.escape(id)}"]`)?.closest('.card,.view,main,#view')?.scrollIntoView?.({ block: 'start' }); }
};
document.addEventListener('click', e => { const b = e.target?.closest('.pager [data-pg]'); if (!b || b.disabled) return; goPage(b.closest('.pager').dataset.pid, +b.dataset.pg); });
document.addEventListener('change', e => { const x = e.target?.closest('.pager [data-pgsize]'); if (x) goPage(x.closest('.pager').dataset.pid, 0, +x.value); });
document.addEventListener('keydown', e => { const x = e.target?.closest?.('.pager [data-pgjump]'); if (x && e.key === 'Enter') { e.preventDefault(); const n = Math.round(+x.value); if (n >= 1 && n <= +x.max) goPage(x.closest('.pager').dataset.pid, n - 1); } });
