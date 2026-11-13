/* Shared portal bootstrap: sign-in screen (with the two-factor step for staff), top bar, account menu, language switch, sign-out. */
import { api, tokenOf, setToken, setRefresh } from './api.js';
import { $, esc, t, lang, setLang, langSwitch, fail, toast, openModal, themeButton, errMsg } from './ui.js';
import { qrSvg } from './qr.js';
import { icon } from './icons.js';
import { bellButton, startBell } from './bell.js';

let KIND = 'staff';
export function topbar({ title, sub = '', menu = false, extra = '' }) {
  return `<header class="top">${menu ? `<button class="btn ghost ic menu-btn" id="menuBtn" aria-label="${esc(t('menu'))}">${icon('menu')}</button>` : ''}<img class="logo brandlogo" src="/img/logo.png" alt="KVET"><div class="ttl">${esc(title)}</div><span class="grow"></span>${extra}${bellButton()}<button class="btn ghost sm ic" id="liveBtn" type="button" aria-label="${esc(t('refresh'))}" title="${esc(t('refresh'))}">↻</button>${themeButton()}${langSwitch()}<div class="who">${sub}</div>`
    + `<button class="btn ghost sm ic" id="account" aria-label="${esc(t('account'))}" title="${esc(t('account'))}">${icon('user')}</button><button class="btn ghost sm" id="signOut">${esc(t('signOut'))}</button></header>`;
}

/* Two-factor set-up (staff): QR code for the authenticator app, then the first 6-digit code. */
export async function mfaSetupDlg({ forced = false } = {}) {
  const en = await api('/staff/mfa/enroll', { kind: 'staff', body: {}, noRedirect: true });
  const uri = en.uri || '';
  return openModal({ title: t('mfaTitle'), html: `${forced ? `<div class="banner warn">${esc(t('mfaForced'))}</div>` : ''}<ol class="sm"><li>${esc(t('mfaStep1'))}</li><li>${esc(t('mfaStep2'))}</li><li>${esc(t('mfaStep3'))}</li></ol>
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><div style="width:180px;height:180px;background:#fff;padding:6px;border-radius:8px">${uri ? qrSvg(uri, { margin: 1 }) : ''}</div>
    <div><div class="mute sm">${esc(t('mfaManual'))}</div><div class="mono b" style="word-break:break-all;max-width:260px">${esc(en.secret || '')}</div></div></div>
    <label style="margin-top:12px">${esc(t('mfaCode'))}<input id="mc" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" style="max-width:160px;font-size:20px;letter-spacing:4px"></label><div class="err" id="me" role="alert"></div>`,
    buttons: [...(forced ? [] : [{ label: t('cancel'), cls: 'ghost', id: false }]), { label: t('mfaActivate'), id: true, fn: async d => {
      try { const r = await api('/staff/mfa/activate', { kind: 'staff', noRedirect: true, body: { factorId: en.id, code: $('#mc', d).value.trim() } }); setToken('staff', r.access); setRefresh(r.refresh); toast(t('mfaOn'), 'ok'); return true; }
      catch (/** @type {any} */ x) { $('#me', d).textContent = x.message === 'badCode' ? t('badCode') : t('mfaError'); return false; } } }] }).promise;
}

/* Account menu: change own password (portals) / two-factor sign-in (staff). */
async function accountDlg(kind, rerun) {
  if (kind === 'staff') {
    const st = await api('/staff/mfa', { kind: 'staff' });
    const v = await openModal({ title: t('account'), html: `<div class="fg"><label>${esc(t('signerName'))}<input id="an" value="${esc(st.name)}" maxlength="120"></label><label>${esc(t('jobTitle'))}<input id="at" value="${esc(st.title)}" maxlength="120"></label></div><p class="hint" style="margin-top:-4px">${esc(t('signerNameHint'))}</p><p><button type="button" class="btn ghost sm" id="asv">${esc(t('save'))}</button></p>
      ${st.canSignCerts ? `<hr style="border:0;border-top:1px solid var(--line)"><p><b>${esc(t('mySignature'))}</b><br><span class="hint">${esc(t('mySignatureHint'))}</span></p><div id="asg" style="margin-bottom:8px">${st.sigImg ? `<img src="${esc(st.sigImg)}" alt="" style="max-height:70px;max-width:260px;background:#fff;border:1px solid var(--line);border-radius:6px;padding:4px">` : `<span class="mute sm">${esc(t('none'))}</span>`}</div><div class="row"><input type="file" id="asf" accept="image/*" style="max-width:300px">${st.sigImg ? `<button type="button" class="btn bad ghost sm" id="asr">${esc(t('delete'))}</button>` : ''}</div>` : ''}
      <hr style="border:0;border-top:1px solid var(--line)"><p><b>${esc(t('changePassword'))}</b></p><div class="fg"><label>${esc(t('currentPassword'))}<input id="sp0" type="password" autocomplete="current-password"></label><div></div><label>${esc(t('newPassword'))}<input id="sp1" type="password" autocomplete="new-password" minlength="8"></label><label>${esc(t('repeatPassword'))}<input id="sp2" type="password" autocomplete="new-password"></label></div><p class="hint">${esc(t('pwRules'))}</p><p><button type="button" class="btn ghost sm" id="spw">${esc(t('changePassword'))}</button> <span class="err" id="spe" role="alert"></span></p>
      <hr style="border:0;border-top:1px solid var(--line)"><p><b>${esc(t('mfaTitle'))}:</b> ${st.enabled ? `<span class="bd PASS">${esc(t('mfaEnabled'))}</span>` : `<span class="bd PENDING">${esc(t('mfaDisabled'))}</span>`}</p><p class="mute sm">${esc(t('mfaWhy'))}</p>`,
      onMount: d => {
        // own signature image: any picture -> PNG (max 600 px wide, white made transparent so it sits on the line)
        $('#asf', d)?.addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try {
          const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
          const k = Math.min(1, 600 / img.width), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          const g = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')); g.drawImage(img, 0, 0, cv.width, cv.height); const px = g.getImageData(0, 0, cv.width, cv.height);
          for (let i = 0; i < px.data.length; i += 4) { const v = (px.data[i] + px.data[i + 1] + px.data[i + 2]) / 3; if (v > 215) px.data[i + 3] = 0; } g.putImageData(px, 0, 0);
          const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
          const r = await fetch('/api/staff/signature', { method: 'POST', headers: { authorization: 'Bearer ' + tokenOf('staff') }, body: blob }); if (!r.ok) throw new Error('badFile');
          $('#asg', d).innerHTML = `<img src="${esc((await r.json()).img)}" alt="" style="max-height:70px;max-width:260px;background:#fff;border:1px solid var(--line);border-radius:6px;padding:4px">`; toast(t('saved'), 'ok'); document.dispatchEvent(new Event('kvet:me'));
        } catch { toast(t('badFile'), 'bad'); } });
        $('#asr', d)?.addEventListener('click', async () => { await api('/staff/signature/remove', { kind: 'staff', body: {} }); $('#asg', d).innerHTML = ''; toast(t('saved'), 'ok'); document.dispatchEvent(new Event('kvet:me')); });
        $('#spw', d).onclick = async () => { const n1 = $('#sp1', d).value; $('#spe', d).textContent = ''; if (n1 !== $('#sp2', d).value) { $('#spe', d).textContent = t('pwMismatch'); return; }
          try { await api('/staff/password', { kind: 'staff', noRedirect: true, body: { current: $('#sp0', d).value, next: n1 } }); ['#sp0', '#sp1', '#sp2'].forEach(k => ($(k, d).value = '')); toast(t('pwChanged'), 'ok'); }
          catch (/** @type {any} */ x) { $('#spe', d).textContent = x.message === 'badPassword' ? t('badPassword') : x.message === 'weakPassword' ? t('pwRules') : t('server'); } };
        $('#asv', d).onclick = async () => { try { await api('/staff/profile', { kind: 'staff', body: { name: $('#an', d).value, title: $('#at', d).value } }); toast(t('saved'), 'ok'); document.dispatchEvent(new Event('kvet:me')); } catch (/** @type {any} */ e) { fail(e); } }; },
      buttons: [...(st.enabled ? (st.required ? [] : [{ label: t('mfaTurnOff'), cls: 'bad ghost', id: 'off' }]) : [{ label: t('mfaTurnOn'), id: 'on' }]), { label: t('close'), cls: 'ghost', id: 'x' }] }).promise;
    if (v === 'on') { if (await mfaSetupDlg()) rerun(); }
    if (v === 'off') { await api('/staff/mfa/disable', { kind: 'staff', body: {} }); toast(t('saved'), 'ok'); }
    return;
  }
  openModal({ title: t('changePassword'), html: `<label>${esc(t('currentPassword'))}<input id="p0" type="password" autocomplete="current-password"></label><label>${esc(t('newPassword'))}<input id="p1" type="password" autocomplete="new-password" minlength="8"></label><label>${esc(t('repeatPassword'))}<input id="p2" type="password" autocomplete="new-password"></label><p class="hint">${esc(t('pwRules'))}</p><div class="err" id="pe" role="alert"></div>`,
    buttons: [{ label: t('cancel'), cls: 'ghost', id: false }, { label: t('save'), id: true, fn: async d => {
      const a = $('#p1', d).value; if (a !== $('#p2', d).value) { $('#pe', d).textContent = t('pwMismatch'); return false; }
      try { const r = await api(`/portal/${kind}/password`, { kind, noRedirect: true, body: { current: $('#p0', d).value, next: a } }); setToken(kind, r.token); toast(t('pwChanged'), 'ok'); return true; }
      catch (/** @type {any} */ x) { $('#pe', d).textContent = x.message === 'badPassword' ? t('badPassword') : x.message === 'weakPassword' ? t('pwRules') : x.message === 'samePassword' ? t('samePassword') : t('server'); return false; } } }] });
}

/** @param {{ kind: string, titleKey: string, icon?: any, boot: (ctx: any) => any, bodyClass?: string }} o */
export function mountPortal({ kind, titleKey, icon: _i, boot, bodyClass = '' }) {
  KIND = kind;
  const app = $('#app'); document.body.classList.add(...(bodyClass ? [bodyClass] : []));
  document.title = 'KVET · ' + t(titleKey);
  const signOut = () => { setToken(kind, ''); if (kind === 'staff') setRefresh(''); run(); };
  /* "Sign out" pressed: the server ends the session too (at most 2 s of waiting; offline, the browser copy is cleared anyway) */
  const leave = async () => {
    if (tokenOf(kind)) await Promise.race([api(kind === 'staff' ? '/staff/logout' : `/portal/${kind}/logout`, { kind, noRedirect: true, body: {} }).catch(() => {}), new Promise(r => setTimeout(r, 2000))]);
    signOut();
  };
  async function run() {
    document.title = 'KVET · ' + t(titleKey);
    if (!tokenOf(kind)) return login();
    app.innerHTML = `<div class="load"><span class="spin"></span></div>`;
    try { await boot({ app, signOut, rerender: run }); if ($('#bellBtn')) startBell(kind); } catch (/** @type {any} */ e) {
      if (e.status === 403 && e.message === 'mfaSetup') return mfaGate();
      if (e.status === 403 && e.message === 'needPassword') return pwGate();
      if (e.status === 401 || e.status === 403) { if (e.status === 403) toast(e.message === 'accountExpired' ? t('accountExpired') : kind === 'staff' && e.message === 'forbidden' ? t('noStaffRole') : t('noAccess'), 'bad'); signOut(); }
      else { fail(e); app.innerHTML = `<div class="card"><p>${esc(errMsg(e))}</p><button class="btn" id="retry">${esc(t('retry'))}</button></div>`; $('#retry').onclick = run; }
    }
  }
  /* The organisation requires two-factor sign-in and this account has none yet. */
  function mfaGate() {
    app.innerHTML = `<div class="login-wrap"><div class="login"><div class="card"><img class="brandlogo" src="/img/logo.png" alt="KVET"><h1>${esc(t('mfaTitle'))}</h1><p>${esc(t('mfaForced'))}</p><button class="btn" id="go" style="width:100%">${esc(t('mfaTurnOn'))}</button><button class="btn ghost" id="so" style="width:100%;margin-top:8px">${esc(t('signOut'))}</button></div></div></div>`;
    $('#go').onclick = async () => { try { if (await mfaSetupDlg({ forced: true })) run(); } catch (/** @type {any} */ e) { fail(e); } };
    $('#so').onclick = leave;
  }
  /* The office requires everybody to choose their own password, and this one is still the generated one. */
  function pwGate() {
    app.innerHTML = `<div class="login-wrap"><div class="login"><div class="card"><img class="brandlogo" src="/img/logo.png" alt="KVET"><h1>${esc(t('changePassword'))}</h1><p>${esc(t('pwForced'))}</p>
      <form id="pf"><label>${esc(t('currentPassword'))}<input id="g0" type="password" autocomplete="current-password" required autofocus></label><label>${esc(t('newPassword'))}<input id="g1" type="password" autocomplete="new-password" minlength="8" required></label><label>${esc(t('repeatPassword'))}<input id="g2" type="password" autocomplete="new-password" required></label><p class="hint">${esc(t('pwRules'))}</p><div class="err" id="ge" role="alert"></div>
      <button class="btn" style="width:100%">${esc(t('save'))}</button></form><button class="btn ghost" id="so" style="width:100%;margin-top:8px">${esc(t('signOut'))}</button></div></div></div>`;
    $('#so').onclick = leave;
    $('#pf').onsubmit = async e => {
      e.preventDefault(); const a = $('#g1').value, btn = e.submitter; if (a !== $('#g2').value) { $('#ge').textContent = t('pwMismatch'); return; }
      btn.disabled = true; $('#ge').textContent = '';
      try { const r = await api(`/portal/${kind}/password`, { kind, noRedirect: true, body: { current: $('#g0').value, next: a } }); setToken(kind, r.token); toast(t('pwChanged'), 'ok'); run(); }
      catch (/** @type {any} */ x) { $('#ge').textContent = x.message === 'badPassword' ? t('badPassword') : x.message === 'weakPassword' ? t('pwRules') : x.message === 'samePassword' ? t('samePassword') : t('server'); btn.disabled = false; }
    };
  }
  function login() {
    document.body.className = bodyClass;
    app.innerHTML = `<div class="login-wrap"><div class="login"><div class="card"><img class="brandlogo" src="/img/logo.png" alt="KVET"><h1>${esc(t(titleKey))}</h1><p class="mute">${esc(t('signInHint'))}</p>
      <form id="lf"><label>${esc(kind === 'staff' ? t('email') : t('login'))}<input name="u" autocomplete="username" ${kind === 'staff' ? 'inputmode="email" autocapitalize="off" spellcheck="false"' : ''} required autofocus></label>
      <label>${esc(t('password'))}<input name="p" type="password" autocomplete="current-password" required></label><div class="err" id="le" role="alert"></div>
      <button class="btn" style="width:100%">${esc(t('signIn'))}</button></form></div>
      <div class="row" style="justify-content:space-between;margin-top:6px"><a href="/" class="sm">← ${esc(t('allPortals'))}</a>${langSwitch()}</div></div></div>`;
    // precise reasons, so a person (or the superadmin, in the audit trail) knows what to fix
    const loginErr = x => (x.message === 'locked' ? t('lockedUntil', x.data?.until ? new Date(x.data.until).toLocaleTimeString().slice(0, 5) : '15 min')
      : x.message === 'forbidden' ? (kind === 'staff' ? t('noStaffRole') : t('noAccess')) : x.message === 'accountExpired' ? t('accountExpired')
      : x.message === 'badCode' ? t('badCode') : x.data?.host || x.status >= 500 || x.message === 'server' ? errMsg(x) : t('badLogin'));
    $('#lf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), btn = e.submitter; $('#le').textContent = ''; btn.disabled = true;
      try {
        if (kind === 'staff') {
          const d = await api('/staff/login', { body: { email: f.get('u'), password: f.get('p') }, kind: 'staff', noRedirect: true });
          if (d.mfa) return codeStep(d);
          setToken('staff', d.access); setRefresh(d.refresh);
        } else { const d = await api('/login', { body: { role: kind, login: f.get('u'), password: f.get('p') }, kind, noRedirect: true }); setToken(kind, d.token); }
        run();
      } catch (/** @type {any} */ x) { $('#le').textContent = loginErr(x); btn.disabled = false; }
    };
    /* second step: 6-digit code from the authenticator app */
    function codeStep(d) {
      $('#lf').innerHTML = `<p>${esc(t('mfaEnter'))}</p><label>${esc(t('mfaCode'))}<input name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required autofocus style="font-size:22px;letter-spacing:6px;text-align:center"></label><div class="err" id="le" role="alert"></div><button class="btn" style="width:100%">${esc(t('signIn'))}</button>`;
      $('#lf [name=c]').focus();
      $('#lf').onsubmit = async e => {
        e.preventDefault(); const btn = e.submitter; btn.disabled = true; $('#le').textContent = '';
        try { const r = await api('/staff/mfa/verify', { kind: 'staff', noRedirect: true, body: { ticket: d.ticket, factorId: d.factorId, code: new FormData(e.target).get('c') } }); setToken('staff', r.access); setRefresh(r.refresh); run(); }
        catch (/** @type {any} */ x) { $('#le').textContent = loginErr(x); btn.disabled = false; }
      };
    }
  }
  document.addEventListener('click', e => {
    const b = e.target?.closest('[data-lang]'); if (b) { setLang(b.dataset.lang).then(run); return; }
    if (e.target?.closest('#signOut')) leave();
    if (e.target?.closest('#account')) accountDlg(kind, run).catch(fail);
  });
  document.addEventListener('kvet:signedout', () => { toast(t('sessionEnded'), 'bad'); run(); });
  run();
  return { run, signOut };
}
