/* Analytics: reports and dashboards computed from the platform's own data, plus an AI-written summary.

   One engine, four views (role-based):
     all     : superadmin / admin. Everything, optional filters by training, trainer, company.
     audit   : auditors. Feedback and evaluation oversight (feedback, trainer evaluations, practical assessments,
               test marking, declarations, completeness of records). No certificate pipeline, no lists of people.
     trainer : the trainer's own sessions (groups) only.
     company : the company's own employees only.

   The numbers are computed here, deterministically. "Needs attention" items are fixed rules on those numbers.
   The AI only writes the text summary from the computed figures (no access to raw records, no names),
   so it cannot change any result. */
import * as S from '../../public/js/shared.js';
import { H, need, str, getSettings, audit, enrsFor, getMany, daysBefore, ENR_LITE } from './core.js';
import { sha } from './auth.js';
import { aiCfg, aiReady, llm, LANG_NAME } from './ai.js';

const r1 = v => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10) / 10);
const pct = (a, b) => (b ? r1((a / b) * 100) : null);
/** @param {any[]} xs @returns {number | null} */
const avg = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const sd = xs => { const m = avg(xs); return m !== null && xs.length > 1 ? Math.sqrt(avg(xs.map(x => (x - m) ** 2)) || 0) : null; };
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

/* attention thresholds (fixed rules, shown to the user next to each item) */
export const RULES = { attendance: 85, passRate: 70, feedback: 7, question: 40, practical: 75, evalDone: 80, fbDone: 60, reviewDays: 3, expiring: 30 };

export function defaultRange(today) {
  const d = new Date(Date.parse(today) - 89 * 864e5).toISOString().slice(0, 10);
  return [d, today];
}

/* Certificate figures of a scope, counted by the database (the list of certificates is never read whole).
   A trainer's scope (certificates of their sessions) is read as a light list instead. */
async function certFigures(c, scope, from, to, today, st) {
  const D = c.D, soon = st.soonDays ?? S.SOON_DAYS, in90 = daysBefore(today, -90), in30 = daysBefore(today, -RULES.expiring);
  if (scope.tid) {
    const sids = (await D.query('sessions', { where: [['tid', 'eq', scope.tid]], fields: ['date'] })).rows.map(r => r.id), list = [];
    for (let i = 0; i < sids.length; i += 60) list.push(...(await D.query('certs', { where: [['sid', 'in', sids.slice(i, i + 60)], ...(scope.bid ? [['bid', 'eq', scope.bid]] : [])], fields: ['bid', 'issuedAt', 'expiry', 'revoked', 'renewed', 'approval'] })).rows.map(r => r.data));
    const ok = list.filter(x => !x.revoked), live = ok.filter(x => !x.renewed), left = x => S.daysBetween(today, x.expiry), inn = d => live.filter(x => left(x) >= 0 && left(x) <= d);
    return { issuedN: ok.filter(x => String(x.issuedAt || '').slice(0, 10) >= from && String(x.issuedAt || '').slice(0, 10) <= to).length, activeN: live.filter(x => !(left(x) < 0)).length,
      exp30N: inn(RULES.expiring).length, exp90: inn(90), expiredN: live.filter(x => left(x) < 0).length, pendingCert: ok.filter(x => x.approval?.status === 'pending').length };
  }
  const base = [...(scope.bid ? [['bid', 'eq', scope.bid]] : []), ...(scope.co ? [['co', 'eq', scope.co], ['approval.status', 'nn', 'pending'], ['approval.status', 'nn', 'returned']] : [])];
  const live = [...base, ['revoked', 'null', true], ['renewed', 'null', true]], n = where => D.query('certs', { where, limit: 0, count: true }).then(r => r.total || 0);
  const [issuedN, activeN, exp30N, exp90, expiredN, pendingCert] = await Promise.all([
    n([...base, ['revoked', 'null', true], ['issuedAt', 'gte', from], ['issuedAt', 'lte', to + 'T99']]), n([...live, ['exp', 'gte', today]]),
    n([...live, ['exp', 'gte', today], ['exp', 'lte', in30]]), D.query('certs', { where: [...live, ['exp', 'gte', today], ['exp', 'lte', in90]], fields: ['bid'] }).then(r => r.rows.map(x => x.data)),
    n([...live, ['exp', 'lt', today]]), scope.co ? 0 : n([...base, ['revoked', 'null', true], ['approval.status', 'eq', 'pending']])]);
  return { issuedN, activeN, exp30N, exp90, expiredN, pendingCert };
}

/* scope: { kind, from, to, bid?, tid? (trainer id), co? (company id) } */
export async function buildAnalytics(c, scope) {
  const D = c.D, today = c.today(), st = await getSettings(D);
  const from = S.isDate(scope.from) ? scope.from : defaultRange(today)[0], to = S.isDate(scope.to) ? scope.to : today;
  need(from <= to, 'badInput');
  // only the period: its sessions, their enrolments and participants (never whole collections)
  const sw = [['date', 'gte', from], ['date', 'lte', to], ...(scope.tid ? [['tid', 'eq', scope.tid]] : [])];
  const [sessR, blanksR, trainersR, companiesR] = await Promise.all([D.query('sessions', { where: sw }).then(r => r.rows), D.all('blanks'), D.all('trainers'), D.all('companies')]);
  const sessionsAll = sessR, ids = sessR.map(r => r.id);
  const [enrMap, trainees, certStats] = await Promise.all([enrsFor(D, ids, [...ENR_LITE, 'test']), getMany(D, 'trainees', sessR.flatMap(r => r.data.traineeIds || [])), certFigures(c, scope, from, to, today, st)]);
  const enrR = [...enrMap.values()].flat().map(data => ({ data }));
  const blanks = new Map(blanksR.map(r => [r.id, r.data])), trainers = new Map(trainersR.map(r => [r.id, r.data]));
  const companies = new Map(companiesR.map(r => [r.id, r.data]));
  const enrBy = new Map(); for (const r of enrR) { const e = r.data; if (!enrBy.has(e.sid)) enrBy.set(e.sid, new Map()); enrBy.get(e.sid).set(e.tid, e); }
  const bName = id => blanks.get(id)?.name || '—', trName = id => { const x = trainers.get(id); return x ? S.fullAz(x, false) : '—'; };
  const kind = scope.kind;

  // trainings that occur in the period for this view (for the training filter)
  const trainingOpts = [...new Set(sessionsAll.map(r => r.data).filter(s => !s.cancelled && s.date >= from && s.date <= to && (!scope.tid || s.tid === scope.tid)
    && (!scope.co || (s.traineeIds || []).some(id => trainees.get(id)?.co === scope.co))).map(s => s.bid))].map(id => ({ id, name: bName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  // sessions in range and in scope
  const sessions = sessionsAll.map(r => r.data).filter(s => !s.cancelled && s.date >= from && s.date <= to
    && (!scope.bid || s.bid === scope.bid) && (!scope.tid || s.tid === scope.tid));
  // enrolments in scope (company: only its own employees)
  const rows = [];
  for (const s of sessions) for (const tid of s.traineeIds || []) {
    const p = trainees.get(tid); if (!p) continue;
    if (scope.co && p.co !== scope.co) continue;
    rows.push({ s, p, e: enrBy.get(s.id)?.get(tid) || { sid: s.id, tid } });
  }
  const sessIds = new Set(rows.map(x => x.s.id)), inScope = sessions.filter(s => sessIds.has(s.id) || (!scope.co && !(s.traineeIds || []).length));
  const past = x => x.s.date <= today;                                  // attendance only counts once the day has come

  /* ---------------- attendance */
  const attRows = rows.filter(past), present = attRows.filter(x => x.e.att), absent = attRows.filter(x => !x.e.att && x.e.absent);
  const decided = present.length + absent.length;
  const byTrainingAtt = {}; for (const x of attRows) { const k = x.s.bid; byTrainingAtt[k] ??= { name: bName(k), enrolled: 0, present: 0 }; byTrainingAtt[k].enrolled++; if (x.e.att) byTrainingAtt[k].present++; }

  /* ---------------- feedback (trainee -> training) */
  const fbs = rows.filter(x => x.e.fb?.r), fbScores = fbs.map(x => avg(S.FB_GROUPS.map(g => x.e.fb.r[g]).filter(Number.isFinite)));
  const byQ = Object.fromEntries(S.FB_GROUPS.map(g => [g, r1(avg(fbs.map(x => x.e.fb.r[g]).filter(Number.isFinite)))]));
  const dist = Array(10).fill(0); for (const x of fbs) for (const g of S.FB_GROUPS) { const v = x.e.fb.r[g]; if (v >= 1 && v <= 10) dist[v - 1]++; }
  const fbByTrainer = {}; for (const [i, x] of fbs.entries()) { const k = x.s.tid; fbByTrainer[k] ??= { name: trName(k), n: 0, sum: 0 }; fbByTrainer[k].n++; fbByTrainer[k].sum += fbScores[i]; }
  const fbByTraining = {}; for (const [i, x] of fbs.entries()) { const k = x.s.bid; fbByTraining[k] ??= { name: bName(k), n: 0, sum: 0 }; fbByTraining[k].n++; fbByTraining[k].sum += fbScores[i]; }
  const comments = fbs.flatMap(x => S.FB_GROUPS.map(g => ({ g, text: String(x.e.fb.cm?.[g] || '').trim(), score: x.e.fb.r[g], training: bName(x.s.bid), date: x.s.date })).filter(k => k.text))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);

  /* ---------------- trainer evaluations of candidates */
  const evs = present.filter(x => x.e.ev), beh = {}, pun = {};
  for (const x of evs) { inc(beh, x.e.ev.behavior); inc(pun, x.e.ev.punctuality); }
  const evDue = present.filter(x => x.s.date < today || x.e.final || x.e.ev);

  /* ---------------- online tests */
  const tests = rows.filter(x => x.e.test?.at), graded = tests.filter(x => x.e.test.status === 'graded'), review = tests.filter(x => x.e.test.status === 'review');
  const byTest = {}; for (const x of graded) { const k = x.e.test.examId || x.e.test.title; byTest[k] ??= { title: x.e.test.title, n: 0, sum: 0, pass: 0 }; byTest[k].n++; byTest[k].sum += x.e.test.pct || 0; if (x.e.test.passed) byTest[k].pass++; }
  const qStat = new Map();
  for (const x of graded) for (const q of x.e.test.qs || []) {
    if (q.kind !== 'mc') continue; const k = q.text.trim().toLowerCase().slice(0, 300);
    const cur = qStat.get(k) || { text: q.text, test: x.e.test.title, n: 0, right: 0, wrong: {} };
    const a = x.e.test.answers?.[q.id]; cur.n++;
    if (a !== undefined && String(a) === String(q.correct)) cur.right++; else inc(cur.wrong, a === undefined || a === null ? '—' : S.optText(q, a) || '—');
    qStat.set(k, cur);
  }
  const hardest = [...qStat.values()].filter(q => q.n >= 3).map(q => ({ text: q.text, test: q.test, n: q.n, correct: pct(q.right, q.n), commonWrong: Object.entries(q.wrong).sort((a, b) => b[1] - a[1])[0]?.[0] || '' }))
    .sort((a, b) => (a.correct ?? 0) - (b.correct ?? 0)).slice(0, 8);
  const reviewDays = graded.filter(x => x.e.test.gradedBy !== 'auto' && x.e.test.gradedAt && x.e.test.at).map(x => (Date.parse(x.e.test.gradedAt) - Date.parse(x.e.test.at)) / 864e5);
  const oldReview = review.filter(x => (c.now() - Date.parse(x.e.test.at)) / 864e5 > RULES.reviewDays).length;

  /* ---------------- exams (all kinds), practical, outcomes */
  const exams = rows.filter(x => x.e.exam && typeof x.e.exam.passed === 'boolean'), examScores = exams.map(x => Number(x.e.exam.score)).filter(v => Number.isFinite(v) && v <= 100);
  const pracs = rows.filter(x => x.e.prac && ['PASS', 'FAIL'].includes(x.e.prac.result));
  const pracByTraining = {}; for (const x of pracs) { const k = x.s.bid; pracByTraining[k] ??= { name: bName(k), n: 0, pass: 0 }; pracByTraining[k].n++; if (x.e.prac.result === 'PASS') pracByTraining[k].pass++; }
  const outcomes = {}; for (const x of rows) { const o = x.e.final?.outcome || (x.s.date > today ? 'UPCOMING' : S.computeOutcome(x.e, x.s, { fbRequired: false }).outcome); inc(outcomes, o); }
  const passN = outcomes.PASS || 0, failN = outcomes.FAIL || 0;

  /* ---------------- declarations of health */
  const pracSessions = rows.filter(x => x.s.sheetId && past(x) && x.e.att), dohs = pracSessions.filter(x => x.e.doh), dohFlag = dohs.filter(x => S.dohYes(x.e.doh));

  /* ---------------- certificates (issued in the period, and the current state of the scope's certificates) */
  const { issuedN, activeN, exp30N, exp90, expiredN, pendingCert } = certStats;
  const expByTraining = {}; for (const x of exp90) inc(expByTraining, bName(x.bid));

  /* ---------------- cohorts (each session = one group) */
  const cohorts = inScope.map(s => {
    const mine = rows.filter(x => x.s.id === s.id), att = mine.filter(x => past(x) && x.e.att).length, pastN = mine.filter(past).length;
    const sc = mine.filter(x => x.e.test?.status === 'graded').map(x => x.e.test.pct), fbv = mine.filter(x => x.e.fb?.r).map(x => avg(S.FB_GROUPS.map(g => x.e.fb.r[g])));
    const out = mine.map(x => x.e.final?.outcome || S.computeOutcome(x.e, x.s, { fbRequired: false }).outcome), dec = out.filter(o => o === 'PASS' || o === 'FAIL');
    return { id: s.id, date: s.date, training: bName(s.bid), trainer: trName(s.tid), size: mine.length, attendance: pct(att, pastN), testAvg: r1(avg(sc)), testSd: r1(sd(sc)),
      passRate: pct(dec.filter(o => o === 'PASS').length, dec.length), feedback: r1(avg(fbv)), upcoming: s.date > today };
  }).filter(g => g.size).sort((a, b) => b.date.localeCompare(a.date));

  /* ---------------- monthly trend */
  const months = {};
  for (const x of rows) { const m = x.s.date.slice(0, 7); months[m] ??= { month: m, enrolled: 0, present: 0, past: 0, pass: 0, decided: 0, fb: [] };
    const k = months[m]; k.enrolled++; if (past(x)) { k.past++; if (x.e.att) k.present++; }
    const o = x.e.final?.outcome || S.computeOutcome(x.e, x.s, { fbRequired: false }).outcome; if (o === 'PASS' || o === 'FAIL') { k.decided++; if (o === 'PASS') k.pass++; }
    if (x.e.fb?.r) k.fb.push(avg(S.FB_GROUPS.map(g => x.e.fb.r[g]))); }
  const trend = Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map(k => ({ month: k.month, enrolled: k.enrolled, attendance: pct(k.present, k.past), passRate: pct(k.pass, k.decided), feedback: r1(avg(k.fb)) }));

  /* ---------------- people who need follow-up (not for auditors; companies and trainers see only their own) */
  const people = kind === 'audit' ? [] : rows.filter(x => past(x)).map(x => ({ x, o: x.e.final?.outcome || S.computeOutcome(x.e, x.s, { fbRequired: false }).outcome }))
    .filter(({ x, o }) => o === 'FAIL' || (o === 'ABSENT' && x.e.absent))
    .map(({ x, o }) => ({ name: x.p.foreign ? x.p.en : S.fullAz(x.p, false), att: x.p.att, training: bName(x.s.bid), date: x.s.date, outcome: o, reason: o === 'FAIL' ? (x.e.prac?.result === 'FAIL' ? 'practical' : 'exam') : 'absent', score: x.e.exam?.score ?? null }))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);

  const kpi = {
    sessions: inScope.length, enrolments: rows.length, people: new Set(rows.map(x => x.p.id)).size,
    attendance: pct(present.length, decided || attRows.length), absent: absent.length, notMarked: attRows.length - decided,
    feedbackAvg: r1(avg(fbScores)), feedbackN: fbs.length, feedbackRate: pct(fbs.length, present.length),
    evalRate: pct(evs.filter(x => evDue.includes(x)).length, evDue.length), engagement: r1(avg(evs.map(x => x.e.ev.engagement))),
    testN: graded.length, testAvg: r1(avg(graded.map(x => x.e.test.pct))), testPass: pct(graded.filter(x => x.e.test.passed).length, graded.length), testReview: review.length,
    reviewDays: r1(avg(reviewDays)), examPass: pct(exams.filter(x => x.e.exam.passed).length, exams.length), examAvg: r1(avg(examScores)),
    pracN: pracs.length, pracPass: pct(pracs.filter(x => x.e.prac.result === 'PASS').length, pracs.length),
    passRate: pct(passN, passN + failN), pass: passN, fail: failN,
    dohRate: pct(dohs.length, pracSessions.length), dohFlags: dohFlag.length,
    certsIssued: issuedN, certsActive: activeN, exp30: exp30N, exp90: exp90.length, expired: expiredN, certPending: pendingCert,
  };

  /* ---------------- needs attention (rules) */
  const A = [], add = (level, key, args = [], extra = {}) => A.push({ level, key, args, ...extra });
  if (kpi.attendance !== null && decided >= 5 && kpi.attendance < RULES.attendance) add('warn', 'atAttendance', [kpi.attendance, RULES.attendance]);
  for (const g of cohorts) if (!g.upcoming && g.size >= 3 && g.attendance !== null && g.attendance < 75) add('warn', 'atCohortAttendance', [g.training, S.fmtDate(g.date), g.attendance]);
  if (kpi.passRate !== null && passN + failN >= 5 && kpi.passRate < RULES.passRate) add('bad', 'atPassRate', [kpi.passRate, RULES.passRate]);
  for (const t of Object.values(byTest)) if (t.n >= 5 && (t.pass / t.n) * 100 < RULES.passRate) add('warn', 'atTestPass', [t.title, pct(t.pass, t.n)]);
  for (const q of hardest.filter(q => (q.correct ?? 0) < RULES.question).slice(0, 3)) add('warn', 'atQuestion', [q.text.slice(0, 90), q.correct]);
  if (kpi.feedbackAvg !== null && fbs.length >= 5 && kpi.feedbackAvg < RULES.feedback) add('warn', 'atFeedback', [kpi.feedbackAvg, RULES.feedback]);
  for (const t of Object.values(fbByTrainer)) if (t.n >= 5 && t.sum / t.n < RULES.feedback) add('warn', 'atTrainerFb', [t.name, r1(t.sum / t.n)]);
  for (const g of S.FB_GROUPS) if (byQ[g] !== null && fbs.length >= 5 && byQ[g] < RULES.feedback) add('warn', 'atFbQuestion', [g, byQ[g]]);
  if (kpi.feedbackRate !== null && present.length >= 5 && kpi.feedbackRate < RULES.fbDone) add('info', 'atFbMissing', [kpi.feedbackRate]);
  if (kpi.evalRate !== null && evDue.length >= 5 && kpi.evalRate < RULES.evalDone) add('warn', 'atEvalMissing', [kpi.evalRate, evDue.length - evs.filter(x => evDue.includes(x)).length]);
  if (kpi.pracPass !== null && pracs.length >= 5 && kpi.pracPass < RULES.practical) add('warn', 'atPractical', [kpi.pracPass]);
  if (oldReview) add('bad', 'atReviewOld', [oldReview, RULES.reviewDays]);
  else if (review.length) add('info', 'atReview', [review.length]);
  if (dohFlag.length) add('info', 'atDohFlags', [dohFlag.length]);
  if (pracSessions.length && dohs.length < pracSessions.length) add('warn', 'atDohMissing', [pracSessions.length - dohs.length]);
  if (attRows.length - decided > 0) add('info', 'atNotMarked', [attRows.length - decided]);
  if (kind !== 'audit') {
    if (exp30N) add('bad', 'atExpiring', [exp30N, RULES.expiring]);
    if (pendingCert) add('info', 'atCertPending', [pendingCert]);
  }
  const order = { bad: 0, warn: 1, info: 2 }; A.sort((a, b) => order[a.level] - order[b.level]);

  const sortN = (o, f) => Object.values(o).map(f).sort((a, b) => (b.n ?? b.enrolled) - (a.n ?? a.enrolled));
  const out = {
    kind, from, to, today, rules: RULES, trainings: trainingOpts, kpi, attention: A,
    attendance: sortN(byTrainingAtt, x => ({ ...x, rate: pct(x.present, x.enrolled) })).slice(0, 12),
    feedback: { byQ, dist, byTrainer: sortN(fbByTrainer, x => ({ name: x.name, n: x.n, avg: r1(x.sum / x.n) })), byTraining: sortN(fbByTraining, x => ({ name: x.name, n: x.n, avg: r1(x.sum / x.n) })).slice(0, 12), comments },
    evaluation: { n: evs.length, behavior: beh, punctuality: pun, engagement: kpi.engagement },
    tests: { byTest: sortN(byTest, x => ({ title: x.title, n: x.n, avg: r1(x.sum / x.n), passRate: pct(x.pass, x.n) })).slice(0, 12), hardest },
    practical: sortN(pracByTraining, x => ({ ...x, rate: pct(x.pass, x.n) })).slice(0, 12),
    outcomes, cohorts: cohorts.slice(0, 60), trend,
    certs: kind === 'audit' ? null : { expiringByTraining: Object.entries(expByTraining).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 10) },
    people,
  };
  if (kind === 'audit') { for (const k of ['certsIssued', 'certsActive', 'exp30', 'exp90', 'expired', 'certPending']) delete out.kpi[k]; }
  return out;
}

/* ------------------------------------------------------------------ AI summary
   Only the computed figures go to the model (no names of people, no raw records). Comments are included anonymously so
   the summary can name recurring themes. Cached per figures + language + view; regenerated on request. */
const ROLE_TXT = { all: 'the management of the training centre', audit: 'an external auditor reviewing feedback and evaluation quality', trainer: 'a trainer looking at their own groups', company: 'a client company looking at its own employees' };
export async function aiSummary(c, data, lg, { force = false, who }) {
  c.settings = await getSettings(c.D); const cfg = aiCfg(c.settings);
  need(cfg.on && cfg.reports !== false, 'aiOff', 404); need(await aiReady(c), 'aiNotConfigured', 503);
  const { people, comments, ...figures } = { ...data, comments: data.feedback.comments };
  figures.feedback = { ...data.feedback, comments: undefined };
  const payload = { ...figures, comments: comments.slice(0, 25).map(k => ({ topic: k.g, score: k.score, text: k.text.slice(0, 300) })), peopleNeedingFollowUp: people.length };
  const key = 'r' + (await sha(JSON.stringify([payload, lg]))).slice(0, 40);
  if (!force) { const hit = await c.D.get('aireport', key); if (hit) return { text: hit.text, at: hit.at, cached: true }; }
  const n = await c.D.seq(`aiR|${who}|${c.today()}`); need(n <= Math.max(20, cfg.daily), 'aiLimit', 429);
  const system = `You are a data analyst for a vocational training centre (lifting operations, health and safety, industrial machinery).
Write a short report for ${ROLE_TXT[data.kind]} in ${LANG_NAME[lg]}, based ONLY on the JSON figures provided.
Format (plain text, no tables, no headings other than these three, use "- " for list items):
1. An overview paragraph of 3-5 sentences with the most important numbers.
2. A line with the heading for "Needs attention" in ${LANG_NAME[lg]}, then 2-6 list items, most serious first.
3. A line with the heading for "Recommendations" in ${LANG_NAME[lg]}, then 2-4 practical list items.
Rules: quote numbers exactly as given (percentages are 0-100, feedback scores are out of 10, engagement out of 5). Never invent figures, names or causes that the data does not show; if something is unknown say so. If there is too little data (few enrolments), say that conclusions are limited. Mention recurring themes from the anonymous comments if any. Feedback topics: g1 = instructor effectiveness, g2 = content and curriculum, g3 = learning materials and resources, g4 = logistics and environment, g6 = overall satisfaction. Do not mention JSON or field names.`;
  const text = await llm(c, { system, messages: [{ role: 'user', content: JSON.stringify(payload).slice(0, 24000) }], max: 900 });
  if (!text) throw new H(502, 'aiFailed');
  const at = new Date(c.now()).toISOString();
  await c.D.put('aireport', [{ id: key, data: { text, at, lang: lg, kind: data.kind } }]);
  await audit(c, 'ai.report', `${data.kind} ${data.from}..${data.to} ${lg}`);
  return { text, at };
}
export const reportsOn = async c => { c.settings = await getSettings(c.D); const cfg = aiCfg(c.settings); return cfg.on && cfg.reports !== false && (await aiReady(c)); };
export const qScope = (c, extra = {}) => { const q = k => str(c.url?.searchParams?.get(k) || '', 60); return { from: q('from'), to: q('to'), bid: q('bid'), tid: q('tid'), co: q('co'), ...extra }; };
export const bScope = (b, extra = {}) => ({ from: str(b.from, 10), to: str(b.to, 10), bid: str(b.bid, 60), tid: str(b.tid, 60), co: str(b.co, 60), ...extra });
