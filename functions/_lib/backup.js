/* Backups, format 3 (v3.36).
   What a backup is:  one object in R2, "backups/kvet-<time><tag>.kvb"  =  "KVB1" + key id (8 bytes) + encrypted frames.
   Inside (after decryption) it is plain text, one JSON value per line:
     {"kvet":"backup","v":3,"at":"…"}                       first line
     {"c":"trainees","id":"E-202600001","d":{…}}            one line per record, collection by collection
     {"counters":[{"name":"att","val":42}, …]}
     {"asset":"assets/ab12….png","type":"image/png","b64":"…"}   logo, signature and accreditation images (small files)
     {"end":true,"rows":{"trainees":1234, …}}               last line: without it (or with other counts) the file is refused
   Why this shape:
   - It is written and read as a stream: a page of records at a time, never the whole database in memory (the old format
     was one JSON object built in memory - 128 MB per request is the ceiling on Cloudflare).
   - It is encrypted at rest (AES-256-GCM, a fresh nonce per frame, frames numbered so they cannot be reordered or cut off
     unnoticed). The key comes from the secret BACKUP_KEY, or from TOKEN_SECRET when BACKUP_KEY is not set.
     KEEP THAT SECRET SOMEWHERE OUTSIDE CLOUDFLARE: without it an encrypted backup cannot be read. A readable copy can be
     downloaded by a superadmin (System -> Backups) for exactly that reason.
   - The audit trail and the staff list travel in the backup too. A restore never rewrites the audit trail; it adds the rows
     that are missing (a new, empty database gets its history back). Staff records are kept for reference only. */
import { H } from './store.js';

const enc = new TextEncoder();
const MAGIC = enc.encode('KVB1');
export const FRAME = 1 << 20;             // about 1 MiB of text per encrypted frame
export const PART = 8 << 20;              // multipart part size (R2: every part but the last has the same size)
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, b) => n + b.length, 0)); let o = 0; for (const b of a) { out.set(b, o); o += b.length; } return out; };
const u32 = n => new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

export async function backupKey(env) {
  const secret = String(env.BACKUP_KEY || env.TOKEN_SECRET || ''); if (secret.length < 16) throw new H(500, 'server');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('kvet-backup-v1|' + secret));
  return { key: await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']), kid: new Uint8Array(await crypto.subtle.digest('SHA-256', raw)).slice(0, 8) };
}
const aad = (n, last) => cat(MAGIC, u32(n), new Uint8Array([last ? 1 : 0]));

/* Where the bytes go: one R2 object. Small ones in a single write; from 8 MiB on, a multipart upload in equal parts. */
export function r2Sink(B, key, opts = {}) {
  /** @type {Uint8Array[]} */ let bufs = []; let size = 0, total = 0; const /** @type {{ up: any }} */ st = { up: null }, /** @type {any[]} */ parts = [];
  const take = n => { const out = new Uint8Array(n); let o = 0; while (o < n) { const b = bufs[0], k = Math.min(b.length, n - o); out.set(b.subarray(0, k), o); o += k; if (k === b.length) bufs.shift(); else bufs[0] = b.subarray(k); } size -= n; return out; };
  return {
    async write(b) { bufs.push(b); size += b.length; total += b.length; while (size >= PART) { st.up ||= await B.createMultipartUpload(key, opts); parts.push(await st.up.uploadPart(parts.length + 1, take(PART))); } },
    async close() { if (st.up) { if (size) parts.push(await st.up.uploadPart(parts.length + 1, take(size))); await st.up.complete(parts); } else await B.put(key, take(size), opts); return total; },
    async abort() { try { await st.up?.abort(); } catch {} },
  };
}
/* text in -> encrypted frames out (to anything with write(bytes)) */
export async function sealer(env, out) {
  const { key, kid } = await backupKey(env); let n = 0, len = 0; /** @type {Uint8Array[]} */ let buf = [];
  await out.write(cat(MAGIC, kid));
  const flush = async last => {
    const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(n, last) }, key, cat(...buf)));
    await out.write(cat(u32(ct.length), new Uint8Array([last ? 1 : 0]), iv, ct)); n++; buf = []; len = 0;
  };
  const bytes = async b => { buf.push(b); len += b.length; if (len >= FRAME) await flush(false); };
  return { text: s => bytes(enc.encode(s)), bytes, async end() { await flush(true); } };
}
/* encrypted bytes (a ReadableStream, or anything async-iterable in byte chunks) -> the plain bytes, frame by frame */
export async function* opened(env, body) {
  const { key, kid } = await backupKey(env); /** @type {Uint8Array[]} */ let bufs = []; let size = 0, n = 0, head = false, done = false;
  const take = k => { const out = new Uint8Array(k); let o = 0; while (o < k) { const b = bufs[0], m = Math.min(b.length, k - o); out.set(b.subarray(0, m), o); o += m; if (m === b.length) bufs.shift(); else bufs[0] = b.subarray(m); } size -= k; return out; };
  const peek = k => { const out = new Uint8Array(k); let o = 0; for (const b of bufs) { const m = Math.min(b.length, k - o); out.set(b.subarray(0, m), o); o += m; if (o === k) break; } return out; };
  for await (const chunk of /** @type {any} */ (body)) {
    const b = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk); if (!b.length) continue; bufs.push(b); size += b.length;
    for (;;) {
      if (!head) { if (size < 12) break; const h = take(12); if (!MAGIC.every((x, i) => h[i] === x)) throw new H(422, 'badBackup'); if (!kid.every((x, i) => h[4 + i] === x)) throw new H(409, 'backupKey'); head = true; }
      if (size < 5) break; const p = peek(5), len = ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0, last = p[4] === 1;
      if (done || len < 16 || len > FRAME * 64) throw new H(422, 'badBackup');
      if (size < 5 + 12 + len) break; take(5); const iv = take(12), ct = take(len);
      let plain; try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(n, last) }, key, ct)); } catch { throw new H(422, 'badBackup'); }
      n++; done = last; yield plain;
    }
  }
  if (!head || !done || size) throw new H(422, 'badBackup');            // cut off, or bytes after the last frame
}
/* byte chunks -> lines of text */
export async function* lines(chunks) {
  const td = new TextDecoder(); let rest = '';
  for await (const b of chunks) { rest += td.decode(b, { stream: true }); let i; while ((i = rest.indexOf('\n')) >= 0) { const l = rest.slice(0, i); rest = rest.slice(i + 1); if (l) yield l; } }
  rest += td.decode(); if (rest.trim()) yield rest;
}
const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));

/* Small files the records point to and a certificate cannot be drawn without. Everything under assets/ up to 3 MB each,
   60 MB in all (presentations, library documents and camera pictures are large and are NOT part of the backup). */
const ASSET_MAX = 3e6, ASSETS_MAX = 60e6;

/** Writes the whole database as text lines to w.text(). @returns {Promise<Record<string, number>>} rows per collection */
export async function dumpTo(c, w, cols) {
  /** @type {Record<string, number>} */ const rows = {};
  await w.text(JSON.stringify({ kvet: 'backup', v: 3, at: new Date(c.now()).toISOString() }) + '\n');
  for (const col of cols) { rows[col] = 0; await c.D.scan(col, async page => { let s = ''; for (const r of page) s += JSON.stringify({ c: col, id: r.id, d: r.data }) + '\n'; rows[col] += page.length; await w.text(s); }); }
  await w.text(JSON.stringify({ counters: await c.D.counters() }) + '\n');
  let sum = 0; for (const o of (await c.B.list({ prefix: 'assets/', limit: 1000 })).objects) {
    if (o.size > ASSET_MAX || sum + o.size > ASSETS_MAX) continue; const f = await c.B.get(o.key); if (!f) continue;
    sum += o.size; await w.text(JSON.stringify({ asset: o.key, type: f.httpMetadata?.contentType || 'image/png', b64: b64(await f.arrayBuffer()) }) + '\n');
  }
  await w.text(JSON.stringify({ end: true, rows }) + '\n');
  return rows;
}
/** Reads backup lines and puts them back. Nothing in the database changes before the last line has been checked. */
export async function restoreFrom(c, src, cols) {
  const want = new Set(cols), /** @type {Record<string, number>} */ seen = {}, out = { rows: 0, audit: 0, assets: 0, staff: 0 };
  /** @type {any[]} */ let batch = [], trail = [], counters = [], assets = []; let first = true; const /** @type {{ end: any }} */ fin = { end: null };
  const flush = async () => { if (batch.length) { await c.D.restoreAdd(batch); batch = []; } };
  const flushTrail = async () => { if (trail.length) { out.audit += (await c.D.insertMany('audit', trail)).length; trail = []; } };
  await c.D.restoreBegin();
  for await (const l of src) {
    /** @type {any} */ let o; try { o = JSON.parse(l); } catch { throw new H(422, 'badBackup'); }
    if (first) { first = false; if (o?.kvet !== 'backup' || o.v !== 3) throw new H(422, 'badBackup'); continue; }
    if (fin.end) throw new H(422, 'badBackup');
    if (o.c) {
      seen[o.c] = (seen[o.c] || 0) + 1;
      if (o.c === 'audit') { trail.push({ id: o.id, data: o.d }); if (trail.length >= 500) await flushTrail(); }
      else if (o.c === 'staff') out.staff++;
      else if (want.has(o.c)) { batch.push({ col: o.c, id: o.id, data: o.d }); out.rows++; if (batch.length >= 500) await flush(); }
    } else if (o.counters) counters = o.counters;
    else if (o.asset) { if (/^assets\/[\w.-]+$/.test(o.asset)) assets.push(o); if (assets.length >= 8) { await putAssets(c, assets, out); assets = []; } }
    else if (o.end) fin.end = o;
  }
  const end = fin.end; if (!end || Object.keys({ ...end.rows, ...seen }).some(k => (end.rows[k] || 0) !== (seen[k] || 0))) { await c.D.restoreBegin().catch(() => {}); throw new H(422, 'badBackup'); }
  await flush(); await flushTrail(); await putAssets(c, assets, out);
  await c.D.restoreApply(cols, counters);                       // ONE database transaction: everything or nothing
  return out;
}
/* files that are missing in the bucket are put back; existing ones are left alone */
async function putAssets(c, list, out) { for (const a of list) { if (await c.B.head(a.asset)) continue; await c.B.put(a.asset, unb64(a.b64), { httpMetadata: { contentType: a.type || 'image/png' } }); out.assets++; } }

/* Is the object under this key encrypted with the key this installation holds? (reads 12 bytes) */
export async function keyFits(c, k) {
  const o = await c.B.get(k, { range: { offset: 0, length: 12 } }); if (!o) return false;
  const h = new Uint8Array(await o.arrayBuffer()).subarray(0, 12), { kid } = await backupKey(c.env);
  if (!MAGIC.every((x, i) => h[i] === x)) throw new H(422, 'badBackup');
  return kid.every((x, i) => h[4 + i] === x);
}
/* Reads a stored backup from the first byte to the last - decrypts it, parses every line, compares the counts with the
   closing line - without touching the database. A backup that passes can be restored. */
export async function checkBackup(c, k) {
  const o = await c.B.get(k); if (!o) throw new H(404, 'noRec');
  /** @type {Record<string, number>} */ const seen = {}, /** @type {{ end: any }} */ fin = { end: null }; let first = true, at = '', assets = 0;
  for await (const l of lines(opened(c.env, o.body))) {
    /** @type {any} */ let x; try { x = JSON.parse(l); } catch { throw new H(422, 'badBackup'); }
    if (first) { first = false; if (x?.kvet !== 'backup' || x.v !== 3) throw new H(422, 'badBackup'); at = x.at; continue; }
    if (fin.end) throw new H(422, 'badBackup');
    if (x.c) seen[x.c] = (seen[x.c] || 0) + 1; else if (x.asset) assets++; else if (x.end) fin.end = x;
  }
  const end = fin.end; if (!end || Object.keys({ ...end.rows, ...seen }).some(key => (end.rows[key] || 0) !== (seen[key] || 0))) throw new H(422, 'badBackup');
  return { at, rows: seen, total: Object.values(seen).reduce((a, b) => a + b, 0), assets };
}
