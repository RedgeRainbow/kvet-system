import { loadUsage, deleteRecord, A, can, view, api, S, $, esc, t, openModal, empty, badge, matches, pageHead, bar, searchBox, load, savedToast, paged, onPage } from './lib.js';
import { tokenOf } from '../api.js';
import { countSlides } from '../pptx.js';
/* pages of a PDF, counted from its page objects (enough for the list; the viewer shows the real document) */
const pdfPages = buf => { const s = new TextDecoder('latin1').decode(new Uint8Array(buf)); if (!s.startsWith('%PDF')) return 0; return Math.max(1, (s.match(/\/Type\s*\/Page(?!s)/g) || []).length); };
import { openViewer } from '../viewer.js';

const mb = n => (n / 1048576).toFixed(1) + ' MB';
export default async function ({ rerender }) {
  const el = view(); let q = '';
  await loadUsage().catch(() => {}); const used = id => A.usage?.materials?.[id] || 0;
  el.innerHTML = pageHead(t('navMaterials'), can('material.save') ? `<button class="btn" id="up">⬆ ${esc(t('uploadPptx'))}</button>` : '') + `<div class="banner">🔒 ${esc(t('materialsIntro'))}</div>` + bar(searchBox('q'))
    + `<div class="tw"><table><thead><tr><th>${esc(t('title'))}</th><th>${esc(t('slides'))}</th><th>${esc(t('size'))}</th><th>${esc(t('uploaded'))}</th><th>${esc(t('usedInSessions'))}</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const draw = () => { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const list = A.materials.filter(m => matches(q, m.title, m.fileName));
    const P = paged('materials', list, q); onPage('materials', draw); $('#pgr') ? ($('#pgr').innerHTML = P.html) : $('#tb').closest('.tw').insertAdjacentHTML('afterend', `<div id="pgr">${P.html}</div>`);
    $('#tb').innerHTML = P.rows.map(m => `<tr><td><b>${esc(m.title)}</b> ${badge('', (m.format || 'pptx').toUpperCase())}${m.status === 'pending' ? ' ' + badge('PENDING', t('awaitingApproval')) : m.status === 'returned' ? ' ' + badge('FAIL', '↩ ' + t('apReturnedShort')) + (m.review?.note ? `<br><span class="xs" style="color:var(--bad)">${esc(m.review.note)}</span>` : '') : ''}<br><span class="mute xs">${esc(m.fileName)}</span></td><td>${m.slides || '—'}</td><td>${mb(m.size)}</td><td>${esc(S.fmtDate(m.at))}</td><td>${used(m.id)}</td>
      <td class="act"><button class="btn sm" data-v="${esc(m.id)}">▶ ${esc(t('open'))}</button> ${can('material.save') ? `<button class="btn ghost sm" data-r="${esc(m.id)}">${esc(t('rename'))}</button> ` : ''}${can('delete') ? `<button class="btn bad ghost sm" data-d="${esc(m.id)}">🗑</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="6">${empty('🖥', t('noMaterials'))}</td></tr>`;
  };
  draw(); $('#q').oninput = e => { q = e.target.value; draw(); };
  $('#up')?.addEventListener('click', () => {
    /** @type {any} */ let file = null; let slides = 0;
    openModal({ title: t('uploadPptx'), html: `<label class="req">${esc(t('title'))}<input id="mt" maxlength="140"></label><label class="req">${esc(t('pptxFile'))}<input id="mf" type="file" accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"></label><p class="hint">${esc(t('pptxHint'))}</p><div class="err" id="me" role="alert"></div>`,
      onMount: d => { $('#mf', d).onchange = async e => { file = e.target.files[0]; $('#me', d).textContent = ''; if (!file) return; try { const buf = await file.arrayBuffer(); slides = /\.pdf$/i.test(file.name) ? pdfPages(buf) : await countSlides(buf); if (!slides) throw 0; if (!$('#mt', d).value) $('#mt', d).value = file.name.replace(/\.(pptx|pdf)$/i, ''); } catch { file = null; $('#me', d).textContent = t('badFile'); } }; },
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('upload'), id: 'ok', fn: async d => {
        const title = $('#mt', d).value.trim(); if (!file || !title) { $('#me', d).textContent = t('fillRequired'); return false; }
        const r = await fetch(`/api/material/upload?title=${encodeURIComponent(title)}&name=${encodeURIComponent(file.name)}&slides=${slides}`, { method: 'POST', headers: { authorization: 'Bearer ' + tokenOf('staff') }, body: file });
        if (!r.ok) { $('#me', d).textContent = r.status === 413 ? t('tooBig') : t('badFile'); return false; }
        await load(); savedToast(); rerender(); return true; } }] });
  });
  $('#tb').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v) { const m = A.materials.find(x => x.id === b.dataset.v); openViewer({ title: m.title, watermark: A.me.email, load: async () => { const r = await fetch('/api/material/get?id=' + encodeURIComponent(m.id), { headers: { authorization: 'Bearer ' + tokenOf('staff') } }); if (!r.ok) throw new Error('server'); return r.arrayBuffer(); } }); }
    if (b.dataset.r) { const m = A.materials.find(x => x.id === b.dataset.r); openModal({ title: t('rename'), html: `<label>${esc(t('title'))}<input id="rt" value="${esc(m.title)}" maxlength="140"></label>`, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => { await api('/material/update', { kind: 'staff', body: { id: m.id, title: $('#rt', d).value } }); await load(); rerender(); return true; } }] }); }
    if (b.dataset.d) { { const rec = { trainer: A.trainers, company: A.companies, blank: A.blanks, sheet: A.sheets, material: A.materials }['material']?.find(q => q.id === b.dataset.d); if (await deleteRecord('material', b.dataset.d, { name: rec?.name || rec?.title || (rec && S.fullAz(rec)) || '' })) rerender(); } }
  };
}
