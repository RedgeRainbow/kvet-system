/* Test editor (question bank), shared by the admin panel and the trainer portal, and the question import (text / Excel).
   mode 'staff'  : one Save button (incomplete multiple-choice questions -> the test is saved as a draft after asking)
   mode 'trainer': Save draft / Submit for approval (only a complete test can be submitted) */
import * as S from './shared.js';
import { $, esc, t, toast, openModal, confirmDlg, opts, download } from './ui.js';
import { api } from './api.js';
import { readXlsx, writeXlsx } from './xlsx.js';

const L = 'ABCDEFGHIJ';
const nid = () => 'q' + Math.random().toString(36).slice(2, 8);

/* ------------------------------------------------------------ editor */
/* a picture for a question: made at most 1400 px wide and saved as WebP (JPEG where WebP is not available) before uploading */
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k); /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')).drawImage(bmp, 0, 0, cv.width, cv.height);
  const as = type => new Promise(res => cv.toBlob(res, type, 0.85));
  let b = await as('image/webp'); if (!b || b.type !== 'image/webp') b = await as('image/jpeg'); return b;
}
export function testEditor({ src, blanks = /** @type {any[]} */ ([]), readOnly = false, mode = 'staff', defaultBid = '', save, onSaved = /** @type {(r: any) => any} */ (() => {}) }) {
  const upPath = mode === 'trainer' ? '/portal/trainer/test/image' : '/test/image', upKind = mode === 'trainer' ? 'trainer' : 'staff';
  const blank = id => blanks.find(x => x.id === id);
  const m = JSON.parse(JSON.stringify(src || { bid: defaultBid, title: '', intro: '', grading: 'rate', passRate: 80, timeLimit: 0, questions: [] }));
  if (!m.questions.length) m.questions.push({ id: nid(), kind: 'mc', text: '', options: ['', '', '', ''], correct: -1, points: 1 });
  // the editor works with plain texts + the position of the correct one; each choice keeps its id (optIds) through edits
  m.questions.forEach(k => { k.id ||= nid(); if (k.kind === 'mc') { const ol = S.optList(k); k.optIds = ol.map(o => (typeof o.id === 'string' ? o.id : null)); k.options = ol.map(o => o.text); k.correct = ol.findIndex(o => o.id === k.correct); } });
  const ro = readOnly;
  const qHtml = (k, i) => `<div class="card qcard" data-q="${i}" style="box-shadow:none;margin:0 0 10px;padding:12px">
    <div class="row" style="align-items:center"><b style="min-width:28px">${i + 1}.</b>
      <select data-f="kind" style="width:auto" ${ro ? 'disabled' : ''}>${opts([['mc', t('qMc')], ['open', t('qOpen')]], k.kind)}</select>
      <label style="margin:0;display:flex;align-items:center;gap:6px" class="sm">${esc(t('points'))}<input data-f="points" type="number" min="1" max="100" value="${k.points || 1}" style="width:64px" ${ro ? 'disabled' : ''}></label>
      ${k.grp && k.grp !== 'open' ? `<span class="bd">${esc(t('sectionN', k.grp.replace(/^g/, '')))}</span>` : ''}${k.kind === 'mc' && k.correct < 0 && k.options?.filter(Boolean).length >= 2 ? `<span class="bd FAIL">${esc(t('noCorrectYet'))}</span>` : ''}<span class="grow"></span>${ro ? '' : `<button type="button" class="btn ghost sm" data-mv="-1" title="↑" ${i ? '' : 'disabled'}>↑</button><button type="button" class="btn ghost sm" data-mv="1" title="↓" ${i < m.questions.length - 1 ? '' : 'disabled'}>↓</button><button type="button" class="btn bad ghost sm" data-rm title="${esc(t('remove'))}">✕</button>`}</div>
    <textarea data-f="text" rows="2" maxlength="2000" placeholder="${esc(t('qTextPh'))}" style="margin-top:8px" ${ro ? 'disabled' : ''}>${esc(k.text)}</textarea>
    <div class="row" style="align-items:center;margin:6px 0 2px;gap:8px">${k.img ? `<img src="${S.qImgUrl(k.img)}" alt="" class="qimg-th">` : ''}${ro ? '' : `<label class="btn ghost sm" style="margin:0">🖼 ${esc(k.img ? t('qImgChange') : t('qImgAdd'))}<input type="file" data-img accept="image/png,image/jpeg,image/webp,image/*" hidden></label>${k.img ? `<button type="button" class="btn bad ghost sm" data-ri>${esc(t('qImgRemove'))}</button>` : ''}`}</div>
    ${k.kind === 'mc' ? `<div class="sm mute" style="margin:6px 0 4px">${esc(t('qChooseCorrect'))}</div>${k.options.map((o, j) => `<div class="row opt" style="align-items:center;margin-bottom:4px;flex-wrap:nowrap"><label class="chk" style="margin:0;min-width:46px" title="${esc(t('correctAnswer'))}"><input type="radio" name="c${i}" data-c="${j}" ${k.correct === j ? 'checked' : ''} ${ro ? 'disabled' : ''}> <b>${L[j]}</b></label><input data-o="${j}" value="${esc(o)}" maxlength="500" placeholder="${esc(t('optionN', L[j]))}" style="flex:1;${k.correct === j ? 'border-color:var(--ok);background:var(--ok-t)' : ''}" ${ro ? 'disabled' : ''}>${ro || k.options.length <= 2 ? '' : `<button type="button" class="btn ghost sm" data-ro="${j}" title="${esc(t('remove'))}">✕</button>`}</div>`).join('')}
      ${ro || k.options.length >= 10 ? '' : `<button type="button" class="btn ghost sm" data-ao>＋ ${esc(t('addOption'))}</button>`}` : `<p class="hint" style="margin:6px 0 0">${esc(t('qOpenHint'))}</p>`}</div>`;
  const html = `<div class="fg"><label class="req">${esc(t('testHeading'))}<input id="tt" value="${esc(m.title)}" maxlength="200" ${ro ? 'disabled' : ''}></label>
    <label>${esc(t('linkedTraining'))} <span class="mute">(${esc(t('optional'))})</span><select id="tb" ${ro ? 'disabled' : ''}>${opts(blanks.map(b => [b.id, b.name]), m.bid, t('noTrainingLink'))}</select></label>
    <label>${esc(t('grading'))}<select id="tg" ${ro ? 'disabled' : ''}>${opts([['rate', t('gradingRate')], ['review', t('gradingReview')]], m.grading)}</select></label>
    <label id="tpl">${esc(t('passRate'))} (%)<input id="tp" type="number" min="1" max="100" value="${m.passRate}" ${ro ? 'disabled' : ''}></label>
    <label>${esc(t('timeLimit'))} <span class="mute">(${esc(t('minutes'))}, 0 = ${esc(t('noLimit'))})</span><input id="tl" type="number" min="0" max="600" value="${m.timeLimit || 0}" ${ro ? 'disabled' : ''}></label>
    <label>${esc(t('perAttempt'))} <span class="mute">(0 = ${esc(t('allQuestions'))})</span><input id="tk" type="number" min="0" max="1000" value="${m.pick || 0}" ${ro || Object.keys(m.pickBy || {}).length ? 'disabled' : ''}>${Object.keys(m.pickBy || {}).length ? `<span class="hint">${esc(t('pickBySummary', Object.entries(m.pickBy).map(([g, n]) => (g === 'open' ? t('qOpen') : t('sectionN', g.replace(/^g/, ''))) + ': ' + n).join(', ')))} ${ro ? '' : `<button type="button" class="btn ghost sm" id="pbx">${esc(t('useOneNumber'))}</button>`}</span>` : `<span class="hint">${esc(t('perAttemptHint'))}</span>`}</label>
    <label class="full">${esc(t('testIntro'))} <span class="mute">(${esc(t('optional'))})</span><textarea id="ti" rows="2" maxlength="1500" ${ro ? 'disabled' : ''}>${esc(m.intro)}</textarea></label></div>
    <div class="banner sm" id="gh" style="margin:4px 0 12px"></div>
    <div class="row" style="margin-bottom:8px;align-items:center"><h3 style="margin:0">${esc(t('questions'))} <span class="mute" id="qn"></span></h3><span class="grow"></span>${ro ? '' : `<button type="button" class="btn ghost sm" id="imp">⬆ ${esc(t('importQuestions'))}</button>`}</div>
    <div id="ql"></div>${ro ? '' : `<button type="button" class="btn ghost" id="aq">＋ ${esc(t('addQuestion'))}</button> <button type="button" class="btn ghost" id="aqo">＋ ${esc(t('addOpenQuestion'))}</button>`}<div class="err" id="te" role="alert"></div>`;
  const dlg = openModal({ title: src?.id ? t('editTest') : t('newTest'), wide: true, html, onMount: d => {
    const ql = $('#ql', d);
    const paint = () => { ql.innerHTML = m.questions.map(qHtml).join(''); $('#qn', d).textContent = `(${m.questions.length} · ${t('totalPts', m.questions.reduce((s, k) => s + (k.points || 1), 0))})`; };
    const gh = () => { const open = m.questions.some(k => k.kind === 'open'); $('#tpl', d).style.display = $('#tg', d).value === 'review' ? 'none' : ''; $('#gh', d).textContent = $('#tg', d).value === 'review' ? t('gradingReviewHint') : open ? t('gradingRateOpenHint') : t('gradingRateHint'); };
    paint(); gh(); $('#tg', d).onchange = gh;
    $('#pbx', d)?.addEventListener('click', ev => { ev.preventDefault(); m.pickBy = {}; const i = $('#tk', d); i.disabled = false; i.value = 0; ev.target.closest('.hint').textContent = t('perAttemptHint'); });
    $('#tb', d).onchange = e => { const b = blank(e.target.value); if (b && !$('#tt', d).value) $('#tt', d).value = b.name; };
    if (!m.title && m.bid) $('#tt', d).value = blank(m.bid)?.name || '';
    // keep the model in step with the inputs
    ql.addEventListener('input', e => { const c = e.target.closest('[data-q]'); if (!c) return; const k = m.questions[+c.dataset.q];
      if (e.target.dataset.f === 'text') k.text = e.target.value; if (e.target.dataset.f === 'points') { k.points = Math.max(1, +e.target.value || 1); paint0(); } if (e.target.dataset.o !== undefined) k.options[+e.target.dataset.o] = e.target.value; });
    const paint0 = () => { $('#qn', d).textContent = `(${m.questions.length} · ${t('totalPts', m.questions.reduce((s, k) => s + (k.points || 1), 0))})`; };
    ql.addEventListener('change', async e => { const c = e.target.closest('[data-q]'); if (!c) return; const k = m.questions[+c.dataset.q];
      if (e.target.dataset.img !== undefined) { const f = e.target.files[0]; if (!f) return; const lb = e.target.closest('label'); lb.classList.add('busy');
        try { const blob = await shrinkImage(f); if (blob.size > 3e6) throw new Error('tooBig'); k.img = (await api(upPath, { kind: upKind, raw: blob })).img; paint(); }
        catch (/** @type {any} */ er) { toast(er.message === 'tooBig' ? t('tooBig') : t('badFile'), 'bad'); lb.classList.remove('busy'); } return; }
      if (e.target.dataset.c !== undefined) { k.correct = +e.target.dataset.c; paint(); }
      if (e.target.dataset.f === 'kind') { k.kind = e.target.value; if (k.kind === 'mc' && !k.options?.length) { k.options = ['', '', '', '']; k.correct = -1; } paint(); gh(); } });
    ql.addEventListener('click', e => { const c = e.target.closest('[data-q]'); if (!c) return; const i = +c.dataset.q, k = m.questions[i], b = e.target.closest('button'); if (!b) return;
      if (b.dataset.rm !== undefined) { m.questions.splice(i, 1); if (!m.questions.length) m.questions.push({ id: nid(), kind: 'mc', text: '', options: ['', '', '', ''], correct: -1, points: 1 }); }
      else if (b.dataset.mv) { const j = i + +b.dataset.mv; [m.questions[i], m.questions[j]] = [m.questions[j], m.questions[i]]; }
      else if (b.dataset.ri !== undefined) delete k.img;
      else if (b.dataset.ao !== undefined) { k.options.push(''); (k.optIds ||= []).push(null); }
      else if (b.dataset.ro !== undefined) { const j = +b.dataset.ro; k.options.splice(j, 1); k.optIds?.splice(j, 1); if (k.correct === j) k.correct = -1; else if (k.correct > j) k.correct--; }
      else return; paint(); gh(); });
    $('#aq', d)?.addEventListener('click', () => { m.questions.push({ id: nid(), kind: 'mc', text: '', options: ['', '', '', ''], correct: -1, points: 1 }); paint(); ql.lastElementChild?.querySelector('textarea')?.focus(); });
    $('#aqo', d)?.addEventListener('click', () => { m.questions.push({ id: nid(), kind: 'open', text: '', points: 1 }); paint(); gh(); ql.lastElementChild?.querySelector('textarea')?.focus(); });
    $('#imp', d)?.addEventListener('click', () => importDlg(list => { const empty1 = m.questions.length === 1 && !m.questions[0].text; if (empty1) m.questions = []; m.questions.push(...list.map(k => ({ ...k, id: nid() }))); paint(); gh(); }));
  }, buttons: ro ? [{ label: t('close'), id: 'x' }] : [{ label: t('cancel'), cls: 'ghost', id: 'x' }, ...(mode === 'trainer' ? [{ label: t('saveDraft'), cls: 'ghost', fn: d => submit(d, false) }, { label: '📤 ' + t('submitForApproval'), id: 'ok', fn: d => submit(d, true) }] : [{ label: t('save'), id: 'ok', fn: d => submit(d, true) }])] });
  async function submit(d, send) {
    const body = { id: src?.id, bid: $('#tb', d).value, title: $('#tt', d).value.trim(), intro: $('#ti', d).value, grading: $('#tg', d).value, passRate: +$('#tp', d).value || 80, timeLimit: +$('#tl', d).value || 0, pick: +$('#tk', d).value || 0, pickBy: m.pickBy || {}, source: m.source || '',
      questions: m.questions.map(({ optIds, ...k }) => k.kind !== 'mc' ? { ...k, options: undefined } : (() => {
        const keep = k.options.map((o, j) => ({ id: optIds?.[j] || undefined, text: o.trim(), j })).filter(o => o.text);
        return { ...k, options: keep.map(({ id, text }) => ({ id, text })), correct: keep.findIndex(o => o.j === k.correct) }; })()) };
    if (!body.title && !body.bid) { $('#te', d).textContent = t('needTitle'); $('#tt', d).focus(); return false; }
    const bad = body.questions.findIndex(k => !k.text.trim() || (k.kind === 'mc' && k.options.length < 2));
    if (bad >= 0) { $('#te', d).textContent = t('badQuestionN', bad + 1); d.querySelectorAll('.qcard')[bad]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    // questions without a correct answer: the test can be kept as a draft (not usable in sessions until completed)
    const open1 = body.questions.findIndex(k => k.kind === 'mc' && k.correct < 0);
    if (open1 >= 0) {
      if (mode === 'trainer' && send) { $('#te', d).textContent = t('completeBeforeSubmit', open1 + 1); d.querySelectorAll('.qcard')[open1]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
      if (mode !== 'trainer' && !await confirmDlg(t('saveDraftConfirm', body.questions.filter(k => k.kind === 'mc' && k.correct < 0).length, open1 + 1))) { d.querySelectorAll('.qcard')[open1]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
      body.draft = true;
    }
    try { const r = await save({ ...body, submit: send }); toast(mode === 'trainer' ? (send ? t('sentForApproval') : t('saved')) : t('saved'), 'ok'); await onSaved(r); return true; }
    catch (/** @type {any} */ er) { $('#te', d).textContent = er.message === 'badQuestion' ? t('badQuestionN', er.data?.n || '?') : t(er.message) === er.message ? t('server') : t(er.message); return false; }
  }
  return dlg;
}

/* --------------------------------------------- import from text / Excel */
function importDlg(done) {
  /** @type {{ questions: any[], errors: any[] }} */
  let parsed = { questions: [], errors: [] };
  const show = d => { const n = parsed.questions.length, o = parsed.questions.filter(k => k.kind === 'open').length;
    $('#ir', d).innerHTML = n ? `<div class="banner ${parsed.errors.length ? 'warn' : 'ok'} sm">${esc(t('importFound', n, o))}${parsed.errors.length ? '<br>' + esc(t('importNoCorrect', parsed.errors.join(', '))) : ''}</div>
      <ol class="sm" style="max-height:220px;overflow:auto;margin:6px 0 0 18px">${parsed.questions.map(k => `<li>${esc(k.text)}${k.kind === 'mc' ? `<br><span class="mute">${k.options.map((o, j) => j === k.correct ? `<b style="color:var(--ok)">${L[j]}) ${esc(o)} ✔</b>` : `${L[j]}) ${esc(o)}`).join(' · ')}</span>` : ` <span class="mute">(${esc(t('qOpen'))})</span>`}</li>`).join('')}</ol>` : ''; };
  openModal({ title: t('importQuestions'), wide: true, html: `<p class="hint" style="white-space:pre-line">${esc(t('qImportHint'))}</p>
    <pre class="mono sm" style="background:var(--soft);padding:8px;border-radius:6px;white-space:pre-wrap">1. Siqnal verməyə kim icazəlidir?
A) İstənilən işçi
B) Təyin edilmiş siqnalçı *
C) Sifarişçi

2. Sapandı istifadədən əvvəl necə yoxlayırsınız?</pre>
    <textarea id="it" rows="9" placeholder="${esc(t('importPaste'))}"></textarea>
    <div class="row" style="margin-top:8px;align-items:center"><label class="btn ghost sm" style="margin:0">⬆ Excel (.xlsx)<input type="file" id="ix" accept=".xlsx" hidden></label><button type="button" class="btn ghost sm" id="itp">⬇ ${esc(t('excelTemplate'))}</button></div><div id="ir" style="margin-top:8px"></div>`,
    onMount: d => {
      $('#it', d).oninput = () => { parsed = S.parseQuestions($('#it', d).value); show(d); };
      $('#ix', d).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { parsed = S.questionsFromRows(await readXlsx(await f.arrayBuffer())); show(d); } catch { toast(t('badFile'), 'bad'); } };
      $('#itp', d).onclick = async () => download(await writeXlsx([{ name: 'Questions', rows: [['Question / Sual', 'Type (MC / Open)', 'A', 'B', 'C', 'D', 'E', 'F', 'Correct (A-F)', 'Points'], ['Who may give signals to the crane operator?', 'MC', 'Anyone', 'The appointed signaller', 'The client', '', '', '', 'B', 1], ['Describe a pre-use check of a sling.', 'Open', '', '', '', '', '', '', '', 3]], widths: [60, 14, 24, 24, 24, 24, 18, 18, 14, 8], textCols: [0, 1, 2, 3, 4, 5, 6, 7, 8] }]), 'questions-template.xlsx');
    },
    buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('addToTest'), id: 'ok', fn: async () => { if (!parsed.questions.length) { toast(t('importNone'), 'bad'); return false; } done(parsed.questions); return true; } }] });
}

