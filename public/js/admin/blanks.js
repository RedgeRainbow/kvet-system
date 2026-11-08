import { loadUsage, deleteRecord, A, can, view, api, S, $, $$, esc, t, toast, openModal, empty, badge, opts, matches, pageHead, bar, searchBox, load, savedToast, tabs, sheet, paged, onPage } from './lib.js';
import { certHtml, sampleCert, DOC_CSS } from '../cert.js';
import { labelFields, readLabels, bindLabelReset } from './certedit.js';

export default async function ({ rerender }) {
  const el = view(); const st = { q: '', cat: '' };
  await loadUsage().catch(() => {}); const usage = id => A.usage?.blanks?.[id] || 0;              // all years (server)
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const cats = [...new Set(A.blanks.map(b => b.category).filter(Boolean))];
    const list = A.blanks.filter(b => (!st.cat || b.category === st.cat) && matches(st.q, b.name, b.qualAz, b.qualEn, b.titleEn, b.category)); const P = paged('blanks', list, JSON.stringify([st.cat, st.q])); onPage('blanks', draw);
    el.innerHTML = pageHead(t('navBlanks'), `${can('seed') && !A.blanks.some(b => b.id === 'sample-pa') ? `<button class="btn ghost" id="seed2" title="${esc(t('stdBlankHint'))}">＋ ${esc(t('stdBlank'))}</button>` : ''}${can('blank.save') ? `<button class="btn" id="add">＋ ${esc(t('newBlank'))}</button>` : ''}`)
      + `<p class="mute" style="margin-top:-8px">${esc(t('blanksIntro'))}</p>`
      + bar(searchBox('q', st.q), cats.length ? `<select id="cat">${opts(cats.map(c => [c, c]), st.cat, t('allCategories'))}</select>` : '', `<span class="mute sm">${list.length} / ${A.blanks.length}</span>`)
      + (list.length ? `<div class="grid g3">${P.rows.map(b => `<div class="card bcard" data-id="${esc(b.id)}" tabindex="0" role="button"><div class="tt">${esc(b.name)}</div>
          <div class="mute sm">${esc(b.qualAz)}${b.qualEn && b.qualEn !== b.qualAz ? ' / ' + esc(b.qualEn) : ''}</div>
          <div class="meta">${badge('info', t('validMonths', b.months))}${Number(b.credits) > 0 ? badge('PASS', t('creditsN', b.credits)) : ''}${b.defaultSheetId && sheet(b.defaultSheetId) ? badge('PENDING', '📋 ' + sheet(b.defaultSheetId).name.slice(0, 26)) : ''}${b.category ? badge('', b.category) : ''}</div>
          <div class="row sm mute"><span>${esc(t('usedIn', usage(b.id)))}</span><span class="grow"></span>${can('blank.save') ? `<button class="btn ghost sm" data-dup="${esc(b.id)}">${esc(t('duplicate'))}</button>` : ''}${can('delete') ? `<button class="btn bad ghost sm" data-del="${esc(b.id)}">🗑</button>` : ''}</div></div>`).join('')}</div>${P.html}`
        : `<div class="card">${empty('🧾', A.blanks.length ? t('noMatch') : t('noBlanks'), !A.blanks.length && can('seed') ? `<p><button class="btn" id="seed">${esc(t('addStarter'))}</button></p>` : '')}</div>`);
    $('#q').oninput = e => { st.q = e.target.value; const pos = e.target.selectionStart; draw(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); };
    $('#cat')?.addEventListener('change', e => { st.cat = e.target.value; draw(); });
    $('#add')?.addEventListener('click', () => form());
    $('#seed2')?.addEventListener('click', async () => { await api('/seed', { kind: 'staff', body: {} }); await load(); toast(t('saved'), 'ok'); rerender(); });
    $('#seed')?.addEventListener('click', async () => { await api('/seed', { kind: 'staff', body: {} }); await load(); rerender(); });
  }
  draw();
  el.onclick = async e => {
    const dup = e.target.closest('[data-dup]'), del = e.target.closest('[data-del]'), card = e.target.closest('.bcard');
    if (dup) { const b = A.blanks.find(x => x.id === dup.dataset.dup); return form({ ...b, id: undefined, name: b.name + ' ' + t('copySuffix') }); }
    if (del) { { const rec = { trainer: A.trainers, company: A.companies, blank: A.blanks, sheet: A.sheets, material: A.materials }['blank']?.find(q => q.id === del.dataset.del); if (await deleteRecord('blank', del.dataset.del, { name: rec?.name || rec?.title || (rec && S.fullAz(rec)) || '' })) rerender(); } return; }
    if (card) form(A.blanks.find(x => x.id === card.dataset.id));
  };
  el.onkeydown = e => { if (e.key === 'Enter' && e.target.classList.contains('bcard')) e.target.click(); };

  function form(b) {
    b ||= { months: 24, credits: 0, provider: info(), titleAz: 'SƏRİŞTƏLİLİK SERTİFİKATI', titleEn: 'CERTIFICATE OF COMPETENCE', descAz: '{qual} təlimini uğurla tamamlamışdır.', descEn: 'Has successfully completed the {qual} training course.' };
    const ro = !can('blank.save'), F = (n, label, extra = '', v = b[n]) => `<label>${esc(label)}<input name="${n}" value="${esc(v)}" ${extra} ${ro ? 'disabled' : ''}></label>`;
    const html = `<div class="split"><div><div class="tabs" id="bt"><button type="button" class="tab on" data-s="1">${esc(t('secBasics'))}</button><button type="button" class="tab" data-s="2">${esc(t('secTexts'))}</button><button type="button" class="tab" data-s="3">${esc(t('secFooter'))}</button><button type="button" class="tab" data-s="4">${esc(t('secLabels'))}</button></div>
     <form id="bf"><div data-sec="1" class="fg">
       <label class="req full">${esc(t('blankName'))}<input name="name" value="${esc(b.name)}" required maxlength="100" ${ro ? 'disabled' : ''}><span class="hint">${esc(t('blankNameHint'))}</span></label>
       ${F('category', t('category'), 'maxlength="60" list="cats"')}<datalist id="cats">${[...new Set(A.blanks.map(x => x.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
       ${F('provider', t('provider'), 'maxlength="160"')}
       <label>${esc(t('validity'))} (${esc(t('months'))})<input name="months" type="number" min="0" max="240" value="${esc(b.months)}" ${ro ? 'disabled' : ''}><span class="hint">${esc(t('validityHint'))}</span></label>
       <label>${esc(t('credits'))}<input name="credits" type="number" min="0" max="99" value="${esc(b.credits || 0)}" ${ro ? 'disabled' : ''}><span class="hint">${esc(t('creditsHint'))}</span></label>
       ${F('prefix', t('prefixOverride'), 'maxlength="12" placeholder="' + esc(A.settings.num?.prefix || 'CRT') + '" style="text-transform:uppercase"')}
       <label>${esc(t('defaultSheet'))}<select name="defaultSheetId" ${ro ? 'disabled' : ''}>${opts(A.sheets.map(s => [s.id, s.name]), b.defaultSheetId || '', t('noneOpt'))}</select><span class="hint">${esc(t('defaultSheetHint'))}</span></label>
       ${F('note', t('internalNote'), 'maxlength="300"')}</div>
     <div data-sec="2" class="fg hide"><label class="req">${esc(t('titleAz'))}<input name="titleAz" value="${esc(b.titleAz)}" required ${ro ? 'disabled' : ''}></label><label class="req">${esc(t('titleEn'))}<input name="titleEn" value="${esc(b.titleEn)}" required ${ro ? 'disabled' : ''}></label>
       ${F('qualAz', t('qualAz'))}${F('qualEn', t('qualEn'))}
       <label class="full">${esc(t('descAz'))}<textarea name="descAz" rows="3" ${ro ? 'disabled' : ''}>${esc(b.descAz)}</textarea><span class="hint">${esc(t('descHint'))}</span></label><label class="full">${esc(t('descEn'))}<textarea name="descEn" rows="3" ${ro ? 'disabled' : ''}>${esc(b.descEn)}</textarea></label></div>
     <div data-sec="3" class="fg hide"><label class="full">${esc(t('footAz'))}<textarea name="footAz" rows="3" ${ro ? 'disabled' : ''}>${esc(b.footAz)}</textarea></label><label class="full">${esc(t('footEn'))}<textarea name="footEn" rows="3" ${ro ? 'disabled' : ''}>${esc(b.footEn)}</textarea></label><p class="hint full">${esc(t('footerNote'))}</p></div>
     <div data-sec="4" class="fg hide">${labelFields(b.labels || {}, ro)}</div></form>
     <div class="err" id="be" role="alert"></div></div>
     <div class="pv"><div class="mute xs" style="margin-bottom:6px">${esc(t('livePreview'))}</div><div id="pvw" style="width:400px;height:${Math.round(1123 * 400 / 794)}px"><div class="pvbox" id="pvb" style="width:794px;transform:scale(${400 / 794})"></div></div></div></div>`;
    const { dlg } = openModal({ title: b.id ? t('editBlank') : t('newBlank'), wide: true, html, onMount: d => {
      const f = $('#bf', d), read = () => /** @type {any} */ ({ ...Object.fromEntries(new FormData(f)), id: b.id, labels: readLabels(f) });
      const prev = () => { const x = read(); $('#pvb', d).innerHTML = `<style>${DOC_CSS}</style>` + certHtml(sampleCert({ ...x, credits: Number(x.credits) }, A.assets, A.settings.company), A.assets, A.settings.company); };
      f.addEventListener('input', prev); bindLabelReset(f, prev); prev();
      $('#bt', d).onclick = e => { const s = e.target.closest('[data-s]')?.dataset.s; if (!s) return; $$('#bt .tab', d).forEach(x => x.classList.toggle('on', x.dataset.s === s)); $$('[data-sec]', d).forEach(x => x.classList.toggle('hide', x.dataset.sec !== s)); };
    }, buttons: ro ? [{ label: t('close'), id: 'x' }] : [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => {
      const f = $('#bf', d); if (!f.reportValidity()) { const bad = f.querySelector(':invalid'); const sec = bad?.closest('[data-sec]')?.dataset.sec; if (sec) $(`#bt [data-s="${sec}"]`, d).click(); f.reportValidity(); return false; }
      try { await api('/blank/save', { kind: 'staff', body: { ...Object.fromEntries(new FormData(f)), id: b.id, labels: readLabels(f) } }); await load(); savedToast(); rerender(); return true; } catch (/** @type {any} */ e) { $('#be', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] });
  }
  function info() { return A.settings.company?.name ? A.settings.company.name : ''; }
}
