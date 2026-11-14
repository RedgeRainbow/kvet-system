import { mountPortal, topbar } from '../portal.js';
import { api, setToken } from '../api.js';
import * as S from '../shared.js';
import { $, $$, esc, t, lang, toast, fail, openModal, badge, empty, busy, download, confirmDlg, errMsg, showPdf, dataUrl } from '../ui.js';
import { certHtml, DOC_CSS, printHtml, htmlToPdf, certFile } from '../cert.js';
import { live } from '../live.js';
const scaled = (html, w) => `<div style="width:${w}px;max-width:100%;overflow:hidden"><div style="width:794px;transform-origin:0 0;transform:scale(${w / 794});height:${Math.round(1123 * w / 794)}px"><style>${DOC_CSS}</style>${html}</div></div>`;
import { chatHtml } from '../chat.js';

const K = 'trainee';
const lnk = u => (/^https?:\/\//i.test(u) ? u : '#');

mountPortal({ kind: K, titleKey: 'portalTrainee', bodyClass: 'trainee', async boot({ app, rerender }) {
  /** @type {any} */ let flow = null; let H = await api('/portal/trainee/home', { kind: K }); // flow = {sid, step:'fb'|'done'|'doh'|'test', examLink}
  // registered by the office without ID/FIN or phone: these come first, the portal opens after
  if (H.needProfile) return profileGate(app, H, rerender);
  // AI assistant (if the training centre switched it on): chat tab (no test questions are ever shown back: they are confidential)
  let AI = H.ai || { chat: false }, tabT = 'home'; const CH = [];
  if (!H.ai) try { AI = await api('/portal/trainee/ai', { kind: K }); } catch {}
  try { if (sessionStorage.kvetTab === 'ai') tabT = 'ai'; } catch {}
  const nm = () => (H.me.foreign ? H.me.en : H.me.az);
  // a candidate sent by a company sees only that the certificate exists and until when it is valid (the company holds the document)
  const factCard = c => `<div class="card"><div class="row"><div><b>📜 ${esc(c.training)}</b><div class="mute sm">${esc(t('certHeld'))}</div></div><span class="grow"></span>${badge(c.st, t('cs_' + c.st))}</div>
    <div class="mute sm" style="margin-top:6px">${esc(S.fmtDate(c.start))} · ${esc(t('valid'))}: <b>${esc(S.fmtDate(c.expiry))}</b></div></div>`;
  const certCard = c => c.fact ? factCard(c) : `<div class="card"><div class="row"><div><b class="mono">${esc(c.no)}</b><div class="mute sm">${esc(c.snap.blank?.name || '')}</div></div><span class="grow"></span>${badge(c.st, t('cs_' + c.st))}</div>
    <div class="mute sm" style="margin:6px 0">${esc(S.fmtDate(c.start))} → ${esc(S.fmtDate(c.end))} · ${esc(t('valid'))}: <b>${esc(S.fmtDate(c.expiry))}</b></div><div class="row"><button class="btn sm" data-v="${esc(c.no)}">👁 ${esc(t('view'))}</button><button class="btn ghost sm" data-pdf="${esc(c.no)}">⬇ PDF</button>${H.certPdf ? '' : `<button class="btn ghost sm" data-pr="${esc(c.no)}">🖨 ${esc(t('print'))}</button>`}</div></div>`;
  const fbForm = s => `<div class="card"><h2>${esc(t('feedbackTitle'))}</h2><p class="mute">${esc(s.blank?.name || '')}</p><p class="hint">${esc(t('feedbackHint'))}</p>
    ${S.FB_GROUPS.map(g => `<div class="fbq" data-g="${g}" style="margin:14px 0"><div class="b">${esc(t(g))}</div><div class="hint">${esc(t(g + 'h'))}</div><div class="rate">${Array.from({ length: 10 }, (_, i) => `<button type="button" class="btn ghost" data-r="${i + 1}">${i + 1}</button>`).join('')}</div><textarea rows="2" maxlength="2000" placeholder="${esc(g === 'g6' ? t('g6c') : t('comment'))}" data-cm></textarea></div>`).join('')}
    <p class="hint">✍ ${esc(t('fbSignNote'))}</p><div class="err" id="fe" role="alert"></div><button class="btn" id="fsend" data-sid="${esc(s.id)}">✍ ${esc(t('fbSubmitSign'))}</button></div>`;
  /* what is waiting for the candidate's signature (shown at the top of the home page) */
  const todoBanner = () => {
    const items = H.sessions.filter(s => !s.cancelled && !s.final).flatMap(s => [
      ...(s.needDoh && !s.doh && s.att && s.docsReady ? [`🩺 ${t('dohTitle')} — ${s.blank?.name || ''}`] : []),
      ...(s.fbOpen ? [`📝 ${t('feedbackTitle')} — ${s.blank?.name || ''}`] : []),
      ...(s.tbt?.canSign ? [`🦺 ${t('toolboxTalk')} — ${s.tbt.topic}`] : [])]);
    return items.length ? `<div class="banner warn" role="status" style="margin-bottom:14px"><b>✍ ${esc(t('toSignTrainee', items.length))}</b><ul style="margin:6px 0 0 18px">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  };
  const sessCard = s => {
    const o = s.final?.outcome, title = `<div class="row"><b>${esc(s.blank?.name || '')}</b><span class="grow"></span>${s.cancelled ? badge('FAIL', t('st_cancelled')) : s.active ? badge('ACTIVE', t('today')) : s.upcoming ? badge('PENDING', t('st_upcoming')) : badge('', t('st_completed'))}</div><div class="mute sm">${esc(S.fmtDate(s.date))}${s.endDate ? ' – ' + esc(S.fmtDate(s.endDate)) : ''}${s.time ? ' · ' + esc(s.time) : ''}${s.location ? ' · ' + esc(s.location) : ''}${s.trainer ? ' · ' + esc(s.trainer) : ''}</div>`;
    let body = '';
    // declaration of health: compulsory for sessions with a practical part, from the first day
    const dohBtn = s.needDoh && !s.doh && !s.final && !s.cancelled && !s.upcoming && s.docsReady ? `<div class="banner warn" style="margin-top:10px">🩺 ${esc(t('dohNeeded'))}<div style="margin-top:8px"><button class="btn" data-doh="${esc(s.id)}">${esc(t('dohFill'))} →</button></div></div>` : s.needDoh && s.doh ? `<div class="mute sm" style="margin-top:8px">🩺 ✔ ${esc(s.doh.paper ? t('dohPaperShort') : t('dohDoneAt', S.fmtDateTime(s.doh.at)))}</div>` : '';
    const testPart = () => {
      if (!s.test || s.final) return '';
      if (s.test === 'graded') return `<div style="margin-top:10px">📝 ${badge(s.testResult.passed ? 'PASS' : 'FAIL', s.testResult.passed ? t('testPassed') : t('testFailed'))} <b>${s.testResult.pct}%</b> <span class="mute sm">· ${esc(t('questionsConfidential'))}</span></div>`;   // result only: the questions are confidential
      if (s.test === 'locked') return `<div class="banner" style="margin-top:10px">📝 ${esc(t('examWaitTrainer'))}</div>`;
      if (s.test === 'closed') return `<div class="banner warn" style="margin-top:10px">📝 ${esc(t('examClosed'))}</div>`;
      if (s.test === 'review') return `<div class="banner" style="margin-top:10px">📝 ${esc(t('testSubmittedReview'))}</div>`;
      if (s.fbRequired && !s.fbDone) return '';
      return `<div style="margin-top:10px"><button class="btn" data-test="${esc(s.id)}">📝 ${esc(s.test === 'started' ? t('continueTest') : t('startTest'))} →</button></div>`;
    };
    // multi-day training: the final-day documents (evaluation, health declaration, exam, toolbox) open on the final day
    const waitFinal = s.multi && !s.docsReady && !s.cancelled && !s.final ? `<div class="banner" style="margin-top:10px">📅 ${esc(t('finalDayWait', S.fmtDate(s.finalDay)))}</div>` : '';
    // toolbox talk opened by the trainer: the candidate acknowledges and signs it (date and time are recorded)
    const tbtPart = s.tbt ? (s.tbt.acked ? `<div class="mute sm" style="margin-top:8px">🦺 ✔ ${esc(t('tbtSignedAt2', S.fmtDateTime(s.tbt.acked)))}</div>` : s.tbt.canSign ? `<div class="banner warn" style="margin-top:10px"><b>🦺 ${esc(t('toolboxTalk'))}:</b> ${esc(s.tbt.topic)}${s.tbt.notes ? `<div class="sm" style="white-space:pre-wrap;margin-top:4px">${esc(s.tbt.notes)}</div>` : ''}<div class="sm" style="margin-top:6px">${esc(t('tbtAckText'))}</div><div style="margin-top:8px"><button class="btn" data-tbt="${esc(s.id)}">✍ ${esc(t('tbtAckSign'))}</button></div></div>` : '') : '';
    if (s.att) body = `<div class="banner ok" style="margin-top:10px">✔ ${esc(t('attConfirmedAt', S.fmtDateTime(s.att)))}</div>` + waitFinal + dohBtn + tbtPart
      + (s.fbOpen ? `<button class="btn" data-fb="${esc(s.id)}" style="margin-top:10px">${esc(t('giveFeedback'))} →</button>` : '') + testPart()
      + (!s.fbDone || s.test ? '' : !s.final && s.hasExam && s.examLink ? `<div style="margin-top:10px"><div class="b">${esc(t('examLink'))}</div><a class="btn" href="${esc(lnk(s.examLink))}" target="_blank" rel="noopener">${esc(t('startExam'))} ↗</a></div>` : `<div class="mute sm" style="margin-top:8px">✔ ${esc(t('feedbackDone'))}</div>`);
    else if (s.active && !s.cancelled) body = `<div class="banner" style="margin-top:10px">${esc(t('attByTrainer'))}</div>` + dohBtn;   // attendance is confirmed by the trainer
    else if (s.upcoming) body = `<div class="mute sm" style="margin-top:8px">${esc(t('availableOnDate', S.fmtDate(s.date)))}</div>`;
    if (o) body += `<div style="margin-top:10px">${o === 'PASS' ? badge('PASS', t('oc_PASS') + (s.final.certNo ? ' · ' + s.final.certNo : '')) : o === 'FAIL' || o === 'ABSENT' ? badge('FAIL', t('oc_' + o)) : ''}</div>`;
    if (s.prac && s.pracSigns?.examiner) body += `<div class="banner" style="margin-top:10px"><b>${esc(t('practical'))}:</b> ${badge(s.prac.result, t('pr_' + s.prac.result))} · ${esc(t('signedBy'))} ${esc(s.pracSigns.examiner.name)}</div>`;
    return `<div class="card">${title}${body}</div>`;
  };
  function draw() {
    const act = H.sessions.filter(s => s.active && !s.cancelled), rest = H.sessions.filter(s => !(s.active && !s.cancelled));
    const fbS = flow?.step === 'fb' && H.sessions.find(s => s.id === flow.sid);
    app.innerHTML = `${topbar({ title: t('portalTrainee'), sub: `<b>${esc(nm())}</b><br><span class="mono">${esc(H.me.att)}</span>` })}
     <main style="max-width:860px;margin:0 auto;padding:16px"><div class="page-h"><h1>${esc(t('hello', nm()))}</h1></div>
     ${!flow ? todoBanner() : ''}
     ${!flow && aiOn() ? `<div class="tabs" role="tablist" style="margin-bottom:12px"><button class="tab ${tabT === 'home' ? 'on' : ''}" data-tt="home" role="tab" aria-selected="${tabT === 'home'}">📅 ${esc(t('myTraining'))}</button><button class="tab ${tabT === 'ai' ? 'on' : ''}" data-tt="ai" role="tab" aria-selected="${tabT === 'ai'}">🤖 ${esc(t('aiSection'))}</button></div>` : ''}
     ${!flow && tabT === 'ai' && aiOn() ? aiSection() : flow?.step === 'doh' ? dohForm(H.sessions.find(s => s.id === flow.sid)) : flow?.step === 'test' ? testScreen() : fbS ? fbForm(fbS) : flow?.step === 'done' ? `<div class="card"><div class="banner ok">✔ ${esc(t('feedbackThanks'))}</div>${H.sessions.find(s => s.id === flow.sid)?.test === 'new' ? `<p style="margin-top:14px"><button class="btn" data-test="${esc(flow.sid)}">📝 ${esc(t('startTest'))} →</button></p>` : ''}${flow.examLink ? `<h2 style="margin-top:14px">${esc(t('examLink'))}</h2><p><a class="btn" href="${esc(lnk(flow.examLink))}" target="_blank" rel="noopener">${esc(t('startExam'))} ↗</a></p>` : ''}<button class="btn ghost" id="back">${esc(t('back'))}</button></div>`
       : `<h2>${esc(t('todaySessions'))}</h2>${act.map(sessCard).join('') || `<div class="card">${empty('📅', t('noActiveToday'))}</div>`}
       <h2 style="margin-top:22px">${esc(t('myCerts'))}</h2>${H.certsViaCompany && H.certs.length ? `<p class="hint">${esc(t('certViaCompanyHint'))}</p>` : ''}<div class="grid g2">${H.certs.filter(c => c.st !== 'REVOKED').map(certCard).join('') || `<div class="card">${empty('📜', t('noCerts'))}</div>`}</div>
       ${rest.length ? `<h2 style="margin-top:22px">${esc(t('mySessions'))}</h2>${rest.map(sessCard).join('')}` : ''}`}</main>`;
    bind();
  }
  const reload = async () => { H = await api('/portal/trainee/home', { kind: K }); if (H.ai) AI = H.ai; if (!aiOn()) tabT = 'home'; draw(); };

  /* ------------------------------------------------- "Artificial intelligence" section of the profile */
  const aiOn = () => !!AI.chat;
  const SUGG = ['aiSugg1', 'aiSugg2', 'aiSugg3', 'aiSugg4'];
  function aiSection() {
    const tested = H.sessions.filter(s => s.testResult);
    return (AI.chat ? `<div class="card"><div class="row"><h2 style="margin:0">💬 ${esc(t('aiAssistant'))}</h2><span class="grow"></span>${CH.length ? `<button class="btn ghost sm" id="cclr">${esc(t('aiClear'))}</button>` : ''}</div>
      <p class="hint">${esc(t('aiTraineeHint'))} ${esc(t('aiAnyLang'))}</p>
      <div id="clog" class="chatlog" aria-live="polite">${CH.length ? chatHtml(CH) : `<p class="mute sm">${esc(t('aiExamples'))}</p>`}</div>
      ${CH.length ? '' : `<div class="row" style="margin-top:8px;gap:6px">${SUGG.map(k => `<button type="button" class="btn ghost sm" data-sg="${esc(t(k))}">${esc(t(k))}</button>`).join('')}</div>`}
      <form id="cform" class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="cq" class="grow" maxlength="1000" placeholder="${esc(t('aiAsk'))}" aria-label="${esc(t('aiAsk'))}" autocomplete="off"><button class="btn">${esc(t('sendMsg'))}</button></form></div>` : '');
  }
  async function ask(q) {
    CH.push({ role: 'user', text: q }); if (CH.length === 1) draw(); $('#clog').innerHTML = chatHtml(CH, true); $('#clog').scrollTop = 1e9;
    try { const r = await api('/portal/trainee/ai/chat', { kind: K, body: { q, lang, history: CH.slice(0, -1).slice(-6) } }); CH.push({ role: 'assistant', text: r.answer, sources: r.sources, grounded: r.grounded }); }
    catch (/** @type {any} */ e) { CH.push({ role: 'assistant', text: t(e.message) === e.message ? t('server') : t(e.message), error: true }); }
    const lg = $('#clog'); if (lg) { lg.innerHTML = chatHtml(CH); lg.scrollTop = 1e9; }
  }


  /* ---------------------------------------------------- declaration of health */
  const L2 = () => ({ az: 1, en: 2, ru: 3 }[lang] || 1);
  function dohForm(s) {
    return `<div class="card"><h2>🩺 ${esc(t('dohTitle'))}</h2><p class="mute">${esc(s.blank?.name || '')} · ${esc(S.fmtDate(s.date))}</p>
      <div class="banner sm">${esc(t('dohIntro'))}</div>
      <div class="fg" style="margin-top:12px"><label class="req">${esc(t('dob'))}<input type="date" id="dd" max="${esc(H.today)}" required></label><label>${esc(t('company'))}<input id="dc" maxlength="160" value="${esc(H.company || '')}"></label></div>
      <p class="b" style="margin:12px 0 6px">${esc(t('dohAsk'))}</p>
      <div class="dohq">${S.DOH_Q.map(q => `<div class="dq" role="radiogroup" aria-label="${esc(q[L2()])}"><span>${esc(q[L2()])}</span><label><input type="radio" name="dq_${q[0]}" value="Y"><b>${esc(t('yes'))}</b></label><label><input type="radio" name="dq_${q[0]}" value="N"><b>${esc(t('answerNo'))}</b></label></div>`).join('')}</div>
      <label style="margin-top:10px">${esc(t('dohDetails'))}<textarea id="dt" rows="3" maxlength="2000"></textarea></label>
      <label class="chk" style="margin-top:8px;align-items:flex-start"><input type="checkbox" id="da"> <span class="sm">${esc(t('dohDeclare'))}</span></label>
      <div class="err" id="de" role="alert"></div><div class="row"><button class="btn ghost" id="back">${esc(t('back'))}</button><button class="btn" id="dsend" data-sid="${esc(s.id)}">✍ ${esc(t('dohSign'))}</button></div></div>`;
  }
  /* ------------------------------------------------------------------ test
     Answers live on this device first (localStorage, at every change) and reach the server shortly after: 3 s after the
     last change, at least every 15 s while someone keeps typing, and before the hand-in. If the network drops, nothing
     is lost: answering goes on, the hand-in waits on the phone and is sent by itself as soon as the connection is back
     (also after a reload). The device copy belongs to one attempt (its start time): a new attempt never reuses it. */
  /** @type {any} */ let T = null; let timer = 0;           // T = { sid, data, answers, pending }
  /** @type {any} */ let saving = null; let saveT = 0, maxT = 0, dirty = false, retryT = 0;
  const LK = sid => 'kvet.test.' + sid;
  const readLocal = sid => { try { return JSON.parse(localStorage[LK(sid)] || 'null'); } catch { return null; } };
  const writeLocal = () => { try { localStorage[LK(T.sid)] = JSON.stringify({ a: T.data.startedAt, ans: T.answers, sub: T.pending ? 1 : 0, data: T.data, at: Date.now() }); } catch {} };
  const dropLocal = sid => { try { delete localStorage[LK(sid)]; } catch {} };
  const saveLocal = () => { writeLocal(); dirty = true; clearTimeout(saveT); saveT = setTimeout(pushSave, 3000); if (!maxT) maxT = setTimeout(pushSave, 15000); saveState('✎ ' + t('savedOnDevice')); };
  const saveState = txt => { const el = $('#tsv'); if (el) el.textContent = txt; };
  const netBanner = on => { if (T) T.net = on; const el = $('#tnet'); if (el) el.hidden = !on; };
  async function pushSave() {
    clearTimeout(saveT); clearTimeout(maxT); maxT = 0;
    if (saving) { await saving.catch(() => {}); }
    if (!dirty || !T?.data || T.data.result || T.pending) return; dirty = false;
    saving = api('/portal/trainee/test/save', { kind: K, body: { sid: T.sid, answers: T.answers }, noRedirect: true, quiet: true })
      .then(r => { netBanner(false); saveState('✓ ' + t('answersSaved', r.saved)); })
      .catch(e => {
        // the exam was closed or the time ran out: the server already handed the attempt in -> show the result
        if (['timeUp', 'noTest', 'examClosed', 'examNotStarted', 'locked'].includes(e.message)) { clearInterval(timer); dropLocal(T.sid); return openTest(T.sid); }
        dirty = true; if (e.message === 'offline') netBanner(true); saveState('✎ ' + t('savedOnDevice')); clearTimeout(retryT); retryT = setTimeout(pushSave, 8000); });
    return saving;
  }
  addEventListener('online', () => { if (T?.pending) sendHandIn(); else if (dirty) pushSave(); });
  /* ---- exam integrity: no copying or right-click on the exam page; leaving it (another tab, window or app) is a warning;
     the 3rd warning ends the attempt at once (counted by the server). */
  const examActive = () => flow?.step === 'test' && T?.data && !T.data.done && !T.data.result;
  let unloading = false, lastWarn = 0;
  addEventListener('beforeunload', () => { unloading = true; }); addEventListener('pagehide', () => { unloading = true; });
  for (const ev of ['copy', 'cut', 'contextmenu', 'dragstart']) document.addEventListener(ev, e => { if (examActive()) { e.preventDefault(); if (ev === 'contextmenu' || ev === 'copy') toast(t('examNoCopy'), 'bad'); } });
  document.addEventListener('keydown', e => { if (!examActive()) return; const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'a', 'p', 's', 'u'].includes(k) || k === 'printscreen' || k === 'f12') { e.preventDefault(); toast(t('examNoCopy'), 'bad'); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && examActive() && !unloading) warnLeave('hidden'); });
  addEventListener('blur', () => { setTimeout(() => { if (examActive() && !unloading && !document.hasFocus()) warnLeave('blur'); }, 400); });
  async function warnLeave(kind) {
    if (Date.now() - lastWarn < 2500) return; lastWarn = Date.now();
    try {
      const r = await api('/portal/trainee/test/warn', { kind: K, body: { sid: T.sid, kind }, noRedirect: true, quiet: true }); T.data.warns = r.warns;
      if (r.done) { clearInterval(timer); clearTimeout(saveT); try { delete localStorage['kvet.test.' + T.sid]; } catch {} T.data = { ...T.data, result: r.result }; draw();
        openModal({ title: '⛔ ' + t('examEndedWarns'), html: `<p>${esc(t('examEndedWarnsText', r.max))}</p>`, buttons: [{ label: t('close'), id: 'x' }] }); return; }
      const w = $('#twn'); if (w) { w.textContent = `⚠ ${r.warns} / ${r.max}`; w.hidden = false; }
      openModal({ title: '⚠ ' + t('examWarnTitle', r.warns, r.max), html: `<p>${esc(t('examWarnText', r.max))}</p>`, buttons: [{ label: t('examBackToTest'), id: 'x' }] });
    } catch {}
  }
  function testScreen() {
    if (!T?.data) return `<div class="card"><div class="load"><span class="spin"></span></div></div>`;
    const x = T.data;
    if (x.done || x.result) { const r = x.result || x; return `<div class="card" style="text-align:center"><div style="font-size:44px">${r.status === 'graded' ? (r.passed ? '✅' : '❌') : '📨'}</div><h2>${esc(r.status === 'graded' ? t(r.passed ? 'testPassed' : 'testFailed') : t('testSubmitted'))}</h2>${r.status === 'graded' ? `<p style="font-size:22px"><b>${r.pct}%</b></p>` : `<p class="mute">${esc(t('testSubmittedReview'))}</p>`}<button class="btn ghost" id="back">${esc(t('back'))}</button></div>`; }
    const L = 'ABCDEFGHIJ';
    return `<div class="exam-lock"><div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">📝 ${esc(x.title)}</h2><span class="grow"></span>${x.timeLimit ? `<span class="bd PENDING" id="tmr" style="font-size:15px">⏱</span>` : ''}</div>
      <p class="mute sm">${esc(t('nQuestions', x.questions.length))}${x.timeLimit ? ' · ' + esc(t('minutesN', x.timeLimit)) : ''} · <span id="tsv" aria-live="polite"></span> <span class="bd PENDING" id="twn" ${x.warns ? '' : 'hidden'}>⚠ ${x.warns || 0} / ${x.maxWarns || 3}</span></p>
      <div class="banner bad sm" id="tnet" ${T.net ? '' : 'hidden'}>📶 ${esc(t('examOffline'))}</div>${T.pending ? `<div class="banner warn sm">⏳ ${esc(t('handInWaiting'))}</div>` : ''}
      <div class="banner warn sm">🔒 ${esc(t('examRules', x.maxWarns || 3))}</div>${x.intro ? `<div class="banner sm" style="white-space:pre-wrap">${esc(x.intro)}</div>` : ''}</div>
      ${x.questions.map((q, i) => `<div class="card tq" data-q="${esc(q.id)}"><div class="b">${i + 1}. ${esc(q.text)}</div>${q.img ? `<img src="${S.qImgUrl(q.img)}" alt="" class="qimg" loading="lazy">` : ''}
        ${q.kind === 'open' ? `<textarea rows="4" maxlength="4000" data-open="${esc(q.id)}" ${T.pending ? 'disabled' : ''} placeholder="${esc(t('yourAnswer'))}" style="margin-top:8px">${esc(T.answers[q.id] || '')}</textarea>`
          : `<div style="margin-top:8px">${q.options.map((o, k) => `<label class="chk tqo" style="display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border:1px solid var(--line);border-radius:8px;margin:0 0 6px;cursor:pointer"><input type="radio" name="tq_${esc(q.id)}" value="${k}" ${T.answers[q.id] === o.id ? 'checked' : ''} ${T.pending ? 'disabled' : ''}> <span><b>${L[k]})</b> ${esc(o.text)}</span></label>`).join('')}</div>`}</div>`).join('')}
      <div class="card"><div class="err" id="te" role="alert"></div><div class="row"><button class="btn ghost" id="back">${esc(t('back'))}</button><span class="grow"></span><button class="btn" id="tsend" ${T.pending ? 'disabled' : ''}>${esc(t(T.pending ? 'handInSending' : 'submitTest'))} ✓</button></div><p class="hint">${esc(t('testOneAttempt'))}</p></div></div>`;
  }
  async function openTest(sid) {
    flow = { sid, step: 'test' }; T = { sid, data: null, answers: {}, pending: false }; draw();
    const local = readLocal(sid);
    try { T.data = await api('/portal/trainee/test?sid=' + encodeURIComponent(sid), { kind: K }); }
    catch (/** @type {any} */ e) {
      // no connection: the exam continues from this device's copy (questions and answers of this attempt)
      if (e.message === 'offline' && local?.data && !local.data.result) { T.data = local.data; T.answers = local.ans || {}; T.pending = !!local.sub; T.net = true; draw(); startTimer(); if (T.pending) sendHandIn(); return; }
      flow = null; draw(); return toast(errMsg(e), 'bad');
    }
    if (T.data.done || T.data.result) { dropLocal(sid); draw(); return; }
    // the server's saved answers count; anything newer on this device (same attempt, not yet sent) is added and sent
    const mine = local && local.a === T.data.startedAt ? local : null; if (local && !mine) dropLocal(sid);
    T.answers = { ...(T.data.saved || {}), ...(mine?.ans || {}) }; writeLocal();
    draw(); startTimer();
    if (mine?.sub) { T.pending = true; return sendHandIn(); }
    if (mine && Object.keys(mine.ans || {}).length) { dirty = true; pushSave(); }
  }
  function startTimer() {
    clearInterval(timer); const x = T?.data; if (!x?.timeLimit || x.done) return;
    const end = new Date(x.startedAt).getTime() + x.timeLimit * 60e3, skew = Date.now() - new Date(x.now).getTime();
    const tick = () => { const left = Math.max(0, end - (Date.now() - skew)), el = $('#tmr'); if (!el) return clearInterval(timer);
      el.textContent = '⏱ ' + String(Math.floor(left / 60e3)).padStart(2, '0') + ':' + String(Math.floor(left / 1e3) % 60).padStart(2, '0'); el.className = 'bd ' + (left < 60e3 ? 'FAIL' : 'PENDING');
      if (!left) { clearInterval(timer); toast(t('timeUp'), 'bad'); submitTest(true); } };
    tick(); timer = setInterval(tick, 1000);
  }
  async function submitTest(force = false) {
    const x = T.data, missing = x.questions.filter(q => T.answers[q.id] === undefined || T.answers[q.id] === '').length;
    if (!force && !(await confirmDlg(missing ? t('testMissingConfirm', missing) : t('testSubmitConfirm')))) return;
    // from here the answers are final: kept on the device as "to hand in" until the server has them
    T.pending = true; writeLocal(); clearTimeout(saveT); clearTimeout(maxT); draw(); return sendHandIn();
  }
  async function sendHandIn() {
    if (!T?.pending || T.sending) return; T.sending = true; clearTimeout(retryT);
    try {
      const r = await api('/portal/trainee/test/submit', { kind: K, body: { sid: T.sid, answers: T.answers }, noRedirect: true });
      clearInterval(timer); dropLocal(T.sid); T.pending = false; T.data = { ...T.data, result: r }; netBanner(false); draw();
    } catch (/** @type {any} */ e) {
      if (e.message === 'offline' || e.data?.host || e.status >= 500) { netBanner(true); retryT = setTimeout(sendHandIn, 8000); }
      // already handed in (by the trainer closing the exam, the time limit, or another tab): show what the server has
      else if (['noTest', 'examClosed', 'timeUp'].includes(e.message)) { dropLocal(T.sid); T.pending = false; openTest(T.sid); }
      else { T.pending = false; writeLocal(); draw(); const el = $('#te'); if (el) el.textContent = errMsg(e); }
    } finally { T.sending = false; }
  }
  function bind() {
    $('#back')?.addEventListener('click', () => { flow = null; clearInterval(timer); reload(); });
    $$('[data-tt]').forEach(b => (b.onclick = () => { tabT = b.dataset.tt; try { sessionStorage.kvetTab = tabT; } catch {} draw(); if (tabT === 'ai') $('#cq')?.focus(); }));
    $$('[data-sg]').forEach(b => (b.onclick = () => ask(b.dataset.sg)));
    $('#cclr')?.addEventListener('click', () => { CH.length = 0; draw(); });
    $('#cform')?.addEventListener('submit', e => { e.preventDefault(); const q = $('#cq').value.trim(); if (!q) return; $('#cq').value = ''; ask(q); });
    $$('[data-tbt]').forEach(b => (b.onclick = () => busy(b, async () => { try { await api('/portal/trainee/tbt', { kind: K, body: { sid: b.dataset.tbt } }); toast(t('signed'), 'ok'); await reload(); } catch (/** @type {any} */ e) { toast(t(e.message) === e.message ? t('server') : t(e.message), 'bad'); } })));
    $$('[data-doh]').forEach(b => (b.onclick = () => { flow = { sid: b.dataset.doh, step: 'doh' }; draw(); scrollTo(0, 0); }));
    $$('[data-test]').forEach(b => (b.onclick = () => openTest(b.dataset.test)));
    $$('.tq').forEach(c => c.addEventListener('change', e => { if (e.target.name?.startsWith('tq_')) { const q = T.data.questions.find(k => k.id === c.dataset.q); T.answers[c.dataset.q] = q.options[+e.target.value].id; saveLocal(); } }));
    $$('[data-open]').forEach(a => (a.oninput = () => { T.answers[a.dataset.open] = a.value; saveLocal(); }));
    $('#tsend')?.addEventListener('click', () => submitTest());
    const ds = $('#dsend'); if (ds) ds.onclick = () => busy(ds, async () => {
      const answers = Object.fromEntries(S.DOH_Q.map(([k]) => [k, $(`[name=dq_${k}]:checked`)?.value]));
      const body = { sid: ds.dataset.sid, dob: $('#dd').value, company: $('#dc').value, answers, details: $('#dt').value, agree: $('#da').checked };
      if (!body.dob) return ($('#de').textContent = t('badDob'));
      if (Object.values(answers).some(v => !v)) return ($('#de').textContent = t('answerAll'));
      if (Object.values(answers).includes('Y') && !body.details.trim()) return ($('#de').textContent = t('needDetails'));
      if (!body.agree) return ($('#de').textContent = t('needAgree'));
      try { await api('/portal/trainee/doh', { kind: K, body }); toast(t('dohThanks'), 'ok'); flow = null; await reload(); } catch (/** @type {any} */ e) { $('#de').textContent = t(e.message) === e.message ? t('server') : t(e.message); }
    });
    $$('[data-fb]').forEach(b => (b.onclick = () => { flow = { sid: b.dataset.fb, step: 'fb' }; draw(); }));
    $$('.fbq .rate').forEach(r => (r.onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; r.dataset.v = b.dataset.r; [...r.children].forEach(x => x.classList.toggle('on', x === b)); }));
    const fs = $('#fsend'); if (fs) fs.onclick = () => busy(fs, async () => {
      const r = {}, cm = {}; let ok = true;
      $$('.fbq').forEach(q => { const v = +q.querySelector('.rate').dataset.v; if (!v) ok = false; r[q.dataset.g] = v; cm[q.dataset.g] = q.querySelector('[data-cm]').value; });
      if (!ok) return ($('#fe').textContent = t('rateAll'));
      try { const d = await api('/portal/trainee/feedback', { kind: K, body: { sid: fs.dataset.sid, r, cm } }); flow = { sid: fs.dataset.sid, step: 'done', examLink: d.examLink }; draw(); } catch (/** @type {any} */ e) { $('#fe').textContent = t('server'); }
    });
    /* Settings -> certificates drawn on the server. On: this page shows the server's PDF and never receives the signature
       picture. Off (Workers Free plan): the page draws the certificate and asks for the picture with its sign-in. */
    $$('[data-v],[data-pdf],[data-pr]').forEach(b => (b.onclick = () => busy(b, async () => {
      const no = b.dataset.v || b.dataset.pdf || b.dataset.pr, c = H.certs.find(x => x.no === no), q = '?no=' + encodeURIComponent(no);
      try {
        if (H.certPdf) { const blob = await api('/portal/trainee/cert.pdf' + q, { kind: K, blob: true }); return b.dataset.pdf ? download(blob, certFile(c)) : showPdf({ title: c.no, blob, name: certFile(c) }); }
        const html = certHtml(c.sigPic ? { ...c, sigData: await dataUrl(await api('/portal/trainee/cert/sig' + q, { kind: K, blob: true })) } : c, H.assets, H.info);
        if (b.dataset.pr) return printHtml(html, c.no);
        if (b.dataset.pdf) return download(await htmlToPdf(html), certFile(c));
        openModal({ title: c.no, wide: true, html: scaled(html, Math.min(640, innerWidth - 70)), buttons: [{ label: '🖨 ' + t('print'), cls: 'ghost', fn: async () => { await printHtml(html, c.no); return false; } }, { label: '⬇ PDF', fn: async () => { try { download(await htmlToPdf(html), certFile(c)); } catch (/** @type {any} */ e) { fail(e); } return false; } }, { label: t('close'), cls: 'ghost', id: 'x' }] });
      } catch (/** @type {any} */ e) { fail(e); }
    })));
  }
  draw();
  // live updates (attendance confirmed by the trainer, results, certificates); never while a form or the test is open
  live({ kind: K, path: () => '/portal/trainee/rev', every: 10000, busy: () => !!flow, quiet: () => !!flow, onChange: reload });
} });

/* first sign-in: ID/FIN (or passport number) and phone number are compulsory before the portal opens.
   A temporary account becomes a full registration (learner number); a FIN that is already registered goes to the office for linking. */
function profileGate(app, H, rerender) {
  const n = H.needProfile, nm = H.me.foreign ? H.me.en : H.me.az;
  const shell = inner => { app.innerHTML = `${topbar({ title: t('portalTrainee'), sub: `<b>${esc(nm)}</b>${H.me.att ? `<br><span class="mono">${esc(H.me.att)}</span>` : ''}` })}<main style="max-width:560px;margin:0 auto;padding:16px"><div class="card">${inner}</div></main>`; };
  if (n.linkPending) return shell(`<h1 style="margin-top:0">⏳ ${esc(t('linkWaitTitle'))}</h1><p>${esc(t('linkWaitText'))}</p><p class="hint">${esc(t('linkWaitHint'))}</p>`);
  shell(`<h1 style="margin-top:0">👋 ${esc(t('hello', nm))}</h1><p>${esc(n.temp ? t('profileNeededTemp') : t('profileNeeded'))}</p>
      ${n.linkReturned ? `<div class="banner warn sm">${esc(t('linkReturnedText'))}: ${esc(n.linkReturned)}</div>` : ''}
      <form id="pf" class="fg" autocomplete="off">
        ${n.fin ? `${n.foreign ? `<label>${esc(t('docType'))}<select name="docType"><option value="passport">${esc(t('doc_passport'))}</option><option value="id">${esc(t('doc_id'))}</option><option value="other">${esc(t('doc_other'))}</option></select></label>` : ''}
          <label class="req full">${esc(n.foreign ? t('docNumber') : t('finLabel'))}<input name="fin" required maxlength="20" autocapitalize="characters" spellcheck="false" placeholder="${n.foreign ? '' : '1AB2C3D'}"><span class="hint">${esc(n.foreign ? t('docNumberHint') : t('finHint'))}</span></label>` : ''}
        ${n.phone ? `<label class="req full">${esc(t('phone'))}<input name="phone" type="tel" required inputmode="tel" placeholder="+994 50 123 45 67" maxlength="20"></label>` : ''}
        <div class="err full" id="pe" role="alert"></div><button class="btn full">${esc(t('profileSave'))} →</button></form>
      <p class="hint">${esc(t('profileWhy'))}</p>`);
  $('#pf').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target), btn = e.submitter; btn.disabled = true; $('#pe').textContent = '';
    try {
      const r = await api('/portal/trainee/profile/complete', { kind: K, body: Object.fromEntries(f) });
      if (r.linkPending) return shell(`<h1 style="margin-top:0">⏳ ${esc(t('linkWaitTitle'))}</h1><p>${esc(t('linkFoundText', r.att))}</p><p class="hint">${esc(t('linkWaitHint'))}</p>`);
      if (r.registered) {
        setToken(K, r.token);
        shell(`<h1 style="margin-top:0">✅ ${esc(t('registeredTitle'))}</h1><p>${esc(t('registeredText'))}</p><div class="banner ok" style="font-size:18px"><b>${esc(t('learnerNo'))}:</b> <span class="mono">${esc(r.att)}</span></div><p class="hint">${esc(t('registeredHint', r.login))}</p><button class="btn" id="go">${esc(t('continue'))} →</button>`);
        $('#go').onclick = () => rerender(); return;
      }
      toast(t('saved'), 'ok'); rerender();
    } catch (/** @type {any} */ x) { $('#pe').textContent = x.message === 'dupFin' ? t('dupFinSelf') : t(x.message) === x.message ? t('server') : t(x.message); btn.disabled = false; }
  };
}
