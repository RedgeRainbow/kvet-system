/* Analytics dashboards and AI summaries, per role (see analytics.js). */
import { str, bool } from './core.js';
import { buildAnalytics, aiSummary, reportsOn, qScope, bScope } from './analytics.js';
import { buildPeople, personDetail, personSummary, peopleSummary, kindOf, qp } from './performance.js';

const lang = v => (['az', 'en', 'ru'].includes(v) ? v : 'az');
const staffKind = c => (c.user.role === 'auditor' ? 'audit' : 'all');
async function view(c, scope) { const d = await buildAnalytics(c, scope); return { ...d, ai: await reportsOn(c) }; }

/** @type {import('../../types/store').Routes} */
export const analyticsRoutes = {
  /* superadmin / admin: the whole system (filters: training, trainer, company); auditor: feedback and evaluation oversight */
  'GET /analytics': { auth: 'staff', act: 'analytics', async fn(c) { return view(c, qScope(c, { kind: staffKind(c) })); } },
  'POST /analytics/summary': { auth: 'staff', act: 'analytics', async fn(c) {
    const b = await c.body(), d = await buildAnalytics(c, bScope(b, { kind: staffKind(c) }));
    return aiSummary(c, d, lang(b.lang), { force: bool(b.force), who: 's' + c.user.id });
  } },
  /* trainer: only the sessions (groups) assigned to them */
  'GET /portal/trainer/analytics': { auth: 'trainer', async fn(c) { return view(c, qScope(c, { kind: 'trainer', tid: c.me.id, co: '' })); } },
  'POST /portal/trainer/analytics/summary': { auth: 'trainer', async fn(c) {
    const b = await c.body(), d = await buildAnalytics(c, bScope(b, { kind: 'trainer', tid: c.me.id, co: '' }));
    return aiSummary(c, d, lang(b.lang), { force: bool(b.force), who: 't' + c.me.id });
  } },
  /* company: only its own employees */
  'GET /portal/company/analytics': { auth: 'company', async fn(c) { return view(c, qScope(c, { kind: 'company', co: c.me.id, tid: '' })); } },
  'POST /portal/company/analytics/summary': { auth: 'company', async fn(c) {
    const b = await c.body(), d = await buildAnalytics(c, bScope(b, { kind: 'company', co: c.me.id, tid: '' }));
    return aiSummary(c, d, lang(b.lang), { force: bool(b.force), who: 'c' + c.me.id });
  } },
  /* performance and feedback analysis of trainers and trainees: superadmin / admin */
  'GET /performance': { auth: 'staff', act: 'perf', async fn(c) { return { ...(await buildPeople(c, { kind: kindOf(qp(c, 'kind')), from: qp(c, 'from'), to: qp(c, 'to') })), ai: await reportsOn(c) }; } },
  'GET /performance/person': { auth: 'staff', act: 'perf', async fn(c) { return { ...(await personDetail(c, { kind: kindOf(qp(c, 'kind')), id: qp(c, 'id'), from: qp(c, 'from'), to: qp(c, 'to') })), ai: await reportsOn(c) }; } },
  'POST /performance/person/summary': { auth: 'staff', act: 'perf', async fn(c) {
    const b = await c.body(); return personSummary(c, await personDetail(c, { kind: kindOf(b.kind), id: str(b.id, 60), from: str(b.from, 10), to: str(b.to, 10) }), lang(b.lang), bool(b.force));
  } },
  'POST /performance/summary': { auth: 'staff', act: 'perf', async fn(c) {
    const b = await c.body(); return peopleSummary(c, await buildPeople(c, { kind: kindOf(b.kind), from: str(b.from, 10), to: str(b.to, 10) }), lang(b.lang), bool(b.force));
  } },
};
