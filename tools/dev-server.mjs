/* Local dev/test server: serves public/ and runs the real /api handler on in-memory storage.
   Staff login: boss@kvet.az / bosspass123 (superadmin). Usage: node tools/dev-server.mjs [port] */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../functions/_lib/index.js';
import { memoryStore, memoryBucket } from '../functions/_lib/store.js';
import { memoryAuth } from '../functions/_lib/auth.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const store = memoryStore(), bucket = memoryBucket(), auth = memoryAuth();
auth.addUser('boss@kvet.az', 'bosspass123');
export const clock = { offset: 0 };
export { store };   // tests and demos can pre-load data
const handle = createHandler({ store: () => store, bucket: () => bucket, auth: () => auth, now: () => Date.now() + clock.offset, files: () => async p => new Uint8Array(await fs.promises.readFile(path.join(root, p))) });
const env = { TOKEN_SECRET: 'dev-secret-dev-secret', BOOTSTRAP_ADMIN_EMAIL: 'boss@kvet.az', ...(process.env.EMERGENCY_PASSWORD ? { EMERGENCY_PASSWORD: process.env.EMERGENCY_PASSWORD } : {}) };
/* DEV_FAKE_AI=1: a stand-in "model" for trying the AI screens without a key. It answers from the first excerpt it is given
   (so the knowledge-base rules can be seen working) and never contacts any service. */
if (process.env.DEV_FAKE_AI === '1') env.__llm = async ({ system, messages }) => {
  if (system.startsWith('You turn a question')) return messages.at(-1).content;
  if (system.startsWith('You are a data analyst')) { let d = {}; try { d = JSON.parse(messages[0].content); } catch {} const k = d.kpi || {};
    return `Demo summary (no AI key): ${k.enrolments ?? 0} enrolments in ${k.sessions ?? 0} sessions; attendance ${k.attendance ?? '—'}%, average feedback ${k.feedbackAvg ?? '—'}/10, test pass rate ${k.testPass ?? '—'}%.\nNeeds attention\n${(d.attention || []).slice(0, 4).map(a => '- ' + a.key + ' ' + a.args.join(', ')).join('\n') || '- Nothing'}\nRecommendations\n- Review the hardest questions with the trainers.\n- Follow up candidates who were absent.`; }
  const ex = system.split('EXCERPTS:')[1] || system.split('REFERENCE EXCERPTS:')[1] || '';
  if (system.includes('You explain')) return 'Demo explanation: the correct answer follows the training material' + (ex ? ' — ' + ex.trim().split('\n')[0].slice(0, 160) : '') + '.';
  const first = (ex.match(/\[1\] \([^)]*\)\n([\s\S]*?)(\n\n\[2\]|$)/) || [])[1];
  return first ? first.trim().slice(0, 400) + ' [1]' : 'NO_ANSWER';
};
const MIME = { '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.csv': 'text/csv', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp' };
const PAGES = new Set(['trainer', 'trainee', 'company', 'verify']);
/* same rewrites as public/_redirects */
const REWRITE = { '/admin.kvet': '/staff-panel-7q3k.html', '/admin.kvet/': '/staff-panel-7q3k.html', '/audit.kvet': '/staff-panel-7q3k.html', '/audit.kvet/': '/staff-panel-7q3k.html' };
/* the same security headers as production (public/_headers, "/*" block) */
const HDRS = (() => { try { const t = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', '_headers'), 'utf8'); const b = t.split(/\n(?=\S)/).find(x => x.startsWith('/*')) || ''; return Object.fromEntries(b.split('\n').slice(1).map(l => l.trim()).filter(Boolean).map(l => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]).filter(([k]) => k !== 'Strict-Transport-Security')); } catch { return {}; } })();

export function start(port = 8787) {
  const srv = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost:' + port);
      if (url.pathname === '/__clock') { clock.offset = Number(url.searchParams.get('offset') || 0); res.end('ok'); return; }
      if (url.pathname.startsWith('/api/')) {
        const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
        const r = await handle(new Request('http://' + (req.headers.host || 'localhost:' + port) + req.url, { method: req.method, headers: req.headers, body }), env);
        res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
      }
      let p = url.pathname === '/' ? '/index.html' : REWRITE[url.pathname] || url.pathname; if (PAGES.has(p.slice(1))) p += '.html';
      const f = path.join(root, path.normalize(p));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(root, '404.html')).pipe(res); return; }
      res.writeHead(200, { ...HDRS, 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
    } catch (e) { console.error(e); res.writeHead(500); res.end('error'); }
  });
  return new Promise(r => srv.listen(port, () => r(srv)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await start(Number(process.argv[2]) || 8787); console.log('KVET dev server on http://localhost:' + (process.argv[2] || 8787)); }
