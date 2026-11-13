/* Public QR page: shows only the learner number, name(s), training dates, expiry date and status. No certificate view or download. */
import * as S from './shared.js';
import { $, esc, t, langSwitch, setLang, badge } from './ui.js';

const q = new URLSearchParams(location.search);
/* ?s=ABCD-1234 : check an electronic signature printed on a document */
async function runSign() {
  document.title = 'KVET · ' + t('esignCheck');
  const app = $('#app'); let d = /** @type {any} */ (null);
  try { const r = await fetch('/api/verify-sign?c=' + encodeURIComponent(q.get('s') || '')); if (r.ok) d = await r.json(); } catch {}
  const DOC = { cert: t('certificate'), att: t('attSheet'), prac: t('practicalSheet'), doh: t('dohTitle'), tbt: t('toolboxTalk'), test: t('test'), ev: t('trainerEvalDoc'), fb: t('feedbackSummaryDoc') }, ok = d?.status === 'VALID';
  const rows = d ? [[t('document'), esc(DOC[d.doc] || d.doc) + (d.role === 'approver' ? ' · ' + esc(t('approvalSign')) : '') + (d.ref ? ` <span class="mono">${esc(d.ref)}</span>` : '')], [t('signerName'), `<b>${esc(d.name)}</b>${d.title ? '<br><span class="mute sm">' + esc(d.title) + '</span>' : ''}`], [t('signedAt'), esc(S.fmtDateTime(d.at))], [t('code'), `<span class="mono">${esc(d.code)}</span>`]] : [];
  app.innerHTML = `<div class="login-wrap"><div class="login" style="max-width:460px"><div class="card" style="text-align:center"><img class="brandlogo" src="${esc(d?.info?.logo || '/img/logo.png')}" alt="" style="max-height:60px;margin-bottom:8px">
    ${d ? `<div style="font-size:44px">${ok ? '✅' : '⚠️'}</div><h1 style="margin:4px 0 8px">${esc(t('sig_' + d.status))}</h1><p class="mute sm">${esc(t('sigHint_' + d.status))}</p>
      <table style="text-align:left;margin-top:10px;width:100%"><tbody>${rows.map(([k, v]) => `<tr><td class="mute sm" style="padding:6px 8px 6px 0;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${v}</td></tr>`).join('')}</tbody></table>`
      : `<div style="font-size:44px">❌</div><h1>${esc(t('sigNotFound'))}</h1><p><a href="/verify.html">${esc(t('tryAnotherCode'))}</a></p>`}</div><div class="row" style="justify-content:flex-end;margin-top:8px">${langSwitch()}</div></div></div>`;
}
function askCode() {
  document.title = 'KVET · ' + t('esignCheck');
  $('#app').innerHTML = `<div class="login-wrap"><div class="login" style="max-width:420px"><div class="card" style="text-align:center"><img class="brandlogo" src="/img/logo.png" alt="" style="max-height:60px;margin-bottom:8px"><h1 style="margin:4px 0 8px">${esc(t('esignCheck'))}</h1><p class="mute sm">${esc(t('enterCodeHint'))}</p>
    <form id="cf" class="row" style="margin-top:10px"><input id="cc" class="mono grow" placeholder="ABCD-1234-EF56" maxlength="14" autocomplete="off" autofocus style="text-transform:uppercase;text-align:center;font-size:18px"><button class="btn">${esc(t('check'))}</button></form></div><div class="row" style="justify-content:flex-end;margin-top:8px">${langSwitch()}</div></div></div>`;
  $('#cf').onsubmit = e => { e.preventDefault(); const v = $('#cc').value.trim(); if (v) location.search = '?s=' + encodeURIComponent(v); };
}
async function run() {
  if (q.get('s')) return runSign();
  if (!q.get('n')) return askCode();
  document.title = 'KVET · ' + t('verifyTitle');
  const app = $('#app'); app.innerHTML = `<div class="login-wrap"><div class="login"><div class="card"><div class="load"><span class="spin"></span></div></div></div></div>`;
  /** @type {any} */ let d = null;
  try { const r = await fetch(`/api/verify?n=${encodeURIComponent(q.get('n') || '')}&h=${encodeURIComponent(q.get('h') || '')}`); if (r.ok) d = await r.json(); } catch {}
  const logo = d?.info?.logo || '/img/logo.png';
  // a deleted certificate: say plainly that it is not valid, nothing else about the person
  if (d?.status === 'PENDING_APPROVAL') {
    app.innerHTML = `<div class="login-wrap"><div class="login" style="max-width:440px"><div class="card" style="text-align:center"><img class="brandlogo" src="${esc(logo)}" alt="" style="max-height:60px;margin-bottom:8px"><div style="font-size:44px">⏳</div><h1 style="margin:4px 0 8px">${esc(t('certPendingApproval'))}</h1><p class="mono">${esc(d.no)}</p><p class="mute">${esc(t('certPendingApprovalHint'))}</p></div><div class="row" style="justify-content:flex-end;margin-top:8px">${langSwitch()}</div></div></div>`;
    return;
  }
  if (d?.status === 'INVALID') {
    app.innerHTML = `<div class="login-wrap"><div class="login" style="max-width:440px"><div class="card" style="text-align:center"><img class="brandlogo" src="${esc(logo)}" alt="" style="max-height:60px;margin-bottom:8px"><div style="font-size:44px">⛔</div><h1 style="margin:4px 0 8px">${esc(t('certInvalid'))}</h1><p class="mono">${esc(d.no)}</p><p class="mute">${esc(t('certInvalidHint'))}</p></div><div class="row" style="justify-content:flex-end;margin-top:8px">${langSwitch()}</div></div></div>`;
    return;
  }
  const rows = d ? [[t('certNo'), `<b class="mono">${esc(d.no || q.get('n') || '')}</b>`], ...(d.status === 'REVOKED' && d.revokedAt ? [[t('revokedOn'), `<b style="color:var(--bad)">${esc(S.fmtDate(d.revokedAt))}</b>`]] : []), [t('learnerNo'), `<b class="mono">${esc(d.att)}</b>`], ...(d.foreign ? [[t('fullName'), `<b>${esc(d.names.en)}</b>`]] : [[t('fullName'), `<b>${esc(d.names.az)}</b>`], [t('fullNameEn'), esc(d.names.en)]]),
    [t('trainingDates'), esc(S.fmtDate(d.start)) + (d.end && d.end !== d.start ? ' – ' + esc(S.fmtDate(d.end)) : '')], [t('expiryDate'), `<b>${esc(S.fmtDate(d.expiry))}</b>`],
    ...(d.sign ? [[t('signedByLbl'), `<b>${esc(d.sign.name)}</b>${d.sign.title ? '<br><span class="mute sm">' + esc(d.sign.title) + '</span>' : ''}<br><span class="sm">${esc(d.sign.mode === 'image' ? t('signModeImg') : t('signModeE'))} · ${esc(S.fmtDateTime(d.sign.at))}</span><br><a class="mono sm" href="?s=${esc(d.sign.code)}">${esc(d.sign.code)}</a>`]] : [[t('signedByLbl'), `<span class="mute">${esc(t('notSigned'))}</span>`]])] : [];
  const good = d && (d.status === 'ACTIVE' || d.status === 'SOON');
  app.innerHTML = `<div class="login-wrap"><div class="login" style="max-width:440px"><div class="card" style="text-align:center"><img class="brandlogo" src="${esc(logo)}" alt="" style="max-height:60px;margin-bottom:8px">
    ${d ? `<div style="font-size:44px">${good ? '✅' : d.status === 'REVOKED' ? '⛔' : '⚠️'}</div><h1 style="margin:4px 0 8px">${esc(t(good ? 'certValid' : 'cs_' + d.status))}</h1>${badge(d.status, t('cs_' + d.status))}
      <table style="text-align:left;margin-top:14px;width:100%"><tbody>${rows.map(([k, v]) => `<tr><td class="mute sm" style="padding:6px 8px 6px 0;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${v}</td></tr>`).join('')}</tbody></table>`
      : `<div style="font-size:44px">❌</div><h1>${esc(t('certNotFound'))}</h1><p class="mute">${esc(t('certNotFoundHint'))}</p>`}</div>
    <div class="row" style="justify-content:flex-end;margin-top:8px">${langSwitch()}</div></div></div>`;
}
document.addEventListener('click', e => { const b = e.target?.closest('[data-lang]'); if (b) { setLang(b.dataset.lang).then(run); } });
run();
