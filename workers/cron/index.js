/* KVET scheduler: a tiny separate Worker with a Cron Trigger (Cloudflare Pages cannot run on a timer by itself).
   Every day it calls POST https://<your-domain>/api/cron/run with the shared CRON_SECRET; the Pages app then
   makes the daily backup, sends expiry reminders and applies the ID/FIN retention rule. */
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(run(env)); },
  // manual test: curl -H "x-cron-key: <CRON_SECRET>" https://kvet-cron.<you>.workers.dev/   (a header does not end up in
  // browser history or request logs; ?key=<CRON_SECRET> still works for a quick check in a browser)
  async fetch(req, env) {
    const k = req.headers.get('x-cron-key') || new URL(req.url).searchParams.get('key') || '';
    if (!env.CRON_SECRET || !(await same(k, env.CRON_SECRET))) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(await run(env), null, 2), { headers: { 'content-type': 'application/json' } });
  },
};
/* equal or not, in the same time whatever the guess (both sides are hashed first, so the lengths do not show either) */
async function same(a, b) {
  const h = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))));
  const [x, y] = await Promise.all([h(a), h(b)]); let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]; return d === 0;
}
async function run(env) {
  const r = await fetch(String(env.APP_URL).replace(/\/+$/, '') + '/api/cron/run', { method: 'POST', headers: { 'x-cron-key': env.CRON_SECRET, 'content-type': 'application/json' }, body: '{}' });
  const out = await r.json().catch(() => ({ status: r.status }));
  if (!r.ok) console.error('KVET cron failed', r.status, out);
  return out;
}
