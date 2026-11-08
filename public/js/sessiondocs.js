/* Session documents, shared by the admin and the trainer portal:
   - previewDoc: any printable form in a dialog (print / PDF)
   - reviewTest: answers of an online test; open answers are marked and PASS / FAIL decided
   - tbtDlg: the toolbox talk form
   - sessionZip: every document of a session as PDFs in one ZIP */
import { $, $$, esc, t, openModal, download, fail, badge, toast } from './ui.js';
import { DOC_CSS, printHtml, htmlToPdf, attendanceHtml, practicalHtml, esignLine } from './cert.js';
import * as F from './forms.js';
import * as S from './shared.js';

const zoomed = (html, w) => `<div style="width:${w}px;max-width:100%;overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff"><div style="zoom:${(w / 794).toFixed(4)}"><style>${DOC_CSS}</style>${html}</div></div>`;
const fileName = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[əƏ]/g, 'e').replace(/[ıİ]/g, 'i').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

export function previewDoc({ title, html, file, buttons = /** @type {any[]} */ ([]) }) {
  return openModal({ title, wide: true, html: zoomed(html, Math.min(760, innerWidth - 80)),
    buttons: [...buttons, { label: '🖨 ' + t('print'), cls: 'ghost', fn: async () => { await printHtml(html, title); return false; } },
      { label: '⬇ PDF', cls: 'ghost', fn: async () => { try { download(await htmlToPdf(html), (file || fileName(title)) + '.pdf'); } catch (/** @type {any} */ e) { fail(e); } return false; } }, { label: t('close'), id: 'x' }] });
}

/* test = e.test (with qs, answers, marks…). save({ marks, passed, note }) -> Promise */
export function reviewTest({ test: x, name, canGrade, save, extraButtons = /** @type {any[]} */ ([]) }) {
  const L = 'ABCDEFGHIJ', marks = { ...(x.marks || {}) };
  const qs = x.qs.map((q, i) => { const a = x.answers?.[q.id];
    return `<div class="card" style="box-shadow:none;margin:0 0 8px;padding:10px 12px"><div class="row" style="align-items:flex-start"><b>${i + 1}. ${esc(q.text)}</b><span class="grow"></span><span class="mute xs nowrap">${q.points} ${esc(t('pts'))}</span></div>${q.img ? `<img src="${S.qImgUrl(q.img)}" alt="" class="qimg" loading="lazy">` : ''}
      ${q.kind === 'open' ? `<div class="banner sm" style="white-space:pre-wrap;margin:6px 0">${esc(a || '—')}</div><label class="sm" style="display:flex;gap:8px;align-items:center;margin:0">${esc(t('marks'))}<input type="number" min="0" max="${q.points}" step="0.5" data-mk="${esc(q.id)}" value="${marks[q.id] ?? ''}" style="width:80px" ${canGrade ? '' : 'disabled'}> / ${q.points}</label>`
        : `<ol type="A" class="sm" style="margin:6px 0 0 18px;padding:0">${S.optList(q).map(o => `<li style="${o.id === q.correct ? 'color:var(--ok);font-weight:700' : a === o.id ? 'color:var(--bad);text-decoration:line-through' : ''}">${esc(o.text)}${a === o.id ? ' ◀ ' + esc(t('theirAnswer')) : ''}${o.id === q.correct ? ' ✔' : ''}</li>`).join('')}</ol>${a === undefined ? `<div class="xs" style="color:var(--bad)">${esc(t('notAnswered'))}</div>` : ''}`}</div>`; }).join('');
  const html = `<p class="mute sm">${esc(name)} · ${esc(t('submitted'))}: ${esc(S.fmtDateTime(x.at))}${x.late ? ` · <b style="color:var(--bad)">${esc(t('testLate'))}</b>` : ''}${x.lateHandIn ? ` · <b style="color:var(--bad)">${esc(t('lateHandInNote', Math.round(x.lateHandIn / 60)))}</b>` : ''}${x.warns?.length ? ` · <b style="color:var(--bad)">⚠ ${x.warns.length} ${esc(t('examWarnsShort'))}${x.closedBy === 'warnings' ? ' — ' + esc(t('endedByWarns')) : ''}</b>` : ''} · ${esc(x.grading === 'review' ? t('gradingReview') : t('passRateN', x.passRate))}</p>
    <div class="banner" id="rsum"></div>${qs}
    ${canGrade ? `<div class="card" style="box-shadow:none;padding:12px"><div class="row" style="align-items:center"><b>${esc(t('result'))}:</b><label class="chk"><input type="radio" name="rp" value="1" ${x.passed === true ? 'checked' : ''}> ${esc(t('pass'))}</label><label class="chk"><input type="radio" name="rp" value="0" ${x.passed === false ? 'checked' : ''}> ${esc(t('fail'))}</label></div>
      <label class="sm">${esc(t('note'))}<input id="rn" maxlength="500" value="${esc(x.note || '')}"></label><div class="err" id="re" role="alert"></div></div>` : ''}`;
  return openModal({ title: x.title || t('test'), wide: true, html, onMount: d => {
    const upd = () => { $$('[data-mk]', d).forEach(i => { if (i.value === '') delete marks[i.dataset.mk]; else marks[i.dataset.mk] = Math.min(+i.max, Math.max(0, +i.value)); });
      const sc = S.testScore(x.qs, x.answers, marks), auto = x.grading === 'rate' ? (sc.pct >= x.passRate) : null;
      $('#rsum', d).innerHTML = `${esc(t('score'))}: <b>${sc.score} / ${sc.max}</b> · <b>${sc.pct}%</b>${sc.pending ? ` · <span style="color:var(--bad)">${esc(t('openToMark', sc.pending))}</span>` : ''}${auto !== null && !sc.pending ? ` · ${esc(t('suggested'))}: ${badge(auto ? 'PASS' : 'FAIL', t(auto ? 'pass' : 'fail'))}` : ''}`;
      if (canGrade && auto !== null && !sc.pending && x.status !== 'graded' && !d.querySelector('[name=rp]:checked')) d.querySelector(`[name=rp][value="${auto ? 1 : 0}"]`).checked = true; };
    d.addEventListener('input', upd); upd();
  }, buttons: [...extraButtons, { label: t('close'), cls: 'ghost', id: 'x' }, ...(canGrade ? [{ label: t('saveResult'), id: 'ok', fn: async d => {
    const sc = S.testScore(x.qs, x.answers, marks); if (sc.pending) { $('#re', d).textContent = t('openToMark', sc.pending); return false; }
    const r = d.querySelector('[name=rp]:checked'); if (!r) { $('#re', d).textContent = t('chooseResult'); return false; }
    try { await save({ marks, passed: r.value === '1', note: $('#rn', d).value }); return true; } catch (/** @type {any} */ e) { $('#re', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] : [])] });
}

/* rows: [{ id, name, company, attAt }] ; save(body) -> Promise */
/* Toolbox talk: the trainer fills it in and saves = opens it for the candidates, who sign it in their portal (date and time);
   the trainer signs last (onSign). rows: [{ id, name, company, attAt, ack (time the candidate signed) }] */
/** @param {any} o */
export function tbtDlg({ session, blank, tbt = /** @type {any} */ ({}), rows, trainer, info, assets, sign, canEdit, save, onSign }) {
  const html = `<div class="fg"><label class="full req">${esc(t('tbtTopic'))}<input id="tt" value="${esc(tbt.topic || '')}" maxlength="300" ${canEdit ? '' : 'disabled'}></label>
    <label>${esc(t('company'))}<input id="tc" value="${esc(tbt.company || '')}" maxlength="160" ${canEdit ? '' : 'disabled'}></label><label>${esc(t('tbtTalkBy'))}<input id="tk" value="${esc(tbt.talkBy || trainer || '')}" maxlength="120" ${canEdit ? '' : 'disabled'}></label>
    <label>${esc(t('date'))}<input id="td" type="date" value="${esc(tbt.date || session.date)}" ${canEdit ? '' : 'disabled'}></label><label>${esc(t('location'))}<input id="tl" value="${esc(tbt.location || session.location || '')}" maxlength="160" ${canEdit ? '' : 'disabled'}></label>
    <label class="full">${esc(t('tbtNotes'))} <span class="mute">(${esc(t('optional'))})</span><textarea id="tn" rows="3" maxlength="2000" ${canEdit ? '' : 'disabled'}>${esc(tbt.notes || '')}</textarea></label></div>
    <div class="tw"><table><thead><tr><th>#</th><th>${esc(t('fullName'))}</th><th>${esc(t('company'))}</th><th>${esc(t('tbtTrade'))}</th><th>${esc(t('tbtSignedAt'))}</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.company || '')}</td><td><input data-trade="${esc(r.id)}" value="${esc(tbt.trades?.[r.id] || '')}" maxlength="80" style="min-width:120px" ${canEdit ? '' : 'disabled'}></td><td>${r.ack ? badge('PASS', '✍ ' + S.fmtDateTime(r.ack)) : !r.attAt ? badge('', t('notConfirmed')) : badge('PENDING', t('tbtWaiting'))}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">${esc(tbt.open ? t('tbtOpenHint', rows.filter(r => r.ack).length, rows.filter(r => r.attAt).length) : t('tbtSaveOpens'))}</p>
    ${sign ? `<p class="sm" style="color:var(--ok)">✔ ${esc(t('signedBy'))} ${esc(sign.name)} · ${esc(S.fmtDateTime(sign.at))} · <span class="mono">${esc(sign.code)}</span></p>` : tbt.topic ? `<p class="sm mute">${esc(t('tbtNotSigned'))}</p>` : ''}<div class="err" id="te" role="alert"></div>`;
  const collect = d => ({ topic: $('#tt', d).value.trim(), company: $('#tc', d).value, talkBy: $('#tk', d).value, date: $('#td', d).value, location: $('#tl', d).value, notes: $('#tn', d).value, trades: Object.fromEntries($$('[data-trade]', d).map(i => [i.dataset.trade, i.value])) });
  const doc = d => F.tbtHtml({ session, blank, tbt: d ? collect(d) : tbt, rows: rows.map(r => ({ ...r, trade: (d ? collect(d).trades : tbt.trades || {})[r.id] || '' })), trainer, info, assets, sign });
  return openModal({ title: t('toolboxTalk'), wide: true, html, buttons: [{ label: '🖨 ' + t('print'), cls: 'ghost', fn: async d => { await printHtml(canEdit ? doc(d) : doc(), t('toolboxTalk')); return false; } },
    { label: t('close'), cls: 'ghost', id: 'x' }, ...(onSign && tbt.open ? [{ label: '✍ ' + (sign ? t('signAgain') : t('tbtSignTrainer')), cls: 'ghost', fn: async d => { try { await onSign(); return true; } catch (/** @type {any} */ e) { $('#te', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] : []),
    ...(canEdit ? [{ label: tbt.open ? t('save') : t('tbtOpenForSigning'), id: 'ok', fn: async d => { const b = collect(d); if (!b.topic) { $('#te', d).textContent = t('needTopic'); return false; } try { await save(b); return true; } catch (/** @type {any} */ e) { $('#te', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] : [])] });
}

/* The approval countersignature (approver / superadmin), printed at the end of a document. */
export function withAppr(html, sg) {
  if (!sg) return html;
  const blk = `<div class="esb" style="margin-top:10px;border-color:#1f6f43;background:#f2faf5">${sg.mode === 'image' && sg.img ? `<img src="/api/asset/${esc(sg.img)}" alt="" style="height:42px;display:block;margin-bottom:4px">` : ''}✔ <b>Təsdiq edilib / Approved</b> — ${esignLine(sg)}</div>`;
  const i = html.lastIndexOf('</div>'); return i < 0 ? html + blk : html.slice(0, i) + blk + html.slice(i);
}
/* Every document of a session, as { key, doc, tid, name, file, html() } — used for the ZIP, previews and approval signing.
   D = { session, blank, sheet, trainer, info, assets, signs, examLabel, people: [{ id, az, en, att, company, enr }] } */
export function sessionDocList(D) {
  const s = D.session, base = { session: s, blank: D.blank, trainer: D.trainer, info: D.info, assets: D.assets }, A = D.signs?.appr || {};
  const nm = p => p.az || p.en, fn = p => `${p.att}_${fileName(p.en || p.az)}`, out = [];
  // doc: set only for the documents an approver countersigns (practical, declaration of health, test sheet)
  const add = (doc, p, name, file, make) => out.push({ key: doc + '|' + (p?.id || '-'), doc: ['prac', 'doh', 'test'].includes(doc) ? doc : '', tid: p?.id || '', person: p ? nm(p) : '', name, file,
    html: () => withAppr(make(), p ? A[doc]?.[p.id] : A[doc]), appr: p ? A[doc]?.[p.id] || null : A[doc] || null });
  add('att', null, t('attSheet'), '01_Attendance_sheet.pdf', () => attendanceHtml({ ...base, rows: D.people.map(p => ({ az: p.foreign ? '' : p.az, en: p.en, att: p.att, company: p.company, attAt: p.enr.att, by: p.enr.attBy, days: p.enr.days })), sign: true, esign: D.signs?.att, esignDays: D.signs?.attDays || {} }));
  add('ev', null, t('trainerEvalDoc'), '02_Trainer_evaluation.pdf', () => F.trainerEvalHtml({ ...base, rows: D.people.map(p => ({ name: nm(p), att: p.att, company: p.company, ev: p.enr.ev })), sign: D.signs?.ev }));
  add('fb', null, t('feedbackSummaryDoc'), '03_Training_evaluation/00_Summary.pdf', () => F.feedbackSummaryHtml({ ...base, rows: D.people.map(p => ({ name: nm(p), att: p.att, fb: p.enr.fb })) }));
  for (const p of D.people) if (p.enr.fb) out.push({ key: 'fbp|' + p.id, doc: '', tid: p.id, person: nm(p), name: t('feedbackTitle'), file: `03_Training_evaluation/${fn(p)}.pdf`, html: () => F.feedbackHtml({ ...base, person: p, fb: p.enr.fb, sign: D.signs?.fb?.[p.id] }), appr: null });
  if (D.sheet) for (const p of D.people) if (p.enr.prac) add('prac', p, D.sheet.name || t('practical'), `04_Practical_sheets/${fn(p)}.pdf`, () => practicalHtml({ ...base, sheet: D.sheet, prac: p.enr.prac, candidate: { az: nm(p), en: p.en, att: p.att }, company: p.company, exam: p.enr.exam, signs: D.signs?.prac?.[p.id] || {} }));
  out.push({ key: 'exam|-', doc: '', tid: '', person: '', name: t('examResultsDoc'), file: '05_Exam/00_Results.pdf', html: () => F.examResultsHtml({ ...base, mode: D.examLabel || '', rows: D.people.map(p => ({ name: nm(p), att: p.att, company: p.company, exam: p.enr.exam, test: p.enr.test })), sign: D.signs?.exam }), appr: null });
  for (const p of D.people) if (p.enr.test?.at) add('test', p, t('testSheetDoc'), `05_Exam/${fn(p)}.pdf`, () => F.testSheetHtml({ ...base, person: p, company: p.company, test: p.enr.test, sign: D.signs?.test?.[p.id] }));
  if (D.sheet) {
    for (const p of D.people) if (p.enr.doh) add('doh', p, t('dohTitle'), `06_Declarations_of_health/${fn(p)}.pdf`, () => F.dohHtml({ ...base, person: p, company: p.company, doh: p.enr.doh, sign: D.signs?.doh?.[p.id] }));
    if (s.tbt) add('tbt', null, t('toolboxTalk'), '07_Toolbox_talk.pdf', () => F.tbtHtml({ ...base, tbt: s.tbt, rows: D.people.map(p => ({ name: nm(p), company: p.company, trade: s.tbt.trades?.[p.id] || '', attAt: p.enr.att, ack: p.enr.tbtAck?.at })), sign: D.signs?.tbt }));
  }
  return out;
}
export async function sessionZip(D, onStep) {
  const zip = new window.JSZip(), jobs = sessionDocList(D);
  for (const [i, j] of jobs.entries()) { onStep?.(i + 1, jobs.length, j.file); zip.file(j.file, await htmlToPdf(j.html())); }
  return zip.generateAsync({ type: 'blob' });
}
export const zipName = (s, blank) => `${s.date}_${fileName(blank?.name || 'session')}_documents.zip`;

/* day-by-day attendance of one candidate in a multi-day session: ✓ present, ✗ absent, · not marked yet */
export function dayStrip(session, days) {
  const list = S.sessionDays(session); if (list.length < 2) return '';
  return `<div class="xs" style="margin-top:3px;letter-spacing:1px" aria-label="${esc(t('attDays'))}">${list.map((d, i) => { const m = days?.[d]; return `<span title="${esc(t('dayN', i + 1))} · ${esc(S.fmtDate(d))}: ${esc(m?.absent ? t('absent') : m?.at ? t('present') : t('dayNotMarked'))}" style="color:${m?.absent ? 'var(--bad)' : m?.at ? 'var(--ok)' : 'var(--mute)'}">${m?.absent ? '✗' : m?.at ? '✓' : '·'}</span>`; }).join(' ')}</div>`;
}
/* Roll call: everybody is present unless ticked "absent".
   rows: [{ id, name, att, absent, locked, days: { date: { at } | { absent } } }]; days: the session's days (several for a multi-day training)
   save(absentIds, day) -> { present, absent } */
export function rollCallDlg({ rows, save, days = /** @type {any[]} */ ([]), today = new Date().toISOString().slice(0, 10) }) {
  const multi = days.length > 1, open = days.filter(d => d <= today);
  let day = multi ? (open.includes(today) ? today : open[open.length - 1]) : '';
  const isAbs = r => (multi ? !!r.days?.[day]?.absent : r.absent), marked = r => (multi ? !!(r.days?.[day]?.absent || r.days?.[day]?.at) : true);
  const body = () => `${multi ? `<div class="row" style="gap:6px;align-items:center;margin-bottom:8px"><b class="sm">${esc(t('rollDay'))}:</b><div class="seg">${days.map((d, i) => `<button type="button" data-day="${d}" class="${d === day ? 'on' : ''}" ${d > today ? 'disabled' : ''}>${esc(t('dayN', i + 1))} · ${esc(S.fmtDate(d).slice(0, 5))}</button>`).join('')}</div></div>
      <p class="hint" style="margin-top:0">${esc(t('rollDayHint'))}</p>` : ''}
    <div class="row" style="margin:-4px 0 8px"><span class="grow"></span><span class="sm"><b id="rcP">0</b> ${esc(t('present'))} · <b id="rcA">0</b> ${esc(t('absent'))}</span></div>
    <div class="tw"><table><thead><tr><th>#</th><th>${esc(t('fullName'))}</th><th>${esc(t('learnerNo'))}</th>${multi ? `<th>${esc(t('attDays'))}</th>` : ''}<th class="c">${esc(t('absent'))}</th></tr></thead><tbody>
    ${rows.map((r, i) => { const lock = !multi && r.locked; return `<tr><td>${i + 1}</td><td><b>${esc(r.name)}</b>${lock ? `<br><span class="xs mute">${esc(t('hasResultsPresent'))}</span>` : ''}${multi && !marked(r) ? `<br><span class="xs mute">${esc(t('dayNotMarked'))}</span>` : ''}</td><td class="mono">${esc(r.att || '')}</td>
      ${multi ? `<td class="nowrap">${days.map(d => { const m = r.days?.[d]; return `<span title="${esc(S.fmtDate(d))}" style="display:inline-block;width:20px;text-align:center;${d === day ? 'outline:1px solid var(--brand);border-radius:4px' : ''}">${m?.absent ? '✗' : m?.at ? '✓' : '·'}</span>`; }).join('')}</td>` : ''}
      <td class="c"><label class="chk" style="justify-content:center;margin:0"><input type="checkbox" data-ab="${esc(r.id)}" ${isAbs(r) ? 'checked' : ''} ${lock ? 'disabled' : ''} aria-label="${esc(t('absent'))} ${esc(r.name)}"></label></td></tr>`; }).join('')}</tbody></table></div><div class="err" id="rce" role="alert"></div>`;
  return openModal({ title: t('rollCall'), wide: true, html: `<p class="hint">${esc(t('rollCallHint'))}</p><div id="rcb">${body()}</div>`,
    onMount: d => { const cnt = () => { const a = $$('[data-ab]', d).filter(x => x.checked).length; $('#rcA', d).textContent = a; $('#rcP', d).textContent = rows.length - a; };
      d.addEventListener('change', cnt); d.addEventListener('click', e => { const b = e.target.closest('[data-day]'); if (b && !b.disabled) { day = b.dataset.day; $('#rcb', d).innerHTML = body(); cnt(); } }); cnt(); },
    buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: '✔ ' + t('confirmAttendance'), cls: 'ok', id: 'ok', fn: async d => {
      try { const r = await save($$('[data-ab]', d).filter(x => x.checked).map(x => x.dataset.ab), day); toast((multi ? t('dayN', days.indexOf(r.day || day) + 1) + ': ' : '') + t('rollCallSaved', r.present, r.absent), 'ok'); return true; }
      catch (/** @type {any} */ e) { $('#rce', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] });
}
