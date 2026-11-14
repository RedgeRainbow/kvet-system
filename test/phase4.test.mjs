/* v3.36: backups written as an encrypted stream, read back and checked, restored after a real wipe; the audit page asked
   from the database; certificates drawn on the server. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';
import { PART } from '../functions/_lib/backup.js';
import { RESTORE_COLS } from '../functions/_lib/routes_system.js';

const mkPerson = i => ({ name: 'Ad' + i, surname: 'Soyad' + i, fin: 'A' + String(100000 + i), phone: '+9945012' + String(10000 + i) });
export async function world(n = 3) {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} }); await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  await call('POST', '/staff/profile', { token: sa, body: { name: 'Boss Bossov', title: 'Director' } });
  const tr = (await call('POST', '/trainer/save', { token: sa, body: { name: 'Taleh', surname: 'Bekirov', fin: 'TRN1234', phone: '+994502223344' } })).json;
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Drill LLC' } })).json;
  const blanks = (await call('GET', '/state', { token: sa })).json.blanks, bid = (blanks.find(b => !b.defaultSheetId) || blanks[0]).id;
  const ppl = []; for (let i = 0; i < n; i++) ppl.push((await call('POST', '/trainee/save', { token: sa, body: { ...mkPerson(i), co: i ? co.company.id : '' } })).json);
  const s = (await call('POST', '/session/save', { token: sa, body: { bid, tid: tr.trainer.id, date: '2026-10-29', traineeIds: ppl.map(p => p.trainee.id) } })).json.session;
  await call('POST', '/enr/attendance', { token: sa, body: { sid: s.id, absent: [] } });
  const certs = []; for (const p of ppl) { await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid: p.trainee.id, passed: true, score: 90 } }); certs.push((await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: p.trainee.id } })).json.cert); }
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), ch => ch.charCodeAt(0));
  await call('POST', '/upload?kind=logo', { token: sa, raw: png, headers: { 'content-type': 'image/png' } });
  return { app, call, sa, tr, co, ppl, s, certs, bid };
}
const bytesOf = async (app, key) => new Uint8Array(await (await app.bucket.get(key)).arrayBuffer());
const wipe = async app => { for (const c of RESTORE_COLS) { const ids = (await app.store.all(c)).map(r => r.id); if (ids.length) await app.store.delMany(c, ids); } };

test('backup: encrypted at rest, readable only through the key, complete after a wipe and restore', async () => {
  const { app, call, sa, ppl } = await world();
  const key = (await call('POST', '/backup', { token: sa, body: {} })).json.key; assert.match(key, /\.kvb$/);
  const raw = await bytesOf(app, key), asText = new TextDecoder('latin1').decode(raw);
  assert.equal(asText.slice(0, 4), 'KVB1'); for (const secret of ['A100000', 'Soyad1', 'trainees', '"hash"']) assert.ok(!asText.includes(secret), secret + ' is not readable in the stored file');
  const v = (await call('POST', '/backup/verify', { token: sa, body: { key } })).json; assert.ok(v.total > 20); assert.equal(v.rows.trainees, 3); assert.ok(v.rows.audit > 5); assert.equal(v.assets, 1);
  // the readable copy: text lines, first and last as described, the download is recorded
  const plain = await (await call('GET', `/backup/get?plain=1&key=${encodeURIComponent(key)}`, { token: sa })).res.text(), ls = plain.trim().split('\n').map(l => JSON.parse(l));
  assert.deepEqual([ls[0].kvet, ls[0].v], ['backup', 3]); assert.equal(ls.at(-1).end, true); assert.ok(ls.some(l => l.c === 'trainees' && l.d.fin === 'A100000')); assert.ok(ls.some(l => l.c === 'staff'));
  assert.ok((await app.store.all('audit')).some(r => r.data.action === 'backup.download.plain'));
  // disaster: every restorable collection emptied, a logo file lost
  const before = (await call('GET', '/backup/fingerprint', { token: sa })).json.list;
  const logoKey = (await app.bucket.list({ prefix: 'assets/' })).objects[0].key; await app.bucket.delete(logoKey);
  await wipe(app); assert.equal((await app.store.all('trainees')).length, 0); assert.equal((await app.store.all('certs')).length, 0);
  const r = await call('POST', '/restore', { token: sa, body: { key } }); assert.equal(r.status, 200); assert.equal(r.json.assets, 1); assert.match(r.json.before, /-before-restore\.kvb$/);
  const after = (await call('GET', '/backup/fingerprint', { token: sa })).json.list, pick = l => Object.fromEntries(l.filter(x => RESTORE_COLS.includes(x.col)).map(x => [x.col, x.n + ':' + x.h]));
  assert.deepEqual(pick(after), pick(before), 'every collection is back, record for record');
  assert.ok(await app.bucket.head(logoKey), 'the logo file is back');
  assert.equal((await call('POST', '/login', { body: { role: 'trainee', login: ppl[0].creds.login, password: ppl[0].creds.password } })).status, 200, 'people can sign in again');
});

test('backup: a new, empty database gets its audit trail back; an existing trail is never rewritten', async () => {
  const { app, call, sa } = await world(1);
  const key = (await call('POST', '/backup', { token: sa, body: {} })).json.key, trail = (await app.store.all('audit')).filter(r => r.data.action !== 'backup.create');     // that row was written after the backup
  const lost = trail.slice(0, 5); await app.store.delMany('audit', lost.map(r => r.id));          // the in-memory store allows it; the database does not
  const mine = trail[7]; await app.store.put('audit', [{ id: mine.id, data: { ...mine.data, detail: 'as it stands in the database' } }]);
  const r = (await call('POST', '/restore', { token: sa, body: { key } })).json; assert.equal(r.audit, 5);
  const now = new Map((await app.store.all('audit')).map(x => [x.id, x.data]));
  for (const x of lost) assert.deepEqual(now.get(x.id), x.data);
  assert.equal(now.get(mine.id).detail, 'as it stands in the database', 'rows that exist are left alone');
});

test('backup: damaged, cut-off or foreign files are refused before anything changes', async () => {
  const { app, call, sa } = await world(1);
  const key = (await call('POST', '/backup', { token: sa, body: {} })).json.key, good = await bytesOf(app, key), fp = async () => JSON.stringify((await call('GET', '/backup/fingerprint', { token: sa })).json.list.filter(x => RESTORE_COLS.includes(x.col)));
  const was = await fp(), n0 = (await app.bucket.list({ prefix: 'backups/' })).objects.length;
  const flipped = good.slice(); flipped[good.length - 40] ^= 1; await app.bucket.put('backups/kvet-flipped.kvb', flipped);
  await app.bucket.put('backups/kvet-cut.kvb', good.slice(0, good.length - 200));
  for (const k of ['backups/kvet-flipped.kvb', 'backups/kvet-cut.kvb']) { const r = await call('POST', '/restore', { token: sa, body: { key: k } }); assert.equal(r.status, 422, k); assert.equal(r.json.error, 'badBackup'); assert.equal((await call('POST', '/backup/verify', { token: sa, body: { key: k } })).status, 422); }
  assert.equal(await fp(), was, 'nothing changed'); assert.equal((await app.bucket.list({ prefix: 'backups/' })).objects.length, n0 + 2, 'not even a safety backup was needed');
  // the secret changed: the old backup says so instead of failing somewhere in the middle
  const old = app.env.TOKEN_SECRET; app.env.BACKUP_KEY = 'another-key-another-key-1234';
  const r = await call('POST', '/restore', { token: sa, body: { key } }); assert.equal(r.status, 409); assert.equal(r.json.error, 'backupKey');
  assert.equal((await call('GET', `/backup/get?plain=1&key=${encodeURIComponent(key)}`, { token: sa })).status, 409);
  delete app.env.BACKUP_KEY; assert.equal(app.env.TOKEN_SECRET, old); assert.equal((await call('POST', '/backup/verify', { token: sa, body: { key } })).status, 200);
});

test('backup: a copy kept outside comes back by upload - encrypted, readable text, or a .json from before v3.36', async () => {
  const { app, call, sa } = await world(2), up = raw => call('POST', '/backup/upload', { token: sa, raw, headers: { 'content-type': 'application/octet-stream' } });
  const key = (await call('POST', '/backup', { token: sa, body: {} })).json.key, enc = await bytesOf(app, key);
  const plain = new Uint8Array(await (await call('GET', `/backup/get?plain=1&key=${encodeURIComponent(key)}`, { token: sa })).res.arrayBuffer());
  const legacy = JSON.stringify({ v: 2, at: '2026-10-01T00:00:00.000Z', cols: Object.fromEntries(await Promise.all(RESTORE_COLS.map(async c => [c, await app.store.all(c)]))), counters: await app.store.counters() });
  for (const k of (await app.bucket.list({ prefix: 'backups/' })).objects) await app.bucket.delete(k.key);          // the bucket lost its backups
  const a = await up(enc); assert.equal(a.status, 200); assert.match(a.json.key, /-uploaded\.kvb$/); assert.ok(a.json.total > 10);
  app.clock.t += 1000; const b = await up(plain); assert.equal(b.status, 200); assert.equal(b.json.total, a.json.total);
  assert.equal(new TextDecoder('latin1').decode(await bytesOf(app, b.json.key)).slice(0, 4), 'KVB1', 'the text copy was encrypted on the way in');
  app.clock.t += 1000; const c = await up(new TextEncoder().encode(legacy)); assert.equal(c.status, 200); assert.match(c.json.key, /-uploaded\.json$/);
  assert.equal((await up(enc.slice(0, enc.length - 50))).status, 422, 'a cut-off file is not accepted'); assert.equal((await up(new TextEncoder().encode('hello, not a backup'))).json.error, 'badFile');
  assert.equal((await app.bucket.list({ prefix: 'backups/' })).objects.length, 3);
  for (const k of [a.json.key, b.json.key, c.json.key]) { await wipe(app); const r = await call('POST', '/restore', { token: sa, body: { key: k } }); assert.equal(r.status, 200, k); assert.equal((await app.store.all('trainees')).length, 2, k); assert.equal((await app.store.all('certs')).length, 2, k); }
});

test('backup: a large database goes up in equal parts and restores (nothing is held in memory as a whole)', async () => {
  const { app, call, sa } = await world(1), big = 'x'.repeat(3000);
  for (let i = 0; i < 9; i++) await app.store.put('notes', Array.from({ length: 1000 }, (_, j) => ({ id: `n${i}-${String(j).padStart(4, '0')}`, data: { to: 'staff:*', k: 'nMsgFrom', a: [big + i + j], at: '2026-10-29T08:00:00.000Z' } })));
  let parts = 0; const mp = app.bucket.createMultipartUpload; app.bucket.createMultipartUpload = async (...a) => { const u = await mp(...a), up = u.uploadPart; u.uploadPart = (...p) => { parts++; return up(...p); }; return u; };
  const key = (await call('POST', '/backup', { token: sa, body: {} })).json.key, size = (await app.bucket.head(key)).size;
  assert.ok(size > 3 * PART && parts >= 4, `${size} bytes in ${parts} parts`);
  const notes = (await app.store.all('notes')).length; assert.ok(notes >= 9000);
  assert.equal((await call('POST', '/backup/verify', { token: sa, body: { key } })).json.rows.notes, notes);
  await wipe(app); const r = await call('POST', '/restore', { token: sa, body: { key } }); assert.equal(r.status, 200); assert.equal((await app.store.all('notes')).length, notes);
});

test('the nightly backup is read back and counted; one that does not read is reported', async () => {
  const { app, call } = await world(1); app.env.CRON_SECRET = 'cron-secret-cron-secret';
  const run = () => call('POST', '/cron/run', { headers: { 'x-cron-key': app.env.CRON_SECRET }, body: { tasks: ['backup'] } }).then(r => r.json);
  const ok = await run(); assert.match(ok.backup, /-auto\.kvb$/); assert.ok(ok.verified > 10);
  app.clock.t = Date.now() + 2 * 864e5; const put = app.bucket.put; app.bucket.put = (k, v, o) => put(k, /-auto\.kvb$/.test(k) ? v.slice(0, v.length - 30) : v, o);     // tonight the stored file is cut short
  const bad = await run(); app.bucket.put = put; assert.equal(bad.verified, 'FAILED');
  assert.ok((await app.store.all('audit')).some(r => r.data.action === 'backup.bad')); assert.ok((await app.store.all('notes')).some(r => r.data.k === 'nBackupBad'));
});

/* ---- certificates drawn on the server ---- */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFont } from '../functions/_lib/font.js';
import { decodePng } from '../functions/_lib/png.js';
import { certTexts } from '../functions/_lib/certpdf.js';
import { siteFile } from './helpers.mjs';

const has = cmd => { try { execFileSync(cmd, ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } };
const pdfText = bytes => { const f = join(mkdtempSync(join(tmpdir(), 'kvet-')), 'c.pdf'); writeFileSync(f, bytes); return execFileSync('pdftotext', ['-layout', f, '-']).toString(); };
const loginAs = (call, role, cr) => call('POST', '/login', { body: { role, login: cr.login, password: cr.password } }).then(r => r.json.token);
// a real picture to sign with: 40 x 20, a dark diagonal on a clear background (made here, so the test needs no file)
async function sigPicture() {
  const w = 40, h = 20, raw = new Uint8Array((w * 4 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.abs(x - y * 2) < 2) raw.set([10, 20, 120, 255], y * (w * 4 + 1) + 1 + x * 4);
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (tag, d) => { const o = new Uint8Array(12 + d.length), v = new DataView(o.buffer); v.setUint32(0, d.length); o.set([...tag].map(ch => ch.charCodeAt(0)), 4); o.set(d, 8); v.setUint32(8 + d.length, crc(o.subarray(4, 8 + d.length))); return o; };
  const ihdr = new Uint8Array(13), iv = new DataView(ihdr.buffer); iv.setUint32(0, w); iv.setUint32(4, h); ihdr.set([8, 6, 0, 0, 0], 8);
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', ihdr), ...chunk('IDAT', z), ...chunk('IEND', new Uint8Array(0))]);
}

test('fonts and pictures: the reader understands the site\'s own files', async () => {
  const f = await loadFont(await siteFile('/fonts/Mulish-Regular.woff')), g = ch => f.glyph(ch.codePointAt(0));
  assert.equal(f.upm, 1000); for (const ch of 'AəƏğışçöüİÇŞĞЖя№—“”·') assert.ok(f.has(ch.codePointAt(0)), ch + ' is in the font');
  assert.ok(f.kern(g('A'), g('V')) < 0, 'kerning pairs are read (A V are pulled together)'); assert.equal(f.kern(g('a'), g('b')), 0);
  assert.ok(f.ttf.length < 70000, 'only the drawing tables go into a PDF');
  const im = await decodePng(await siteFile('/img/accred/accred-1.png')); assert.deepEqual([im.w, im.h, im.rgb.length, im.alpha?.length], [300, 299, 300 * 299 * 3, 300 * 299]);
  const mine = await decodePng(await sigPicture()); assert.deepEqual([mine.w, mine.h, mine.alpha[0], mine.alpha[1 * 40 + 2]], [40, 20, 255, 255]); assert.equal(mine.alpha[39], 0);
});

test('certificate PDF: drawn by the server for its owner only, with the same words as the office version; signature pictures stay private', { skip: !has('pdftotext') && 'pdftotext is not installed' }, async () => {
  const { app, call, sa, ppl, certs, co } = await world(2), no = certs[0].no, q = '?no=' + encodeURIComponent(no);
  await call('POST', '/settings/save', { token: sa, body: { serverCerts: true, company: { name: 'KVET LEC', address: 'Bakı, Nizami küç. 10', phone: '+994 12 000 00 00' } } });
  await call('POST', '/staff/signature', { token: sa, raw: await sigPicture(), headers: { 'content-type': 'image/png' } });
  assert.equal((await call('POST', '/cert/sign', { token: sa, body: { nos: [no], mode: 'image' } })).json.results[0].ok, true);
  const cert = await app.store.get('certs', no), sigKey = cert.sign.img; assert.match(sigKey, /^[a-f0-9]{16}\.png$/);
  const tok = await loginAs(call, 'trainee', ppl[0].creds), other = await loginAs(call, 'trainee', ppl[1].creds);

  // the document
  const r = await call('GET', '/portal/trainee/cert.pdf' + q, { token: tok }); assert.equal(r.status, 200); assert.equal(r.res.headers.get('content-type'), 'application/pdf');
  const pdf = new Uint8Array(await r.res.arrayBuffer()), head = new TextDecoder('latin1').decode(pdf.subarray(0, 8)); assert.equal(head.slice(0, 5), '%PDF-'); assert.ok(pdf.length > 20000 && pdf.length < 900000, 'a sensible size: ' + pdf.length);
  const text = pdfText(pdf).replace(/\s+/g, ' '), T = certTexts(cert, (await app.store.get('settings', 'main')).company);
  for (const part of [T.h1, T.h2, T.no, T.intro, T.n1, T.q1, T.q2, ...T.left.flat(), ...T.right.flat(), T.valid, T.expiry, T.sigL, 'Boss Bossov', 'Director', cert.sign.code, 'Bakı, Nizami küç. 10'])
    for (const w of String(part).split(/\s+/).filter(Boolean)) assert.ok(text.includes(w), `"${w}" is on the certificate (searchable text, not a picture)`);
  assert.ok(new TextDecoder('latin1').decode(pdf).includes('/SMask'), 'the signature picture is inside the document');

  // nobody else gets it
  assert.equal((await call('GET', '/portal/trainee/cert.pdf' + q, { token: other })).status, 404, 'another candidate');
  assert.equal((await call('GET', '/portal/trainee/cert.pdf' + q)).status, 401, 'no sign-in');
  assert.equal((await call('GET', '/portal/trainee/cert.pdf?no=' + encodeURIComponent(certs[1].no), { token: other })).status, 403, 'a candidate sent by a company gets the certificate from the company');

  // drawn once: the second request is answered from storage; a change of the certificate draws it again
  const kept = async () => (await app.bucket.get('certpdf/' + no.replace(/[^A-Za-z0-9]+/g, '-') + '.pdf'));
  const mark1 = (await kept()).customMetadata.mark, again = new Uint8Array(await (await call('GET', '/portal/trainee/cert.pdf' + q, { token: tok })).res.arrayBuffer()); assert.deepEqual(again, pdf);
  await call('POST', '/cert/sign', { token: sa, body: { nos: [no], mode: 'esign' } });
  const pdf2 = new Uint8Array(await (await call('GET', '/portal/trainee/cert.pdf' + q, { token: tok })).res.arrayBuffer()); assert.notEqual((await kept()).customMetadata.mark, mark1);
  assert.ok(pdfText(pdf2).includes('Signed electronically'), 'the new signature is on the new document');

  // what the portals receive: no address of any signature or stamp picture
  await call('POST', '/cert/sign', { token: sa, body: { nos: certs.map(c => c.no), mode: 'image' } });
  const home = JSON.stringify((await call('GET', '/portal/trainee/home', { token: tok })).json); assert.ok(home.includes(no)); assert.ok(!home.includes(sigKey), 'candidate portal');
  const coTok = await loginAs(call, 'company', co.creds); assert.ok(coTok, 'the company signs in');
  {
    for (const p of ['/portal/company/home', '/portal/company/cert?no=' + encodeURIComponent(certs[1].no)]) { const j = JSON.stringify((await call('GET', p, { token: coTok })).json); assert.ok(j.includes(certs[1].no)); assert.ok(!j.includes(sigKey), p); }
    const cr = await call('GET', '/portal/company/cert.pdf?no=' + encodeURIComponent(certs[1].no), { token: coTok }); assert.equal(cr.status, 200); assert.equal(cr.res.headers.get('content-type'), 'application/pdf');
    assert.equal((await call('GET', '/portal/company/cert.pdf' + q, { token: coTok })).status, 404, 'a certificate of somebody outside the company');
  }

  // the picture itself: not served by its address alone any more; office users get it with the day's pass; the pass ages out
  assert.equal((await call('GET', '/asset/' + sigKey)).status, 404, 'the address that older versions handed to portals is dead');
  assert.equal((await call('GET', '/asset/' + sigKey + '?s=' + 'a'.repeat(32))).status, 404);
  const state = (await call('GET', '/state', { token: sa })).json; assert.match(state.sigPass, /^[a-f0-9]{32}$/); assert.ok(state.me.sigImg.endsWith('?s=' + state.sigPass));
  assert.equal((await call('GET', '/asset/' + sigKey + '?s=' + state.sigPass)).status, 200);
  app.clock.t += 2 * 864e5; assert.equal((await call('GET', '/asset/' + sigKey + '?s=' + state.sigPass)).status, 200, 'a page left open for two days still shows it');
  app.clock.t += 2 * 864e5; assert.equal((await call('GET', '/asset/' + sigKey + '?s=' + state.sigPass)).status, 404, 'an old pass stops working');
  // the logo stays public (sign-in pages and the public check page show it)
  const logo = (await call('GET', '/public/info')).json.logo; assert.match(logo, /^\/api\/asset\//); assert.equal((await call('GET', logo.replace('/api', ''))).status, 200);
});

test('question pictures: a trainer account adds at most 100 new ones a day; the same picture again costs nothing', async () => {
  const { app, call, tr } = await world(1), tok = await loginAs(call, 'trainer', tr.creds), png = await sigPicture(), up = raw => call('POST', '/portal/trainer/test/image', { token: tok, raw, headers: { 'content-type': 'image/png' } });
  const a = await up(png); assert.equal(a.status, 200); assert.equal((await app.store.get('trainers', tr.trainer.id)).imgq.n, 1);
  assert.equal((await up(png)).json.img, a.json.img); assert.equal((await app.store.get('trainers', tr.trainer.id)).imgq.n, 1, 'a repeat is not counted');
  const t = await app.store.get('trainers', tr.trainer.id); t.imgq.n = 100; await app.store.put('trainers', [{ id: t.id, data: t }]);
  const other = png.slice(); other[other.length - 1] ^= 1;                              // different bytes = a different picture
  const r = await up(other); assert.equal(r.status, 429); assert.equal(r.json.error, 'imgLimit'); assert.ok((await app.store.all('audit')).some(x => x.data.action === 'test.image.limit'));
  app.clock.t += 864e5; assert.equal((await up(other)).status, 200, 'the next day it works again');
});

test('certificates on the Free plan (the switch is off, as after an upgrade): the owner\'s page draws them; the signature picture goes only to the signed-in owner', async () => {
  const { app, call, sa, ppl, certs, co } = await world(2), no = certs[0].no, q = '?no=' + encodeURIComponent(no), png = await sigPicture();
  await call('POST', '/staff/signature', { token: sa, raw: png, headers: { 'content-type': 'image/png' } });
  await call('POST', '/cert/sign', { token: sa, body: { nos: certs.map(c => c.no), mode: 'image' } });
  const sigKey = (await app.store.get('certs', no)).sign.img, tok = await loginAs(call, 'trainee', ppl[0].creds), other = await loginAs(call, 'trainee', ppl[1].creds), coTok = await loginAs(call, 'company', co.creds);
  // off by default: no server drawing; the page is told so and the certificate says it has a picture, without its address
  const home = (await call('GET', '/portal/trainee/home', { token: tok })).json; assert.equal(home.certPdf, false); assert.equal(home.certs[0].sigPic, true); assert.ok(!JSON.stringify(home).includes(sigKey));
  assert.equal((await call('GET', '/portal/trainee/cert.pdf' + q, { token: tok })).status, 409);
  const pic = await call('GET', '/portal/trainee/cert/sig' + q, { token: tok }); assert.equal(pic.status, 200); assert.deepEqual(new Uint8Array(await pic.res.arrayBuffer()), png);
  assert.equal((await call('GET', '/portal/trainee/cert/sig' + q, { token: other })).status, 404, 'another candidate');
  assert.equal((await call('GET', '/portal/trainee/cert/sig' + q)).status, 401, 'no sign-in');
  assert.equal((await call('GET', '/portal/company/cert/sig' + q, { token: coTok })).status, 404, 'a company the certificate does not belong to');
  assert.equal((await call('GET', '/portal/company/cert/sig?no=' + encodeURIComponent(certs[1].no), { token: coTok })).status, 200, 'the company of the certificate');
  assert.equal((await call('GET', '/asset/' + sigKey)).status, 404, 'still no public address');
  // only a superadmin turns it on; then the picture is not handed out at all
  const adm = await app.mkStaff('adm@kvet.az', 'admin'); assert.equal((await call('POST', '/settings/save', { token: adm, body: { serverCerts: true } })).status, 403);
  assert.equal((await call('POST', '/settings/save', { token: sa, body: { serverCerts: true } })).status, 200); assert.ok((await app.store.all('audit')).some(x => x.data.action === 'settings.serverCerts'));
  assert.equal((await call('GET', '/portal/trainee/home', { token: tok })).json.certPdf, true);
  assert.equal((await call('GET', '/portal/trainee/cert/sig' + q, { token: tok })).status, 404);
  assert.equal((await call('GET', '/portal/trainee/cert.pdf' + q, { token: tok })).status, 200);
});
