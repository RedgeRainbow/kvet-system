/* Question bank: tests per training. Multiple-choice questions (one correct answer) and open questions,
   pass rate (automatic marking) or "needs review" (trainer / admin / superadmin decide). Import from pasted text or Excel. */
import { loadUsage, A, can, view, api, S, $, $$, esc, t, toast, fail, openModal, confirmDlg, empty, badge, opts, matches, pageHead, bar, searchBox, load, printHtml, blank, paged, onPage } from './lib.js';
import { testEditor } from '../testeditor.js';
import { testSheetHtml } from '../forms.js';

const L = 'ABCDEFGHIJ';
const nid = () => 'q' + Math.random().toString(36).slice(2, 8);

export default async function ({ args, rerender }) {
  const el = view(); let q = '', fb = args[0] || '';
  await loadUsage().catch(() => {}); const used = id => A.usage?.tests?.[id] || 0;
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const list = (A.tests || []).filter(x => (!fb || x.bid === fb) && matches(q, x.title, blank(x.bid)?.name)); const P = paged('tests', list, JSON.stringify([fb, q])); onPage('tests', draw);
    el.innerHTML = pageHead(t('navTests'), can('test.save') ? `<label class="btn ghost" style="margin:0">⬆ ${esc(t('importSiteFile'))}<input type="file" id="isf" accept=".json,application/json" hidden></label><button class="btn" id="add">＋ ${esc(t('newTest'))}</button>` : '') + `<p class="mute" style="margin-top:-8px">${esc(t('testsIntro'))}</p>`
      + bar(searchBox('q', q), `<select id="fb" aria-label="${esc(t('training'))}">${opts(A.blanks.map(b => [b.id, b.name]), fb, t('allTrainings'))}</select>`)
      + (list.length ? `<div class="grid g3">${P.rows.map(x => { const nOpen = x.questions.filter(k => k.kind === 'open').length; return `<div class="card bcard" data-id="${esc(x.id)}" tabindex="0" role="button"><div class="tt">${esc(x.title)}</div>${x.bid ? `<div class="mute sm">🔗 ${esc(blank(x.bid)?.name || '')}</div>` : ''}
        <div class="meta">${badge('info', t('nQuestions', x.questions.length))}${nOpen ? badge('', t('nOpen', nOpen)) : ''}${x.grading === 'review' ? badge('PENDING', t('gradingReview')) : badge('PASS', t('passRateN', x.passRate))}${x.timeLimit ? badge('', '⏱ ' + t('minutesN', x.timeLimit)) : ''}${perAttempt(x) ? badge('', '🎲 ' + t('perAttemptN', perAttempt(x))) : ''}${x.draft ? badge('FAIL', '✎ ' + t('draftN', x.questions.filter(k => k.kind === 'mc' && k.correct < 0).length)) : ''}${x.status === 'pending' ? badge('PENDING', t('awaitingApproval')) : x.status === 'returned' ? badge('FAIL', '↩ ' + t('apReturnedShort')) : ''}${x.proposal && !x.proposal.returned ? badge('info', t('changeAwaiting')) : ''}${x.owner?.kind === 'trainer' ? badge('', '👤 ' + x.owner.name) : ''}</div>
        <div class="row sm mute"><span>${esc(t('usedIn', used(x.id)))}</span><span class="grow"></span><button class="btn ghost sm" data-print="${esc(x.id)}" title="${esc(t('print'))}">🖨</button>${can('test.save') ? `<button class="btn ghost sm" data-dup="${esc(x.id)}">${esc(t('duplicate'))}</button><button class="btn bad ghost sm" data-del="${esc(x.id)}" title="${esc(t('delete'))}">🗑</button>` : ''}</div></div>`; }).join('')}</div>${P.html}`
        : `<div class="card">${empty('📝', (A.tests || []).length ? t('noMatch') : t('noTests'))}</div>`);
    $('#q').oninput = e => { q = e.target.value; const p = e.target.selectionStart; draw(); const i = $('#q'); i.focus(); i.setSelectionRange(p, p); };
    $('#fb').onchange = e => { fb = e.target.value; draw(); };
    $('#add')?.addEventListener('click', () => editor(null));
    $('#isf')?.addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; let d; try { d = JSON.parse(await f.text()); } catch { return toast(t('badFile'), 'bad'); } if (!Array.isArray(d?.sets)) return toast(t('badFile'), 'bad'); importSite(d); });
  }
  /* questions per attempt (random draw) */
  const perAttempt = x => { const by = x.pickBy || {}; if (Object.keys(by).length) { const groups = [...new Set(x.questions.map(q => q.grp || ''))]; return groups.reduce((n, g) => n + (by[g] || x.questions.filter(q => (q.grp || '') === g).length), 0); } return x.pick > 0 && x.pick < x.questions.length ? x.pick : 0; };
  draw();
  el.onclick = async e => {
    const card = e.target.closest('.bcard'), pr = e.target.closest('[data-print]'), dup = e.target.closest('[data-dup]'), del = e.target.closest('[data-del]');
    const x = id => A.tests.find(k => k.id === id);
    if (pr) { const k = x(pr.dataset.print); return printHtml(testSheetHtml({ session: { date: '' }, blank: blank(k.bid), person: { az: '', att: '' }, test: { ...k, qs: k.questions.map(p => ({ ...p, correct: null })), answers: {}, title: k.title }, info: A.settings.company || {}, assets: A.assets }).replace(/<table>[\s\S]*?<\/table>\s*<div style="height:10px"><\/div>/, `<table><tr><td class="k">Name / Ad, soyad</td><td style="height:26px"></td><td class="k">Date / Tarix</td><td></td></tr></table><div style="height:10px"></div>`), k.title); }
    if (dup) { const k = JSON.parse(JSON.stringify(x(dup.dataset.dup))); delete k.id; k.title += ' ' + t('copySuffix'); return editor(k); }
    if (del) {
      const k = x(del.dataset.del); if (used(k.id)) return toast(t('testInUse'), 'bad');
      if (!await confirmDlg(t('deleteTestConfirm', k.title), { danger: true })) return;
      try { await api('/test/delete', { kind: 'staff', body: { id: k.id } }); await load(); toast(t('deleted'), 'ok'); draw(); } catch (/** @type {any} */ er) { fail(er); } return;
    }
    if (card) editor(x(card.dataset.id));
  };
  el.onkeydown = e => { if (e.key === 'Enter' && e.target.classList.contains('bcard')) e.target.click(); };

  function editor(src) {
    return testEditor({ src, blanks: A.blanks, readOnly: !can('test.save'), defaultBid: fb, save: body => api('/test/save', { kind: 'staff', body }), onSaved: async () => { await load(); draw(); } });
  }

  /* --------------------------------------------- import an exam-az.com export (one test per question set) */
  function importSite(D) {
    const have = new Set((A.tests || []).map(x => x.source).filter(Boolean));
    const sets = D.sets.map((x, i) => ({ i, x, mc: x.mc.length, open: x.open.length, noC: x.mc.filter(q => q[2] < 0).length, img: x.mc.filter(q => q[4]).length, done: have.has('exam-az:' + x.id) }));
    const row = r => `<tr data-r="${r.i}"><td><input type="checkbox" data-on ${r.done ? '' : 'checked'} aria-label="${esc(r.x.ti)}"></td><td><b>${esc(r.x.ti)}</b>${r.done ? ` <span class="bd">${esc(t('alreadyImported'))}</span>` : ''}</td><td class="mute sm">${esc(t('importSetLine', r.mc, r.open))}${r.noC ? ` · <span style="color:var(--bad)">${esc(t('noCorrectN', r.noC))}</span>` : ''}${r.img ? ` · 🖼 ${r.img}` : ''}</td></tr>`;
    openModal({ title: t('importSiteTitle', D.sets.length), wide: true, html: `<p class="hint">${esc(t('importSiteHint'))}</p>
      <div class="row" style="align-items:center;margin-bottom:8px"><span class="grow"></span><button type="button" class="btn ghost sm" id="sa">${esc(t('selectAll'))}</button><button type="button" class="btn ghost sm" id="sn">${esc(t('clearAll'))}</button></div>
      <div class="tw" style="max-height:52vh;overflow:auto"><table><thead><tr><th></th><th>${esc(t('test'))}</th><th>${esc(t('questions'))}</th></tr></thead><tbody>${sets.map(row).join('')}</tbody></table></div><div id="ip" class="mute sm" style="margin-top:8px"></div>`,
      onMount: d => {
        $('#sa', d).onclick = () => $$('[data-on]', d).forEach(c => (c.checked = true)); $('#sn', d).onclick = () => $$('[data-on]', d).forEach(c => (c.checked = false));
      },
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: '⬆ ' + t('importSelected'), id: 'ok', fn: async (d, btn) => {
        const pickRows = $$('tr[data-r]', d).filter(tr => tr.querySelector('[data-on]').checked).map(tr => ({ r: sets[+tr.dataset.r], bid: '' }));
        if (!pickRows.length) { toast(t('importNone'), 'bad'); return false; }
        btn.disabled = true; let ok = 0, drafts = 0; const errs = [];
        for (const [n, { r, bid }] of pickRows.entries()) {
          $('#ip', d).textContent = `${n + 1} / ${pickRows.length} · ${r.x.ti}`;
          const imgNote = t('imgInOriginal');
          const questions = [...r.x.mc.map(([text, options, correct, g, img]) => ({ kind: 'mc', text: (img ? imgNote + ' ' : '') + text, options, correct, grp: 'g' + g })), ...r.x.open.map(text => ({ kind: 'open', text, grp: 'open' }))];
          const pickBy = {}; for (const [k, v] of Object.entries(r.x.pick || {})) { const g = 'g' + k.replace(/\D/g, ''); if (+v && questions.some(q => q.grp === g)) pickBy[g] = +v; } if (+r.x.op && r.x.open.length) pickBy.open = +r.x.op;
          // a one-section set that draws all its questions needs no draw rule
          const groups = [...new Set(questions.map(q => q.grp))]; const all = groups.every(g => !pickBy[g] || pickBy[g] >= questions.filter(q => q.grp === g).length);
          try { const res = await api('/test/save', { kind: 'staff', body: { bid, title: r.x.ti, questions, grading: r.open ? 'review' : 'rate', passRate: 80, pickBy: all ? {} : pickBy, draft: true, source: 'exam-az:' + r.x.id } }); ok++; if (res.test.draft) drafts++; }
          catch (/** @type {any} */ er) { errs.push(r.x.ti + ': ' + (t(er.message) === er.message ? er.message : t(er.message))); }
        }
        await load(); draw(); btn.disabled = false;
        $('#ip', d).innerHTML = `<div class="banner ${errs.length ? 'warn' : 'ok'}">${esc(t('importSiteDone', ok, drafts))}${errs.length ? '<br>' + errs.map(esc).join('<br>') : ''}</div>`;
        return false; } }] });
  }

}
