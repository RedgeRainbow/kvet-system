/* AI module: settings (superadmin), knowledge base (admins) and a test chat with the same rules as the trainees'. */
import { can, view, api, S, $, esc, t, lang, toast, fail, busy, openModal, confirmDlg, empty, badge, opts, pageHead } from './lib.js';

const PROV = ['gemini', 'groq', 'workers', 'openrouter', 'anthropic', 'openai'];
const KEY_URL = { gemini: 'https://aistudio.google.com/apikey', groq: 'https://console.groq.com/keys', openrouter: 'https://openrouter.ai/keys', anthropic: 'https://console.anthropic.com/settings/keys', workers: 'https://dash.cloudflare.com/profile/api-tokens' };
import { chatHtml } from '../chat.js';

/* text of a Word file (.docx): paragraphs of word/document.xml */
async function docxText(buf) {
  const z = await window.JSZip.loadAsync(buf), xml = await z.file('word/document.xml')?.async('string'); if (!xml) throw new Error('badFile');
  const d = new DOMParser().parseFromString(xml, 'application/xml'), W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  return [...d.getElementsByTagNameNS(W, 'p')].map(p => [...p.getElementsByTagNameNS(W, 't')].map(x => x.textContent).join('')).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

export default async function ({ rerender }) {
  const el = view(); let D = await api('/ai', { kind: 'staff' }); const chat = [];
  const sup = can('users'), kb = can('ai.kb');
  const keyPh = p => D.cfg.keyHint?.[p] ? t('aiKeySaved', D.cfg.keyHint[p]) : D.envKeys?.[p] ? t('aiKeyEnv') : p === 'workers' && D.binding ? t('aiBindingFound') : t('aiKeyPaste');
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const c = D.cfg;
    el.innerHTML = pageHead(t('navAi')) + `<p class="mute" style="margin-top:-8px">${esc(t('aiIntro'))}</p>
      <form class="card" id="cf" autocomplete="off"><div class="ch"><h2>${esc(t('aiSettings'))}</h2><span class="grow"></span>${c.on ? (D.ready ? badge('PASS', '● ' + t('aiOn')) : badge('FAIL', t('aiNotConfigured'))) : badge('', t('aiOffState'))}</div>
        ${sup ? '' : `<p class="hint">${esc(t('aiSuperOnly'))}</p>`}
        <label class="chk"><input type="checkbox" name="on" ${c.on ? 'checked' : ''} ${sup ? '' : 'disabled'}> <b>${esc(t('aiEnable'))}</b></label>
        ${sup ? `<div class="fg" style="margin-top:8px">
          <label>${esc(t('aiProvider'))}<select name="provider">${opts(PROV.map(p => [p, t('aiProv_' + p)]), c.provider)}</select></label>
          <label id="kwrap" class="full">${esc(t('aiApiKey'))}<input name="key" type="password" autocomplete="new-password" spellcheck="false" placeholder="${esc(keyPh(c.provider))}"><span class="hint" id="khelp"></span></label>
          <label class="chk" id="kclr" ${c.keyHint?.[c.provider] ? '' : 'hidden'}><input type="checkbox" name="clearKey"> ${esc(t('aiClearKey'))}</label>
          <label id="burl" ${c.provider === 'openai' ? '' : 'hidden'}>${esc(t('aiBaseUrl'))}<input name="baseUrl" value="${esc(c.baseUrl || '')}" placeholder="https://api.example.com/v1"></label>
          <label id="acct" ${c.provider === 'workers' ? '' : 'hidden'}>${esc(t('aiAccountId'))}<input name="accountId" value="${esc(c.accountId || '')}" spellcheck="false"><span class="hint">${esc(D.binding ? t('aiBindingFound') : t('aiAccountHint'))}</span></label>
          <label class="full">${esc(t('aiModel'))}<span class="row" style="gap:6px;flex-wrap:nowrap"><input name="model" list="mlist" class="grow" value="${esc(c.models?.[c.provider] || '')}" placeholder="${esc(D.defaults[c.provider] || '')}" spellcheck="false"><button type="button" class="btn ghost sm" id="mload">${esc(t('aiLoadModels'))}</button></span><datalist id="mlist"></datalist><span class="hint">${esc(t('aiModelHint'))}</span></label>
          <label class="chk"><input type="checkbox" name="chat" ${c.chat ? 'checked' : ''}> ${esc(t('aiChatOn'))}</label>
          
          <label class="chk"><input type="checkbox" name="reports" ${c.reports !== false ? 'checked' : ''}> ${esc(t('aiReportsOn'))}</label>
          <label>${esc(t('aiDaily'))}<input name="daily" type="number" min="1" max="5000" value="${c.daily}"></label></div>
        <div class="row"><button class="btn">${esc(t('save'))}</button><button type="button" class="btn ghost" id="atest">⚡ ${esc(t('aiTestConn'))}</button></div><div id="tout" style="margin-top:8px"></div>`
        : `<p class="mute sm">${esc(t('aiProvider'))}: <b>${esc(t('aiProv_' + c.provider))}</b> · ${esc(c.model)}</p>`}</form>
      <div class="card"><div class="ch"><h2>${esc(t('aiKb'))}</h2><span class="grow"></span>${kb ? `<label class="btn ghost" style="margin:0">⬆ ${esc(t('aiKbUpload'))}<input type="file" id="kup" multiple accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label><button class="btn" id="kadd">＋ ${esc(t('aiKbAdd'))}</button>` : ''}</div><p class="hint">${esc(t('aiKbHint'))}</p>
        ${D.docs.length ? `<div class="tw"><table class="sortable"><thead><tr><th>${esc(t('title'))}</th><th>${esc(t('language'))}</th><th>${esc(t('aiParts'))}</th><th>${esc(t('date'))}</th><th></th></tr></thead><tbody>${D.docs.map(d => `<tr><td><b>${esc(d.title)}</b>${d.on === false ? ' ' + badge('', t('inactive')) : ''}${d.source ? `<br><span class="mute xs">${esc(d.source)}</span>` : ''}</td><td>${esc(d.lang.toUpperCase())}</td><td data-sort="${d.parts}">${d.parts} · ${Math.round(d.chars / 1000)}k</td><td data-sort="${esc(d.updatedAt)}">${esc(S.fmtDate((d.updatedAt || '').slice(0, 10)))}</td><td class="act nowrap">${kb ? `<button class="btn ghost sm" data-ke="${esc(d.id)}">${esc(t('edit'))}</button> <button class="btn bad ghost sm" data-kd="${esc(d.id)}" aria-label="${esc(t('delete'))}">🗑</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('📚', t('aiKbEmpty'))}</div>
      ${kb ? `<div class="card"><h2>${esc(t('aiTry'))}</h2><p class="hint">${esc(t('aiTryHint'))}</p><div id="tlog" class="chatlog">${chatHtml(chat)}</div><form id="tf" class="row" style="margin-top:8px"><input id="tq" class="grow" maxlength="1000" placeholder="${esc(t('aiAsk'))}" aria-label="${esc(t('aiAsk'))}"><select id="tl" style="width:auto">${opts([['az', 'AZ'], ['en', 'EN'], ['ru', 'RU']], lang)}</select><button class="btn">${esc(t('sendMsg'))}</button></form></div>` : ''}`;
    const f = $('#cf');
    const sync = () => { if (!sup) return; const p = f.provider.value; $('#burl').hidden = p !== 'openai'; $('#acct').hidden = p !== 'workers'; $('#kclr').hidden = !D.cfg.keyHint?.[p];
      f.key.placeholder = keyPh(p); f.model.placeholder = D.defaults[p] || ''; f.model.value = D.cfg.models?.[p] || ''; $('#mlist').innerHTML = '';
      $('#khelp').innerHTML = KEY_URL[p] ? `${esc(t('aiGetKey'))} <a href="${KEY_URL[p]}" target="_blank" rel="noopener">${esc(KEY_URL[p].replace(/^https:\/\//, '').split('/')[0])} ↗</a>` : ''; };
    if (sup) { f.provider.onchange = sync; sync(); }
    const body = () => ({ on: f.on.checked, provider: f.provider.value, key: f.key.value, clearKey: f.clearKey?.checked, baseUrl: f.baseUrl.value, accountId: f.accountId.value, model: f.model.value, chat: f.chat.checked, reports: f.reports.checked, daily: +f.daily.value });
    f.onsubmit = async e => { e.preventDefault(); if (!sup) return; try { await api('/ai/settings', { kind: 'staff', body: body() }); toast(t('saved'), 'ok'); D = await api('/ai', { kind: 'staff' }); draw(); } catch (/** @type {any} */ er) { fail(er); } };
    $('#mload')?.addEventListener('click', e => busy(e.currentTarget, async () => { try { await api('/ai/settings', { kind: 'staff', body: body() }); D = await api('/ai', { kind: 'staff' }); const r = await api('/ai/models', { kind: 'staff' });
      $('#mlist').innerHTML = r.models.map(m => `<option value="${esc(m)}">`).join(''); toast(t('aiModelsN', r.models.length), r.models.length ? 'ok' : 'bad'); f.key.value = ''; f.model.focus(); } catch (/** @type {any} */ er) { fail(er); } }));
    $('#atest')?.addEventListener('click', e => busy(e.currentTarget, async () => { const out = $('#tout'); out.innerHTML = '';
      try { await api('/ai/settings', { kind: 'staff', body: body() }); f.key.value = ''; const r = await api('/ai/test', { kind: 'staff', body: {} }); D = await api('/ai', { kind: 'staff' });
        out.innerHTML = `<div class="banner ok">✔ ${esc(t('aiTestOk', r.model, (r.ms / 1000).toFixed(1)))}<br><span class="sm">${esc(r.text)}</span></div>`; }
      catch (/** @type {any} */ er) { out.innerHTML = `<div class="banner bad">✖ ${esc(t(er.message) === er.message ? t('aiFailed') : t(er.message))}</div>`; } }));
    $('#kadd')?.addEventListener('click', () => docDlg(null));
    /* several files at once: title = first "# heading" (else the file name); a document with the same title is replaced */
    $('#kup')?.addEventListener('change', async e => { const files = [...e.target.files]; e.target.value = ''; if (!files.length) return; let ok = 0; const bad = [];
      for (const f of files) {
        try { const raw = /\.docx$/i.test(f.name) ? await docxText(await f.arrayBuffer()) : await f.text(); const m = raw.match(/^\s*#\s+(.+)$/m);
          const title = (m ? m[1] : f.name.replace(/\.[^.]+$/, '')).trim().slice(0, 200), text = raw.trim(); if (text.length < 20) throw new Error('badFile');
          const same = D.docs.find(d => d.title.toLowerCase() === title.toLowerCase());
          await api('/ai/kb/save', { kind: 'staff', body: { id: same?.id, title, lang: same?.lang || 'mix', source: same?.source || f.name, text, on: same ? same.on !== false : true } }); ok++;
        } catch (/** @type {any} */ er) { bad.push(f.name); } }
      D = await api('/ai', { kind: 'staff' }); draw(); toast(t('aiKbUploaded', ok) + (bad.length ? ' · ✖ ' + bad.join(', ') : ''), bad.length ? 'bad' : 'ok'); });
    $('#tf')?.addEventListener('submit', async e => { e.preventDefault(); const q = $('#tq').value.trim(); if (!q) return; chat.push({ role: 'user', text: q }); $('#tq').value = ''; $('#tlog').innerHTML = chatHtml(chat, true);
      try { const r = await api('/ai/try', { kind: 'staff', body: { q, lang: $('#tl').value, history: chat.slice(0, -1) } }); chat.push({ role: 'assistant', text: r.answer, sources: r.sources, grounded: r.grounded }); } catch (/** @type {any} */ er) { chat.push({ role: 'assistant', text: t(er.message) === er.message ? t('server') : t(er.message), error: true }); }
      $('#tlog').innerHTML = chatHtml(chat); $('#tlog').scrollTop = 1e9; });
  }
  async function docDlg(id) {
    let doc = { title: '', text: '', lang: 'mix', source: '', on: true }; if (id) try { doc = (await api('/ai/kb?id=' + encodeURIComponent(id), { kind: 'staff' })).doc; } catch (/** @type {any} */ e) { return fail(e); }
    openModal({ title: id ? doc.title : t('aiKbAdd'), wide: true, html: `<div class="fg"><label class="req">${esc(t('title'))}<input id="kt" value="${esc(doc.title)}" maxlength="200"></label><label>${esc(t('language'))}<select id="kl">${opts([['mix', 'AZ / EN / RU'], ['az', 'Azərbaycan'], ['en', 'English'], ['ru', 'Русский']], doc.lang)}</select></label>
      <label class="full">${esc(t('aiSource'))} <span class="mute">(${esc(t('optional'))})</span><input id="ks" value="${esc(doc.source || '')}" maxlength="200" placeholder="LOLER 1998, Reg. 9 / KVET procedure P-12"></label>
      <label class="full req">${esc(t('aiText'))}<textarea id="kx" rows="14" maxlength="400000">${esc(doc.text)}</textarea><span class="hint">${esc(t('aiTextHint'))}</span></label>
      <label class="chk full"><input type="checkbox" id="ko" ${doc.on !== false ? 'checked' : ''}> ${esc(t('aiUseDoc'))}</label></div>
      <div class="row"><label class="btn ghost sm" style="margin:0">⬆ .txt / .md / .docx<input type="file" id="kf" accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label></div><div class="err" id="ke" role="alert"></div>`,
      onMount: d => { $('#kf', d).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const txt = /\.docx$/i.test(f.name) ? await docxText(await f.arrayBuffer()) : await f.text(); $('#kx', d).value = txt; if (!$('#kt', d).value) $('#kt', d).value = f.name.replace(/\.[^.]+$/, ''); } catch { $('#ke', d).textContent = t('badFile'); } }; },
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => {
        const body = { id, title: $('#kt', d).value.trim(), lang: $('#kl', d).value, source: $('#ks', d).value, text: $('#kx', d).value, on: $('#ko', d).checked };
        if (!body.title || body.text.trim().length < 20) { $('#ke', d).textContent = t('fillRequired'); return false; }
        try { const r = await api('/ai/kb/save', { kind: 'staff', body }); toast(t('aiIndexed', r.doc.parts), 'ok'); D = await api('/ai', { kind: 'staff' }); draw(); return true; } catch (/** @type {any} */ er) { $('#ke', d).textContent = t(er.message) === er.message ? t('server') : t(er.message); return false; } } }] });
  }
  el.onclick = async e => {
    const ed = e.target.closest('[data-ke]'); if (ed) return docDlg(ed.dataset.ke);
    const del = e.target.closest('[data-kd]'); if (del) { const d = D.docs.find(x => x.id === del.dataset.kd); if (!await confirmDlg(t('aiKbDeleteConfirm', d.title), { danger: true })) return; try { await api('/ai/kb/delete', { kind: 'staff', body: { id: d.id } }); D = await api('/ai', { kind: 'staff' }); draw(); } catch (/** @type {any} */ er) { fail(er); } }
  };
  draw();
}
