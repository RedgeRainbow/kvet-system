/* KVET scheduler: a tiny separate Worker with a Cron Trigger (Cloudflare Pages cannot run on a timer by itself).
   Every day it calls POST https://<your-domain>/api/cron/run with the shared CRON_SECRET; the Pages app then
   makes the daily backup, sends expiry reminders and applies the ID/FIN retention rule. */
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(run(env)); },
  // manual test: GET https://kvet-cron.<you>.workers.dev/?key=<CRON_SECRET>
  async fetch(req, env) {
    const k = new URL(req.url).searchParams.get('key');
    if (!env.CRON_SECRET || k !== env.CRON_SECRET) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(await run(env), null, 2), { headers: { 'content-type': 'application/json' } });
  },
};
async function run(env) {
  const r = await fetch(String(env.APP_URL).replace(/\/+$/, '') + '/api/cron/run', { method: 'POST', headers: { 'x-cron-key': env.CRON_SECRET, 'content-type': 'application/json' }, body: '{}' });
  const out = await r.json().catch(() => ({ status: r.status }));
  if (!r.ok) console.error('KVET cron failed', r.status, out);
  return out;
}
