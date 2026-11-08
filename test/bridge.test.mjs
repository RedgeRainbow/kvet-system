import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.ALLOW_ORIGIN = 'https://kvet.example';
const B = await import('../tools/camera-bridge.mjs');
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

test('camera bridge: only the admin origin, only with the token, only pictures', async () => {
  B.setToken('a'.repeat(40));
  const cam = http.createServer((req, res) => {
    if (req.url === '/video') { res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace;boundary=Ba4oTvQ0MBPgdDJYvJHzW' }); return res.end('--Ba4oTvQ0MBPgdDJYvJHzW\r\n'); }
    if (req.url === '/shot.jpg') { res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(Buffer.from([0xff, 0xd8, 0xff, 0xe0])); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end('<h1>router admin</h1>');
  });
  const camPort = await listen(cam), br = B.createServer(), port = await listen(br), base = `http://127.0.0.1:${port}`;
  try {
    const H = { origin: 'https://kvet.example', 'content-type': 'application/json' };
    assert.equal((await fetch(base + '/health', { headers: { origin: 'https://evil.example' } })).status, 403, 'other web sites are refused');
    assert.equal((await fetch(base + '/register', { method: 'POST', headers: H, body: JSON.stringify({ src: `http://127.0.0.1:${camPort}/shot.jpg` }) })).status, 401, 'token required');
    const T = { ...H, 'x-bridge-token': 'a'.repeat(40) };
    assert.equal((await fetch(base + '/register', { method: 'POST', headers: T, body: JSON.stringify({ src: 'http://8.8.8.8/x.jpg' }) })).status, 400, 'public addresses refused');
    const { id } = await (await fetch(base + '/register', { method: 'POST', headers: T, body: JSON.stringify({ src: `http://127.0.0.1:${camPort}/shot.jpg` }) })).json();
    assert.match(id, /^[a-f0-9]{32}$/);
    const pic = await fetch(`${base}/snap?id=${id}`); assert.equal(pic.status, 200); assert.equal(pic.headers.get('content-type'), 'image/jpeg');
    assert.equal((await fetch(`${base}/snap?id=${'0'.repeat(32)}`)).status, 404, 'unknown link');
    const page = (await (await fetch(base + '/register', { method: 'POST', headers: T, body: JSON.stringify({ src: `http://127.0.0.1:${camPort}/` }) })).json()).id;
    assert.equal((await fetch(`${base}/live?id=${page}`)).status, 415, 'a web page is never relayed');
    const vid = (await (await fetch(base + '/register', { method: 'POST', headers: T, body: JSON.stringify({ src: `http://127.0.0.1:${camPort}/video` }) })).json()).id;
    const lv = await fetch(`${base}/live?id=${vid}`); await lv.text();
    assert.equal(lv.headers.get('content-type'), 'multipart/x-mixed-replace;boundary=Ba4oTvQ0MBPgdDJYvJHzW', 'stream boundary passed on unchanged (case-sensitive)');
  } finally { br.close(); cam.close(); }
});
