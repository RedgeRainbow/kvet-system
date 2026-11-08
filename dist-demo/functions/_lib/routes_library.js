/* Library -> Additional documents: files of any common office type (procedures, forms, instructions) kept for the team.
   Admin / superadmin upload, rename and delete them; trainers see and download them in their portal. Other staff roles
   (editor, approver, auditor) have no access. Files live in R2 under libdocs/, metadata in the "libdocs" collection.

   Company groups: a company's own saved lists of its candidates (company portal -> requests), collection "cogroups". */
import { J, str, need, uid, audit } from './core.js';
import { rnd } from './auth.js';

const TYPES = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', csv: 'text/csv', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip' };
export const LIBDOC_EXT = Object.keys(TYPES);
const extOf = name => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const out = x => ({ id: x.id, title: x.title, fileName: x.fileName, ext: x.ext, size: x.size, at: x.at, category: x.category || '' });
const list = async c => (await c.D.all('libdocs')).map(r => r.data).sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.title.localeCompare(b.title));
async function fileResp(c, id) {
  const x = await c.D.get('libdocs', str(id, 60)); need(x, 'noRec', 404);
  const o = await c.B.get('libdocs/' + x.key); need(o, 'noRec', 404);
  return new Response(o.body, { headers: { 'content-type': TYPES[x.ext] || 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(x.fileName)}`, 'cache-control': 'no-store, private', 'x-content-type-options': 'nosniff' } });
}

async function ownGroup(c, id) { const g = await c.D.get('cogroups', str(id, 60)); need(g && g.co === c.me.id, 'noRec', 404); return g; }

/** @type {import('../../types/store').Routes} */
export const libraryRoutes = {
  'GET /libdocs': { auth: 'staff', act: 'libdocs', async fn(c) { return { list: (await list(c)).map(out) }; } },
  'POST /libdoc/upload': { auth: 'staff', act: 'libdocs', raw: true, async fn(c) {
    const q = c.url.searchParams, name = str(q.get('name'), 200), ext = extOf(name), title = str(q.get('title'), 140) || name.replace(/\.[^.]+$/, '');
    const buf = await c.req.arrayBuffer(); need(name && TYPES[ext] && buf.byteLength > 0 && buf.byteLength <= 30e6, 'badFile');
    const id = uid('d'), key = id + '-' + rnd(6) + '.' + ext;
    await c.B.put('libdocs/' + key, buf, { httpMetadata: { contentType: 'application/octet-stream' } });
    const x = { id, title, key, fileName: name, ext, size: buf.byteLength, category: str(q.get('category'), 60), at: new Date(c.now()).toISOString(), by: c.user.email };
    await c.D.put('libdocs', [{ id, data: x }]); await audit(c, 'libdoc.upload', title);
    return J({ doc: out(x) });
  } },
  'POST /libdoc/update': { auth: 'staff', act: 'libdocs', async fn(c) {
    const b = await c.body(), x = await c.D.get('libdocs', str(b.id, 60)); need(x, 'noRec', 404);
    x.title = str(b.title, 140) || x.title; x.category = str(b.category, 60); await c.D.put('libdocs', [{ id: x.id, data: x }]); return { doc: out(x) };
  } },
  'POST /libdoc/delete': { auth: 'staff', act: 'libdocs', async fn(c) {
    const b = await c.body(), x = await c.D.get('libdocs', str(b.id, 60)); need(x, 'noRec', 404);
    try { await c.B.delete('libdocs/' + x.key); } catch {}
    await c.D.del('libdocs', x.id); await audit(c, 'libdoc.delete', x.title); return { ok: 1 };
  } },
  'GET /libdoc/get': { auth: 'staff', act: 'libdocs', raw: true, async fn(c) { return fileResp(c, c.url.searchParams.get('id')); } },
  // trainers: read only
  'GET /portal/trainer/libdocs': { auth: 'trainer', async fn(c) { return { list: (await list(c)).map(out) }; } },
  'GET /portal/trainer/libdoc': { auth: 'trainer', raw: true, async fn(c) { const r = await fileResp(c, c.url.searchParams.get('id')); await audit(c, 'libdoc.download', c.url.searchParams.get('id')); return r; } },

  /* company groups */
  'GET /portal/company/groups': { auth: 'company', async fn(c) {
    return { list: (await c.D.byField('cogroups', 'co', c.me.id)).map(r => r.data).sort((a, b) => a.name.localeCompare(b.name)) };
  } },
  'POST /portal/company/group/save': { auth: 'company', async fn(c) {
    const b = await c.body(), name = str(b.name, 120); need(name, 'needName');
    const own = new Set((await c.D.byField('trainees', 'co', c.me.id)).map(r => r.id));
    const ids = [...new Set((b.ids || []).map(x => str(x, 60)))].filter(id => own.has(id)).slice(0, 1000);
    const g = b.id ? await ownGroup(c, b.id) : { id: uid('cg'), co: c.me.id, at: new Date(c.now()).toISOString() };
    Object.assign(g, { name, ids }); await c.D.put('cogroups', [{ id: g.id, data: g }]);
    return { group: g };
  } },
  'POST /portal/company/group/delete': { auth: 'company', async fn(c) {
    const g = await ownGroup(c, (await c.body()).id); await c.D.del('cogroups', g.id); return { ok: 1 };
  } },
};
