/* Cameras (superadmin). USB / built-in cameras go straight through the browser.
   Network (IP) cameras on Wi-Fi / LAN go through the small "camera bridge" program on a PC in the same network (tools/camera-bridge.mjs):
   an https page cannot open http:// camera addresses, cannot play RTSP and cannot do Digest login, the bridge does all three on http://127.0.0.1:8899. */
import { view, api, $, esc, t, toast, openModal, confirmDlg, empty, pageHead, tabs, S, download } from './lib.js';
import { tokenOf } from '../api.js';

const authH = () => ({ authorization: 'Bearer ' + tokenOf('staff') });
const LS = (() => { try { return localStorage; } catch { return {}; } })();
const bridgeUrl = () => (LS['kvet.bridge'] || 'http://127.0.0.1:8899').replace(/\/+$/, '');
/* the token printed by the bridge when it starts: needed for every control request */
const bridgeTok = () => LS['kvet.bridgeToken'] || '';
const BRIDGE_VERSION = 4;
const bH = () => ({ 'x-bridge-token': bridgeTok(), 'content-type': 'application/json' });
const enc = encodeURIComponent;
const isLocal = u => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(u);
const mixed = u => location.protocol === 'https:' && /^http:\/\//i.test(u) && !isLocal(u);   // blocked by the browser
const hostOf = v => { try { return new URL(/^[a-z]+:\/\//i.test(v) ? v : 'http://' + v).hostname; } catch { return v; } };
const timeoutFetch = (u, ms = 2500, o = {}) => { const c = new AbortController(); const h = setTimeout(() => c.abort(), ms); return fetch(u, { signal: c.signal, cache: 'no-store', ...o }).finally(() => clearTimeout(h)); };
/* The bridge serves a camera only through a random link it hands out for a registered address (no password in any URL). */
const links = new Map();
async function bridgeLink(c, snap) {
  const k = [c.url, c.user || '', c.pass || ''].join('|');
  if (!links.has(k)) { const r = await timeoutFetch(bridgeUrl() + '/register', 5000, { method: 'POST', headers: bH(), body: JSON.stringify({ src: c.url, user: c.user || '', pass: c.pass || '' }) }); if (!r.ok) throw new Error('bridge'); links.set(k, (await r.json()).id); }
  return `${bridgeUrl()}/${snap ? 'snap' : 'live'}?id=${links.get(k)}`;
}

export default async function ({ rerender }) {
  const el = view(); let stream = /** @type {any} */ (null), tab = 'live', devices = [], cur = '', bridge = /** @type {any} */ (null), ip = /** @type {any} */ (null);
  const stopUsb = () => { stream?.getTracks().forEach(x => x.stop()); stream = null; };
  const stopIp = () => { if (ip) { ip.stop(); ip = null; } };
  const stop = () => { stopUsb(); stopIp(); };
  window.addEventListener('hashchange', stop, { once: true });
  const data = async () => api('/cameras', { kind: 'staff' });
  const secure = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

  async function checkBridge() {
    try { const r = await timeoutFetch(bridgeUrl() + '/health', 2000, { headers: { 'x-bridge-token': bridgeTok() } }); bridge = r.ok ? await r.json() : null; } catch { bridge = null; }
    if (bridge && !bridge.auth) bridge = { ...bridge, noToken: true };
    if (bridge && (bridge.version || 0) < BRIDGE_VERSION) bridge = { ...bridge, old: true };   // an older camera-bridge.mjs is still running
    const b = $('#bst'); if (b) b.innerHTML = bridgeBadge();
    return bridge;
  }
  const bridgeBadge = () => bridge?.old && !bridge.noToken ? `<span class="bd PENDING">● ${esc(t('brOld'))}</span>` : bridge?.noToken ? `<span class="bd PENDING">● ${esc(t('brToken'))}</span>` : bridge ? `<span class="bd PASS">● ${esc(t('brOn'))}${bridge.ffmpeg ? ' · RTSP ✓' : ' · RTSP ✗'}</span>` : `<span class="bd FAIL">● ${esc(t('brOff'))}</span>`;

  async function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    stop(); const { cams, snaps } = await data();
    el.innerHTML = pageHead(t('navCameras'), `<button class="btn ghost" id="clr">🗑 ${esc(t('clearCamData'))}</button>`) + `<p class="mute" style="margin-top:-8px">${esc(t('camIntro'))}</p>` + tabs([['live', t('camLive')], ['saved', t('camSaved'), cams.length], ['snaps', t('camSnaps'), snaps.length]], tab)
      + (tab === 'live' ? `<div class="grid g2" style="align-items:start">
        <div class="card"><h2>${esc(t('camUsb'))}</h2><div class="row" style="margin-bottom:8px"><select id="dev" style="flex:1;min-width:180px"><option value="">${esc(t('camChoose'))}</option></select><button class="btn ghost" id="rf" title="${esc(t('camRefresh'))}">🔄</button><button class="btn" id="conn">${esc(t('camConnect'))}</button></div>
          <div class="row" style="margin-bottom:8px"><button class="btn ghost sm" id="allow">🔓 ${esc(t('camAllow'))}</button><span class="mute sm" id="cnt"></span></div>
          <video id="vid" autoplay playsinline muted style="width:100%;background:#000;border-radius:10px;min-height:200px"></video><div class="err" id="ce" role="alert"></div>
          <div class="row" style="margin-top:8px"><button class="btn" id="snap" disabled>📷 ${esc(t('camSnapshot'))}</button><button class="btn ghost" id="save" disabled>💾 ${esc(t('camSaveSetup'))}</button><button class="btn ghost" id="off" disabled>⏹ ${esc(t('camDisconnect'))}</button></div></div>
        <div class="card"><div class="ch"><h2>${esc(t('camIp'))}</h2><span class="grow"></span><span id="bst"></span></div>
          <div class="fg"><label class="req">${esc(t('name'))}<input id="in" maxlength="80" placeholder="${esc(t('camNameEx'))}"></label>
            <label class="req">${esc(t('camAddr'))}<input id="ih" placeholder="192.168.1.64  ·  http://…/video  ·  rtsp://…" autocomplete="off" autocapitalize="off"></label>
            <label>${esc(t('camPort'))} <span class="mute">(${esc(t('optional'))})</span><input id="ipt" type="number" min="1" max="65535" placeholder="80 / 554"></label><div></div>
            <label>${esc(t('login'))}<input id="iu" autocomplete="off" autocapitalize="off"></label><label>${esc(t('password'))}<input id="ip" type="password" autocomplete="new-password"></label></div>
          <p class="hint">${esc(t('camIpHint2'))}</p>
          <div class="row"><button class="btn" id="ic">▶ ${esc(t('camFindConnect'))}</button><button class="btn ghost sm" id="bs">⚙ ${esc(t('camBridgeSettings'))}</button></div><div class="err" id="ie" role="alert"></div><div id="ist" class="mute sm" style="margin-top:6px"></div></div></div>
        <div class="card" id="ipv" style="display:none"><div class="ch"><h2 id="ivt"></h2><span class="grow"></span><span id="ivs" class="mute sm"></span></div>
          <div style="background:#000;border-radius:10px;min-height:240px;display:grid;place-items:center;overflow:hidden"><img id="ivi" alt="" style="max-width:100%;max-height:70vh;display:block"></div>
          <div class="row" style="margin-top:8px"><button class="btn" id="isn">📷 ${esc(t('camSnapshot'))}</button><button class="btn ghost" id="isv">💾 ${esc(t('camSaveSetup'))}</button><button class="btn ghost" id="iso">⏹ ${esc(t('camDisconnect'))}</button><a class="btn ghost" id="ifs" href="#" target="_blank" rel="noopener">⛶</a></div></div>`
        : tab === 'saved' ? `<div class="tw"><table><tbody>${cams.map(c => `<tr><td><b>${esc(c.name)}</b><div class="mute xs">${esc(c.kind === 'ip' ? (c.host || '') + ' ' + (c.url || '').replace(/\/\/[^@/]*@/, '//') : c.label || c.deviceId)}</div></td><td>${esc(c.kind === 'ip' ? (c.mode === 'rtsp' ? 'RTSP' : c.mode === 'snap' ? 'JPEG' : 'IP') : 'USB')}</td><td class="act nowrap">${c.kind === 'ip' ? `<button class="btn sm" data-live="${esc(c.id)}">▶ ${esc(t('camWatch'))}</button> ` : ''}<button class="btn bad ghost sm" data-dc="${esc(c.id)}">🗑</button></td></tr>`).join('') || `<tr><td>${empty('📷', t('camNone'))}</td></tr>`}</tbody></table></div><div id="ipv" class="card" style="display:none;margin-top:14px"><div class="ch"><h2 id="ivt"></h2><span class="grow"></span><span id="ivs" class="mute sm"></span></div><div style="background:#000;border-radius:10px;min-height:240px;display:grid;place-items:center;overflow:hidden"><img id="ivi" alt="" style="max-width:100%;max-height:70vh;display:block"></div><div class="row" style="margin-top:8px"><button class="btn" id="isn">📷 ${esc(t('camSnapshot'))}</button><button class="btn ghost" id="iso">⏹ ${esc(t('camDisconnect'))}</button></div></div>`
        : `<div class="grid g3">${snaps.map(s => `<div class="card" style="padding:8px"><img data-key="${esc(s.key)}" alt="" style="width:100%;border-radius:8px;background:#eee;min-height:100px"><div class="mute xs" style="margin-top:6px">${esc(s.camName)} · ${esc(S.fmtDateTime(s.at))}</div><div class="row"><span class="grow"></span><button class="btn bad ghost sm" data-ds="${esc(s.id)}">🗑</button></div></div>`).join('') || `<div class="card">${empty('🖼', t('camNone'))}</div>`}</div>`);
    for (const im of el.querySelectorAll('img[data-key]')) fetch('/api/camera/snap?key=' + enc(im.dataset.key), { headers: authH() }).then(r => r.blob()).then(b => (im.src = URL.createObjectURL(b))).catch(() => {});
    if (tab === 'live') { wireLive(); wireIp(); } if (tab === 'saved') { wireViewer(); checkBridge(); }
    $('#clr').onclick = clearDlg;
  }

  /* ------------------------------------------------------------- USB / built-in */
  async function listDevices() { try { devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && d.deviceId); } catch { devices = []; } return devices; }
  const errText = e => (!secure() ? t('camInsecure') : e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? t('camDenied') : e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? t('camNotFound') : e?.name === 'NotReadableError' || e?.name === 'AbortError' ? t('camBusy') : t('camDenied'));
  function wireLive() {
    const vid = $('#vid'), ce = $('#ce'), sel = $('#dev'), on = v => ['#snap', '#save', '#off'].forEach(s => ($(s).disabled = !v));
    const fill = () => { sel.innerHTML = `<option value="">${esc(t('camChoose'))}</option>` + devices.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || t('camera') + ' ' + (i + 1))}</option>`).join(''); $('#cnt').textContent = devices.length ? t('camFound', devices.length) : ''; };
    async function connect() {
      ce.textContent = ''; stopUsb(); const id = sel.value;
      try {
        if (!secure()) throw new Error('insecure');
        try { stream = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id } } : true, audio: false }); }
        catch (/** @type {any} */ e) { if (!id || e.name === 'NotAllowedError') throw e; stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
        vid.srcObject = stream; await vid.play().catch(() => {}); cur = stream.getVideoTracks()[0].getSettings().deviceId || id; on(true); await listDevices(); fill();
      } catch (/** @type {any} */ e) { ce.textContent = errText(e); on(false); }
    }
    $('#allow').onclick = async () => { ce.textContent = ''; try { if (!secure()) throw new Error('insecure'); const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); s.getTracks().forEach(x => x.stop()); await listDevices(); fill(); if (!devices.length) ce.textContent = t('camNotFound'); } catch (/** @type {any} */ e) { ce.textContent = errText(e); } };
    $('#rf').onclick = async () => { await listDevices(); fill(); };
    sel.onchange = () => { cur = sel.value; if (sel.value) connect(); }; $('#conn').onclick = connect;
    navigator.mediaDevices?.addEventListener?.('devicechange', async () => { if (!document.body.contains(sel)) return; await listDevices(); fill(); });
    $('#off').onclick = () => { stopUsb(); vid.srcObject = null; on(false); };
    const labelOf = () => devices.find(d => d.deviceId === cur)?.label || t('camera');
    $('#snap').onclick = async () => {
      if (!stream) return; const c = document.createElement('canvas'); c.width = vid.videoWidth || 640; c.height = vid.videoHeight || 480; /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(vid, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
      let cam = (await data()).cams.find(x => x.deviceId === cur && x.kind === 'usb');
      if (!cam) cam = (await api('/camera/save', { kind: 'staff', body: { name: labelOf(), kind: 'usb', deviceId: cur, label: labelOf() } })).cam;
      const r = await fetch('/api/camera/snapshot?cid=' + cam.id, { method: 'POST', headers: authH(), body: blob }); toast(r.ok ? t('saved') : t('server'), r.ok ? 'ok' : 'bad');
    };
    $('#save').onclick = async () => { await api('/camera/save', { kind: 'staff', body: { name: labelOf(), kind: 'usb', deviceId: cur, label: labelOf() } }); toast(t('saved'), 'ok'); };
    if (!secure()) ce.textContent = t('camInsecure'); else listDevices().then(fill);
  }

  /* ------------------------------------------------------------- network cameras */
  /* Shows a camera live (through the bridge when it runs, directly otherwise). Resolves true when the first picture arrived. */
  async function startViewer(c) {
    const useBridge = bridge && !bridge.noToken;
    // through a current bridge every camera is a continuous stream (it turns snapshot cameras into video itself);
    // without a bridge, or with an older bridge, snapshot cameras are fetched picture after picture by the page
    const snapMode = c.mode === 'snap' && (!useBridge || !!bridge.old);
    let src0; try { src0 = useBridge ? await bridgeLink(c, snapMode) : c.url; } catch { $('#ivs').textContent = t('camBridgeErr'); return false; }
    const imgSrc = () => src0 + (snapMode ? (src0.includes('?') ? '&' : '?') + 't=' + Date.now() : '');
    const box = $('#ipv'), img = $('#ivi'), st = $('#ivs'); box.style.display = ''; $('#ivt').textContent = c.name || c.host || c.url.replace(/\/\/[^@/]*@/, '//');
    stopIp(); let alive = true, frames = 0, t0 = Date.now(), timer = 0, stats = 0;
    img.crossOrigin = 'anonymous';
    const show = f => { st.textContent = frames ? `● ${t('camLiveNow')}${f !== null ? ` · ${f.toFixed(1)} fps` : ''}` : t('camConnecting'); };
    const run = new Promise(resolve => {
      if (!useBridge && mixed(c.url)) { st.textContent = t('camMixed'); resolve(false); return; }
      if (snapMode) {
        // direct snapshot camera: next picture right after the previous one (no fixed pause)
        const tick = () => { if (!alive) return; const t1 = Date.now(), p = new Image(); p.crossOrigin = 'anonymous'; p.onload = () => { if (!alive) return; img.src = p.src; frames++; show(frames / Math.max((Date.now() - t0) / 1000, 1)); resolve(true); timer = setTimeout(tick, Math.max(0, 66 - (Date.now() - t1))); }; p.onerror = () => { if (!alive) return; if (!frames) resolve(false); else timer = setTimeout(tick, 1500); }; p.src = imgSrc(); };
        tick();
      } else {
        img.onload = () => { if (!alive) return; frames++; if (frames === 1) resolve(true); show(null); };
        img.onerror = () => { if (!alive) return; st.textContent = t('camLost'); resolve(false); };
        img.src = imgSrc();
        // the real frame rate is measured by the bridge (a browser <img> stream does not report frames)
        // watchdog: no new frames for ~6 s -> reconnect the stream
        if (useBridge && !bridge.old) { const id = new URL(src0).searchParams.get('id'); let still = 0; stats = setInterval(async () => { if (!alive || !frames) return; try { const f = (await (await timeoutFetch(`${bridgeUrl()}/stats?id=${id}`, 1500)).json()).fps; show(f); still = f > 0 ? 0 : still + 1; if (still >= 3) { still = 0; st.textContent = t('camReconnect'); img.src = src0 + (src0.includes('?') ? '&' : '?') + 'r=' + Date.now(); } } catch {} }, 2000); }
      }
      setTimeout(() => resolve(false), 15000);
    });
    ip = { cam: c, stop() { alive = false; clearTimeout(timer); clearInterval(stats); img.onload = img.onerror = null; img.removeAttribute('src'); } };
    const fs = $('#ifs'); if (fs) fs.href = src0;
    show(null); return run;
  }
  /* Snapshot of whatever the viewer shows -> server. */
  async function viewerSnap(c) {
    const img = $('#ivi'); if (!img.naturalWidth) return toast(t('camConnecting'), 'bad');
    let blob; try { const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')).drawImage(img, 0, 0); blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85)); } catch { blob = null; }
    if (!blob) return toast(t('camSnapCors'), 'bad');
    const cam = c.id ? c : (await api('/camera/save', { kind: 'staff', body: { ...c, kind: 'ip' } })).cam; c.id = cam.id;
    const r = await fetch('/api/camera/snapshot?cid=' + cam.id, { method: 'POST', headers: authH(), body: blob }); toast(r.ok ? t('saved') : t('server'), r.ok ? 'ok' : 'bad');
  }
  function wireViewer() {
    $('#isn')?.addEventListener('click', () => ip && viewerSnap(ip.cam)); $('#iso')?.addEventListener('click', () => { stopIp(); $('#ipv').style.display = 'none'; });
    $('#isv')?.addEventListener('click', async () => { if (!ip) return; const r = await api('/camera/save', { kind: 'staff', body: { ...ip.cam, kind: 'ip', id: ip.cam.id } }); ip.cam.id = r.cam.id; toast(t('saved'), 'ok'); });
  }
  function wireIp() {
    const ie = $('#ie'), ist = $('#ist'), note = m => (ist.textContent = m);
    wireViewer(); checkBridge();
    $('#bs').onclick = () => bridgeDlg();
    $('#ic').onclick = async () => {
      ie.textContent = ''; note('');
      const name = $('#in').value.trim(), addr = $('#ih').value.trim(), user = $('#iu').value, pass = $('#ip').value;
      if (!name || !addr) { ie.textContent = t('fillAll'); return; }
      const b = $('#ic'); b.disabled = true;
      try {
        let port = $('#ipt').value.trim(); if (!port) { try { port = new URL(/^[a-z]+:\/\//i.test(addr) ? addr : 'http://' + addr).port; } catch {} }
        await checkBridge(); const base = { name, host: hostOf(addr), port: port ? Number(port) : '', user, pass };
        /** @type {any} */ let cam = null;
        if (/^(https?|rtsp):\/\//i.test(addr) && /\/[^/]/.test(addr.replace(/^[a-z]+:\/\/[^/]*/i, '/x') ) && addr.replace(/^[a-z]+:\/\/[^/]+/i, '').length > 1) {      // a full picture address was typed
          cam = { ...base, url: addr, mode: /^rtsp/i.test(addr) ? 'rtsp' : /snap|jpe?g|image|capture|picture/i.test(addr) ? 'snap' : 'mjpeg' };
          if (cam.mode === 'rtsp' && !bridge?.ffmpeg) { ie.textContent = bridge ? t('camNoFfmpeg') : t('camNeedBridge'); return; }
          if (!(await startViewer(cam))) { stopIp(); ie.textContent = bridge ? t('camNoPicture') : mixed(addr) ? t('camMixed') : t('camNoPicture'); return; }
        } else if (bridge && !bridge.noToken) {
          note(t('camProbing', base.host));
          let pr; try { pr = await (await timeoutFetch(`${bridgeUrl()}/probe`, 60000, { method: 'POST', headers: bH(), body: JSON.stringify({ host: base.host, port, proto: /^https:/i.test(addr) ? 'https' : '', user, pass }) })).json(); } catch { ie.textContent = t('camBridgeErr'); return; }
          if (pr.error) { ie.textContent = pr.error; return; }
          const cands = [...pr.found.flatMap(f => [{ ...base, url: f.url, mode: f.kind === 'snap' ? 'snap' : 'mjpeg' }, ...(/\/video$/.test(f.url) ? [{ ...base, url: f.url.replace(/\/video$/, '/shot.jpg'), mode: 'snap' }] : [])]), ...(pr.ffmpeg ? pr.rtsp.map(u => ({ ...base, url: u, mode: 'rtsp' })) : [])];
          if (!pr.openPorts.length) { ie.textContent = t('camUnreachable', base.host); return; }
          if (!cands.length) { ie.textContent = pr.needLogin ? t('camNeedLogin') : t('camNoUrl'); note(t('camPorts', pr.openPorts.join(', '))); return; }
          for (const [i, c] of cands.entries()) { note(t('camTrying', i + 1, cands.length)); if (await startViewer(c)) { cam = c; break; } stopIp(); }
          if (!cam) { ie.textContent = pr.needLogin ? t('camNeedLogin') : t('camNoPicture'); note(t('camPorts', pr.openPorts.join(', '))); return; }
          if (cam.mode === 'rtsp') cam.url = cam.url.replace(/\/\/[^@/]*@/, '//');       // the login is stored in its own fields
        } else {
          // no bridge: try the usual addresses directly (only possible from an http page or toward https cameras)
          const tries = [['/video', 'mjpeg'], ['/shot.jpg', 'snap'], ['/mjpg/video.mjpg', 'mjpeg'], ['/videostream.cgi', 'mjpeg'], ['/snapshot.jpg', 'snap'], ['/cgi-bin/snapshot.cgi', 'snap'], ['/image.jpg', 'snap']].map(([p, m]) => ({ ...base, url: `http://${base.host}${port ? ':' + port : ''}${p}`, mode: m }));
          if (mixed(tries[0].url)) { ie.textContent = t('camMixed'); note(t('camNeedBridge')); bridgeDlg(); return; }
          for (const [i, c] of tries.entries()) { note(t('camTrying', i + 1, tries.length)); if (await startViewer(c)) { cam = c; break; } stopIp(); }
          if (!cam) { ie.textContent = t('camNoUrl'); return; }
        }
        note(t('camConnectedVia', bridge ? t('camViaBridge') : t('camDirect')));
        try { const r = await api('/camera/save', { kind: 'staff', body: { ...cam, kind: 'ip' } }); cam.id = r.cam.id; ip.cam = cam; } catch { /* viewing works even if saving fails */ }
      } finally { b.disabled = false; }
    };
  }
  /* Camera bridge set-up. The bridge is a small program on a PC in the same Wi-Fi as the camera (an https page cannot open
     http:// cameras by itself). Its address is the PC's (normally http://127.0.0.1:8899) - NOT the camera's or the phone's. */
  function bridgeDlg() {
    const bat = (remote = false) => new Blob([`@echo off\r\ncd /d "%~dp0"\r\ntitle KVET camera bridge\r\nwhere node >nul 2>nul || (echo Node.js is not installed. Download it from https://nodejs.org and run this file again. & pause & exit /b)\r\n${remote ? 'where cloudflared >nul 2>nul || (echo Installing cloudflared... & winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements)\r\n' : ''}node camera-bridge.mjs --origin ${location.origin}${remote ? ' --tunnel' : ''}\r\npause\r\n`], { type: 'application/octet-stream' });
    const sh = () => new Blob([`#!/bin/sh\ncd "$(dirname "$0")"\nnode camera-bridge.mjs --origin ${location.origin}\n`], { type: 'application/octet-stream' });
    openModal({ title: t('camBridgeSettings'), wide: true, html: `<p>${esc(t('camBridgeWhy'))}</p>
      <ol class="sm"><li>${esc(t('camBridgeNode'))} <a href="https://nodejs.org" target="_blank" rel="noopener">nodejs.org</a></li>
        <li>${esc(t('camBridgeDl'))}<div class="row" style="margin:6px 0"><a class="btn ghost sm" href="/tools/camera-bridge.mjs" download>⬇ camera-bridge.mjs</a><button type="button" class="btn ghost sm" id="dbat">⬇ start-camera-bridge.bat (Windows)</button><button type="button" class="btn ghost sm" id="dsh">⬇ start-camera-bridge.sh (Mac/Linux)</button></div></li>
        <li>${esc(t('camBridgeRun'))}<pre class="mono" style="background:var(--soft);padding:8px;border-radius:6px;white-space:pre-wrap">node camera-bridge.mjs --origin ${esc(location.origin)}</pre></li>
        <li>${esc(t('camBridgeTok'))}</li></ol>
      <label>${esc(t('camBridgeAddr'))}<input id="bu" value="${esc(bridgeUrl())}"><span class="hint">${esc(t('camBridgeHint'))}</span></label><div id="bw"></div>
      <label>${esc(t('camBridgeToken'))}<input id="bt" class="mono" value="${esc(bridgeTok())}" autocomplete="off"></label><div id="bres"></div>
      <div class="banner" style="margin-top:12px"><b>${esc(t('camRemoteTitle'))}</b><br>${esc(t('camRemoteText'))}<div class="row" style="margin-top:6px"><button type="button" class="btn ghost sm" id="dbatr">⬇ start-camera-bridge-remote.bat (Windows)</button></div><pre class="mono" style="background:var(--soft);padding:6px 8px;border-radius:6px;white-space:pre-wrap;margin:6px 0 0">node camera-bridge.mjs --origin ${esc(location.origin)} --tunnel</pre></div>
      <div class="banner" style="margin-top:12px"><b>${esc(t('camPhoneAlt'))}</b><br>${esc(t('camPhoneAltText'))}</div>`,
      onMount: d => {
        $('#dbat', d).onclick = () => download(bat(), 'start-camera-bridge.bat'); $('#dbatr', d).onclick = () => download(bat(true), 'start-camera-bridge-remote.bat'); $('#dsh', d).onclick = () => download(sh(), 'start-camera-bridge.sh');
        // the most common mistake: the camera / phone address typed as the bridge address
        const chk = () => { const v = $('#bu', d).value.trim(); let warn = ''; try { const u = new URL(/^[a-z]+:\/\//i.test(v) ? v : 'http://' + v); if (u.protocol === 'https:') warn = ''; else if (u.port && u.port !== '8899') warn = t('camBridgeWrongAddr'); else if (!['127.0.0.1', 'localhost'].includes(u.hostname)) warn = t('camBridgeOtherPc'); } catch { warn = t('camBridgeWrongAddr'); }
          $('#bw', d).innerHTML = warn ? `<div class="banner warn" style="margin:-4px 0 8px">${esc(warn)} <button type="button" class="btn ghost sm" id="bfix">http://127.0.0.1:8899</button></div>` : '';
          $('#bfix', d)?.addEventListener('click', () => { $('#bu', d).value = 'http://127.0.0.1:8899'; chk(); }); };
        $('#bu', d).oninput = chk; chk();
      },
      buttons: [{ label: t('camBridgeTest'), cls: 'ghost', fn: async d => { LS['kvet.bridge'] = $('#bu', d).value.trim() || 'http://127.0.0.1:8899'; LS['kvet.bridgeToken'] = $('#bt', d).value.trim(); links.clear(); await checkBridge(); $('#bres', d).innerHTML = bridge?.noToken ? `<div class="banner warn">${esc(t('brToken'))}</div>` : bridge ? `<div class="banner ok">${esc(t('brOn'))} · ffmpeg ${bridge.ffmpeg ? '✓' : '✗'}</div>` : `<div class="banner bad">${esc(t('brOff'))}<br><span class="sm">${esc(t('brOffHelp'))}</span></div>`; return false; } }, { label: t('close'), id: 'x' }] });
  }

  /* ------------------------------------------------------------- clear + list actions */
  function clearDlg() {
    openModal({ title: t('clearCamData'), html: `<p>${esc(t('clearCamHint'))}</p><label class="chk"><input type="checkbox" id="ca"> ${esc(t('clearSetups'))}</label>`, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('clearCamData'), cls: 'bad', id: 'ok', fn: async d => { await api('/cameras/clear', { kind: 'staff', body: { all: $('#ca', d).checked } }); toast(t('deleted'), 'ok'); return true; } }] }).promise.then(v => v === 'ok' && draw());
  }
  await draw();
  el.onclick = async e => {
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; return draw(); }
    const lv = e.target.closest('[data-live]');
    if (lv) { const c = (await data()).cams.find(x => x.id === lv.dataset.live); if (!c) return; await checkBridge(); const ok = await startViewer(c); if (!ok) { toast(bridge || !mixed(c.url) ? t('camNoPicture') : t('camMixed'), 'bad'); } $('#ipv').scrollIntoView?.({ behavior: 'smooth' }); return; }
    const dc = e.target.closest('[data-dc]'), ds = e.target.closest('[data-ds]');
    if (dc || ds) { if (!await confirmDlg(t('deleteConfirm'), { danger: true })) return; await api('/camera/delete', { kind: 'staff', body: { id: dc ? dc.dataset.dc : ds.dataset.ds, snap: !!ds } }); draw(); }
  };
}
