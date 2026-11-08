/* Analytics dashboard (shared by admin / auditor, trainer and company portals).
   Figures come from the server (computed from the platform's data, scoped by role). The AI summary is written by the
   model from those figures only; it is informational and changes nothing. */
import { api } from './api.js';
import * as S from './shared.js';
import { $, $$, esc, t, lang, fail, busy, empty, badge, opts } from './ui.js';

const P = v => (v === null || v === undefined ? '—' : v + '%');
const N = (v, d = '—') => (v === null || v === undefined ? d : String(v));
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);

/* the AI text: escaped, "- " lines become a list, short lines without a full stop become sub-headings */
export function summaryHtml(text) {
  const out = []; let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map(x => `<li>${x}</li>`).join('')}</ul>`); list = []; } };
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  for (const raw of String(text || '').split('\n')) {
    const l = raw.trim().replace(/^#+\s*/, ''); if (!l) { flush(); continue; }
    const m = l.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (m && !/^\d+[.)]\s+\S+$/.test(l) && (l[0] !== '1' || list.length || /^[-•*]/.test(l))) { list.push(fmt(m[1])); continue; }
    flush();
    const plain = l.replace(/^\d+[.)]\s*/, '').replace(/\*\*/g, '');
    out.push(plain.length < 60 && !/[.!?]$/.test(plain) ? `<h3 class="ai-h">${esc(plain.replace(/:$/, ''))}</h3>` : `<p>${fmt(l)}</p>`);
  }
  flush(); return out.join('');
}

/* bar rows (single series: the bar is the magnitude, the number is printed next to it) */
const bars = (rows, val, max, label, txt) => rows.length ? rows.map(r => { const v = val(r) ?? 0; return `<div class="hb" title="${esc(label(r) + ': ' + txt(r))}"><span class="nm">${esc(label(r))}</span><span class="tr"><span class="fl" style="width:${Math.max(2, Math.round((v / (max || 1)) * 100))}%"></span></span><b>${esc(txt(r))}</b></div>`; }).join('') : empty('📊', t('none'));
const lv = { bad: ['FAIL', 'anLvBad'], warn: ['PENDING', 'anLvWarn'], info: ['info', 'anLvInfo'] };

/* el: container; base: '/analytics' | '/portal/trainer/analytics' | '/portal/company/analytics'; kind: api kind
   opts: { trainers: [[id,name]], companies: [[id,name]], staff: bool (shows the AI-off hint) } */
export async function analyticsView(el, { base, kind, trainers = /** @type {any} */ (null), companies = /** @type {any} */ (null), staff = false, title = t('navAnalytics') }) {
  el.classList.add('an'); const today = new Date().toISOString().slice(0, 10);
  const F = { period: '90', from: addDays(today, -89), to: today, bid: '', tid: '', co: '' };
  try { Object.assign(F, JSON.parse(localStorage.getItem('kvetAn|' + base) || '{}')); } catch {}
  /** @type {any} */ let D = null; let AI = { state: 'idle', text: '', at: '', err: '' };

  const setPeriod = p => {
    F.period = p; const y = today.slice(0, 4);
    if (p === '30') [F.from, F.to] = [addDays(today, -29), today];
    if (p === '90') [F.from, F.to] = [addDays(today, -89), today];
    if (p === '365') [F.from, F.to] = [addDays(today, -364), today];
    if (p === 'year') [F.from, F.to] = [y + '-01-01', today];
    if (p === 'lastYear') [F.from, F.to] = [(Number(y) - 1) + '-01-01', (Number(y) - 1) + '-12-31'];
  };
  if (F.period !== 'custom') setPeriod(F.period);
  const qs = () => new URLSearchParams(Object.entries({ from: F.from, to: F.to, bid: F.bid, tid: F.tid, co: F.co }).filter(([, v]) => v)).toString();

  async function load() {
    try { localStorage.setItem('kvetAn|' + base, JSON.stringify(F)); } catch {}
    el.innerHTML = head() + `<div class="load"><span class="spin"></span></div>`; wire();
    try { D = await api(base + '?' + qs(), { kind }); } catch (/** @type {any} */ e) { fail(e); el.innerHTML = head() + `<div class="card">${empty('⚠️', t('server'))}</div>`; wire(); return; }
    AI = { state: D.ai ? 'busy' : 'off', text: '', at: '', err: '' }; draw();
    if (D.ai) summary(false);
  }
  async function summary(force) {
    AI.state = 'busy'; drawAi();
    try { const r = await api(base + '/summary', { kind, body: { from: F.from, to: F.to, bid: F.bid, tid: F.tid, co: F.co, lang, force } }); AI = { state: 'ok', text: r.text, at: r.at, err: '' }; }
    catch (/** @type {any} */ e) { AI = { state: 'err', text: '', at: '', err: t(e.message) === e.message ? t('aiFailed') : t(e.message) }; }
    drawAi();
  }

  const head = () => `<div class="page-h"><h1>${esc(title)}</h1><span class="grow"></span><button class="btn ghost noprint" id="anPrint">🖨 ${esc(t('print'))}</button></div>
    <p class="mute" style="margin-top:-8px">${esc(kind === 'company' ? t('anIntroCo') : kind === 'trainer' ? t('anIntroTr') : D?.kind === 'audit' ? t('anIntroAudit') : t('anIntro'))}</p>
    <div class="bar noprint"><div class="seg">${[['30', t('anP30')], ['90', t('anP90')], ['365', t('anP365')], ['year', t('thisYear')], ['lastYear', t('anLastYear')]].map(([v, l]) => `<button data-per="${v}" class="${F.period === v ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
      <input type="date" id="anFrom" value="${esc(F.from)}" aria-label="${esc(t('from'))}"><input type="date" id="anTo" value="${esc(F.to)}" aria-label="${esc(t('to'))}">
      <select id="anBid" aria-label="${esc(t('training'))}">${opts((D?.trainings || []).map(b => [b.id, b.name]), F.bid, t('allTrainings'))}</select>
      ${trainers ? `<select id="anTid" aria-label="${esc(t('trainer'))}">${opts(trainers, F.tid, t('anAllTrainers'))}</select>` : ''}
      ${companies ? `<select id="anCo" aria-label="${esc(t('company'))}">${opts(companies, F.co, t('anAllCompanies'))}</select>` : ''}</div>
    <p class="mute sm printonly">${esc(S.fmtDate(F.from))} – ${esc(S.fmtDate(F.to))}</p>`;

  const aiCard = () => {
    if (AI.state === 'off') return staff ? `<div class="card ai-card noprint"><div class="row"><b>🤖 ${esc(t('anAiTitle'))}</b><span class="grow"></span>${badge('', t('aiOffState'))}</div><p class="hint" style="margin:6px 0 0">${esc(t('anAiOff'))}</p></div>` : '';
    return `<div class="card ai-card" id="anAi" aria-live="polite"><div class="row"><b>🤖 ${esc(t('anAiTitle'))}</b><span class="grow"></span>${AI.at ? `<span class="mute xs">${esc(new Date(AI.at).toLocaleString())}</span>` : ''}<button class="btn ghost sm noprint" id="anRe" ${AI.state === 'busy' ? 'disabled' : ''}>↻ ${esc(t('anRegen'))}</button></div>
      ${AI.state === 'busy' ? `<div class="row mute" style="margin-top:10px"><span class="spin"></span> ${esc(t('anAiBusy'))}</div>` : AI.state === 'err' ? `<div class="banner warn" style="margin-top:8px">${esc(AI.err)}</div>` : `<div class="ai-text">${summaryHtml(AI.text)}</div>`}
      <p class="hint" style="margin:8px 0 0">${esc(t('anAiNote'))}</p></div>`;
  };
  const drawAi = () => { const x = $('#anAi', el); if (x) { x.outerHTML = aiCard(); $('#anRe', el)?.addEventListener('click', () => summary(true)); } };

  function draw() {
    const k = D.kpi, audit = D.kind === 'audit';
    const tile = (v, label, cls = '', sub = '') => `<div class="stat ${cls}" role="group"><b>${esc(v)}</b><span>${esc(label)}</span>${sub ? `<div class="mute xs">${esc(sub)}</div>` : ''}</div>`;
    const tone = (v, good, ok) => (v === null ? '' : v >= good ? 'ok' : v >= ok ? 'warn' : 'bad');
    const tiles = [
      tile(N(k.enrolments, '0'), t('anEnrol'), '', t('anPeopleSessions', k.people, k.sessions)),
      tile(P(k.attendance), t('anAttendance'), tone(k.attendance, D.rules.attendance, 70), k.absent ? t('anAbsentN', k.absent) : ''),
      tile(k.feedbackAvg === null ? '—' : k.feedbackAvg + ' / 10', t('anFeedback'), tone(k.feedbackAvg, D.rules.feedback, 5), t('anResponses', k.feedbackN, P(k.feedbackRate))),
      tile(P(k.testPass), t('anTestPass'), tone(k.testPass, D.rules.passRate, 50), t('anTestAvg', N(k.testN, '0'), P(k.testAvg))),
      tile(P(k.pracPass), t('anPractical'), tone(k.pracPass, D.rules.practical, 50), t('anAssessed', N(k.pracN, '0'))),
      audit ? tile(P(k.evalRate), t('anEvalDone'), tone(k.evalRate, D.rules.evalDone, 50), k.engagement ? t('anEngagement', k.engagement) : '')
        : tile(P(k.passRate), t('anOverallPass'), tone(k.passRate, D.rules.passRate, 50), t('anPassFail', k.pass, k.fail)),
      audit ? tile(N(k.testReview, '0'), t('anReviewPending'), k.testReview ? 'warn' : '', k.reviewDays !== null ? t('anReviewDays', k.reviewDays) : '')
        : tile(N(k.certsIssued, '0'), t('anCertsIssued'), '', t('anCertsActive', k.certsActive)),
      audit ? tile(P(k.dohRate), t('anDoh'), tone(k.dohRate, 100, 90), k.dohFlags ? t('anDohFlags', k.dohFlags) : '')
        : tile(N(k.exp30, '0'), t('anExpiring30'), k.exp30 ? 'bad' : '', t('anExp90', k.exp90, k.expired)),
    ].join('');
    const att = D.attention.length ? `<ul class="att-list">${D.attention.map(a => `<li>${badge(lv[a.level][0], t(lv[a.level][1]))} ${esc(t(a.key, ...a.args.map(x => (typeof x === 'string' && /^g\d$/.test(x) ? t(x) : x))))}</li>`).join('')}</ul>` : `<div class="banner ok">✔ ${esc(t('anAllGood'))}</div>`;
    const fb = D.feedback, ev = D.evaluation, ts = D.tests;
    const table = (hd, rows) => rows.length ? `<div class="tw"><table class="sortable"><thead><tr>${hd.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : empty('📊', t('none'));
    const td = (v, sort) => `<td${sort !== undefined ? ` data-sort="${esc(sort ?? -1)}"` : ''}>${esc(v)}</td>`;
    el.innerHTML = head() + aiCard()
      + `<div class="card"><h2>⚠ ${esc(t('anAttention'))}</h2>${att}<p class="hint" style="margin:8px 0 0">${esc(t('anRulesNote', D.rules.attendance, D.rules.passRate, D.rules.feedback))}</p></div>`
      + `<div class="grid g4" style="margin:16px 0">${tiles}</div>`
      + `<div class="grid g2">
        <div class="card"><h2>${esc(t('anAttByTraining'))}</h2>${bars(D.attendance, r => r.rate, 100, r => r.name, r => `${P(r.rate)} (${r.present}/${r.enrolled})`)}</div>
        <div class="card"><h2>${esc(t('anFbByQuestion'))}</h2>${bars(S.FB_GROUPS.filter(g => fb.byQ[g] !== null).map(g => ({ g, v: fb.byQ[g] })), r => r.v, 10, r => t(r.g), r => r.v + ' / 10')}
          <h3 style="margin-top:14px">${esc(t('anFbDist'))}</h3><div class="dist" role="img" aria-label="${esc(t('anFbDist'))}">${fb.dist.map((n, i) => { const mx = Math.max(1, ...fb.dist); return `<div class="dcol" title="${i + 1}: ${n}"><span class="dv">${n || ''}</span><span class="dbar" style="height:${Math.round((n / mx) * 70)}px"></span><span class="dl">${i + 1}</span></div>`; }).join('')}</div></div>
        <div class="card"><h2>${esc(t('anFbByTrainer'))}</h2>${bars(fb.byTrainer, r => r.avg, 10, r => r.name, r => `${r.avg} / 10 · ${r.n}`)}</div>
        <div class="card"><h2>${esc(t('anFbByTraining'))}</h2>${bars(fb.byTraining, r => r.avg, 10, r => r.name, r => `${r.avg} / 10 · ${r.n}`)}</div>
        <div class="card"><h2>${esc(t('anTrainerEval'))}</h2>${ev.n ? `<p class="mute sm">${esc(t('anEvalN', ev.n))}${ev.engagement ? ' · ' + esc(t('anEngagement', ev.engagement)) : ''}</p>
          <h3>${esc(t('behavior'))}</h3>${bars(S.BEHAVIOR.map(b => ({ b, n: ev.behavior[b] || 0 })), r => r.n, Math.max(1, ...Object.values(ev.behavior)), r => t('beh_' + r.b), r => String(r.n))}
          <h3 style="margin-top:12px">${esc(t('punctuality'))}</h3>${bars(S.PUNCTUALITY.map(b => ({ b, n: ev.punctuality[b] || 0 })), r => r.n, Math.max(1, ...Object.values(ev.punctuality)), r => t('pun_' + r.b), r => String(r.n))}` : empty('📝', t('none'))}</div>
        <div class="card"><h2>${esc(t('anPracByTraining'))}</h2>${bars(D.practical, r => r.rate, 100, r => r.name, r => `${P(r.rate)} (${r.pass}/${r.n})`)}</div>
      </div>`
      + `<div class="card" style="margin-top:16px"><h2>${esc(t('anTests'))}</h2>${table([t('test'), t('anAttempts'), t('anAvgScore'), t('anPassRate')], ts.byTest.map(r => `<tr><td><b>${esc(r.title)}</b></td>${td(r.n, r.n)}${td(P(r.avg), r.avg)}${td(P(r.passRate), r.passRate)}</tr>`))}
          <h3 style="margin-top:14px">${esc(t('anHardest'))}</h3>${table([t('question'), t('test'), t('anAnswered'), t('anCorrect'), t('anCommonWrong')], ts.hardest.map(q => `<tr><td>${esc(q.text)}</td><td class="mute sm">${esc(q.test)}</td>${td(q.n, q.n)}${td(P(q.correct), q.correct)}<td class="mute sm">${esc(q.commonWrong)}</td></tr>`))}</div>`
      + `<div class="card" style="margin-top:16px"><h2>${esc(t('anCohorts'))}</h2><p class="hint">${esc(t('anCohortsHint'))}</p>${table([t('date'), t('training'), t('trainer'), t('anSize'), t('anAttendance'), t('anTestAvgShort'), t('anSpread'), t('anPassRate'), t('anFeedback')],
          D.cohorts.map(g => `<tr><td data-sort="${esc(g.date)}">${esc(S.fmtDate(g.date))}${g.upcoming ? ' ' + badge('PENDING', t('st_upcoming')) : ''}</td><td>${esc(g.training)}</td><td>${esc(g.trainer)}</td>${td(g.size, g.size)}${td(P(g.attendance), g.attendance)}${td(P(g.testAvg), g.testAvg)}${td(g.testSd === null ? '—' : '±' + g.testSd, g.testSd)}${td(P(g.passRate), g.passRate)}${td(g.feedback === null ? '—' : g.feedback + ' / 10', g.feedback)}</tr>`))}</div>`
      + `<div class="grid g2" style="margin-top:16px">
        <div class="card"><h2>${esc(t('anTrend'))}</h2>${table([t('anMonth'), t('anEnrol'), t('anAttendance'), t('anPassRate'), t('anFeedback')], D.trend.map(m => `<tr><td data-sort="${m.month}">${esc(m.month)}</td>${td(m.enrolled, m.enrolled)}${td(P(m.attendance), m.attendance)}${td(P(m.passRate), m.passRate)}${td(m.feedback === null ? '—' : m.feedback + ' / 10', m.feedback)}</tr>`))}</div>
        <div class="card"><h2>${esc(t('anOutcomes'))}</h2>${bars(Object.entries(D.outcomes).map(([o, n]) => ({ o, n })).sort((a, b) => b.n - a.n), r => r.n, Math.max(1, ...Object.values(D.outcomes)), r => t('oc_' + r.o) === 'oc_' + r.o ? r.o : t('oc_' + r.o), r => String(r.n))}
          ${D.certs ? `<h3 style="margin-top:14px">${esc(t('anExpByTraining'))}</h3>${bars(D.certs.expiringByTraining, r => r.n, Math.max(1, ...D.certs.expiringByTraining.map(r => r.n)), r => r.name, r => String(r.n))}` : ''}</div>
      </div>`
      + `<div class="card" style="margin-top:16px"><h2>${esc(t('anComments'))}</h2>${fb.comments.length ? `<ul class="cm-list">${fb.comments.map(k => `<li><span class="mute xs">${esc(S.fmtDate(k.date))} · ${esc(k.training)} · ${esc(t(k.g))} · ${esc(k.score)}/10</span><br>${esc(k.text)}</li>`).join('')}</ul>` : empty('💬', t('none'))}</div>`
      + (D.people.length ? `<div class="card" style="margin-top:16px"><h2>${esc(t('anFollowUp'))}</h2>${table([t('fullName'), t('learnerNo'), t('training'), t('date'), t('anReason')], D.people.map(p => `<tr><td><b>${esc(p.name)}</b></td><td class="mono">${esc(p.att)}</td><td>${esc(p.training)}</td><td data-sort="${esc(p.date)}">${esc(S.fmtDate(p.date))}</td><td>${badge(p.reason === 'absent' ? 'PENDING' : 'FAIL', t('anR_' + p.reason))}${p.score !== null && p.reason === 'exam' ? ' ' + esc(p.score) + '%' : ''}</td></tr>`))}</div>` : '');
    wire(); $('#anRe', el)?.addEventListener('click', () => summary(true));
  }
  function wire() {
    $$('[data-per]', el).forEach(b => (b.onclick = () => { setPeriod(b.dataset.per); load(); }));
    const dt = () => { const a = $('#anFrom', el).value, b = $('#anTo', el).value; if (S.isDate(a) && S.isDate(b) && a <= b) { F.period = 'custom'; F.from = a; F.to = b; load(); } };
    $('#anFrom', el).onchange = dt; $('#anTo', el).onchange = dt;
    $('#anBid', el).onchange = e => { F.bid = e.target.value; load(); };
    if ($('#anTid', el)) $('#anTid', el).onchange = e => { F.tid = e.target.value; load(); };
    if ($('#anCo', el)) $('#anCo', el).onchange = e => { F.co = e.target.value; load(); };
    $('#anPrint', el).onclick = () => window.print();
  }
  await load();
}
