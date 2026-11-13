import { mountPortal, topbar } from '../portal.js';
import { A, load, can, view, api, S, $, $$, esc, t, fail, toast } from './lib.js';
import { icon } from '../icons.js';
import { live } from '../live.js';

const PAGES = {
  dashboard: () => import('./dashboard.js'), sessions: () => import('./sessions.js'), issue: () => import('./issue.js'), certificates: () => import('./certificates.js'),
  blanks: () => import('./blanks.js'), sheets: () => import('./sheets.js'), tests: () => import('./tests.js'), approvals: () => import('./approvals.js'), materials: () => import('./materials.js'), forms: () => import('./forms.js'), docs: () => import('./docs.js'),
  trainees: () => import('./trainees.js'), groups: () => import('./groups.js'), trainers: () => import('./trainers.js'), companies: () => import('./companies.js'),
  settings: () => import('./settings.js'), requests: () => import('./requests.js'), messages: () => import('./messages.js'), users: () => import('./users.js'), system: () => import('./system.js'), audit: () => import('./audit.js'), cameras: () => import('./cameras.js'), ai: () => import('./ai.js'), analytics: () => import('./analytics.js'), performance: () => import('./performance.js'),
};
const SKEL = `<div class="skel-page" aria-hidden="true"><div class="skel w40"></div><div class="card"><div class="skel"></div><div class="skel w80"></div><div class="skel w60"></div></div><div class="card"><div class="skel"></div><div class="skel w70"></div></div></div>`;
/** @type {any} */ let shown = null;
const NAV = [
  ['dashboard', 'home', 'navDashboard', 'dashboard'], ['analytics', 'chart', 'navAnalytics', 'analytics'], ['performance', 'spark', 'navPerformance', 'perf'], ['grp', 'grpTraining'], ['sessions', 'calendar', 'navSessions'], ['issue', 'check', 'navIssue', 'issue'], ['certificates', 'award', 'navCerts'], ['requests', 'inbox', 'navRequests', 'requests'], ['messages', 'chat', 'navMessages', 'view'], ['approvals', 'shield', 'navApprovals', 'approve'],
  ['grp', 'grpLibrary'], ['blanks', 'file', 'navBlanks'], ['sheets', 'clipboard', 'navSheets'], ['tests', 'quiz', 'navTests', 'library'], ['materials', 'monitor', 'navMaterials'], ['forms', 'file', 'navForms', 'library'], ['docs', 'folder', 'navDocs', 'libdocs'],
  ['grp', 'grpPeople'], ['trainees', 'people', 'navTrainees'], ['groups', 'group', 'navGroups', 'library'], ['trainers', 'cap', 'navTrainers'], ['companies', 'building', 'navCompanies'],
  ['grp', 'grpSystem'], ['settings', 'settings', 'navSettings', 'settings.save'], ['users', 'shield', 'navUsers', 'users'], ['audit', 'list', 'navAudit', 'audit.view'], ['system', 'database', 'navSystem', 'backup.view'], ['cameras', 'camera', 'navCameras', 'camera'], ['ai', 'spark', 'navAi', 'library'],
];
/** @type {any} */ let cleanup = null;

mountPortal({ kind: 'staff', titleKey: 'portalStaff', async boot({ app, signOut, rerender }) {
  await load();
  globalThis.KVET_NODL = !can('download');                          // auditors read documents on screen only
  if (can('backup.create')) api('/backup/auto', { kind: 'staff', body: {} }).catch(() => {});
  const only = S.ROLE_NAV[A.role];                                     // approver / auditor: a fixed short menu
  const nav = NAV.filter(n => n[0] === 'grp' || (only ? only.includes(n[0]) : can(n[3] || 'view') && !(n[0] === 'messages' && A.role === 'emergency'))).filter((n, i, all) => n[0] !== 'grp' || (all[i + 1] && all[i + 1][0] !== 'grp'));   // no empty group headings
  app.innerHTML = `${topbar({ title: t('portalStaff'), menu: true, sub: `${esc(A.me.email || '')}<br><b>${esc(t('role_' + A.role))}</b>` })}
   <div class="shell"><nav class="nav" id="nav" aria-label="${esc(t('menu'))}">${nav.map(n => n[0] === 'grp' ? `<button type="button" class="grp" data-grp="${n[1]}" aria-expanded="true"><span>${esc(t(n[1]))}</span><span class="chev" aria-hidden="true">▾</span></button>` : `<a href="#/${n[0]}" data-p="${n[0]}"><span class="ic">${icon(n[1])}</span>${esc(t(n[2]))}<span class="cnt hide" data-cnt="${n[0]}"></span></a>`).join('')}</nav><main id="view" tabindex="-1"></main></div>`;
  // break-glass account: a permanent red banner; for the superadmin: every emergency sign-in since the last acknowledgement
  if (A.emergency === true) app.insertAdjacentHTML('afterbegin', `<div class="banner bad" role="alert" style="border-radius:0;margin:0;text-align:center"><b>⚠ ${esc(t('emergencyBanner'))}</b></div>`);
  else if (Array.isArray(A.emergency) && A.emergency.length) {
    app.insertAdjacentHTML('afterbegin', `<div class="banner bad" role="alert" id="emw" style="border-radius:0;margin:0"><b>⚠ ${esc(t('emergencyUsed', A.emergency.length))}</b> ${A.emergency.slice(-5).map(u => `<span class="mono xs">${esc(S.fmtDateTime(u.at))}${u.ip ? ' · ' + esc(u.ip) : ''}</span>`).join(' · ')} <a href="#/audit">${esc(t('navAudit'))} →</a> <button class="btn ghost sm" id="emack">${esc(t('emergencyAck'))}</button></div>`);
    $('#emack').onclick = async () => { try { await api('/emergency/ack', { kind: 'staff', body: {} }); $('#emw').remove(); } catch (/** @type {any} */ e) { fail(e); } };
  }
  $('#menuBtn').onclick = () => $('#nav').classList.toggle('open');
  /* menu sections fold and unfold on their heading (remembered in this browser); the open page stays visible */
  const LSK = 'kvetNavClosed', closedSet = () => { try { return new Set(JSON.parse(localStorage[LSK] || '[]')); } catch { return new Set(); } };
  const applyNav = () => { const cl = closedSet(); let g = /** @type {any} */ (null);
    for (const x of $('#nav').children) { if (x.classList.contains('grp')) { g = x.dataset.grp; x.classList.toggle('closed', cl.has(g)); x.setAttribute('aria-expanded', String(!cl.has(g))); } else if (g) x.classList.toggle('folded', cl.has(g)); } };
  $('#nav').addEventListener('click', e => { const h = e.target.closest('.grp'); if (!h) return; const cl = closedSet(), g = h.dataset.grp; cl.has(g) ? cl.delete(g) : cl.add(g); try { localStorage[LSK] = JSON.stringify([...cl]); } catch {} applyNav(); });
  applyNav();
  let turn = 0;
  const route = async () => {
    const my = ++turn;      // a page still loading when the person moves on draws into an area that is gone: its result and its errors are dropped
    cleanup?.(); cleanup = null;
    // a fresh page area: handlers one page put on it (e.g. a row click opening a group) must not act on the next page
    { const v = $('#view'), n = v.cloneNode(false); v.replaceWith(n); }
    let [page = 'dashboard', ...args] = location.hash.replace(/^#\//, '').split('/').map(decodeURIComponent);
    if (only && !only.includes(page)) page = only[0];
    else if (!only && page === 'dashboard' && !can('dashboard')) page = 'sessions';
    $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.p === page)); $('#nav').classList.remove('open');
    const loader = PAGES[page] || PAGES.dashboard, v = view(), first = v?.firstElementChild, moved = page !== shown; shown = page;
    // a new section: placeholder if it is not ready within a moment (a refresh of the same section keeps its content)
    const ph = moved && v ? setTimeout(() => { if (v.firstElementChild === first) v.innerHTML = SKEL; }, 140) : 0;
    try { const m = await loader(), end = (await m.default({ args, rerender: route, go: h => { location.hash = '#/' + h; } })) || null; if (my !== turn) { end?.(); return; } cleanup = end; }
    catch (/** @type {any} */ e) { if (e.status === 401 || e.status === 403) throw e; if (my !== turn) return; fail(e); view().innerHTML = `<div class="card"><p>${esc(t('server'))}</p></div>`; }
    finally { clearTimeout(ph); }
    badges();
  };
  const setCnt = (k, n) => { const b = $(`[data-cnt=${k}]`); if (b) { b.textContent = n; b.classList.toggle('hide', !n); } };
  // menu counters: refreshed in the background (all three at once), at most every 20 s unless something was saved
  let badgeAt = 0, dirty = true; document.addEventListener('kvet:wrote', () => { dirty = true; });
  async function badges(force = false) {
    if (!force && !dirty && Date.now() - badgeAt < 20000) return; badgeAt = Date.now(); dirty = false;
    const q = { kind: 'staff', quiet: true };
    await Promise.all([
      can('issue') && api('/issue/queue', q).then(r => setCnt('issue', r.list.filter(x => x.outcome === 'PASS').length)).catch(() => {}),
      can('approve') && api('/approvals', q).then(r => { A.apprCount = r.tests.length + r.materials.length + r.certs.length + (r.candidates || []).length + (r.links || []).length; setCnt('approvals', A.apprCount + (A.unsignedCerts || 0)); }).catch(() => {}),
      A.role !== 'emergency' && api('/notify', q).then(r => {
        setCnt('messages', r.msgs || 0);
        // the signature reminder follows the bell: put off until tomorrow there (or with its ✕) = hidden here too
        A.signTodo = (r.todo || []).find(x => x.k === 'nCertsToSign') || null; A.signKnown = true; document.dispatchEvent(new Event('kvet:unsigned'));
      }).catch(() => {}),
      can('requests') && api('/requests', q).then(r => setCnt('requests', r.list.filter(x => x.status === 'new').length)).catch(() => {}),
      // certificates waiting for a signature: the superadmin and approvers sign them
      can('cert.sign') && api('/certs?unsigned=1&size=0&counts=0', q).then(r => { A.unsignedCerts = r.total || 0; setCnt('certificates', A.unsignedCerts); if (can('approve')) setCnt('approvals', (A.apprCount || 0) + A.unsignedCerts); document.dispatchEvent(new Event('kvet:unsigned')); }).catch(() => {}),
    ]);
  }
  document.addEventListener('kvet:me', () => load().catch(() => {}));
  document.addEventListener('kvet:badges', () => { badges(true).catch(() => {}); });   // a page changed what the menu counts (e.g. messages read)
  // superadmin / approver: certificates waiting for their signature, a reminder on every page (bottom of the page area).
  // ✕ = "remind me tomorrow" (the same as ⏰ in the bell); it comes back tomorrow, or sooner when more certificates arrive.
  const signPill = () => {
    let p = $('#signPill'); const n = A.unsignedCerts || 0, to = can('approve') ? '#/approvals' : '#/certificates/st=UNSIGNED', here = location.hash.startsWith(to);
    if (!n || here || (A.signKnown && !A.signTodo)) return p?.remove();
    if (!p) {
      p = Object.assign(document.createElement('div'), { id: 'signPill', className: 'sign-pill' });
      p.innerHTML = `<a class="sp-go" href="${to}"></a><button type="button" class="sp-x" aria-label="${esc(t('nLater'))}" title="${esc(t('nLater'))}">✕</button>`;
      document.body.append(p);
      $('.sp-x', p).onclick = async () => {
        const k = A.signTodo; p?.remove(); A.signTodo = null; A.signKnown = true;
        if (!k?.key) return;
        try { await api('/notify/act', { kind: 'staff', body: { op: 'later', key: k.key, n: k.n || 0 }, quiet: true }); toast(t('nLaterDone'), 'ok'); document.dispatchEvent(new CustomEvent('kvet:wrote')); } catch (/** @type {any} */ e) { fail(e); }
      };
    }
    $('.sp-go', p).setAttribute('href', to); $('.sp-go', p).textContent = '✍ ' + t('certsToSign', n);
  };
  document.addEventListener('kvet:unsigned', signPill); window.addEventListener('hashchange', signPill);
  window.__badges = () => badges(true); window.onhashchange = route; await route();
  // warm the other sections' code while the browser is idle, so switching sections does not wait for downloads
  const warm = () => $$('#nav a[data-p]').forEach((a, i) => setTimeout(() => PAGES[a.dataset.p]?.().catch(() => {}), i * 60));
  (window.requestIdleCallback || (f => setTimeout(f, 1500)))(warm);
  // live updates: list / overview pages refresh themselves; pages with inline forms only show the "new changes" button
  const AUTO = new Set(['dashboard', 'sessions', 'issue', 'certificates', 'requests', 'tests', 'trainees', 'trainers', 'companies', 'audit']);
  const page = () => location.hash.replace(/^#\//, '').split('/')[0] || 'dashboard';
  live({ kind: 'staff', path: () => '/rev', every: 8000, busy: () => !AUTO.has(page()), onChange: async () => { const y = scrollY; await load(); await route(); scrollTo(0, y); } });
  window.__reload = async () => { await load(); await route(); };
} });
