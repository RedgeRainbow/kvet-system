/* Performance and feedback analysis of trainers and trainees (superadmin / admin), with AI-written analysis.

   Figures are computed here from attendance, the trainees' training feedback, the trainers' evaluations of candidates,
   online tests, practical assessments and certificates. The AI receives only these figures and anonymous comments, with
   people replaced by codes (T1, T2… / P1, P2…); it never sees names, learner numbers, ID/FIN or contact details, and it
   cannot change anything. */
import * as S from '../../public/js/shared.js';
import { H, need, str, getSettings, audit, enrsFor, getMany, queryIn, ENR_LITE } from './core.js';
import { sha } from './auth.js';
import { aiCfg, aiReady, llm, LANG_NAME } from './ai.js';
import { defaultRange } from './analytics.js';
import { certSt } from './search.js';

const r1 = v => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10) / 10);
const pct = (a, b) => (b ? r1((a / b) * 100) : null);
const avg = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const fbAvg = fb => avg(S.FB_GROUPS.map(g => fb.r[g]).filter(Number.isFinite));
const outcomeOf = (e, s) => e.final?.outcome || S.computeOutcome(e, s, { fbRequired: false }).outcome;
const BEH = { excellent: 4, good: 3, satisfactory: 2, poor: 1 };

/* the period only: its sessions, their enrolments and people; certificates only of those people (light fields) */
/** @param {any} c @param {string} from @param {string} to @param {{ people?: boolean, extra?: string[] }} [o] */
async function load(c, from, to, { people = true, extra = /** @type {any[]} */ ([]) } = {}) {
  const D = c.D, ss = (await D.query('sessions', { where: [['date', 'gte', from], ['date', 'lte', to]] })).rows.map(r => r.data).filter(s => !s.cancelled);
  const pids = [...new Set([...ss.flatMap(s => s.traineeIds || []), ...extra])];
  const [enr, trainers, blanks, companies, trainees, certs] = await Promise.all([enrsFor(D, ss.map(s => s.id), [...ENR_LITE, 'test']), D.all('trainers'), D.all('blanks'), D.all('companies'),
    getMany(D, 'trainees', pids), people ? queryIn(D, 'certs', 'tid', pids, { fields: ['no', 'tid', 'bid', 'start', 'issuedAt', 'expiry', 'revoked', 'renewed'] }) : []]);
  const by = new Map(); for (const list of enr.values()) for (const e of list) by.set(e.sid + '|' + e.tid, e);
  const certsBy = new Map(); for (const k of certs) { if (!certsBy.has(k.tid)) certsBy.set(k.tid, []); certsBy.get(k.tid).push(k); }
  return { ss, by, trainers: new Map(trainers.map(r => [r.id, r.data])), trainees, blanks: new Map(blanks.map(r => [r.id, r.data])), companies: new Map(companies.map(r => [r.id, r.data])), certsBy };
}

/* one trainer: everything about their sessions in the period */
function trainerFigures(X, tid, today) {
  const ss = X.ss.filter(s => s.tid === tid), rows = ss.flatMap(s => (s.traineeIds || []).map(id => ({ s, e: X.by.get(s.id + '|' + id) || { sid: s.id, tid: id } })));
  const past = rows.filter(x => x.s.date <= today), present = past.filter(x => x.e.att), absent = past.filter(x => !x.e.att && x.e.absent);
  const fbs = rows.filter(x => x.e.fb?.r), tests = rows.filter(x => x.e.test?.status === 'graded'), pracs = rows.filter(x => ['PASS', 'FAIL'].includes(x.e.prac?.result));
  const out = rows.map(x => outcomeOf(x.e, x.s)), pass = out.filter(o => o === 'PASS').length, fail = out.filter(o => o === 'FAIL').length;
  const evDue = present.filter(x => x.s.date < today || x.e.final || x.e.ev), evDone = evDue.filter(x => x.e.ev);
  return {
    sessions: ss.length, trainees: rows.length, trainings: [...new Set(ss.map(s => X.blanks.get(s.bid)?.name || '—'))].slice(0, 12),
    attendance: pct(present.length, present.length + absent.length || past.length),
    feedback: r1(avg(fbs.map(x => fbAvg(x.e.fb)))), feedbackN: fbs.length, feedbackRate: pct(fbs.length, present.length),
    byTopic: Object.fromEntries(S.FB_GROUPS.map(g => [g, r1(avg(fbs.map(x => x.e.fb.r[g]).filter(Number.isFinite)))])),
    testPass: pct(tests.filter(x => x.e.test.passed).length, tests.length), testAvg: r1(avg(tests.map(x => x.e.test.pct))), testN: tests.length,
    pracPass: pct(pracs.filter(x => x.e.prac.result === 'PASS').length, pracs.length), pracN: pracs.length,
    passRate: pct(pass, pass + fail), pass, fail, evalRate: pct(evDone.length, evDue.length),
    reviewOpen: rows.filter(x => x.e.test?.status === 'review').length,
    comments: fbs.flatMap(x => S.FB_GROUPS.map(g => ({ topic: g, score: x.e.fb.r[g], text: String(x.e.fb.cm?.[g] || '').trim().slice(0, 300) })).filter(k => k.text)).slice(-30),
    perSession: ss.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map(s => { const mine = rows.filter(x => x.s.id === s.id), f = mine.filter(x => x.e.fb?.r), tt = mine.filter(x => x.e.test?.status === 'graded'), oc = mine.map(x => outcomeOf(x.e, x.s));
      return { date: s.date, training: X.blanks.get(s.bid)?.name || '—', size: mine.length, attendance: pct(mine.filter(x => x.e.att).length, mine.filter(x => x.s.date <= today).length), feedback: r1(avg(f.map(x => fbAvg(x.e.fb)))), testAvg: r1(avg(tt.map(x => x.e.test.pct))), passRate: pct(oc.filter(o => o === 'PASS').length, oc.filter(o => o === 'PASS' || o === 'FAIL').length) }; }),
  };
}
/* one trainee: their sessions in the period */
function traineeFigures(X, pid, today) {
  const ss = X.ss.filter(s => (s.traineeIds || []).includes(pid)), rows = ss.map(s => ({ s, e: X.by.get(s.id + '|' + pid) || { sid: s.id, tid: pid } }));
  const past = rows.filter(x => x.s.date <= today), days = past.flatMap(x => Object.values(x.e.days || {})), evs = rows.filter(x => x.e.ev);
  const tests = rows.filter(x => x.e.test?.status === 'graded'), out = rows.map(x => outcomeOf(x.e, x.s));
  const certs = (X.certsBy.get(pid) || []).filter(k => !k.revoked && !k.renewed).map(k => ({ ...k, st: certSt(k, today, S.SOON_DAYS) }));
  return {
    sessions: ss.length, attended: past.filter(x => x.e.att).length, absent: past.filter(x => !x.e.att && x.e.absent).length, missedDays: days.filter(d => d.absent).length,
    testAvg: r1(avg(tests.map(x => x.e.test.pct))), testN: tests.length, examWarnings: rows.reduce((n, x) => n + (x.e.test?.warns?.length || 0), 0),
    pass: out.filter(o => o === 'PASS').length, fail: out.filter(o => o === 'FAIL').length, pending: out.filter(o => o.startsWith('PENDING')).length,
    pracPass: rows.filter(x => x.e.prac?.result === 'PASS').length, pracFail: rows.filter(x => x.e.prac?.result === 'FAIL').length,
    behavior: r1(avg(evs.map(x => BEH[x.e.ev.behavior]).filter(Boolean))), engagement: r1(avg(evs.map(x => x.e.ev.engagement))), late: evs.filter(x => x.e.ev.punctuality !== 'ontime').length, evalN: evs.length,
    feedbackGiven: rows.filter(x => x.e.fb).length, feedbackAvg: r1(avg(rows.filter(x => x.e.fb?.r).map(x => fbAvg(x.e.fb)))),
    certsValid: certs.filter(k => k.st === 'ACTIVE' || k.st === 'SOON').length, certsExpired: certs.filter(k => k.st === 'EXPIRED').length,
    comments: evs.map(x => String(x.e.ev.comment || '').trim().slice(0, 300)).filter(Boolean).slice(-10),
    perSession: rows.sort((a, b) => b.s.date.localeCompare(a.s.date)).slice(0, 20).map(x => ({ date: x.s.date, training: X.blanks.get(x.s.bid)?.name || '—', attended: !!x.e.att, absent: !!x.e.absent && !x.e.att,
      test: x.e.test?.status === 'graded' ? x.e.test.pct : null, practical: x.e.prac?.result || null, outcome: outcomeOf(x.e, x.s), behavior: x.e.ev?.behavior || null, engagement: x.e.ev?.engagement || null })),
  };
}
/* who needs attention (fixed rules, visible to the user) */
function flagsOf(kind, f) {
  const out = [];
  if (kind === 'trainer') {
    if (f.feedbackN >= 5 && f.feedback < 7) out.push('pfLowFeedback');
    if (f.byTopic?.g1 !== null && f.feedbackN >= 5 && f.byTopic.g1 < 7) out.push('pfLowInstructor');
    if (f.pass + f.fail >= 5 && f.passRate < 70) out.push('pfLowPass');
    if (f.evalRate !== null && f.evalRate < 80 && f.trainees >= 5) out.push('pfEvalMissing');
    if (f.reviewOpen) out.push('pfReviewOpen');
    if (f.attendance !== null && f.attendance < 85 && f.trainees >= 5) out.push('pfLowAttendance');
  } else {
    if (f.fail) out.push('pfFailed');
    if (f.absent || f.missedDays) out.push('pfAbsent');
    if (f.examWarnings) out.push('pfWarnings');
    if (f.behavior !== null && f.behavior < 2.5) out.push('pfBehavior');
    if (f.late >= 2) out.push('pfLate');
    if (f.certsExpired) out.push('pfExpired');
  }
  return out;
}

/** @param {any} c @param {{kind: string, from?: string, to?: string, q?: string}} o */
export async function buildPeople(c, { kind, from: f0, to: t0, q }) {
  const today = c.today(), from = S.isDate(f0) && f0 ? f0 : defaultRange(today)[0], to = S.isDate(t0) && t0 ? t0 : today; need(from <= to, 'badInput');
  const X = await load(c, from, to, { people: kind !== 'trainer' });
  let rows;
  if (kind === 'trainer') {
    const ids = [...new Set(X.ss.map(s => s.tid))].filter(id => X.trainers.has(id));
    rows = ids.map(id => { const p = X.trainers.get(id), f = trainerFigures(X, id, today); delete f.comments; delete f.perSession; return { id, name: S.fullAz(p, false), ...f, flags: flagsOf('trainer', f) }; });
  } else {
    const ids = [...new Set(X.ss.flatMap(s => s.traineeIds || []))].filter(id => X.trainees.has(id));
    rows = ids.map(id => { const p = X.trainees.get(id), f = traineeFigures(X, id, today); delete f.comments; delete f.perSession;
      return { id, name: p.foreign ? S.fullEn(p) : S.fullAz(p), att: p.att, company: p.co ? X.companies.get(p.co)?.name || '' : '', ...f, flags: flagsOf('trainee', f) }; });
  }
  rows.sort((a, b) => b.flags.length - a.flags.length || (b.sessions - a.sessions) || a.name.localeCompare(b.name));
  return { kind, from, to, rows: rows.slice(0, 1000), total: rows.length };
}
export async function personDetail(c, { kind, id, from, to }) {
  const today = c.today(); from = S.isDate(from) ? from : defaultRange(today)[0]; to = S.isDate(to) ? to : today;
  const X = await load(c, from, to, { people: kind !== 'trainer', extra: kind === 'trainer' ? [] : [id] });
  if (kind === 'trainer') { const p = X.trainers.get(id); need(p, 'noRec', 404); const f = trainerFigures(X, id, today); return { kind, id, name: S.fullAz(p, false), from, to, ...f, flags: flagsOf('trainer', f) }; }
  const p = X.trainees.get(id); need(p, 'noRec', 404); const f = traineeFigures(X, id, today);
  return { kind, id, name: p.foreign ? S.fullEn(p) : S.fullAz(p), att: p.att, company: p.co ? X.companies.get(p.co)?.name || '' : '', from, to, ...f, flags: flagsOf('trainee', f) };
}

/* ------------------------------------------------------------------ AI */
const TOPICS = 'Feedback topics: g1 = instructor effectiveness, g2 = content and curriculum, g3 = learning materials and resources, g4 = logistics and environment, g6 = overall satisfaction (scores out of 10).';
async function ai(c, payload, system, lg, force, who) {
  c.settings = await getSettings(c.D); const cfg = aiCfg(c.settings);
  need(cfg.on && cfg.reports !== false, 'aiOff', 404); need(await aiReady(c), 'aiNotConfigured', 503);
  const key = 'p' + (await sha(JSON.stringify([payload, system.length, lg]))).slice(0, 40);
  if (!force) { const hit = await c.D.get('aireport', key); if (hit) return { text: hit.text, at: hit.at, cached: true }; }
  const n = await c.D.seq(`aiR|${who}|${c.today()}`); need(n <= Math.max(40, cfg.daily * 2), 'aiLimit', 429);
  const text = await llm(c, { system, messages: [{ role: 'user', content: JSON.stringify(payload).slice(0, 24000) }], max: 900 });
  if (!text) throw new H(502, 'aiFailed');
  const at = new Date(c.now()).toISOString(); await c.D.put('aireport', [{ id: key, data: { text, at, lang: lg } }]);
  return { text, at };
}
const FORMAT = lg => `Write in ${LANG_NAME[lg]}. Plain text. Use exactly three short sections with headings in ${LANG_NAME[lg]} for "Strengths", "Concerns" and "Recommendations", each with 1-4 items starting with "- ". Quote numbers exactly (percentages are 0-100). Never invent figures or causes the data does not show; with little data say that conclusions are limited. Do not mention JSON or field names.`;
export async function personSummary(c, d, lg, force) {
  const { name, att, id, company, ...fig } = d;
  const role = d.kind === 'trainer' ? 'a trainer (instructor) of the training centre, based on the trainees\' anonymous feedback about their sessions, attendance, test, practical and pass results of their groups, and how completely they recorded evaluations'
    : 'one trainee (candidate), based on attendance, test and practical results, outcomes, the trainers\' evaluations of their behaviour, punctuality and engagement, and exam-integrity warnings';
  const system = `You are an analyst for a vocational training centre (lifting operations, health and safety, industrial machinery).
Analyse the performance of ${role}. The person is called "${d.kind === 'trainer' ? 'the trainer' : 'the trainee'}" — never guess a name. ${TOPICS}
${FORMAT(lg)}`;
  const r = await ai(c, { kind: d.kind, ...fig }, system, lg, force, 's' + c.user.id);
  await audit(c, 'ai.performance', `${d.kind} ${d.id} ${lg}`); return r;
}
/* all trainers (or trainees) at once: people are codes T1… / P1…, the browser shows which code is whom */
export async function peopleSummary(c, data, lg, force) {
  const pre = data.kind === 'trainer' ? 'T' : 'P', list = data.rows.slice(0, 60);
  const codes = list.map((r, i) => ({ code: pre + (i + 1), id: r.id, name: r.name }));
  const rows = list.map((r, i) => { const { id, name, att, company, trainings, ...f } = r; return { code: pre + (i + 1), ...f }; });
  const system = `You are an analyst for a vocational training centre. Compare the ${data.kind === 'trainer' ? 'trainers' : 'trainees'} below (each is a code like ${pre}1; never guess names) over the period ${data.from} to ${data.to}. ${TOPICS}
Write in ${LANG_NAME[lg]}: an overview paragraph (3-5 sentences), then a heading for "Needs attention" with 2-6 items naming the codes and the figures, then a heading for "Recommendations" with 2-4 items. Items start with "- ". Quote numbers exactly. Never invent figures. Do not mention JSON or field names.`;
  const r = await ai(c, { kind: data.kind, from: data.from, to: data.to, rows }, system, lg, force, 's' + c.user.id);
  await audit(c, 'ai.performance', `${data.kind} overview ${lg}`); return { ...r, codes };
}
export const kindOf = v => (v === 'trainer' ? 'trainer' : 'trainee');
export const qp = (c, k) => str(c.url.searchParams.get(k) || '', 60);
