/* Library -> Blank forms: every training document unfilled, to see, print or keep as PDF (paper back-up, checking the layout). */
import { A, view, esc, t, pageHead, info, S } from './lib.js';
import { attendanceHtml, practicalHtml } from '../cert.js';
import { dohHtml, tbtHtml, trainerEvalHtml, feedbackHtml, examResultsHtml } from '../forms.js';
import { previewDoc } from '../sessiondocs.js';

const ROWS = 15, rows = () => Array.from({ length: ROWS }, () => ({ name: '', az: '', en: '', att: '', company: ' ' }));
const clean = html => html.replaceAll('>—<', '><').replaceAll('>— / 10<', '> / 10<');   // no dashes in the empty boxes
export const BLANK_FORMS = () => {
  const session = { date: '', location: '' }, i = info(), as = A.assets, base = { session, blank: null, info: i, assets: as };
  return [
    { id: 'att', name: t('attSheet'), html: () => clean(attendanceHtml({ ...base, trainer: '', rows: rows() })) },
    { id: 'attDays', name: t('attSheet') + ' — ' + t('multiDayShort'), html: () => clean(attendanceHtml({ ...base, session: { date: '2026-01-01', endDate: '2026-01-03' }, trainer: '', rows: rows() }).replace(/<span style="font-weight:400">[^<]*<\/span>/g, '')) },
    { id: 'tbt', name: t('toolboxTalk'), html: () => clean(tbtHtml({ ...base, tbt: {}, rows: [] })) },
    { id: 'doh', name: t('dohTitle'), html: () => clean(dohHtml({ ...base, person: {}, doh: null })) },
    { id: 'ev', name: t('trainerEval'), html: () => clean(trainerEvalHtml({ ...base, rows: rows() })) },
    { id: 'fb', name: t('trainingEvaluation'), html: () => clean(feedbackHtml({ ...base, person: {}, fb: null })) },
    { id: 'exam', name: t('examResults'), html: () => clean(examResultsHtml({ ...base, rows: rows() })) },
    ...(A.sheets || []).map(sh => ({ id: 'prac-' + sh.id, name: t('practicalSheet') + ': ' + sh.name, html: () => clean(practicalHtml({ sheet: sh, prac: null, candidate: '', session, blank: null, info: i, assets: as })) })),
  ];
};

export default async function () {
  const el = view(), list = BLANK_FORMS();
  el.innerHTML = pageHead(t('navForms')) + `<div class="banner">${esc(t('formsIntro'))}</div>
    <div class="grid g3">${list.map(f => `<button class="card bcard" data-f="${esc(f.id)}" style="text-align:left;cursor:pointer"><b>📄 ${esc(f.name)}</b><div class="mute xs" style="margin-top:4px">${esc(t('formsOpen'))}</div></button>`).join('')}</div>`;
  el.onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; const f = list.find(x => x.id === b.dataset.f); previewDoc({ title: f.name, html: f.html(), file: S.loginSlug(f.name) || 'form' }); };
}
