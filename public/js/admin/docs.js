/* Library -> Additional documents: any office file kept for the team. Admin / superadmin upload, rename, delete;
   trainers download them in their portal. */
import { view, api, $, esc, t, toast, fail, openModal, confirmDlg, empty, matches, pageHead, bar, searchBox, savedToast, download, S, paged, onPage } from './lib.js';
import { tokenOf } from '../api.js';

const kb = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.zip';
export const fileIcon = ext => ({ pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', csv: '📗', ppt: '📙', pptx: '📙', png: '🖼', jpg: '🖼', jpeg: '🖼', zip: '🗜' }[ext] || '📄');

export default async function ({ rerender }) {
  const el = view(); let q = '', list = (await api('/libdocs', { kind: 'staff' })).list;
  el.innerHTML = pageHead(t('navDocs'), `<button class="btn" id="up">⬆ ${esc(t('upload'))}</button>`) + `<div class="banner">${esc(t('docsIntro'))}</div>` + bar(searchBox('q'))
    + `<div class="tw"><table><thead><tr><th>${esc(t('title'))}</th><th>${esc(t('category'))}</th><th>${esc(t('size'))}</th><th>${esc(t('uploaded'))}</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const draw = () => { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const rows = list.filter(d => matches(q, d.title, d.fileName, d.category));
    const P = paged('docs', rows, q); onPage('docs', draw); $('#pgr') ? ($('#pgr').innerHTML = P.html) : $('#tb').closest('.tw').insertAdjacentHTML('afterend', `<div id="pgr">${P.html}</div>`);
    $('#tb').innerHTML = P.rows.map(d => `<tr><td>${fileIcon(d.ext)} <b>${esc(d.title)}</b><br><span class="mute xs">${esc(d.fileName)}</span></td><td>${esc(d.category || '')}</td><td class="nowrap">${kb(d.size)}</td><td class="nowrap">${esc(S.fmtDateTime(d.at))}</td>
      <td class="act nowrap"><button class="btn sm" data-dl="${esc(d.id)}">⬇ ${esc(t('download'))}</button> <button class="btn ghost sm" data-ed="${esc(d.id)}">${esc(t('rename'))}</button> <button class="btn bad ghost sm" data-del="${esc(d.id)}" aria-label="${esc(t('delete'))}">🗑</button></td></tr>`).join('') || `<tr><td colspan="5">${empty('📁', t('none'))}</td></tr>`;
  };
  draw(); $('#q').oninput = e => { q = e.target.value; draw(); };
  const cats = () => `<datalist id="dcats">${[...new Set(list.map(d => d.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
  $('#up').onclick = () => {
    let files = [];
    openModal({ title: t('upload'), html: `<label class="req">${esc(t('files'))}<input id="df" type="file" multiple accept="${ACCEPT}"><span class="hint">${esc(t('docsTypes'))}</span></label>
      <label>${esc(t('category'))} <span class="mute">(${esc(t('optional'))})</span><input id="dc" maxlength="60" list="dcats">${cats()}</label><div class="err" id="de" role="alert"></div>`,
      onMount: d => { $('#df', d).onchange = e => { files = [...e.target.files]; }; },
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('upload'), id: 'ok', fn: async d => {
        if (!files.length) { $('#de', d).textContent = t('fillRequired'); return false; }
        for (const f of files) {
          const r = await fetch(`/api/libdoc/upload?name=${encodeURIComponent(f.name)}&category=${encodeURIComponent($('#dc', d).value.trim())}`, { method: 'POST', headers: { authorization: 'Bearer ' + tokenOf('staff') }, body: f });
          if (!r.ok) { $('#de', d).textContent = `${f.name}: ${r.status === 413 ? t('tooBig') : t('badFile')}`; return false; }
        }
        savedToast(); rerender(); return true; } }] });
  };
  $('#tb').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const x = list.find(d => d.id === (b.dataset.dl || b.dataset.ed || b.dataset.del));
    if (b.dataset.dl) { try { download(await api('/libdoc/get?id=' + encodeURIComponent(x.id), { kind: 'staff', blob: true }), x.fileName); } catch (/** @type {any} */ er) { fail(er); } }
    if (b.dataset.ed) openModal({ title: t('rename'), html: `<label class="req">${esc(t('title'))}<input id="rt" maxlength="140" value="${esc(x.title)}"></label><label>${esc(t('category'))}<input id="rc" maxlength="60" list="dcats" value="${esc(x.category || '')}">${cats()}</label>`,
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => { try { await api('/libdoc/update', { kind: 'staff', body: { id: x.id, title: $('#rt', d).value, category: $('#rc', d).value } }); savedToast(); rerender(); return true; } catch (/** @type {any} */ er) { fail(er); return false; } } }] });
    if (b.dataset.del && await confirmDlg(x.title + ' — ' + t('deleteConfirm'), { danger: true })) { try { await api('/libdoc/delete', { kind: 'staff', body: { id: x.id } }); toast(t('deleted'), 'ok'); rerender(); } catch (/** @type {any} */ er) { fail(er); } }
  };
}
