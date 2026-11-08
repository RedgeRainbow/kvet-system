/* Printable session forms: declaration of health (KLN-A-006), toolbox talk (KLN-HS-001), trainer evaluation,
   training evaluation (trainee feedback), test answer sheets and the session's exam results.
   Same frame as the practical sheets: logo | title | address, footer with the web site and the form number. */
import { fmtDate, fmtDateTime, DOH_Q, FB_GROUPS, testScore, optList } from './shared.js';
import { esc } from './ui.js';
import { DICT } from './dict.js';
import { logoSrc, esignLine } from './cert.js';
export { FORMS_CSS } from './forms-css.js';


/* "Azərbaycanca / English" for printed forms */
export const bi = k => (DICT[k] ? `${DICT[k][0]} / ${DICT[k][1]}` : k);
const head = (title, info, assets) => `<div class="fh"><img src="${esc(logoSrc(assets))}" alt=""><div class="tt">${title}</div><div class="ad">${[info.address, info.phone && 'Tel.: ' + info.phone, info.email && 'e-mail: ' + info.email].filter(Boolean).map(esc).join('<br>')}</div></div>`;
const foot = (info, code) => `<div class="ftr"><span class="w">${esc(info.website || '')}</span><span>${esc(code || '')}</span></div>`;
const es = sg => (sg ? `<div class="es">✔ ${esignLine(sg)}</div>` : '');
const nameOf = p => p.az || p.en || '';

/* ---------------------------------------------------- declaration of health */
export function dohHtml({ session, blank, person, company = '', doh, info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}), sign = /** @type {any} */ (null) }) {
  const a = doh?.answers || {}, paper = doh?.paper;
  const yn = k => `<td class="yn">${!paper && a[k] === 'Y' ? '✓' : ''}</td><td class="yn">${!paper && a[k] === 'N' ? '✓' : ''}</td>`;
  return `<div class="doc sheet fm">${head('Declaration of Health /<br>Sağlamlıq Haqqında Bəyannamə', info, assets)}
  <table><tr><td class="k" style="width:17%">Training name:/<br>Təlimin adı</td><td style="width:33%">${esc(blank?.name || '')}</td><td class="k" style="width:17%">Participant Full Name:<br>/İştirakçının adı və soyadı</td><td>${esc(nameOf(person))}${person.att ? `<br><span style="color:#555">${esc(person.att)}</span>` : ''}</td></tr>
   <tr><td class="k">Date of Birth/<br>Doğum tarixi</td><td>${esc(doh?.dob ? fmtDate(doh.dob) : '')}</td><td class="k">Company: /Şirkət adı</td><td>${esc(doh?.company || company || '')}</td></tr></table>
  <p class="it" style="margin-top:12px">This medical questionnaire is compulsory to complete for all training courses whether it involves physical exertion or not. / <i>Bu tibbi sorğu anketi fiziki güc istifadə edilib edilməməsindən asılı olmayaraq bütün təlim kursları üçün doldurulması məcburidir.</i></p>
  <p class="it">Answering ‘YES’ to any of the questions does not necessarily mean that you will not be permitted to take part in the training course but may require a doctor’s certificate to prove ability to operate certain types of machinery. / <i>Hər hansı bir suala Bəli cavabı vermək sizin kursa qeydiyyatınıza maneə olmayacaq. Lakin sizin bəzi mexanizmləri idarə edə biləcəyinizi göstərən həkim arayışı istənilə bilər.</i></p>
  <p class="it">It is important that you answer the questions honestly. Should you become ill or injured during the training course, medical treatment may be administered by a third party and they will need to be informed of any existing medical problems or of any medication you may be taking. / <i>Sualları dürüstlüklə cavablandırmağınız çox vacibdir. Təlim kursu ərzində xəstələnmə və ya yaralanma halında tibbi yardım göstərəcək üçüncü şəxslərə hər hansı tibbi probleminiz və ya qəbul etdiyiniz dərmanlar barədə məlumat veriləcək.</i></p>
  <p class="it">This information is confidential but must be recorded on this form. / <i>Bu məlumatlar məxfi saxlanılır, lakin bu formada qeyd edilməlidir.</i></p>
  <p class="it">Do you currently suffer from or have you ever suffered from the following ailments? / <i>Hal-hazırda və ya keçmişdə bu xəstəliklərdən əziyyət çəkmisinizmi?</i></p>
  <table class="q"><tr><td style="border-left:0;border-top:0"></td><td class="yn">Yes /Bəli</td><td class="yn">No / Xeyr</td></tr>
   ${DOH_Q.map(([k, az, en]) => `<tr><td><i>${esc(en)}</i> / ${esc(az)}</td>${yn(k)}</tr>`).join('')}</table>
  <p class="it" style="margin-top:10px">*If you have answered ‘YES’ to any of the above, please provide brief details in the box below. / <i>Yuxarıdakı suallardan hər hansı birinə Bəli cavabı verdinizsə, zəhmət olmasa qısa məlumat verin.</i></p>
  <div class="dbox">${esc(paper ? '' : doh?.details || '')}</div>
  <p class="it">By signing the declaration, I hereby declare I understand the questions presented above and have answered truthfully and accurately. I further understand that the training centre will not allow my participation on the training course if the instructor believes I am under the influence of alcohol or drugs or am in any way impaired to carry out the training. / <i>Bu bəyanata imza atmaqla yuxarıdakı sualları anladığımı və tam doğruluqla cavablandırdığımı bəyan edirəm. Təlimçi spirtli içki və ya narkotik maddə təsiri altında olduğumu və ya təlimi davam etdirə bilməyəcəyim hər hansı vəziyyətdə olduğumu düşünərsə, təlim kursunda iştirakıma icazə verilməyəcəyini anlayıram.</i></p>
  <div class="sline"><div>Participant signature: / İştirakçının imzası <span class="u">${sign ? '✔ e-imza / e-signed' : ''}</span></div><div>Date: / Tarix <span class="u">${esc(doh?.at && !paper ? fmtDate(doh.at.slice(0, 10)) : '')}</span></div></div>
  ${sign ? `<div class="esb">✔ ${esignLine(sign)}</div>` : paper ? `<div class="esb" style="border-color:#bbb;background:#fafafa;color:#333">${esc(bi('dohPaperNote'))}: ${esc(fmtDateTime(doh.at))} · ${esc(doh.by || '')}</div>` : ''}
  ${foot(info, 'KLN-A-006 rev 01')}</div>`;
}

/* ------------------------------------------------------------ toolbox talk */
/* rows: [{ name, company, trade, attAt }] */
export function tbtHtml({ session, blank, tbt = /** @type {any} */ ({}), rows = /** @type {any[]} */ ([]), trainer = '', info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}), sign = /** @type {any} */ (null) }) {
  const n = Math.max(20, rows.length);
  return `<div class="doc sheet fm">${head('Toolbox Talk', info, assets)}
  <table><tr><td colspan="4" style="height:30px"><b>${esc(tbt.topic || '')}</b>${blank?.name ? `<span style="float:right;color:#555">${esc(blank.name)}</span>` : ''}</td></tr>
   <tr><td class="k r">Company:</td><td style="width:32%">${esc(tbt.company || '')}</td><td class="k r">Talk by:</td><td>${esc(tbt.talkBy || trainer)}</td></tr>
   <tr><td class="k r">Date:</td><td>${esc(fmtDate(tbt.date || session.date))}</td><td class="k r">Signature:</td><td>${es(sign)}</td></tr>
   <tr><td class="k r">Location:</td><td>${esc(tbt.location || session.location || '')}</td><td class="k"></td><td></td></tr></table>
  ${tbt.notes ? `<div class="dbox" style="margin-top:10px">${esc(tbt.notes)}</div>` : '<div style="height:14px"></div>'}
  <table class="tbt"><tr><th class="c"></th><th class="c">Name</th><th class="c">Company</th><th class="c">Trade</th><th class="c">Signature</th></tr>
   ${Array.from({ length: n }, (_, i) => { const r = rows[i]; return `<tr><td class="n">${i + 1}</td><td>${esc(r?.name || '')}</td><td>${esc(r?.company || '')}</td><td>${esc(r?.trade || '')}</td><td style="width:22%;font-size:9.5px;color:#1d4e2f">${r?.ack ? '✍ ' + esc(fmtDateTime(r.ack)) : ''}</td></tr>`; }).join('')}</table>
  ${rows.some(r => r.ack) ? `<p style="font-size:9.5px;color:#555;margin:6px 0 0">✍ = ${esc(bi('tbtSignedNote'))}</p>` : ''}
  ${foot(info, 'KLN-HS-001 rev 01')}</div>`;
}

/* -------------------------------------------------------- trainer evaluation */
/* rows: [{ name, att, company, ev }] */
export function trainerEvalHtml({ session, blank, trainer = '', rows = /** @type {any[]} */ ([]), info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}), sign = /** @type {any} */ (null) }) {
  const stars = n => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));
  const lbl = (p, k) => (k ? bi(p + k) : '—');
  return `<div class="doc sheet fm">${head(bi('trainerEval'), info, assets)}
  <table><tr><td class="k">${esc(bi('training'))}</td><td>${esc(blank?.name || '')}</td><td class="k">${esc(bi('trainer'))}</td><td>${esc(trainer)}</td></tr>
   <tr><td class="k">${esc(bi('date'))}</td><td>${esc(fmtDate(session.date))}${session.endDate ? ' – ' + esc(fmtDate(session.endDate)) : ''}</td><td class="k">${esc(bi('location'))}</td><td>${esc(session.location || '')}</td></tr></table>
  <table style="margin-top:14px"><tr><th class="c" style="width:26px">#</th><th>${esc(bi('fullName'))}</th><th>${esc(bi('behavior'))}</th><th>${esc(bi('punctuality'))}</th><th>${esc(bi('engagement'))}</th><th>${esc(bi('comment'))}</th></tr>
   ${rows.map((r, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(r.name)}</b><br><span style="color:#555">${esc(r.att || '')}${r.company ? ' · ' + esc(r.company) : ''}</span></td><td>${esc(lbl('beh_', r.ev?.behavior))}</td><td>${esc(lbl('pun_', r.ev?.punctuality))}</td><td style="white-space:nowrap;color:#b7791f">${r.ev ? stars(r.ev.engagement) : '—'}</td><td>${esc(r.ev?.comment || '')}</td></tr>`).join('')}</table>
  ${sign ? `<div class="esb">✔ ${esignLine(sign)}</div>` : `<table style="margin-top:22px;width:60%"><tr><td class="k">${esc(bi('trainer'))}</td><td>${esc(trainer)}</td><td class="k">${esc(bi('signature'))}</td><td style="width:30%"></td></tr></table>`}
  ${foot(info, '')}</div>`;
}

/* ------------------------------------------------ training evaluation (trainee feedback) */
/* summary of all trainees + one page per trainee */
export function feedbackSummaryHtml({ session, blank, trainer = '', rows = /** @type {any[]} */ ([]), info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}) }) {
  const done = rows.filter(r => r.fb), avg = g => (done.length ? (done.reduce((s, r) => s + (r.fb.r[g] || 0), 0) / done.length).toFixed(1) : '—');
  return `<div class="doc sheet fm">${head(bi('trainingEvaluation'), info, assets)}
  <table><tr><td class="k">${esc(bi('training'))}</td><td>${esc(blank?.name || '')}</td><td class="k">${esc(bi('trainer'))}</td><td>${esc(trainer)}</td></tr>
   <tr><td class="k">${esc(bi('date'))}</td><td>${esc(fmtDate(session.date))}</td><td class="k">${esc(bi('feedbackDone'))}</td><td>${done.length} / ${rows.length}</td></tr></table>
  <table style="margin-top:14px"><tr><th>${esc(bi('fullName'))}</th>${FB_GROUPS.map(g => `<th class="c" style="font-size:9.5px">${esc(DICT[g]?.[1] || g)}</th>`).join('')}</tr>
   ${rows.map(r => `<tr><td>${esc(r.name)}<br><span style="color:#555">${esc(r.att || '')}</span></td>${FB_GROUPS.map(g => `<td class="c">${r.fb ? r.fb.r[g] + '/10' : '—'}</td>`).join('')}</tr>`).join('')}
   <tr><td class="k">${esc(bi('average'))}</td>${FB_GROUPS.map(g => `<td class="c"><b>${avg(g)}</b></td>`).join('')}</tr></table>
  ${foot(info, '')}</div>`;
}
/** @param {any} o0 */
export function feedbackHtml({ session, blank, trainer = '', person, fb, info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}), sign = /** @type {any} */ (null) }) {
  return `<div class="doc sheet fm">${head(bi('trainingEvaluation'), info, assets)}
  <table><tr><td class="k">${esc(bi('training'))}</td><td>${esc(blank?.name || '')}</td><td class="k">${esc(bi('fullName'))}</td><td>${esc(nameOf(person))}<br><span style="color:#555">${esc(person.att || '')}</span></td></tr>
   <tr><td class="k">${esc(bi('date'))}</td><td>${esc(fmtDate(session.date))}</td><td class="k">${esc(bi('trainer'))}</td><td>${esc(trainer)}</td></tr></table>
  ${FB_GROUPS.map(g => `<table style="margin-top:10px"><tr><th>${esc(bi(g))}</th><th class="c" style="width:70px">${fb ? fb.r[g] + ' / 10' : '— / 10'}</th></tr>
    <tr><td colspan="2" style="color:#444;font-size:10px">${esc(DICT[g + 'h']?.[1] || '')}</td></tr><tr><td colspan="2" style="height:34px;white-space:pre-wrap">${esc(fb?.cm?.[g] || '')}</td></tr></table>`).join('')}
  ${sign ? `<div class="esb">✔ ${esignLine(sign)}</div>` : fb ? `<p style="font-size:10px;color:#555;margin-top:8px">${esc(bi('submittedOnline'))}: ${esc(fmtDateTime(fb.at))}</p>` : `<table style="margin-top:16px;width:60%"><tr><td class="k">${esc(bi('participant'))}</td><td></td><td class="k">${esc(bi('signature'))}</td><td style="width:30%"></td></tr></table>`}
  ${foot(info, '')}</div>`;
}

/* ------------------------------------------------------------ test sheets */
const resultTxt = (passed, pct) => (passed === true ? `<span class="ok">PASS</span>` : passed === false ? `<span class="warn">FAIL</span>` : '—') + (pct !== undefined && pct !== null ? ` · ${pct}%` : '');
/** @param {any} o0 */
export function testSheetHtml({ session, blank, person, company = '', test, info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}), sign = /** @type {any} */ (null) }) {
  const x = test, marks = x.marks || {}, sc = testScore(x.qs, x.answers, marks);
  const L = 'ABCDEFGHIJ';
  return `<div class="doc sheet fm">${head(esc(x.title || blank?.name || '') + '<br><span style="font-size:13px;font-weight:600">' + esc(bi('testAnswers')) + '</span>', info, assets)}
  <table><tr><td class="k">${esc(bi('fullName'))}</td><td>${esc(nameOf(person))} <span style="color:#555">${esc(person.att || '')}</span></td><td class="k">${esc(bi('company'))}</td><td>${esc(company)}</td></tr>
   <tr><td class="k">${esc(bi('started'))}</td><td>${esc(fmtDateTime(x.startedAt))}</td><td class="k">${esc(bi('submitted'))}</td><td>${esc(fmtDateTime(x.at))}${x.late ? ' <span class="warn">(late)</span>' : ''}</td></tr>
   <tr><td class="k">${esc(bi('score'))}</td><td>${x.status === 'graded' ? `${x.score} / ${x.max}` : `${sc.score} / ${sc.max} (${esc(bi('testInReview'))})`}</td><td class="k">${esc(bi('result'))}</td><td>${x.status === 'graded' ? resultTxt(x.passed, x.pct) : '—'}</td></tr></table>
  <div style="height:10px"></div>
  ${x.qs.map((q, i) => { const a = x.answers?.[q.id];
    return `<div class="qa"><div class="qt">${i + 1}. ${esc(q.text)} <span style="float:right;font-weight:400">${q.points} ${esc(bi('pts'))}</span></div>${q.img ? `<img src="/api/qimg/${esc(q.img)}" alt="" style="max-width:60%;max-height:200px;margin:4px 0;display:block">` : ''}${q.kind === 'open' ? `<div class="open">${esc(a || '—')}</div><div class="mk">${esc(bi('marks'))}: <b>${marks[q.id] ?? '—'}</b> / ${q.points}</div>`
      : `<ol type="A">${optList(q).map(o => `<li class="${o.id === q.correct ? 'right' : a === o.id ? 'wrong' : ''}">${esc(o.text)}${a === o.id ? ' ◀' : ''}</li>`).join('')}</ol>${a === undefined ? `<div class="mk warn">${esc(bi('notAnswered'))}</div>` : ''}`}</div>`; }).join('')}
  ${x.note ? `<div class="dbox">${esc(x.note)}</div>` : ''}${x.gradedBy && x.gradedBy !== 'auto' ? `<p style="font-size:10.5px">${esc(bi('gradedBy'))}: <b>${esc(x.gradedBy)}</b> · ${esc(fmtDateTime(x.gradedAt))}</p>` : x.gradedBy === 'auto' ? `<p style="font-size:10.5px">${esc(bi('gradedAuto'))}</p>` : ''}
  ${sign ? `<div class="esb">✔ ${esignLine(sign)}</div>` : ''}${foot(info, '')}</div>`;
}
/* rows: [{ name, att, company, exam, test }] */
export function examResultsHtml({ session, blank, trainer = '', rows = /** @type {any[]} */ ([]), info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}), mode = '', sign = /** @type {any} */ (null) }) {
  const how = r => (r.test ? (r.test.gradedBy === 'auto' ? bi('gradedAuto') : r.test.gradedBy ? bi('reviewed') + ': ' + r.test.gradedBy : bi('testInReview')) : r.exam ? (r.exam.note || '') : '');
  return `<div class="doc sheet fm">${head(bi('examResults'), info, assets)}
  <table><tr><td class="k">${esc(bi('training'))}</td><td>${esc(blank?.name || '')}</td><td class="k">${esc(bi('trainer'))}</td><td>${esc(trainer)}</td></tr>
   <tr><td class="k">${esc(bi('date'))}</td><td>${esc(fmtDate(session.date))}</td><td class="k">${esc(bi('exam'))}</td><td>${esc(mode)}</td></tr></table>
  <table style="margin-top:14px"><tr><th class="c" style="width:26px">#</th><th>${esc(bi('fullName'))}</th><th>${esc(bi('learnerNo'))}</th><th class="c">${esc(bi('score'))}</th><th class="c">${esc(bi('result'))}</th><th>${esc(bi('note'))}</th></tr>
   ${rows.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${esc(r.name)}${r.company ? `<br><span style="color:#555">${esc(r.company)}</span>` : ''}</td><td>${esc(r.att || '')}</td><td class="c">${r.exam?.score ?? (r.test?.status === 'review' ? '…' : '—')}</td><td class="c">${r.exam ? resultTxt(r.exam.passed) : '—'}</td><td style="font-size:10px">${esc(how(r))}</td></tr>`).join('')}</table>
  ${sign ? `<div class="esb">✔ ${esignLine(sign)}</div>` : `<table style="margin-top:22px;width:60%"><tr><td class="k">${esc(bi('trainer'))}</td><td>${esc(trainer)}</td><td class="k">${esc(bi('signature'))}</td><td style="width:30%"></td></tr></table>`}
  ${foot(info, '')}</div>`;
}
