#!/usr/bin/env node
/* KVET camera bridge: runs on a PC that is on the same Wi-Fi / LAN as the IP cameras.
   Browsers cannot (a) open http:// camera addresses from an https page, (b) play RTSP, (c) log in to cameras with Digest authentication.
   This program does all three and serves the picture on http://127.0.0.1:8899, which browsers DO allow from the https admin page.

     node camera-bridge.mjs --origin https://your-kvet-domain          (the address of YOUR admin page; required)

   Options / environment: --origin / ALLOW_ORIGIN (comma-separated), --token / BRIDGE_TOKEN, PORT (8899), BIND (127.0.0.1).
   Needs Node 18+. RTSP cameras additionally need ffmpeg on the PATH.

   Safety:
   - only the admin page's own origin may talk to it (other web sites open in the same browser are refused)
   - every control request carries the bridge TOKEN (printed at start, saved in ~/.kvet-camera-bridge-token); paste it once in Admin -> Cameras -> Camera bridge
   - pictures are only served for camera addresses registered with the token; the browser then loads them through a random,
     single-camera link (no passwords in any address), and only image/video responses are relayed
   - talks only to private-network addresses (192.168.x, 10.x, 172.16-31.x, 169.254.x, localhost), listens on 127.0.0.1, writes no files except the token */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
const PORT = Number(process.env.PORT || 8899), HOST = process.env.BIND || '127.0.0.1';
export const ALLOWED = String(arg('origin') || process.env.ALLOW_ORIGIN || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const TOKEN_FILE = path.join(os.homedir(), '.kvet-camera-bridge-token');
let TOKEN = arg('token') || process.env.BRIDGE_TOKEN || '';
export const setToken = t => (TOKEN = t);
function loadToken() {
  if (TOKEN) return TOKEN;
  try { TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch {}
  if (!/^[a-f0-9]{32,}$/.test(TOKEN)) { TOKEN = crypto.randomBytes(20).toString('hex'); try { fs.writeFileSync(TOKEN_FILE, TOKEN, { mode: 0o600 }); } catch {} }
  return TOKEN;
}
/* registered cameras: random id -> { src, user, pass } (memory only, forgotten when the bridge stops) */
const CAMS = new Map();
/* real frame rate per camera link, measured on what the bridge actually delivers */
const STATS = new Map();
function frameCounter(id) {
  const st = STATS.get(id) || { n: 0, t: Date.now(), fps: 0 }; STATS.set(id, st);
  return k => { st.n += k; const now = Date.now(); if (now - st.t >= 2000) { st.fps = Math.round((st.n * 10000) / (now - st.t)) / 10; st.n = 0; st.t = now; } };
}
/* counts JPEG start-of-image markers (FF D8 FF) in a passing MJPEG stream */
function countJpegs(buf, carry) { let n = 0; const b = carry.length ? Buffer.concat([carry, buf]) : buf; for (let i = 0; i + 2 < b.length; i++) if (b[i] === 0xff && b[i + 1] === 0xd8 && b[i + 2] === 0xff) { n++; i += 2; } return { n, carry: b.subarray(Math.max(0, b.length - 2)) }; }
/* A camera that only gives single pictures (IP Webcam /shot.jpg, ISAPI picture…) is turned into a video stream here:
   the next picture is fetched as soon as the previous one arrived (max `fps` per second), so the browser gets one smooth stream. */
async function snapStream(res, cam, fps, count) {
  let alive = true; res.on('close', () => { alive = false; });
  res.writeHead(200, { 'content-type': `multipart/x-mixed-replace;boundary=${BOUNDARY}`, 'cache-control': 'no-store' });
  const gap = 1000 / Math.min(Math.max(fps, 1), 25);
  while (alive) {
    const t0 = Date.now();
    try {
      const r = await open(cam.src, cam.user, cam.pass, 6000);
      if (r.statusCode !== 200) { r.resume(); await new Promise(z => setTimeout(z, 1000)); continue; }
      const chunks = []; for await (const c of r) chunks.push(c); const jpg = Buffer.concat(chunks);
      if (!alive) break;
      res.write(`--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpg.length}\r\n\r\n`); res.write(jpg); res.write('\r\n'); count(1);
    } catch { await new Promise(z => setTimeout(z, 1000)); }
    const wait = gap - (Date.now() - t0); if (wait > 0) await new Promise(z => setTimeout(z, wait));
  }
}

/* ------------------------------------------------------------------ target safety */
export function isPrivateHost(h) {
  h = String(h || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost') return true;
  if (net.isIPv4(h)) { const [a, b] = h.split('.').map(Number); return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254); }
  if (net.isIPv6(h)) return h === '::1' || /^f[cd]/.test(h) || h.startsWith('fe80');
  return /\.(local|lan|home|internal)$/.test(h) || !h.includes('.');           // mDNS / single-label LAN names
}
export function parseTarget(src) {
  let u; try { u = new URL(src); } catch { throw new Error('bad address'); }
  if (!['http:', 'https:', 'rtsp:'].includes(u.protocol)) throw new Error('only http, https and rtsp addresses');
  if (!isPrivateHost(u.hostname)) throw new Error('only cameras on the local network are allowed');
  return u;
}

/* ------------------------------------------------------------------ HTTP client with Basic + Digest */
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
function digestHeader(h, method, uri, user, pass) {
  const p = {}; for (const m of h.matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]+))/g)) p[m[1].toLowerCase()] = m[2] ?? m[3];
  const cnonce = crypto.randomBytes(8).toString('hex'), nc = '00000001', qop = (p.qop || '').split(',')[0].trim();
  const ha1 = md5(`${user}:${p.realm}:${pass}`), ha2 = md5(`${method}:${uri}`);
  const resp = qop ? md5(`${ha1}:${p.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${p.nonce}:${ha2}`);
  return `Digest username="${user}", realm="${p.realm}", nonce="${p.nonce}", uri="${uri}", response="${resp}"${p.opaque ? `, opaque="${p.opaque}"` : ''}${qop ? `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"` : ''}${p.algorithm ? `, algorithm=${p.algorithm}` : ''}`;
}
function once(u, headers, timeout) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method: 'GET', headers, rejectUnauthorized: false, timeout }, resolve);   // cameras use self-signed certificates
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end();
  });
}
/* Opens the camera address and resolves with the response (stream still unread). Tries no auth, then Basic or Digest as the camera asks. */
export async function open(url, user = '', pass = '', timeout = 6000) {
  const u = new URL(url); if (u.username) { user = user || decodeURIComponent(u.username); pass = pass || decodeURIComponent(u.password); u.username = u.password = ''; }
  const base = { 'user-agent': 'kvet-camera-bridge', accept: '*/*' };
  let r = await once(u, base, timeout);
  if (r.statusCode === 401 && user) {
    const ch = String(r.headers['www-authenticate'] || ''); r.resume();
    const auth = /^digest/i.test(ch) ? digestHeader(ch.replace(/^digest\s*/i, ''), 'GET', u.pathname + u.search, user, pass) : 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    r = await once(u, { ...base, authorization: auth }, timeout);
  }
  return r;
}

/* ------------------------------------------------------------------ what a camera might call its picture */
const PATHS = [   // [path, kind]  kind: mjpeg = continuous stream, snap = single jpeg
  ['/video', 'mjpeg'], ['/videofeed', 'mjpeg'], ['/shot.jpg', 'snap'], ['/mjpegfeed', 'mjpeg'], ['/mjpegfeed?640x480', 'mjpeg'], ['/live.mjpg', 'mjpeg'], ['/mjpg/video.mjpg', 'mjpeg'], ['/axis-cgi/mjpg/video.cgi', 'mjpeg'], ['/videostream.cgi', 'mjpeg'], ['/video.cgi', 'mjpeg'], ['/cgi-bin/mjpeg', 'mjpeg'], ['/stream', 'mjpeg'], ['/mjpeg', 'mjpeg'], ['/live/mjpeg', 'mjpeg'], ['/video.mjpg', 'mjpeg'], ['/cgi-bin/video.cgi', 'mjpeg'], ['/cgi-bin/mjpg/video.cgi', 'mjpeg'], ['/Streaming/channels/102/httppreview', 'mjpeg'],
  ['/ISAPI/Streaming/channels/101/picture', 'snap'], ['/ISAPI/Streaming/channels/1/picture', 'snap'], ['/cgi-bin/snapshot.cgi', 'snap'], ['/snapshot.jpg', 'snap'], ['/snapshot.cgi', 'snap'], ['/image.jpg', 'snap'], ['/jpg/image.jpg', 'snap'], ['/axis-cgi/jpg/image.cgi', 'snap'], ['/tmpfs/auto.jpg', 'snap'], ['/capture', 'snap'], ['/image/jpeg.cgi', 'snap'], ['/onvif/snapshot', 'snap'], ['/cgi-bin/api.cgi?cmd=Snap&channel=0', 'snap'],
];
const RTSP = ['/', '/stream1', '/stream', '/live', '/h264', '/Streaming/Channels/101', '/cam/realmonitor?channel=1&subtype=1', '/cam/realmonitor?channel=1&subtype=0', '/h264Preview_01_sub', '/h264Preview_01_main', '/live/ch0', '/live/ch00_1', '/1', '/11', '/user=admin_password=_channel=1_stream=0.sdp?real_stream'];

const ctype = r => String(r.headers['content-type'] || '').toLowerCase();
async function tryHttp(base, path, kind, user, pass, timeout = 3500) {
  const url = base + path;
  try {
    const r = await open(url, user, pass, timeout), t = ctype(r);
    if (r.statusCode === 401) { r.resume(); return { url, ok: false, auth: true }; }
    const good = r.statusCode === 200 && (kind === 'mjpeg' ? t.includes('multipart') || t.includes('mjpeg') : t.includes('image/jpeg') || t.includes('image/jpg'));
    r.destroy(); return { url, kind, ok: good, status: r.statusCode, type: t };
  } catch (e) { return { url, ok: false, error: e.code || e.message }; }
}
function tcp(host, port, ms = 1500) { return new Promise(res => { const s = net.connect({ host, port, timeout: ms }); s.on('connect', () => { s.destroy(); res(true); }); s.on('timeout', () => { s.destroy(); res(false); }); s.on('error', () => res(false)); }); }

/* Probe a camera: which ports answer and which picture addresses work. */
export async function probe({ host, port, proto, user, pass }) {
  if (!isPrivateHost(host)) throw new Error('only cameras on the local network are allowed');
  const ports = port ? [Number(port)] : [80, 8080, 443, 8000, 8081, 554, 8554];
  const open_ = []; await Promise.all(ports.map(async p => { if (await tcp(host, p)) open_.push(p); }));
  const found = [], authNeeded = []; const webPorts = open_.filter(p => ![554, 8554].includes(p));
  for (const p of webPorts) {
    const sch = proto === 'https' || p === 443 || p === 8443 ? 'https' : 'http', base = `${sch}://${host}:${p}`;
    // a few at a time: phone camera apps (IP Webcam, DroidCam…) and cheap cameras only serve 1-3 connections at once
    // video streams first (one at a time, they can take a moment to start), snapshot addresses only when no stream answers
    for (const [path, kind] of PATHS.filter(x => x[1] === 'mjpeg')) {
      if (found.length) break;
      const r = await tryHttp(base, path, kind, user, pass, 6000); if (r.ok) found.push({ url: r.url, kind: r.kind }); else if (r.auth) authNeeded.push(r.url);
    }
    const snaps = PATHS.filter(x => x[1] === 'snap');
    for (let i = 0; i < snaps.length && !found.length; i += 3) {
      const rs = await Promise.all(snaps.slice(i, i + 3).map(([path, kind]) => tryHttp(base, path, kind, user, pass)));
      for (const r of rs) { if (r.ok) found.push({ url: r.url, kind: r.kind }); else if (r.auth) authNeeded.push(r.url); }
    }
    if (found.length) break;
  }
  const rtspPort = open_.find(p => [554, 8554].includes(p));
  const rtsp = rtspPort ? RTSP.map(path => `rtsp://${user ? encodeURIComponent(user) + ':' + encodeURIComponent(pass || '') + '@' : ''}${host}:${rtspPort}${path}`) : [];
  return { host, openPorts: open_.sort((a, b) => a - b), found, needLogin: !found.length && authNeeded.length > 0, rtsp, ffmpeg: await hasFfmpeg() };
}

let ffOk = null;
function hasFfmpeg() { if (ffOk !== null) return Promise.resolve(ffOk); return new Promise(res => { const p = spawn('ffmpeg', ['-version']); p.on('error', () => res((ffOk = false))); p.on('exit', c => res((ffOk = c === 0))); }); }

/* ------------------------------------------------------------------ server */
const BOUNDARY = 'kvetframe';
const originOk = o => !!o && ALLOWED.includes(String(o).replace(/\/+$/, ''));
function cors(req, res) {
  const o = req.headers.origin;
  if (originOk(o)) { res.setHeader('access-control-allow-origin', o); res.setHeader('access-control-allow-private-network', 'true'); }
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-headers', 'content-type, x-bridge-token'); res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS'); res.setHeader('cross-origin-resource-policy', 'cross-origin');
}
const tokenOk = req => { const t = String(req.headers['x-bridge-token'] || ''); return !!TOKEN && t.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN)); };
const body = req => new Promise(r => { let d = ''; req.on('data', c => { d += c; if (d.length > 8000) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };

/* RTSP -> MJPEG with ffmpeg (TCP transport: works over Wi-Fi where UDP drops). */
function rtspStream(res, url, { fps = 15, width = 960, count = () => {} } = {}) {
  const args = ['-hide_banner', '-loglevel', 'error', '-rtsp_transport', 'tcp', '-i', url, '-an', '-vf', `fps=${fps},scale='min(${width},iw)':-2`, '-q:v', '6', '-f', 'mpjpeg', '-boundary_tag', BOUNDARY, 'pipe:1'];
  const p = spawn('ffmpeg', args); let err = '';
  p.stderr.on('data', d => (err += d)); p.on('error', () => { if (!res.headersSent) json(res, 501, { error: 'ffmpeg' }); });
  let started = false;
  p.stdout.once('data', () => { started = true; });
  { let carry = Buffer.alloc(0); p.stdout.on('data', c => { const x = countJpegs(c, carry); carry = x.carry; count(x.n); }); }
  p.stdout.pipe(res.writeHead(200, { 'content-type': `multipart/x-mixed-replace;boundary=${BOUNDARY}`, 'cache-control': 'no-store' }));
  p.on('exit', () => { if (!started && !res.writableEnded) res.end(); });
  res.on('close', () => p.kill('SIGKILL'));
}
function rtspSnap(res, url) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-rtsp_transport', 'tcp', '-i', url, '-frames:v', '1', '-q:v', '3', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1']);
  const chunks = []; p.stdout.on('data', d => chunks.push(d)); p.on('error', () => json(res, 501, { error: 'ffmpeg' }));
  const kill = setTimeout(() => p.kill('SIGKILL'), 12000);
  p.on('exit', () => { clearTimeout(kill); const b = Buffer.concat(chunks); if (!b.length) return json(res, 502, { error: 'noPicture' }); res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' }); res.end(b); });
}

/* --tunnel: the camera is at another place than the people watching it. cloudflared (free, from Cloudflare) gives this bridge
   a public https address; the admin page anywhere uses that address + the token. The camera itself stays unreachable from the internet. */
function startTunnel() {
  const p = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`]);
  p.on('error', () => console.log('\n--tunnel needs cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/  (Windows: winget install Cloudflare.cloudflared)'));
  let shown = false; const look = d => { const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(d)); if (m && !shown) { shown = true; console.log(`\nRemote bridge address (enter it in Admin -> Cameras -> Camera bridge on any computer):\n  ${m[0]}\n`); } };
  p.stdout.on('data', look); p.stderr.on('data', look);
  process.on('exit', () => p.kill());
}

export function createServer() {
  return http.createServer(async (req, res) => {
    cors(req, res);
    const u = new URL(req.url, 'http://x'), q = u.searchParams;
    // a request coming from a web page must come from the admin page itself (blocks other sites open in the same browser)
    if (req.headers.origin && !originOk(req.headers.origin)) return json(res, 403, { error: 'origin' });
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    try {
      if (u.pathname === '/stats') { const st = STATS.get(q.get('id') || ''); return json(res, 200, { fps: st?.fps ?? 0 }); }
      if (u.pathname === '/health') return json(res, 200, { ok: true, bridge: 'kvet', version: 4, auth: tokenOk(req), ffmpeg: tokenOk(req) ? await hasFfmpeg() : undefined });
      // picture links handed out by /register: the random id is the only key, no password in the address
      if (u.pathname === '/live' || u.pathname === '/snap') {
        const id = q.get('id') || '', cam = CAMS.get(id); if (!cam) return json(res, 404, { error: 'noRec' });
        const t = parseTarget(cam.src), snap = u.pathname === '/snap', count = frameCounter(id), fps = Math.min(Number(q.get('fps')) || 15, 25);
        if (t.protocol === 'rtsp:') {
          if (!(await hasFfmpeg())) return json(res, 501, { error: 'ffmpeg' });
          const full = new URL(t.href); if (cam.user && !full.username) { full.username = cam.user; full.password = cam.pass; }
          return snap ? rtspSnap(res, full.href) : rtspStream(res, full.href, { fps, count });
        }
        const r = await open(t.href, cam.user, cam.pass, 8000);
        if (r.statusCode === 401) { r.resume(); return json(res, 401, { error: 'badLogin' }); }
        if (r.statusCode !== 200) { r.resume(); return json(res, 502, { error: 'camera', status: r.statusCode }); }
        const type = ctype(r) || 'image/jpeg', stream = type.includes('multipart');
        if (!/^(image\/|multipart\/x-mixed-replace)/.test(type)) { r.destroy(); return json(res, 415, { error: 'notPicture' }); }   // never relay web pages
        if (snap && stream) { r.destroy(); return json(res, 415, { error: 'streamNotSnapshot' }); }
        if (!snap && !stream) { r.resume(); return snapStream(res, cam, fps, count); }      // single pictures -> continuous stream
        res.writeHead(200, { 'content-type': String(r.headers['content-type'] || type), 'cache-control': 'no-store' });   // as sent: the boundary is case-sensitive (IP Webcam uses Ba4oTvQ0…)
        if (stream) { let carry = Buffer.alloc(0); r.on('data', c => { const x = countJpegs(c, carry); carry = x.carry; count(x.n); }); }
        r.pipe(res); res.on('close', () => r.destroy()); return;
      }
      if (!tokenOk(req)) return json(res, 401, { error: 'token' });
      if (u.pathname === '/register' && req.method === 'POST') {
        const b = await body(req); parseTarget(String(b.src || ''));
        if (CAMS.size >= 50) CAMS.delete(CAMS.keys().next().value);
        const id = crypto.randomBytes(16).toString('hex'); CAMS.set(id, { src: String(b.src), user: String(b.user || ''), pass: String(b.pass || '') });
        return json(res, 200, { id });
      }
      if (u.pathname === '/probe' && req.method === 'POST') { const b = await body(req); return json(res, 200, await probe({ host: String(b.host || ''), port: String(b.port || ''), proto: String(b.proto || ''), user: String(b.user || ''), pass: String(b.pass || '') })); }
      json(res, 404, { error: 'noRec' });
    } catch (e) { if (!res.headersSent) json(res, e.message.startsWith('only') || e.message === 'bad address' ? 400 : 502, { error: e.message, code: e.code }); else res.end(); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!ALLOWED.length) { console.error('Tell the bridge which page may use it, e.g.\n  node camera-bridge.mjs --origin https://your-kvet-domain'); process.exit(1); }
  if (ALLOWED.includes('*')) { console.error('"*" is not allowed: any web site could then reach your local network through the bridge.'); process.exit(1); }
  loadToken();
  createServer().listen(PORT, HOST, async () => {
    if (process.argv.includes('--tunnel')) startTunnel();
    console.log(`KVET camera bridge on http://${HOST}:${PORT}  (allowed page: ${ALLOWED.join(', ')})`);
    console.log(`Bridge token (Admin -> Cameras -> Camera bridge):  ${TOKEN}`);
    console.log(`ffmpeg for RTSP cameras: ${(await hasFfmpeg()) ? 'found' : 'NOT found (only http/MJPEG/snapshot cameras will work; install ffmpeg for RTSP)'}`);
    console.log('Keep this window open while using Admin -> Cameras.');
  });
}
