/* AI module (Settings -> AI; the superadmin can switch it off completely).
   1. Chatbot in the trainee portal: answers ONLY from the knowledge base managed by admins. If no passage covers the question,
      it says so (no guessing). Azerbaijani, English, Russian.
   2. Test explanations: after a test is marked and the session's exam is closed, the candidate can read for each question why
      the correct answer is right, compared with the answer they chose. Explanations never change scores, answer keys or results. */
import { S, str, num, need, bool, uid, audit, getSettings } from './core.js';
import { seal } from './auth.js';
import { aiCfg, aiCfgPublic, PROVIDERS, LANG_NAME, llm, aiReady, listModels, chunk, search } from './ai.js';

const NO = 'NO_ANSWER';
const FALLBACK = { az: 'Bu sualın cavabı təsdiqlənmiş bilik bazasında yoxdur. Zəhmət olmasa, təlimçinizdən soruşun.', en: 'The approved knowledge base does not cover this question. Please ask your trainer.', ru: 'В утверждённой базе знаний нет ответа на этот вопрос. Пожалуйста, обратитесь к инструктору.' };
const lang = v => (['az', 'en', 'ru'].includes(v) ? v : 'az');
async function ctx(c, part) {
  c.settings = await getSettings(c.D); const cfg = aiCfg(c.settings);
  need(cfg.on && (!part || cfg[part]), 'aiOff', 404); need(await aiReady(c), 'aiNotConfigured', 503); return cfg;
}
const activeDocs = async c => (await c.D.all('kb')).map(r => r.data).filter(d => d.on !== false);

/* search words in all three languages, so a Russian question finds Azerbaijani documents too */
async function expand(c, q) {
  try { return await llm(c, { system: 'You turn a question into search keywords. Output one line only: 8-25 keywords in Azerbaijani, English and Russian (synonyms and technical terms included), separated by spaces. No explanations.', messages: [{ role: 'user', content: q.slice(0, 600) }], max: 120 }); }
  catch { return ''; }
}
/* grounded answer: the passages are the only source; anything else -> the fallback text */
export async function answer(c, question, history, lg) {
  const docs = await activeDocs(c);
  let hits = search(docs, question);
  if (hits.length < 3) { const more = search(docs, question + ' ' + (await expand(c, question))); const seen = new Set(hits.map(h => h.id + h.text)); hits = [...hits, ...more.filter(h => !seen.has(h.id + h.text))].slice(0, 6); }
  if (!hits.length) return { answer: FALLBACK[lg], grounded: false, sources: [] };
  const excerpts = hits.map((h, i) => `[${i + 1}] (${h.title})\n${h.text}`).join('\n\n');
  const system = `You are the training assistant of a vocational training centre (lifting operations, health and safety).
Answer the trainee's question using ONLY the EXCERPTS below. Do not use any other knowledge.
If the excerpts do not contain the answer, reply with exactly: ${NO}
Reply in ${LANG_NAME[lg]}, clearly and briefly (at most about 150 words). Put the excerpt numbers you used in square brackets, e.g. [1].
Never invent regulations, numbers or procedures. Safety-critical instructions must match the excerpts word for word in meaning.

EXCERPTS:
${excerpts}`;
  const msgs = [...(history || []).slice(-6).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: str(m.text, 1500) })).filter(m => m.content), { role: 'user', content: question }];
  const out = await llm(c, { system, messages: msgs, max: 600 });
  if (!out || out.includes(NO)) return { answer: FALLBACK[lg], grounded: false, sources: [] };
  const used = [...new Set([...out.matchAll(/\[(\d+)\]/g)].map(m => +m[1]).filter(n => n >= 1 && n <= hits.length))];
  return { answer: out, grounded: true, sources: [...new Set((used.length ? used : [1]).map(n => hits[n - 1].title))] };
}
/* a few questions per person per day (cost control); the limit is in Settings -> AI */
async function rateLimit(c, who, cfg) { const n = await c.D.seq(`ai|${who}|${c.today()}`); need(n <= cfg.daily, 'aiLimit', 429); }

/** @type {import('../../types/store').Routes} */
export const aiRoutes = {
  /* ---------------------------------------------------------------- admin */
  'GET /ai': { auth: 'staff', act: 'library', async fn(c) {
    c.settings = await getSettings(c.D);
    const cfg = aiCfgPublic(c.settings), sup = S.can(c.user.role, 'users');
    return { cfg: sup ? cfg : { on: cfg.on, provider: cfg.provider, model: cfg.model, chat: cfg.chat, reports: cfg.reports, daily: cfg.daily }, ready: await aiReady(c),
      defaults: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v.model])),
      envKeys: sup ? Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, !!c.env[v.env]])) : {}, binding: !!c.env.AI?.run,
      docs: (await c.D.all('kb')).map(r => { const { chunks, text, ...d } = r.data; return { ...d, chars: (text || '').length, parts: (chunks || []).length }; }).sort((a, b) => a.title.localeCompare(b.title)) };
  } },
  /* switching the module on / off, provider, model and key: superadmin. A key is stored encrypted; an empty key field keeps
     the stored one, "clearKey" removes it. Keys are never sent back. */
  'POST /ai/settings': { auth: 'staff', act: 'users', async fn(c) {
    const b = await c.body(), st = await getSettings(c.D), cur = aiCfg(st);
    const provider = PROVIDERS[b.provider] ? b.provider : cur.provider;
    const models = { ...cur.models }; if (b.model !== undefined) { const m = str(b.model, 160).trim(); if (m) models[provider] = m; else delete models[provider]; }
    const keys = { ...(st.ai?.keys || {}) };
    if (b.clearKey) delete keys[provider];
    const k = String(b.key || '').trim(); if (k) { need(k.length >= 8 && k.length <= 400 && !/\s/.test(k), 'badInput'); keys[provider] = { v: await seal(c.env.TOKEN_SECRET, k), tail: k.slice(-4), at: new Date(c.now()).toISOString(), by: c.user.email }; }
    let baseUrl = cur.baseUrl; if (b.baseUrl !== undefined) { baseUrl = str(b.baseUrl, 200).trim(); need(!baseUrl || /^https:\/\/[^\s/]+/i.test(baseUrl), 'badInput'); }
    const accountId = b.accountId !== undefined ? str(b.accountId, 64).trim() : cur.accountId;
    st.ai = { on: b.on !== undefined ? bool(b.on) : cur.on, provider, models, keys, baseUrl, accountId,
      chat: b.chat !== undefined ? bool(b.chat) : cur.chat, reports: b.reports !== undefined ? bool(b.reports) : cur.reports, daily: num(b.daily, 1, 5000, cur.daily) };
    await c.D.put('settings', [{ id: 'main', data: st }]);
    await audit(c, 'ai.settings', `on=${st.ai.on} ${provider} ${models[provider] || PROVIDERS[provider].model} chat=${st.ai.chat} reports=${st.ai.reports}${k ? ' · key changed' : ''}${b.clearKey ? ' · key removed' : ''}`);
    c.settings = st; return { cfg: aiCfgPublic(st), ready: await aiReady(c) };
  } },
  /* models of the chosen provider (with the stored key) */
  'GET /ai/models': { auth: 'staff', act: 'users', async fn(c) { c.settings = await getSettings(c.D); return { models: await listModels(c) }; } },
  /* a short test call with the saved settings (works while the module is still switched off) */
  'POST /ai/test': { auth: 'staff', act: 'users', async fn(c) {
    c.settings = await getSettings(c.D); need(await aiReady(c), 'aiNotConfigured', 503); const t0 = Date.now();
    const out = await llm(c, { system: 'Reply with one short sentence.', messages: [{ role: 'user', content: 'Say hello in Azerbaijani, English and Russian.' }], max: 80 });
    return { ok: !!out, text: str(out, 300), ms: Date.now() - t0, provider: aiCfg(c.settings).provider, model: aiCfg(c.settings).model };
  } },
  /* knowledge base: documents provided and approved by the training centre (admins manage them) */
  'GET /ai/kb': { auth: 'staff', act: 'library', async fn(c) { const x = await c.D.get('kb', str(c.url.searchParams.get('id'), 60)); need(x, 'noRec', 404); const { chunks, ...d } = x; return { doc: d }; } },
  'POST /ai/kb/save': { auth: 'staff', act: 'ai.kb', async fn(c) {
    const b = await c.body(), title = str(b.title, 200), text = String(b.text || '').slice(0, 400000).replace(/\u0000/g, '');
    need(title && text.trim().length >= 20, 'badInput');
    let x; if (b.id) { x = await c.D.get('kb', str(b.id, 60)); need(x, 'noRec', 404); } else x = { id: uid('k'), createdAt: new Date(c.now()).toISOString() };
    Object.assign(x, { title, text, lang: ['az', 'en', 'ru', 'mix'].includes(b.lang) ? b.lang : 'mix', source: str(b.source, 200), on: b.on !== false, chunks: chunk(text), updatedAt: new Date(c.now()).toISOString(), by: c.user.email });
    await c.D.put('kb', [{ id: x.id, data: x }]); await audit(c, b.id ? 'ai.kb.update' : 'ai.kb.add', `${title} (${x.chunks.length})`);
    return { doc: { id: x.id, title, parts: x.chunks.length } };
  } },
  'POST /ai/kb/delete': { auth: 'staff', act: 'ai.kb', async fn(c) { const b = await c.body(), x = await c.D.get('kb', str(b.id, 60)); need(x, 'noRec', 404); await c.D.del('kb', x.id); await audit(c, 'ai.kb.delete', x.title); return { ok: 1 }; } },
  /* admins try the chatbot with the same rules as trainees */
  'POST /ai/try': { auth: 'staff', act: 'ai.kb', async fn(c) { const b = await c.body(); await ctx(c); return answer(c, str(b.q, 1000), b.history, lang(b.lang)); } },

  /* -------------------------------------------------------------- trainee */
  'GET /portal/trainee/ai': { auth: 'trainee', async fn(c) { c.settings = await getSettings(c.D); const cfg = aiCfg(c.settings); const ok = cfg.on && (await aiReady(c)); return { chat: ok && cfg.chat }; } },
  'POST /portal/trainee/ai/chat': { auth: 'trainee', async fn(c) {
    const cfg = await ctx(c, 'chat'), b = await c.body(), q = str(b.q, 1000); need(q.trim().length >= 2, 'badInput');
    await rateLimit(c, c.me.id, cfg);
    const r = await answer(c, q, b.history, lang(b.lang));
    await audit(c, 'ai.chat', `${c.me.att} · ${r.grounded ? 'answered' : 'not in knowledge base'}`);
    return r;
  } },
  /* No question review for candidates: test questions are confidential. A candidate sees the result only (score, pass / fail). */
};
