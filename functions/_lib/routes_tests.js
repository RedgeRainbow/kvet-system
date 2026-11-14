/* Online tests (question bank), the declaration of health and the toolbox talk.

   Tests (col "tests"): one per training (or several versions), written in Admin -> Question bank.
     { id, bid, title, intro, questions: [{ id, kind: 'mc'|'open', text, options, correct, points }], grading: 'rate'|'review', passRate, timeLimit }
     grading 'rate'   : marked automatically; PASS when the percentage reaches passRate. A test with open questions still goes to review.
     grading 'review' : always reviewed: the session's trainer, an admin or a superadmin marks it and decides PASS / FAIL.
   A session uses either an external link (examMode 'link', examLink) or a test from the bank (examMode 'bank', examId).
   The attempt lives on the enrolment (e.test) with a copy of the questions as they were when the trainee started,
   so later edits of the bank never change a result. A graded test writes the normal exam result (e.exam).

   Declaration of health (e.doh): compulsory before the practical part. The trainee fills and signs it in the trainee portal,
   or staff / the trainer record that the paper form was received.
   Toolbox talk (session.tbt): filled and signed by the trainer for sessions with a practical part. */
import { H, S, str, num, need, bool, uid, audit, auditMany, enrOf, saveEnr, saveEnrs, enrsOfIds, getSettings, edgeCached } from './core.js';
import { sign, unsign, slot } from './signs.js';
import { loadEnrolled, loadSession, docsGate } from './ops.js';
import { notify } from './routes_notify.js';

/* ------------------------------------------------------------------ bank */
export function readTest(b) {
  const seen = new Set();
  const questions = (Array.isArray(b.questions) ? b.questions : []).slice(0, 1000).map((q, i) => {
    let id = str(q.id, 20) || 'q' + (i + 1); while (seen.has(id)) id += 'x'; seen.add(id);
    const kind = q.kind === 'open' ? 'open' : 'mc', text = str(q.text, 4000), points = num(q.points, 1, 100, 1), grp = str(q.grp, 20).replace(/[^\w-]/g, '');
    const img = S.goodQImg(q.img) ? q.img : '';                              // picture of the question (uploaded, see POST /test/image)
    if (kind === 'open') return { id, kind, text, points, ...(grp ? { grp } : {}), ...(img ? { img } : {}) };
    // choices get their own random id; the correct answer is stored as that id (an index is accepted on input)
    const raw = (Array.isArray(q.options) ? q.options : []).map(o => (o && typeof o === 'object' ? { id: str(o.id, 12), text: str(o.text, 1000) } : { id: '', text: str(o, 1000) }));
    const used = new Set(), options = [];
    raw.forEach((o, k) => { if (!o.text || options.length >= 10) return; let oid = /^[\w-]{3,12}$/.test(o.id) && !used.has(o.id) ? o.id : ''; while (!oid || used.has(oid)) oid = rid(); used.add(oid); options.push({ id: oid, text: o.text, k }); });
    const ci = typeof q.correct === 'number' ? q.correct : -1, cid = typeof q.correct === 'string' ? q.correct : null;
    const correct = (cid !== null ? options.find(o => o.id === cid || raw[o.k]?.id === cid) : options.find(o => o.k === ci))?.id ?? -1;
    return { id, kind, text, options: options.map(({ id: i2, text: t2 }) => ({ id: i2, text: t2 })), correct, points, ...(grp ? { grp } : {}), ...(img ? { img } : {}) };
  }).filter(q => q.text);
  need(questions.length, 'noQuestions');
  // a draft may hold unfinished questions (e.g. imported without a correct answer); it cannot be used by a session until complete
  const bad = questions.findIndex(q => q.kind === 'mc' && !(q.options.length >= 2 && q.options.some(o => o.id === q.correct)));
  if (bad >= 0 && !bool(b.draft)) throw new H(400, 'badQuestion', { n: bad + 1 });
  const grading = b.grading === 'review' ? 'review' : 'rate';
  // questions per attempt, drawn at random: pick = in total, or pickBy = per section ({ g1: 10, open: 5 })
  const pickBy = {}; for (const [k, v] of Object.entries(b.pickBy || {})) { const n = num(v, 0, 1000, 0), key = str(k, 20).replace(/[^\w-]/g, ''); if (n && key && questions.some(q => (q.grp || '') === key)) pickBy[key] = n; }
  return { bid: str(b.bid, 60), title: str(b.title, 200), intro: str(b.intro, 1500), questions, grading, passRate: num(b.passRate, 1, 100, 80), timeLimit: num(b.timeLimit, 0, 600, 0),
    pick: Object.keys(pickBy).length ? 0 : num(b.pick, 0, 1000, 0), pickBy, draft: bad >= 0, source: str(b.source, 120) };
}
/* The questions of one attempt.
   - count (set on the session) = that many questions per candidate, drawn at random from the whole test;
     otherwise the test's own rule (pick in total / pickBy per section / all).
   - question order and the order of the choices are shuffled for each candidate (choices like "all of the above" keep their order);
   - every choice gets a new random id for this attempt, so nothing about the bank's order can be read from the page.
   The result is stored on the enrolment: refreshing the page shows exactly the same questions and choices. */
const rndIdx = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const shuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = rndIdx(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (list, n) => shuffle(list).slice(0, n);
export function drawQuestions(x, count = 0) {
  const all = x.questions, by = x.pickBy || {};
  let chosen;
  if (count > 0) chosen = sample(all, Math.min(count, all.length));
  else if (Object.keys(by).length) { chosen = []; for (const g of [...new Set(all.map(q => q.grp || ''))]) { const list = all.filter(q => (q.grp || '') === g); chosen.push(...(by[g] ? sample(list, by[g]) : list)); } chosen = shuffle(chosen); }
  else chosen = x.pick > 0 && x.pick < all.length ? sample(all, x.pick) : shuffle(all);
  return chosen.map(q => {
    if (q.kind === 'open') return { ...q };
    const opts = S.optList(q), ids = new Map(opts.map(o => [o.id, rid()]));
    return { ...q, options: (S.keepOrder(q) ? opts : shuffle(opts)).map(o => ({ id: ids.get(o.id), text: o.text })), correct: ids.get(q.correct) ?? '' };
  });
}
/* how many questions a session may ask per candidate: the whole pool at most */
export const poolSize = x => x?.questions?.length || 0;
/* what a trainee sees: never the correct answers */
const forTrainee = q => ({ ...(q.kind === 'open' ? { id: q.id, kind: 'open', text: q.text, points: q.points } : { id: q.id, kind: 'mc', text: q.text, options: S.optList(q), points: q.points }), ...(q.img ? { img: q.img } : {}) });
const examLabel = 'Online test';

/* Marks a test (open answers by marks, pass / fail chosen by the reviewer) and writes the exam result. */
async function grade(c, s, e, b) {
  const x = e.test; need(x?.at, 'noTest', 409); need(!e.final, 'locked', 409);
  const marks = {}; for (const q of x.qs) if (q.kind === 'open') { const v = b.marks?.[q.id]; if (v !== undefined && v !== null && v !== '') marks[q.id] = num(v, 0, q.points, 0); }
  const sc = S.testScore(x.qs, x.answers, marks); need(!sc.pending, 'marksMissing', 409);
  need(typeof b.passed === 'boolean', 'chooseResult');
  const by = c.user.kind === 'trainer' ? S.fullAz(c.me, false) : c.user.email;
  Object.assign(x, { marks, score: sc.score, max: sc.max, pct: sc.pct, passed: b.passed, status: 'graded', note: str(b.note, 500), gradedAt: new Date(c.now()).toISOString(), gradedBy: by });
  e.exam = { passed: b.passed, score: sc.pct, note: x.note || examLabel, at: x.gradedAt, by, test: true };
  await saveEnr(c.D, e); await audit(c, 'test.grade', `${s.id} ${e.tid} ${sc.pct}% ${b.passed ? 'PASS' : 'FAIL'}`);
  await unsign(c, [slot.test(s.id, e.tid), slot.exam(s.id)]);       // the session's signed exam results changed too
  // the test sheet is signed by the trainer when the trainer marks it (the office does not sign documents)
  if (c.user.kind === 'trainer') x.sign = await sign(c, slot.test(s.id, e.tid), 'test', { sid: s.id, tid: e.tid }, 'grader');
  return e;
}

/* ------------------------------------------------- declaration of health */
function readDoh(b) {
  const answers = {};
  for (const [k] of S.DOH_Q) { need(b.answers?.[k] === 'Y' || b.answers?.[k] === 'N', 'answerAll'); answers[k] = b.answers[k]; }
  const x = { dob: str(b.dob, 10), company: str(b.company, 160), answers, details: str(b.details, 2000) };
  need(S.isDate(x.dob), 'badDob');
  need(!Object.values(answers).includes('Y') || x.details, 'needDetails');
  need(bool(b.agree), 'needAgree');
  return x;
}
async function paperDoh(c, sid, tid, on) {
  const { s, e } = await loadEnrolled(c, sid, tid); docsGate(c, s); need(s.sheetId, 'noSheet', 409); need(!e.final, 'locked', 409);
  if (on) { need(!e.doh || e.doh.paper, 'dohDone', 409); e.doh = { paper: true, at: new Date(c.now()).toISOString(), by: c.user.kind === 'trainer' ? S.fullAz(c.me, false) : c.user.email }; }
  else { need(!e.doh || e.doh.paper, 'dohDone', 409); need(!e.prac, 'hasData', 409); delete e.doh; }
  await saveEnr(c.D, e); await audit(c, on ? 'doh.paper' : 'doh.paper.undo', `${s.id} ${tid}`); return e;
}

/* ------------------------------------------------------------ toolbox talk */
/* The trainer opens the toolbox talk (topic, notes …): the candidates then acknowledge and sign it in their portal (date and
   time), and the trainer signs it last. Changing the talk afterwards withdraws every signature: it is signed again. */
async function saveTbt(c, s, b) {
  need(s.sheetId, 'noSheet', 409); need(!s.cancelled, 'sessionClosed', 409); docsGate(c, s);
  const was = s.tbt ? JSON.stringify((({ at, by, sign, open, ...x }) => x)(s.tbt)) : null;
  const trades = {}; for (const tid of s.traineeIds || []) { const v = str(b.trades?.[tid], 80); if (v) trades[tid] = v; }
  s.tbt = { topic: str(b.topic, 300), company: str(b.company, 160), location: str(b.location, 160), talkBy: str(b.talkBy, 120), date: S.isDate(b.date) ? b.date : s.date, notes: str(b.notes, 2000), trades,
    at: new Date(c.now()).toISOString(), by: c.user.kind === 'trainer' ? S.fullAz(c.me, false) : c.user.email };
  need(s.tbt.topic, 'needTopic'); s.tbt.open = true;
  await c.D.put('sessions', [{ id: s.id, data: s }]); await audit(c, 'tbt.save', `${s.id} ${s.tbt.topic}`);
  const now = JSON.stringify((({ at, by, sign, open, ...x }) => x)(s.tbt));
  if (was !== now) {
    await notify(c, (s.traineeIds || []).map(x => 'trainee:' + x), 'nTbtOpen', [s.tbt.topic]);
    await unsign(c, [slot.tbt(s.id), ...(s.traineeIds || []).map(tid => slot.tbtP(s.id, tid))]);
    for (const tid of s.traineeIds || []) { const e = await enrOf(c.D, s.id, tid); if (e.tbtAck) { delete e.tbtAck; await saveEnr(c.D, e); } }
  }
  return s;
}

/* The exam is opened by the trainer (or staff) in the classroom; until then nobody sees a question.
   Closing it hands in every attempt that is still open, with the answers saved so far. */
async function examSwitch(c, s, open) {
  need(s.examMode === 'bank' && s.examId, 'noTest', 409); need(!s.cancelled, 'sessionClosed', 409);
  const who = c.user.kind === 'trainer' ? S.fullAz(c.me, false) : c.user.email, at = new Date(c.now()).toISOString();
  if (open) { docsGate(c, s); const x = await c.D.get('tests', s.examId); need(x && !x.draft, 'testDraft', 409); need(S.usable(x), 'testNotApproved', 409); s.exam = { open: true, openedAt: at, openedBy: who }; }
  else {
    need(s.exam?.open, 'examNotStarted', 409); s.exam = { ...s.exam, open: false, closedAt: at, closedBy: who };
    // every attempt still open is handed in with what was saved: read together, written together
    const open = (await enrsOfIds(c.D, s.id, s.traineeIds || [])).filter(e => e.test && !e.test.at), done = open.map(e => markFinished(c, s, e, e.test.draft || {}, 'closed'));
    await saveEnrs(c.D, open); if (done.some(d => d.out.status === 'graded')) await unsign(c, [slot.exam(s.id)]); await auditMany(c, done.map(d => ['test.submit', d.line]));
  }
  await c.D.put('sessions', [{ id: s.id, data: s }]); await audit(c, open ? 'exam.open' : 'exam.close', `${s.id} · ${who}`, { entity: { kind: 'session', id: s.id, label: s.date } });
  return s.exam;
}
/* the fields of a test from a request (shared by staff and trainers) */
export async function testFields(c, b) {
  const f = readTest(b), bl = f.bid ? await c.D.get('blanks', f.bid) : null; need(!f.bid || bl, 'badInput');
  if (!f.title) f.title = bl?.name || ''; need(f.title, 'needTitle'); return f;
}
/* Saves a test with the approval rules:
   - direct (admin; editor without approval): published at once, any open proposal is dropped;
   - otherwise a new test waits as 'pending' (or 'draft' while it is not submitted / not complete),
     and a change to an active test is kept as x.proposal; the active version stays in use until the change is approved. */
export async function storeTest(c, x, f, { submit, direct, owner }) {
  const now = new Date(c.now()).toISOString(), by = owner.name;
  if (x) {
    if (direct) { Object.assign(x, f, { updatedAt: now, status: 'active' }); delete x.proposal; delete x.review; }
    else if ((x.status || 'active') === 'active') { need(submit && !f.draft, f.draft ? 'badQuestion' : 'needSubmit'); x.proposal = { ...f, by, at: now }; }
    else { Object.assign(x, f, { updatedAt: now, status: submit && !f.draft ? 'pending' : 'draft' }); delete x.review; }
  } else x = { id: uid('x'), ...f, owner, createdAt: now, status: direct ? 'active' : submit && !f.draft ? 'pending' : 'draft' };
  await c.D.put('tests', [{ id: x.id, data: x }]);
  await audit(c, x.proposal?.at === now ? 'test.propose' : x.createdAt === now ? 'test.create' : 'test.update', `${x.title} (${(x.proposal || x).questions.length}) · ${x.proposal?.at === now ? 'pending' : x.status}`, { entity: { kind: 'test', id: x.id, label: x.title } });
  return x;
}
/** @type {import('../../types/store').Routes} */
const testsStaff = {
  'GET /tests': { auth: 'staff', act: 'library', async fn(c) { return { list: (await c.D.all('tests')).map(r => r.data).sort((a, b) => (a.title || '').localeCompare(b.title || '')) }; } },
  'POST /test/save': { auth: 'staff', act: 'test.save', async fn(c) {
    // the bank is independent of trainings: linking a test to a training is optional (it only sorts the list)
    const b = await c.body(), f = await testFields(c, b);
    const old = b.id ? await c.D.get('tests', str(b.id, 60)) : null; if (b.id) need(old, 'noRec', 404);
    const x = await storeTest(c, old, f, { submit: true, direct: S.mayPublish(c.user, await getSettings(c.D), 'tests'), owner: { kind: 'staff', id: c.user.id, name: c.user.email } });
    return { test: x };
  } },
  'POST /test/delete': { auth: 'staff', act: 'test.save', async fn(c) {
    const b = await c.body(), x = await c.D.get('tests', str(b.id, 60)); need(x, 'noRec', 404);
    const used = (await c.D.query('sessions', { where: [['examId', 'eq', x.id], ['examMode', 'eq', 'bank']], limit: 0, count: true })).total; if (used) throw new H(409, 'testInUse', { n: used });
    await c.D.del('tests', x.id); await audit(c, 'test.delete', x.title); return { ok: 1 };
  } },
  'POST /test/grade': { auth: 'staff', act: 'test.review', async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid); return { enr: await grade(c, s, e, b) };
  } },
  /* a new attempt (e.g. a technical problem); a released result cannot be reset */
  'POST /test/reset': { auth: 'staff', act: 'test.review', async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid); need(e.test, 'noTest', 409); need(!e.final, 'locked', 409);
    delete e.test; if (e.exam?.test) delete e.exam;
    await saveEnr(c.D, e); await unsign(c, [slot.test(s.id, e.tid), slot.exam(s.id)]); await audit(c, 'test.reset', `${s.id} ${e.tid}`); return { enr: e };
  } },
  'POST /session/exam': { auth: 'staff', act: 'exam.save', async fn(c) { const b = await c.body(), s = await loadSession(c, b.sid); return { exam: await examSwitch(c, s, bool(b.open)) }; } },
  'POST /enr/doh/paper': { auth: 'staff', act: 'practical.save', async fn(c) { const b = await c.body(); return { enr: await paperDoh(c, b.sid, b.tid, b.on !== false) }; } },
  /* a declaration filled online can be cleared (wrong answers); it then has to be filled again */
  'POST /enr/doh/reset': { auth: 'staff', act: 'test.review', async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid); need(!e.final, 'locked', 409); delete e.doh;
    await saveEnr(c.D, e); await unsign(c, [slot.doh(s.id, e.tid)]); await audit(c, 'doh.reset', `${s.id} ${e.tid}`); return { enr: e };
  } },
  'POST /session/tbt': { auth: 'staff', act: 'session.save', async fn(c) { const b = await c.body(), s = await loadSession(c, b.sid); return { session: await saveTbt(c, s, b) }; } },
};

const own = (c, s) => need(s.tid === c.me.id, 'forbidden', 403);
/** @type {import('../../types/store').Routes} */
const testsTrainer = {
  /* the trainer opens a candidate's answers (with the answer key): recorded on the session, because after this a new attempt
     for anyone in the session needs the trainer's explicit agreement (they have seen the correct answers) */
  'GET /portal/trainer/test': { auth: 'trainer', async fn(c) {
    const { s, e } = await loadEnrolled(c, c.url.searchParams.get('sid'), c.url.searchParams.get('tid')); own(c, s); need(e.test?.at, 'noTest', 404);
    if (!s.keySeen) { s.keySeen = { at: new Date(c.now()).toISOString(), by: S.fullAz(c.me, false) }; await c.D.put('sessions', [{ id: s.id, data: s }]); await audit(c, 'test.keyView', `${s.id} ${e.tid}`); }
    return { test: e.test };
  } },
  /* a new attempt for one candidate: the old attempt is removed and the next opening draws new random questions */
  'POST /portal/trainer/test/reset': { auth: 'trainer', async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid); own(c, s); need(!s.cancelled && !s.closed, 'sessionClosed', 409);
    need(e.test, 'noTest', 409); need(!e.final, 'locked', 409);
    if (s.keySeen && !bool(b.force)) throw new H(409, 'keySeen', { at: s.keySeen.at, by: s.keySeen.by });
    const was = e.test.at ? `${e.test.pct ?? '?'}%` : 'not submitted';
    delete e.test; if (e.exam?.test) delete e.exam;
    await saveEnr(c.D, e); await unsign(c, [slot.test(s.id, e.tid), slot.exam(s.id)]);
    await audit(c, 'test.reset', `${s.id} ${e.tid} by trainer (was ${was})${s.keySeen ? ' · after viewing the answer key' : ''}`);
    return { ok: 1 };
  } },
  'POST /portal/trainer/test/grade': { auth: 'trainer', async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid); own(c, s); need(!s.cancelled, 'sessionClosed', 409);
    // a test the system marked by itself (multiple choice, pass rate) is not re-decided by the trainer: the office can (POST /test/grade)
    need(!(e.test?.status === 'graded' && e.test.gradedBy === 'auto'), 'autoGraded', 409);
    const r = await grade(c, s, e, b); return { test: r.test };
  } },
  'POST /portal/trainer/exam': { auth: 'trainer', async fn(c) { const b = await c.body(), s = await loadSession(c, b.sid); own(c, s); return { exam: await examSwitch(c, s, bool(b.open)) }; } },
  'POST /portal/trainer/doh/paper': { auth: 'trainer', async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid); own(c, s); need(!s.closed && !s.cancelled, 'sessionClosed', 409);
    return { doh: (await paperDoh(c, b.sid, b.tid, b.on !== false)).doh || null };
  } },
  'POST /portal/trainer/tbt': { auth: 'trainer', async fn(c) { const b = await c.body(), s = await loadSession(c, b.sid); own(c, s); return { tbt: (await saveTbt(c, s, b)).tbt }; } },
  'POST /portal/trainer/sign/tbt': { auth: 'trainer', async fn(c) { const b = await c.body(), s = await loadSession(c, b.sid); own(c, s); need(s.tbt, 'nothingToSign', 409); return { sign: await sign(c, slot.tbt(s.id), 'tbt', { sid: s.id }, 'trainer') }; } },
};

/* ------------------------------------------------------------------ trainee */
async function myEnrol(c, sid) {
  const s = await c.D.get('sessions', str(sid, 60)); need(s && (s.traineeIds || []).includes(c.me.id), 'noRec', 404);
  return { s, e: await enrOf(c.D, s.id, c.me.id) };
}
/* when the trainee may open the test: the trainer / admin started the exam, attendance confirmed, feedback given (if required) */
async function testOpen(c, s, e) {
  need(s.examMode === 'bank' && s.examId, 'noTest', 404); need(!s.cancelled, 'sessionClosed', 409);
  need(e.att && !e.absent, 'notConfirmed', 409); need(!e.final, 'locked', 409);
  need(s.exam?.open, s.exam?.closedAt ? 'examClosed' : 'examNotStarted', 409);
  if ((await getSettings(c.D)).fbRequired !== false) need(e.fb, 'needFeedback', 409);
}
export const testState = (s, e) => (s.examMode !== 'bank' ? null : e.test?.at ? (e.test.status === 'graded' ? 'graded' : 'review') : e.test ? 'started' : s.exam?.open ? 'new' : s.exam?.closedAt ? 'closed' : 'locked');

/* the trainee's answers, checked against this attempt's questions (choice ids, free text) */
function cleanAnswers(x, raw = {}) {
  const out = {};
  for (const q of x.qs) { const v = raw[q.id]; if (v === undefined || v === null || v === '') continue;
    if (q.kind === 'open') { const t = str(v, 4000); if (t) out[q.id] = t; } else if (S.optList(q).some(o => o.id === v)) out[q.id] = v; }
  return out;
}
const deadline = x => (x.timeLimit > 0 ? new Date(x.startedAt).getTime() + (x.timeLimit * 60 + 120) * 1000 : Infinity);   // 2 minutes' grace
/* hands the attempt in (by the trainee, at the end of the time, or when the exam is closed) and marks it when possible */
export async function finishTest(c, s, e, answers, why = 'submit') {
  const d = markFinished(c, s, e, answers, why);
  await saveEnr(c.D, e); if (d.out.status === 'graded') await unsign(c, [slot.exam(s.id)]); await audit(c, 'test.submit', d.line);
  return d.out;
}
/* the marking itself, nothing saved: changes e.test (and e.exam when it can be marked automatically) */
function markFinished(c, s, e, answers, why = 'submit') {
  const x = e.test, now = c.now(), late = why === 'submit' && now > deadline(x);
  const sc = S.testScore(x.qs, answers, {});
  Object.assign(x, { answers, at: new Date(now).toISOString(), late: late || undefined, closedBy: why === 'submit' ? undefined : why, auto: { score: sc.score, max: sc.max } });
  delete x.draft;
  if (x.grading === 'rate' && !sc.open && !late) {
    Object.assign(x, { status: 'graded', score: sc.score, max: sc.max, pct: sc.pct, passed: sc.pct >= x.passRate, gradedAt: x.at, gradedBy: 'auto' });
    e.exam = { passed: x.passed, score: sc.pct, note: examLabel, at: x.at, by: 'auto', test: true };
  } else x.status = 'review';
  return { out: { status: x.status, ...(x.status === 'graded' ? { pct: x.pct, passed: x.passed } : {}) }, line: `${s.id} ${e.tid} ${x.status}${x.status === 'graded' ? ' ' + x.pct + '%' : ''}${why !== 'submit' ? ' (' + why + ')' : ''}` };
}
const doneOut = x => ({ done: true, status: x.status, ...(x.status === 'graded' ? { pct: x.pct, passed: x.passed } : {}) });

/* question pictures: images only (PNG / JPEG / WebP, checked by their first bytes), max 3 MB; the browser shrinks them first */
/** @type {[string, number[], string][]} */
const IMG = [['png', [0x89, 0x50, 0x4e, 0x47], 'image/png'], ['jpg', [0xff, 0xd8, 0xff], 'image/jpeg'], ['webp', [0x52, 0x49, 0x46, 0x46], 'image/webp']];
export const QIMG_PER_DAY = 100;
export async function saveQImage(c) {
  const buf = await c.req.arrayBuffer(); need(buf.byteLength > 100 && buf.byteLength <= 3e6, 'badFile');
  const head = new Uint8Array(buf.slice(0, 12)), kind = IMG.find(([, sig]) => sig.every((v, i) => head[i] === v)); need(kind, 'badFile');
  if (kind[0] === 'webp') need(String.fromCharCode(...head.slice(8, 12)) === 'WEBP', 'badFile');
  const key = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join('') + '.' + kind[0];
  if (await c.B.head('qimg/' + key)) return { img: key };                          // the same picture again: nothing new is stored
  // a trainer's account may add QIMG_PER_DAY new pictures a day (v3.36): storage cannot be filled from one signed-in account
  if (c.me && c.user?.kind !== 'staff') {
    const tr = await c.D.get('trainers', c.me.id), day = c.today(), used = tr?.imgq?.day === day ? Number(tr.imgq.n) || 0 : 0;
    if (!tr || used >= QIMG_PER_DAY) { await audit(c, 'test.image.limit', `${c.me.name || ''} ${c.me.surname || ''} · ${used}`).catch(() => {}); throw new H(429, 'imgLimit'); }
    tr.imgq = { day, n: used + 1 }; await c.D.put('trainers', [{ id: tr.id, data: tr }]);
  }
  await c.B.put('qimg/' + key, buf, { httpMetadata: { contentType: kind[2] } });
  return { img: key };
}
export const MAX_WARN = 3;
/** @type {import('../../types/store').Routes} */
const testsTrainee = {
  'GET /portal/trainee/test': { auth: 'trainee', async fn(c) {
    const { s, e } = await myEnrol(c, c.url.searchParams.get('sid'));
    if (e.test?.at) return doneOut(e.test);
    // time is up (e.g. the browser was closed): hand in what was saved
    if (e.test && c.now() > deadline(e.test)) return { ...doneOut({}), ...(await finishTest(c, s, e, e.test.draft || {}, 'time')), done: true };
    await testOpen(c, s, e);
    if (!e.test) {
      const x = await c.D.get('tests', s.examId); need(x, 'noTest', 404); need(!x.draft, 'testDraft', 409);
      e.test = { examId: x.id, title: x.title, grading: x.grading, passRate: x.passRate, timeLimit: s.examMinutes || x.timeLimit || 0, qs: drawQuestions(x, s.examCount || 0), intro: x.intro || '', startedAt: new Date(c.now()).toISOString(), draft: {} };
      await saveEnr(c.D, e); await audit(c, 'test.start', `${s.id} ${c.me.att} (${e.test.qs.length})`);
    }
    const x = e.test;
    return { title: x.title, intro: x.intro, timeLimit: x.timeLimit, startedAt: x.startedAt, now: new Date(c.now()).toISOString(), questions: x.qs.map(forTrainee), saved: x.draft || {}, warns: (x.warns || []).length, maxWarns: MAX_WARN };
  } },
  /* exam integrity: leaving the exam page (another tab, window or app) is reported by the browser; each counts as a warning
     and the 3rd ends the attempt at once with what was answered. Counted on the server, so a reload does not reset it. */
  'POST /portal/trainee/test/warn': { auth: 'trainee', async fn(c) {
    const b = await c.body(), { s, e } = await myEnrol(c, b.sid); const x = e.test; need(x && !x.at, 'noTest', 409); await testOpen(c, s, e);
    x.warns ||= []; const last = x.warns[x.warns.length - 1], now = c.now();
    if (!last || now - Date.parse(last.at) > 2500) {                    // one leave fires several browser events: counted once
      x.warns.push({ at: new Date(now).toISOString(), kind: ['hidden', 'blur', 'copy', 'menu'].includes(b.kind) ? b.kind : 'hidden' }); await saveEnr(c.D, e);
      await audit(c, 'test.warning', `${s.id} ${c.me.att} ${x.warns.length}/${MAX_WARN}`);
    }
    if (x.warns.length >= MAX_WARN) return { warns: x.warns.length, max: MAX_WARN, done: true, result: await finishTest(c, s, e, x.draft || {}, 'warnings') };
    return { warns: x.warns.length, max: MAX_WARN };
  } },
  /* answers are saved as the trainee goes (the whole set each time, so a lost request never loses an earlier answer) */
  'POST /portal/trainee/test/save': { auth: 'trainee', async fn(c) {
    const b = await c.body(), { s, e } = await myEnrol(c, b.sid); const x = e.test; need(x && !x.at, 'noTest', 409); await testOpen(c, s, e);
    need(c.now() <= deadline(x), 'timeUp', 409);
    x.draft = cleanAnswers(x, b.answers); x.savedAt = new Date(c.now()).toISOString(); await saveEnr(c.D, e);
    return { saved: Object.keys(x.draft).length, at: x.savedAt };
  } },
  'POST /portal/trainee/test/submit': { auth: 'trainee', async fn(c) {
    const b = await c.body(), { s, e } = await myEnrol(c, b.sid); const x = e.test; need(x && !x.at, 'noTest', 409);
    // after the exam was closed the attempt was already handed in; a late click still hands in what is newest
    if (!s.exam?.open) need(!s.exam?.closedAt || x, 'examClosed', 409); else await testOpen(c, s, e);
    // one hand-in per attempt even when two tabs submit at the same moment: the first claim wins (atomic insert)
    try { await c.D.insert('claims', `submit|${s.id}|${e.tid}|${x.startedAt}`, { at: new Date(c.now()).toISOString() }); } catch (/** @type {any} */ er) { if (er.message === 'dup') throw new H(409, 'noTest'); throw er; }
    // after the time limit (+2 minutes' grace, +3 more for a phone that was offline and reconnects) only the answers saved in
    // time count: a hand-in cannot extend the exam. Answers kept on the phone during a short outage still arrive in time.
    const late = c.now() > deadline(x) + 180e3;
    if (late) x.lateHandIn = Math.round((c.now() - deadline(x)) / 1000);
    return finishTest(c, s, e, late ? { ...(x.draft || {}) } : { ...(x.draft || {}), ...cleanAnswers(x, b.answers) });
  } },
  'POST /portal/trainee/doh': { auth: 'trainee', async fn(c) {
    const b = await c.body(), { s, e } = await myEnrol(c, b.sid); docsGate(c, s);
    need(s.sheetId, 'noSheet', 409); need(!s.cancelled, 'sessionClosed', 409); need(!e.final, 'locked', 409); need(!e.doh, 'dohDone', 409);
    e.doh = { ...readDoh(b), at: new Date(c.now()).toISOString() };
    await saveEnr(c.D, e); await audit(c, 'doh.submit', `${s.id} ${c.me.att}${S.dohYes(e.doh) ? ' YES' : ''}`);
    e.doh.sign = await sign(c, slot.doh(s.id, e.tid), 'doh', { sid: s.id, tid: e.tid }, 'participant');
    return { doh: e.doh };
  } },
};

/** @type {import('../../types/store').Routes} */
const testsImages = {
  'POST /test/image': { auth: 'staff', act: 'test.save', raw: true, async fn(c) { return saveQImage(c); } },
  'POST /portal/trainer/test/image': { auth: 'trainer', raw: true, async fn(c) { return saveQImage(c); } },
  /* pictures are public by their unguessable name (a question picture never shows the answer key) */
  'GET /qimg/:key': { auth: 'none', raw: true, async fn(c) {
    const k = c.params.key; if (!S.goodQImg(k)) throw new H(404, 'noRec');
    return edgeCached(c.req, async () => { const o = await c.B.get('qimg/' + k); if (!o) throw new H(404, 'noRec');
    return new Response(o.body, { headers: { 'content-type': k.endsWith('.png') ? 'image/png' : k.endsWith('.jpg') ? 'image/jpeg' : 'image/webp', 'cache-control': 'public,max-age=31536000,immutable', 'x-content-type-options': 'nosniff' } }); });
  } },
};
export const testRoutes = { ...testsStaff, ...testsTrainer, ...testsTrainee, ...testsImages };
