/* AI performance and feedback analysis of trainers and trainees (superadmin / admin).
   The figures come from the platform's records; the AI writes the analysis from those figures only (people as codes, no names). */
import { A, view, api, S, $, $$, esc, t, lang, fail, openModal, empty, badge, pageHead, matches, searchBox } from './lib.js';
import { summaryHtml } from '../analytics.js';

const P = v => (v === null || v === undefined ? '—' : v + '%');
const N = v => (v === null || v === undefined ? '—' : String(v));
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
const BEH = { 4: 'beh_excellent', 3: 'beh_good', 2: 'beh_satisfactory', 1: 'beh_poor' };

export default async function ({ args }) {
  const el = view(); el.classList.add('an');
  /** @type {any} */ let D = null; let kind = args[0] === 'trainee' ? 'trainee' : 'trainer', period = '365', from = addDays(A.today, -364), to = A.today, q = '', AI = { state: 'idle' };
  const setP = p => { period = p; const y = A.today.slice(0, 4); [from, to] = p === '90' ? [addDays(A.today, -89), A.today] : p === 'year' ? [y + '-01-01', A.today] : p === 'lastYear' ? [(Number(y) - 1) + '-01-01', (Number(y) - 1) + '-12-31'] : [addDays(A.today, -364), A.today]; };
  async function load() {
    el.innerHTML = head() + `<div class="load"><span class="spin"></span></div>`; wire();
    try { D = await api(`/performance?kind=${kind}&from=${from}&to=${to}`, { kind: 'staff' }); } catch (/** @type {any} */ e) { fail(e); return; }
    AI = { state: D.ai ? 'busy' : 'off' }; draw(); if (D.ai && D.rows.length) overview(false);
  }
  async function overview(force) {
    AI = { state: 'busy' }; paintAi();
    try { const r = await api('/performance/summary', { kind: 'staff', body: { kind, from, to, lang, force } }); AI = { state: 'ok', ...r }; }
    catch (/** @type {any} */ e) { AI = { state: 'err', err: t(e.message) === e.message ? t('aiFailed') : t(e.message) }; }
    paintAi();
  }
  const head = () => pageHead(t('navPerformance')) + `<p class="mute" style="margin-top:-8px">${esc(t('perfIntro'))}</p>
    <div class="tabs" role="tablist"><button class="tab ${kind === 'trainer' ? 'on' : ''}" data-k="trainer" role="tab">🧑‍🏫 ${esc(t('navTrainers'))}</button><button class="tab ${kind === 'trainee' ? 'on' : ''}" data-k="trainee" role="tab">🧑‍🎓 ${esc(t('navTrainees'))}</button></div>
    <div class="bar"><div class="seg">${[['90', t('anP90')], ['365', t('anP365')], ['year', t('thisYear')], ['lastYear', t('anLastYear')]].map(([v, l]) => `<button data-per="${v}" class="${period === v ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>${searchBox('pq', q)}<span class="mute sm">${esc(S.fmtDate(from))} – ${esc(S.fmtDate(to))}</span></div>`;
  const aiCard = () => AI.state === 'off' ? `<div class="card ai-card"><b>🤖 ${esc(t('anAiTitle'))}</b><p class="hint" style="margin:6px 0 0">${esc(t('anAiOff'))}</p></div>`
    : `<div class="card ai-card" id="pAi"><div class="row"><b>🤖 ${esc(kind === 'trainer' ? t('perfAiTrainers') : t('perfAiTrainees'))}</b><span class="grow"></span>${AI.at ? `<span class="mute xs">${esc(new Date(AI.at).toLocaleString())}</span>` : ''}<button class="btn ghost sm" id="pRe" ${AI.state === 'busy' ? 'disabled' : ''}>↻ ${esc(t('anRegen'))}</button></div>
      ${AI.state === 'busy' ? `<div class="row mute" style="margin-top:10px"><span class="spin"></span> ${esc(t('anAiBusy'))}</div>` : AI.state === 'err' ? `<div class="banner warn" style="margin-top:8px">${esc(AI.err)}</div>` : AI.text ? `<div class="ai-text">${summaryHtml(AI.text)}</div>
        <details style="margin-top:6px"><summary class="sm">${esc(t('perfCodes'))}</summary><div class="sm mute" style="columns:2;margin-top:6px">${(AI.codes || []).map(k => `<div><b>${esc(k.code)}</b> = ${esc(k.name)}</div>`).join('')}</div></details>` : ''}
      <p class="hint" style="margin:8px 0 0">${esc(t('perfAiNote'))}</p></div>`;
  const paintAi = () => { const x = $('#pAi', el); if (x) { x.outerHTML = aiCard(); $('#pRe', el)?.addEventListener('click', () => overview(true)); } };
  const flags = r => r.flags.map(f => badge(/Failed|Low|Expired|Warnings|Behavior/.test(f) ? 'FAIL' : 'PENDING', t(f))).join(' ');
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const rows = D.rows.filter(r => matches(q, r.name, r.att, r.company));
    const th = h => h.map(x => `<th>${esc(x)}</th>`).join(''), td = (v, s) => `<td data-sort="${esc(s ?? -1)}">${esc(v)}</td>`;
    const table = kind === 'trainer'
      ? `<table class="sortable"><thead><tr>${th([t('fullName'), t('anSessionsShort'), t('anEnrol'), t('anAttendance'), t('anFeedback'), t('g1'), t('anTestPass'), t('anPractical'), t('anOverallPass'), t('anEvalDone'), t('anAttention')])}</tr></thead><tbody>${rows.map(r => `<tr class="click" data-p="${esc(r.id)}"><td><b>${esc(r.name)}</b><div class="mute xs">${esc((r.trainings || []).slice(0, 3).join(' · '))}</div></td>${td(r.sessions, r.sessions)}${td(r.trainees, r.trainees)}${td(P(r.attendance), r.attendance)}${td(r.feedback === null ? '—' : r.feedback + ' / 10', r.feedback)}${td(N(r.byTopic?.g1), r.byTopic?.g1)}${td(P(r.testPass), r.testPass)}${td(P(r.pracPass), r.pracPass)}${td(P(r.passRate), r.passRate)}${td(P(r.evalRate), r.evalRate)}<td>${flags(r)}</td></tr>`).join('')}</tbody></table>`
      : `<table class="sortable"><thead><tr>${th([t('fullName'), t('company'), t('anSessionsShort'), t('anAttendance'), t('anTestAvgShort'), t('anPassFailShort'), t('behavior'), t('perfEngagement'), t('examWarnsShort'), t('anAttention')])}</tr></thead><tbody>${rows.map(r => `<tr class="click" data-p="${esc(r.id)}"><td><b>${esc(r.name)}</b><div class="mono xs mute">${esc(r.att)}</div></td><td class="sm">${esc(r.company || t('private'))}</td>${td(r.sessions, r.sessions)}${td(`${r.attended}/${r.sessions}${r.missedDays ? ' · −' + r.missedDays + 'd' : ''}`, r.attended)}${td(P(r.testAvg), r.testAvg)}${td(`${r.pass} / ${r.fail}`, r.pass - r.fail)}${td(r.behavior === null ? '—' : t(BEH[Math.round(r.behavior)] || 'beh_good'), r.behavior)}${td(r.engagement === null ? '—' : r.engagement + ' / 5', r.engagement)}${td(r.examWarnings || '—', r.examWarnings)}<td>${flags(r)}</td></tr>`).join('')}</tbody></table>`;
    el.innerHTML = head() + aiCard() + `<div class="card" style="margin-top:16px"><div class="row"><h2 style="margin:0">${esc(kind === 'trainer' ? t('navTrainers') : t('navTrainees'))} · ${D.total}</h2><span class="grow"></span><span class="hint">${esc(t('perfClickHint'))}</span></div>${rows.length ? `<div class="tw" style="margin-top:8px">${table}</div>` : empty('📊', t('none'))}</div>`;
    wire(); $('#pRe', el)?.addEventListener('click', () => overview(true));
  }
  function wire() {
    $$('[data-k]', el).forEach(b => (b.onclick = () => { if (kind !== b.dataset.k) { kind = b.dataset.k; q = ''; load(); } }));
    $$('[data-per]', el).forEach(b => (b.onclick = () => { setP(b.dataset.per); load(); }));
    const s = $('#pq', el); if (s) s.oninput = e => { q = e.target.value; const p = e.target.selectionStart; draw(); const i = $('#pq', el); i.focus(); i.setSelectionRange(p, p); };
  }
  el.onclick = e => { const r = e.target.closest('tr[data-p]'); if (r) detail(r.dataset.p); };

  /* one person: figures, AI analysis, sessions, comments */
  async function detail(id) {
    let d; try { d = await api(`/performance/person?kind=${kind}&id=${encodeURIComponent(id)}&from=${from}&to=${to}`, { kind: 'staff' }); } catch (/** @type {any} */ e) { return fail(e); }
    const tile = (v, l) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
    const tiles = kind === 'trainer'
      ? [tile(d.sessions, t('anSessionsShort')), tile(d.trainees, t('anEnrol')), tile(P(d.attendance), t('anAttendance')), tile(d.feedback === null ? '—' : d.feedback + ' / 10', t('anFeedback')), tile(P(d.passRate), t('anOverallPass')), tile(P(d.evalRate), t('anEvalDone'))]
      : [tile(`${d.attended}/${d.sessions}`, t('anAttendance')), tile(P(d.testAvg), t('anTestAvgShort')), tile(`${d.pass} / ${d.fail}`, t('anPassFailShort')), tile(d.engagement === null ? '—' : d.engagement + ' / 5', t('perfEngagement')), tile(d.examWarnings, t('examWarnsShort')), tile(d.certsValid, t('anCertsActive', '').trim() || t('navCerts'))];
    const sess = kind === 'trainer'
      ? `<table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('training'))}</th><th>${esc(t('anSize'))}</th><th>${esc(t('anAttendance'))}</th><th>${esc(t('anFeedback'))}</th><th>${esc(t('anTestAvgShort'))}</th><th>${esc(t('anPassRate'))}</th></tr></thead><tbody>${d.perSession.map(x => `<tr><td>${esc(S.fmtDate(x.date))}</td><td>${esc(x.training)}</td><td>${x.size}</td><td>${P(x.attendance)}</td><td>${x.feedback === null ? '—' : x.feedback + ' / 10'}</td><td>${P(x.testAvg)}</td><td>${P(x.passRate)}</td></tr>`).join('')}</tbody></table>`
      : `<table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('training'))}</th><th>${esc(t('attendance'))}</th><th>${esc(t('test'))}</th><th>${esc(t('practical'))}</th><th>${esc(t('behavior'))}</th><th>${esc(t('outcome'))}</th></tr></thead><tbody>${d.perSession.map(x => `<tr><td>${esc(S.fmtDate(x.date))}</td><td>${esc(x.training)}</td><td>${x.attended ? '✓' : x.absent ? '✗' : '—'}</td><td>${P(x.test)}</td><td>${x.practical ? badge(x.practical, t('pr_' + x.practical)) : '—'}</td><td>${x.behavior ? esc(t('beh_' + x.behavior)) + (x.engagement ? ' · ' + '★'.repeat(x.engagement) : '') : '—'}</td><td>${badge(x.outcome === 'PASS' ? 'PASS' : x.outcome === 'FAIL' || x.outcome === 'ABSENT' ? 'FAIL' : 'PENDING', t('oc_' + x.outcome) === 'oc_' + x.outcome ? x.outcome : t('oc_' + x.outcome))}</td></tr>`).join('')}</tbody></table>`;
    const topics = kind === 'trainer' ? `<h3>${esc(t('anFbByQuestion'))}</h3>${S.FB_GROUPS.filter(g => d.byTopic[g] !== null).map(g => `<div class="hb"><span class="nm">${esc(t(g))}</span><span class="tr"><span class="fl" style="width:${Math.round(d.byTopic[g] * 10)}%"></span></span><b>${d.byTopic[g]} / 10</b></div>`).join('') || `<p class="mute sm">${esc(t('none'))}</p>`}` : '';
    const cm = d.comments?.length ? `<h3 style="margin-top:12px">${esc(kind === 'trainer' ? t('anComments') : t('perfTrainerComments'))}</h3><ul class="cm-list">${d.comments.map(k => `<li>${typeof k === 'string' ? esc(k) : `<span class="mute xs">${esc(t(k.topic))} · ${k.score}/10</span><br>${esc(k.text)}`}</li>`).join('')}</ul>` : '';
    const m = openModal({ title: d.name + (d.att ? ' · ' + d.att : ''), wide: true, html: `<div class="an">${d.flags.length ? `<div style="margin-bottom:8px">${flags(d)}</div>` : ''}<div class="grid g4" style="margin-bottom:12px">${tiles.join('')}</div>
      <div class="card ai-card" id="dAi">${d.ai ? `<div class="row mute"><span class="spin"></span> ${esc(t('anAiBusy'))}</div>` : `<p class="hint" style="margin:0">${esc(t('anAiOff'))}</p>`}</div>
      ${topics}<h3 style="margin-top:12px">${esc(t('perfSessions'))}</h3><div class="tw">${d.perSession.length ? sess : empty('📅', t('none'))}</div>${cm}</div>`,
      buttons: [{ label: t('close'), id: 'x' }] });
    if (!d.ai) return;
    const run = async force => {
      const box = $('#dAi', m.dlg); if (!box) return; box.innerHTML = `<div class="row mute"><span class="spin"></span> ${esc(t('anAiBusy'))}</div>`;
      try { const r = await api('/performance/person/summary', { kind: 'staff', body: { kind, id, from, to, lang, force } });
        box.innerHTML = `<div class="row"><b>🤖 ${esc(t('perfAiPerson'))}</b><span class="grow"></span><span class="mute xs">${esc(new Date(r.at).toLocaleString())}</span><button class="btn ghost sm" data-re>↻ ${esc(t('anRegen'))}</button></div><div class="ai-text">${summaryHtml(r.text)}</div><p class="hint" style="margin:6px 0 0">${esc(t('perfAiNote'))}</p>`;
        $('[data-re]', box).onclick = () => run(true); }
      catch (/** @type {any} */ e) { box.innerHTML = `<div class="banner warn">${esc(t(e.message) === e.message ? t('aiFailed') : t(e.message))}</div>`; }
    };
    run(false);
  }
  await load();
}
