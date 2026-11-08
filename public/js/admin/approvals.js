/* Approval queue (approver, admin, superadmin): tests, presentations and certificates waiting for a decision.
   Approve publishes the item; Return sends it back to its author with a compulsory note. */
import { A, can, view, api, S, $, esc, t, toast, fail, openModal, confirmDlg, empty, badge, pageHead, tabs, blank, info, paged, onPage } from './lib.js';
import { tokenOf } from '../api.js';
import { openViewer } from '../viewer.js';
import { signCerts, previewCert } from './certview.js';
import { certHtml, DOC_CSS } from '../cert.js';

const L = 'ABCDEFGHIJ';
export default async function ({ rerender }) {
  const el = view(); let Q, tab = 'tests';
  // certificates approved but not yet signed: waiting for the approver's / superadmin's signature
  const reload = async () => { const [q, u] = await Promise.all([api('/approvals', { kind: 'staff' }), can('cert.sign') ? api('/certs?unsigned=1&counts=0&size=200', { kind: 'staff' }) : null]); Q = q; Q.unsigned = u?.certs || []; Q.unsignedTotal = u?.total || 0; window.__badges?.(); };
  await reload();
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const n = { sign: Q.unsignedTotal, tests: Q.tests.length, materials: Q.materials.length, certs: Q.certs.length, cands: (Q.candidates || []).length, links: (Q.links || []).length };
    if (!n[tab]) tab = ['sign', 'certs', 'tests', 'materials', 'cands', 'links'].find(k => n[k]) || tab;
    el.innerHTML = pageHead(t('navApprovals')) + `<p class="mute" style="margin-top:-8px">${esc(t('approvalsIntro'))}</p>`
      + tabs([...(can('cert.sign') ? [['sign', '✍ ' + t('toSignCerts'), n.sign]] : []), ['tests', t('navTests'), n.tests], ['materials', t('navMaterials'), n.materials], ['certs', t('navCerts'), n.certs], ...(can('cand.approve') ? [['cands', t('candRegs'), n.cands], ['links', t('linkReqs'), n.links]] : [])], tab)
      + (tab === 'sign' ? signList() : tab === 'tests' ? list(Q.tests, x => `<div class="card"><div class="row"><b>${esc(x.title)}</b><span class="grow"></span>${x.change ? badge('info', t('apChange')) : badge('PENDING', t('apNew'))}</div>
          <div class="mute sm">${esc(t('apBy', x.owner?.name || x.by || '—', S.fmtDateTime(x.at)))}${x.bid ? ' · 🔗 ' + esc(blank(x.bid)?.name || '') : ''} · ${esc(t('nQuestions', x.questions.length))}${x.change ? ` (${esc(t('apWas', x.current.questions.length))})` : ''}</div>
          <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-see="${esc(x.id)}">👁 ${esc(t('apReview'))}</button><span class="grow"></span>${buttons('test', x.id)}</div></div>`)
        : tab === 'links' ? list(Q.links || [], x => `<div class="card"><div class="row"><b>${esc(t('linkTitle'))}</b><span class="grow"></span>${badge('PENDING', t('candPending'))}</div>
          <p class="sm" style="margin:6px 0">${esc(t('linkHint'))}</p>
          <div class="grid g2" style="gap:8px"><div class="banner sm"><b>${esc(t('linkNew'))}</b><br>${esc(x.temp?.name || '—')}<br><span class="mono xs">${esc(x.tempId)}</span> · ${esc(S.fmtDateTime(x.temp?.createdAt))}<br>☎ ${esc(x.phone || '')}</div>
            <div class="banner ok sm"><b>${esc(t('linkExisting'))}</b><br>${esc(x.existing?.name || '—')}<br><span class="mono xs">${esc(x.existing?.att || '')}</span>${x.existing?.phone ? ' · ☎ ' + esc(x.existing.phone) : ''}</div></div>
          <div class="mute xs" style="margin-top:6px">FIN <span class="mono">${esc(x.fin)}</span> · ${esc(S.fmtDateTime(x.at))}</div>
          <div class="row" style="margin-top:8px"><span class="grow"></span>${buttons('link', x.id)}</div></div>`)
        : tab === 'cands' ? list(Q.candidates || [], x => `<div class="card"><div class="row"><b>${esc(S.fullAz(x.person))}</b><span class="grow"></span>${badge('PENDING', t('candPending'))}</div>
          <div class="sm">🏢 <b>${esc(x.coName)}</b> · ${esc(t('apBy', x.by || '—', S.fmtDateTime(x.at)))}</div>
          ${x.sameName ? `<div class="banner warn sm" style="margin:6px 0">⚠ ${esc(t('sameNameExists'))}: ${x.sameName.map(p => esc(`${p.name} (${p.att})`)).join(', ')}</div>` : ''}<div class="mute sm">${esc(S.fullEn(x.person))}${x.person.foreign ? ' · ' + esc(t('foreignPerson')) : ''} · FIN <span class="mono">${esc(x.person.fin)}</span> · ☎ ${esc(x.person.phone || '—')}${x.person.email ? ' · ' + esc(x.person.email) : ''}</div>
          <div class="row" style="margin-top:8px"><span class="grow"></span>${buttons('cand', x.id)}</div></div>`)
        : tab === 'materials' ? list(Q.materials, m => `<div class="card"><div class="row"><b>${esc(m.title)}</b><span class="grow"></span>${badge('', (m.format || 'pptx').toUpperCase())}</div>
          <div class="mute sm">${esc(t('apBy', m.by || '—', S.fmtDateTime(m.at)))} · ${esc(m.fileName || '')}${m.slides ? ' · ' + m.slides + ' ' + esc(t('slides')) : ''}</div>
          <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-mat="${esc(m.id)}">▶ ${esc(t('open'))}</button><span class="grow"></span>${buttons('material', m.id)}</div></div>`)
        : list(Q.certs, c => `<div class="card"><div class="row"><b class="mono">${esc(c.no)}</b><span class="grow"></span>${c.approval?.change ? badge('info', t('apChange')) : badge('PENDING', t('apNew'))}</div>
          <div class="sm"><b>${esc(c.snap?.names?.az || c.snap?.names?.en || '')}</b> · ${esc(c.snap?.blank?.name || '')}</div><div class="mute sm">${esc(S.fmtDate(c.start))} → ${esc(S.fmtDate(c.expiry))} · ${esc(t('apBy', c.approval?.by || c.by || '—', S.fmtDateTime(c.approval?.at)))}</div>
          <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-cert="${esc(c.no)}">👁 ${esc(t('view'))}</button><span class="grow"></span>${buttons('cert', c.no)}</div></div>`));
  }
  let PU; function signList() {
    onPage('tosign', draw);
    if (!Q.unsigned.length) return `<div class="card">${empty('✅', t('apNothing'))}</div>`;
    return `<div class="banner warn row" style="gap:8px;flex-wrap:wrap">✍ <b>${esc(t('certsToSign', Q.unsignedTotal))}</b><span class="grow"></span><button class="btn ok sm" data-sall="esign">✔ ${esc(t('signAllShown', Q.unsigned.length))}</button>${A.me.sigImg ? `<button class="btn ok ghost sm" data-sall="image">🖊 ${esc(t('signAllImage', Q.unsigned.length))}</button>` : ''}</div>
      ${Q.unsignedTotal > Q.unsigned.length ? `<p class="mute sm">${esc(t('shownOf', Q.unsigned.length, Q.unsignedTotal))}</p>` : ''}
      <div class="tw"><table><thead><tr><th>${esc(t('certNo'))}</th><th>${esc(t('fullName'))}</th><th>${esc(t('training'))}</th><th>${esc(t('date'))}</th><th></th></tr></thead><tbody>${(PU = paged('tosign', Q.unsigned)).rows.map(c => `<tr><td class="mono">${esc(c.no)}</td><td><b>${esc(c.snap?.names?.az || c.snap?.names?.en || '')}</b><br><span class="mute xs mono">${esc(c.att || '')}</span></td><td>${esc(c.snap?.blank?.name || '')}</td><td class="nowrap">${esc(S.fmtDate(c.start))}</td>
        <td class="act nowrap"><button class="btn ghost sm" data-pv="${esc(c.no)}">👁</button> <button class="btn ok sm" data-s1="${esc(c.no)}" data-sign="esign">✔ ${esc(t('signCertE'))}</button>${A.me.sigImg ? ` <button class="btn ok ghost sm" data-s1="${esc(c.no)}" data-sign="image">🖊</button>` : ''}</td></tr>`).join('')}</tbody></table></div>${PU.html}`;
  }
  const list = (items, card) => (items.length ? `<div class="grid g2">${items.map(card).join('')}</div>` : `<div class="card">${empty('✅', t('apNothing'))}</div>`);
  // a certificate is approved and signed in one step by whoever may sign (approver / superadmin): e-signature or own image
  const buttons = (kind, id) => `<button class="btn bad ghost sm" data-ret="${esc(kind)}" data-id="${esc(id)}">↩ ${esc(t('apReturn'))}</button>${kind === 'cert' && can('cert.sign')
    ? `<button class="btn ok sm" data-ok="cert" data-id="${esc(id)}" data-sign="esign">✔ ${esc(t('apApproveESign'))}</button>${A.me.sigImg ? `<button class="btn ok ghost sm" data-ok="cert" data-id="${esc(id)}" data-sign="image">🖊 ${esc(t('apApproveImg'))}</button>` : ''}`
    : `<button class="btn ok sm" data-ok="${esc(kind)}" data-id="${esc(id)}">✔ ${esc(t('apApprove'))}</button>`}`;
  async function decide(kind, id, approve, sign = '') {
    let note = '';
    if (!approve) {
      const v = await new Promise(res => openModal({ title: t('apReturn'), html: `<label class="req">${esc(t('apReturnNote'))}<textarea id="rn" rows="4" maxlength="1000"></textarea></label><div class="err" id="re" role="alert"></div>`,
        buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: '↩ ' + t('apReturn'), cls: 'bad', id: 'ok', fn: async d => { note = $('#rn', d).value.trim(); if (!note) { $('#re', d).textContent = t('needNote'); return false; } return true; } }] }).promise.then(res));
      if (v !== 'ok') return;
    }
    try { const r = await api('/approval/decide', { kind: 'staff', body: { kind, id, approve, note, sign } }); toast(approve ? t('apApproved') : t('apReturned'), 'ok'); await reload(); draw();
      // a confirmed candidate is now a trainee: show the sign-in details once (they can be printed later from the trainee's page)
      if (r.creds) openModal({ title: t('candRegistered'), html: `<p>${esc(r.trainee.name)} · <span class="mono">${esc(r.trainee.att)}</span></p><div class="banner"><b>${esc(t('login'))}:</b> <span class="mono">${esc(r.creds.login)}</span><br><b>${esc(t('password'))}:</b> <span class="mono">${esc(r.creds.password)}</span></div><p class="hint">${esc(t('candCredsHint'))}</p>`, buttons: [{ label: t('close'), id: 'x' }] });
    } catch (/** @type {any} */ e) { fail(e); }
  }
  function seeTest(x) {
    const qs = x.questions.map((q, i) => `<div class="card" style="box-shadow:none;margin:0 0 8px;padding:10px 12px"><b>${i + 1}. ${esc(q.text)}</b> <span class="mute xs">${q.points || 1} ${esc(t('pts'))}${q.kind === 'open' ? ' · ' + esc(t('qOpen')) : ''}</span>${q.img ? `<img src="${S.qImgUrl(q.img)}" alt="" class="qimg" loading="lazy">` : ''}
      ${q.kind === 'open' ? '' : `<ol type="A" class="sm" style="margin:6px 0 0 18px;padding:0">${S.optList(q).map(o => `<li style="${o.id === q.correct ? 'color:var(--ok);font-weight:700' : ''}">${esc(o.text)}${o.id === q.correct ? ' ✔' : ''}</li>`).join('')}</ol>`}</div>`).join('');
    openModal({ title: x.title, wide: true, html: `<p class="mute sm">${esc(x.grading === 'review' ? t('gradingReview') : t('passRateN', x.passRate))}${x.timeLimit ? ' · ⏱ ' + esc(t('minutesN', x.timeLimit)) : ''}</p>${x.intro ? `<div class="banner sm">${esc(x.intro)}</div>` : ''}${qs}`,
      buttons: [{ label: t('close'), cls: 'ghost', id: 'x' }, { label: '↩ ' + t('apReturn'), cls: 'bad ghost', id: 'ret' }, { label: '✔ ' + t('apApprove'), cls: 'ok', id: 'ok' }] }).promise.then(v => { if (v === 'ok') decide('test', x.id, true); if (v === 'ret') decide('test', x.id, false); });
  }
  el.onclick = async e => {
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; return draw(); }
    const sall = e.target.closest('[data-sall]'), s1 = e.target.closest('[data-s1]'), pv = e.target.closest('[data-pv]');
    if (sall) { const nos = Q.unsigned.map(c => c.no); if (!await confirmDlg(t('signAllConfirm', nos.length))) return; sall.disabled = true; await signCerts(nos, sall.dataset.sall); await reload(); return draw(); }
    if (s1) { s1.disabled = true; await signCerts([s1.dataset.s1], s1.dataset.sign); await reload(); return draw(); }
    if (pv) { const c = Q.unsigned.find(x => x.no === pv.dataset.pv); return previewCert(c).promise?.then(async () => { await reload(); draw(); }); }
    const ok = e.target.closest('[data-ok]'), ret = e.target.closest('[data-ret]');
    if (ok) return decide(ok.dataset.ok, ok.dataset.id, true, ok.dataset.sign || '');
    if (ret) return decide(ret.dataset.ret, ret.dataset.id, false);
    const see = e.target.closest('[data-see]'); if (see) return seeTest(Q.tests.find(x => x.id === see.dataset.see));
    const mat = e.target.closest('[data-mat]'); if (mat) { const m = Q.materials.find(x => x.id === mat.dataset.mat); return openViewer({ title: m.title, watermark: A.me.email, load: async () => { const r = await fetch('/api/material/get?id=' + encodeURIComponent(m.id), { headers: { authorization: 'Bearer ' + tokenOf('staff') } }); if (!r.ok) throw new Error('server'); return r.arrayBuffer(); } }); }
    const ce = e.target.closest('[data-cert]'); if (ce) { const c = Q.certs.find(x => x.no === ce.dataset.cert), w = Math.min(640, innerWidth - 80);
      return openModal({ title: c.no, wide: true, html: `<div style="width:${w}px;max-width:100%;overflow:hidden"><div style="width:794px;transform-origin:0 0;transform:scale(${w / 794});height:${Math.round(1123 * w / 794)}px"><style>${DOC_CSS}</style>${certHtml({ ...c, vh: 'pending' }, A.assets, info())}</div></div>`,
        buttons: [{ label: t('close'), cls: 'ghost', id: 'x' }, { label: '↩ ' + t('apReturn'), cls: 'bad ghost', id: 'ret' }, { label: '✔ ' + t('apApprove'), cls: 'ok', id: 'ok' }] }).promise.then(v => { if (v === 'ok') decide('cert', c.no, true, can('cert.sign') ? 'esign' : ''); if (v === 'ret') decide('cert', c.no, false); }); }
  };
  draw();
}
