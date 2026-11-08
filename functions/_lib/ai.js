/* AI helpers: the language model call and the knowledge-base search.

   Provider and key are chosen by the superadmin in Settings -> AI. Keys are stored encrypted (AES-GCM with TOKEN_SECRET)
   and never sent back to any browser. A Cloudflare secret with the same name still works as a fallback.
     anthropic  : Anthropic API (Claude)                         key  | secret ANTHROPIC_API_KEY
     gemini     : Google AI Studio (Gemini), free tier available  key  | secret GEMINI_API_KEY
     groq       : Groq, free tier available                       key  | secret GROQ_API_KEY
     openrouter : OpenRouter (incl. ":free" models)               key  | secret OPENROUTER_API_KEY
     openai     : any OpenAI-compatible service (base URL)        key  | secret OPENAI_API_KEY
     workers    : Cloudflare Workers AI, free daily allocation    binding "AI" in wrangler.toml, or account ID + API token
   Knowledge base (col "kb"): documents added by admins; each is split into passages with search terms.
   Search: keyword ranking (BM25) over the passages. Questions in another language than the documents are first turned into
   search words in Azerbaijani, English and Russian by the model. */
import { H } from './core.js';
import { unseal } from './auth.js';

export const PROVIDERS = {
  anthropic:  { env: 'ANTHROPIC_API_KEY',  model: 'claude-haiku-5-5' },
  gemini:     { env: 'GEMINI_API_KEY',     model: 'gemini-flash-latest', base: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  groq:       { env: 'GROQ_API_KEY',       model: 'llama-3.3-70b-versatile', base: 'https://api.groq.com/openai/v1' },
  openrouter: { env: 'OPENROUTER_API_KEY', model: 'meta-llama/llama-3.3-70b-instruct:free', base: 'https://openrouter.ai/api/v1' },
  openai:     { env: 'OPENAI_API_KEY',     model: '' },
  workers:    { env: 'CF_AI_TOKEN',        model: '@cf/google/gemma-4-26b-a4b-it' },
};
export const AI_DEFAULTS = { on: false, provider: 'gemini', models: {}, baseUrl: '', accountId: '', keys: {}, chat: true, reports: true, daily: 40 };
export const aiCfg = st => {
  const a = { ...AI_DEFAULTS, ...(st?.ai || {}) };
  a.models = { ...(a.models || {}) };
  if (st?.ai?.model && !a.models.anthropic) a.models.anthropic = st.ai.model;            // settings from the first version
  if (st?.ai?.workersModel && !a.models.workers) a.models.workers = st.ai.workersModel;
  if (!PROVIDERS[a.provider]) a.provider = 'gemini';
  a.model = a.models[a.provider] || PROVIDERS[a.provider].model;
  return a;
};
/* what the admin page may see: no keys, only whether one is stored and its last 4 characters */
export const aiCfgPublic = st => { const { keys, ...a } = aiCfg(st); return { ...a, keyHint: Object.fromEntries(Object.entries(keys || {}).filter(([, v]) => v?.v).map(([k, v]) => [k, v.tail || '••••'])) }; };
export const LANG_NAME = { az: 'Azerbaijani', en: 'English', ru: 'Russian' };

/* the key of a provider: stored (encrypted) in settings, else the Cloudflare secret */
export async function aiKey(c, provider) {
  const sealed = aiCfg(c.settings).keys?.[provider]?.v;
  if (sealed) { const k = await unseal(c.env.TOKEN_SECRET, sealed); if (k) return k; }
  return c.env[PROVIDERS[provider].env] || '';
}
const baseOf = (cfg, p) => (p === 'openai' ? String(cfg.baseUrl || '').replace(/\/+$/, '') : PROVIDERS[p].base);

async function call(url, init) {
  let res; try { res = await fetch(url, init); } catch (/** @type {any} */ e) { console.error('ai fetch', e?.message); throw new H(502, 'aiFailed'); }
  if (!res.ok) { const body = (await res.text().catch(() => '')).slice(0, 300); console.error('ai', res.status, body); throw new H(res.status === 429 ? 429 : 502, res.status === 429 ? 'aiBusy' : res.status === 401 || res.status === 403 ? 'aiBadKey' : 'aiFailed'); }
  return res.json();
}

/* one call to the model; returns the text */
export async function llm(c, { system, messages, max = 700 }) {
  if (typeof c.env.__llm === 'function') return c.env.__llm({ system, messages, max });          // tests
  const cfg = aiCfg(c.settings), p = cfg.provider, model = cfg.model;
  if (p === 'workers') {
    const msgs = { messages: [{ role: 'system', content: system }, ...messages], max_tokens: max };
    if (c.env.AI?.run) { const r = await c.env.AI.run(model, msgs); return String(r?.response ?? r?.choices?.[0]?.message?.content ?? '').trim(); }
    const tok = await aiKey(c, 'workers'); if (!tok || !cfg.accountId) throw new H(503, 'aiNotConfigured');
    const d = await call(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.accountId)}/ai/run/${model}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify(msgs) });
    const r = d.result || {}; return String(r.response ?? r.choices?.[0]?.message?.content ?? '').trim();
  }
  const key = await aiKey(c, p); if (!key) throw new H(503, 'aiNotConfigured');
  if (p === 'anthropic') {
    const d = await call('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: max, system, messages }) });
    return (d.content || []).map(b => b.text || '').join('').trim();
  }
  const base = baseOf(cfg, p); if (!base || !model) throw new H(503, 'aiNotConfigured');
  const d = await call(base + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key, ...(p === 'openrouter' ? { 'X-Title': 'KVET Training' } : {}) },
    body: JSON.stringify({ model, max_tokens: max, temperature: 0.2, messages: [{ role: 'system', content: system }, ...messages] }) });
  const m = d.choices?.[0]?.message?.content; return String(Array.isArray(m) ? m.map(x => x.text || '').join('') : m || '').trim();
}

/* models the account can use (for the drop-down in Settings -> AI) */
export async function listModels(c) {
  const cfg = aiCfg(c.settings), p = cfg.provider;
  if (p === 'workers') {
    const tok = await aiKey(c, 'workers'); if (!tok || !cfg.accountId) return [];
    const d = await call(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.accountId)}/ai/models/search?task=Text%20Generation&per_page=100`, { headers: { authorization: 'Bearer ' + tok } });
    return (d.result || []).map(m => m.name).filter(Boolean).sort();
  }
  const key = await aiKey(c, p); if (!key) throw new H(503, 'aiNotConfigured');
  if (p === 'anthropic') { const d = await call('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } }); return (d.data || []).map(m => m.id); }
  const base = baseOf(cfg, p); if (!base) throw new H(503, 'aiNotConfigured');
  const d = await call(base + '/models', { headers: { authorization: 'Bearer ' + key } });
  let ids = (d.data || d.models || []).map(m => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean);
  if (p === 'gemini') ids = ids.filter(id => /gemini|gemma/.test(id) && !/embedding|image|tts|audio|live|veo|imagen/.test(id));
  if (p === 'openrouter') ids.sort((a, b) => (b.endsWith(':free') - a.endsWith(':free')) || a.localeCompare(b)); else ids.sort();
  return ids;
}
export const aiReady = async c => {
  if (typeof c.env.__llm === 'function') return true;
  const cfg = aiCfg(c.settings), p = cfg.provider;
  if (p === 'workers') return !!c.env.AI?.run || (!!cfg.accountId && !!(await aiKey(c, 'workers')));
  if (p === 'openai' && !cfg.baseUrl) return false;
  return !!(await aiKey(c, p));
};

/* ------------------------------------------------------------------ search */
const FOLD = { ə: 'e', ı: 'i', ş: 's', ç: 'c', ğ: 'g', ö: 'o', ü: 'u', ё: 'е' };
/* words -> search terms: lower case, Azerbaijani letters folded, short words dropped, long words cut to a common stem */
export function terms(text) {
  return String(text || '').toLowerCase().replace(/[əışçğöüё]/g, ch => FOLD[ch]).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9Ѐ-ӿ]+/).filter(w => w.length >= 3).map(w => (w.length > 7 ? w.slice(0, 7) : w));
}
/* a document -> passages of up to ~1600 characters. Paragraphs (blank-line separated) are kept whole where possible, so one
   course or one question/answer stays one passage. A longer paragraph is split at sentence ends and each part repeats the
   paragraph's opening words (e.g. the course name), so a part still says what it is about. */
export function chunk(text, size = 1600) {
  const paras = String(text || '').replace(/\r/g, '').split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean), out = [];
  let cur = '';
  const flush = () => { if (cur) out.push(cur); cur = ''; };
  for (const p of paras) {
    if (p.length > size) {
      flush();
      const head = (p.match(/^[^.!?\n]{3,120}[.!?]?/) || [''])[0].trim(), parts = p.match(/[^.!?]+[.!?]+["»)]?\s*|[^.!?]+$/g) || [p];
      let piece = '';
      for (const sx of parts) {
        if ((piece + sx).length > size && piece) { out.push(piece.trim()); piece = head && !sx.startsWith(head) ? head + ' … ' : ''; }
        if (sx.length > size) { for (let i = 0; i < sx.length; i += size) out.push(sx.slice(i, i + size)); continue; }
        piece += sx;
      }
      if (piece.trim()) out.push(piece.trim());
      continue;
    }
    if (cur && (cur.length >= 300 || (cur + '\n\n' + p).length > size)) flush();   // short paragraphs (headings, one-liners) join the next one
    cur = cur ? cur + '\n\n' + p : p;
  }
  flush();
  return out.map(t => ({ t, w: [...new Set(terms(t))] }));
}
/* BM25 over every passage of every active document; returns the best ones with their source */
export function search(docs, query, top = 6) {
  const q = [...new Set(terms(query))]; if (!q.length) return [];
  const all = docs.flatMap(d => (d.chunks || []).map((ch, i) => ({ doc: d, i, ch, tf: ch.w })));
  const N = all.length || 1, avg = all.reduce((s, x) => s + x.ch.t.length, 0) / N || 1, df = {};
  for (const x of all) for (const w of new Set(x.tf)) df[w] = (df[w] || 0) + 1;
  const scored = all.map(x => {
    const bag = terms(x.ch.t), cnt = {}; for (const w of bag) cnt[w] = (cnt[w] || 0) + 1;
    let s = 0; for (const w of q) { const f = cnt[w] || 0; if (!f) continue; const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5)); s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * x.ch.t.length / avg)); }
    return { score: s, title: x.doc.title, id: x.doc.id, text: x.ch.t };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, top);
}
