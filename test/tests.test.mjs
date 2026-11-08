/* Online tests (question bank), declaration of health, toolbox talk. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';
import * as S2 from '../public/js/shared.js';

const person = (o = {}) => ({ name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', fin: '1ABC234', phone: '+994501234567', ...o });
async function setup() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} });
  await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  const tr = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Rəşad', surname: 'Əliyev', fin: 'TRN1234' }) })).json;
  const st = (await call('GET', '/state', { token: sa })).json;
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  return { app, call, sa, tr, tk, blank: st.blanks[0], sheet: st.sheets[0] };
}
const mk = async (ctx, fin) => { const r = (await ctx.call('POST', '/trainee/save', { token: ctx.sa, body: person({ fin }) })).json; r.tok = (await ctx.call('POST', '/login', { body: { role: 'trainee', login: r.trainee.login, password: r.creds.password } })).json.token; return r; };
/* answers by the text of the chosen option (questions and choices are shuffled per candidate) */
const pick = (view, picks) => Object.fromEntries(view.questions.filter(q => picks[q.text] !== undefined).map(q => [q.id, q.kind === 'open' ? picks[q.text] : q.options.find(o => o.text === picks[q.text]).id]));
const openExam = (ctx, s) => ctx.call('POST', '/session/exam', { token: ctx.sa, body: { sid: s.id, open: true } });
const Q = [
  { kind: 'mc', text: 'Who may give signals to the crane operator?', options: ['Anyone', 'The appointed signaller', 'The client'], correct: 1 },
  { kind: 'mc', text: 'Max wind speed?', options: ['20 m/s', '9.8 m/s'], correct: 1 },
  { kind: 'mc', text: 'Check slings before every lift?', options: ['Yes', 'No'], correct: 0 },
  { kind: 'mc', text: 'Stand under a suspended load?', options: ['Yes', 'Never'], correct: 1 },
];

test('question bank: validation, the trainee never sees answers, automatic marking writes the exam result', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  assert.equal((await call('POST', '/test/save', { token: sa, body: { bid: ctx.blank.id, questions: [{ kind: 'mc', text: 'x', options: ['a'], correct: 0 }] } })).json.error, 'badQuestion');
  assert.equal((await call('POST', '/test/save', { token: sa, body: { bid: ctx.blank.id, questions: [] } })).json.error, 'noQuestions');
  const x = (await call('POST', '/test/save', { token: sa, body: { bid: ctx.blank.id, questions: Q, passRate: 75 } })).json.test;
  assert.equal(x.title, ctx.blank.name, 'the training name is the default heading'); assert.equal(x.grading, 'rate');
  const ed = await ctx.app.mkStaff('ed@kvet.az', 'editor'), rd = await ctx.app.mkStaff('rd@kvet.az', 'reader');
  assert.equal((await call('POST', '/test/save', { token: rd, body: { bid: ctx.blank.id, questions: Q } })).status, 403, 'readers cannot write questions');
  assert.equal((await call('POST', '/test/save', { token: ed, body: { bid: ctx.blank.id, questions: Q } })).status, 200, 'editors can');

  const a = await mk(ctx, '1AAA111'), b = await mk(ctx, '2BBB222');
  assert.equal((await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', traineeIds: [] } })).json.error, 'needTest');
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: x.id, examLink: 'https://ignored.example', traineeIds: [a.trainee.id, b.trainee.id] } })).json.session;
  assert.equal(s.examLink, '', 'a bank test replaces the external link');
  assert.equal((await call('POST', '/test/delete', { token: sa, body: { id: x.id } })).json.error, 'testInUse');

  assert.equal((await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json.error, 'notConfirmed');
  for (const t of [a, b]) await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: t.trainee.id } });
  assert.equal((await call('GET', '/portal/trainee/home', { token: a.tok })).json.sessions[0].test, 'locked');
  assert.equal((await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json.error, 'examNotStarted', 'nobody sees a question before the exam is started');
  await openExam(ctx, s);
  assert.equal((await call('GET', '/portal/trainee/home', { token: a.tok })).json.sessions[0].test, 'new');
  const view = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json;
  assert.equal(view.questions.length, 4); assert.ok(view.questions.every(q => q.correct === undefined), 'no correct answers sent');
  // edits of the bank after the start do not change this attempt
  await call('POST', '/test/save', { token: sa, body: { ...x, questions: [...Q, { kind: 'mc', text: 'new', options: ['a', 'b'], correct: 0 }] } });
  const r = (await call('POST', '/portal/trainee/test/submit', { token: a.tok, body: { sid: s.id, answers: pick(view, { [Q[0].text]: Q[0].options[1], [Q[1].text]: Q[1].options[1], [Q[2].text]: Q[2].options[0], [Q[3].text]: Q[3].options[0] }) } })).json;
  assert.deepEqual(r, { status: 'graded', pct: 75, passed: true });
  assert.equal((await call('POST', '/portal/trainee/test/submit', { token: a.tok, body: { sid: s.id, answers: {} } })).json.error, 'noTest', 'one attempt only');
  const enr = (await call('GET', '/session?id=' + s.id, { token: sa })).json.enrs.find(e => e.tid === a.trainee.id);
  assert.equal(enr.exam.passed, true); assert.equal(enr.exam.score, 75); assert.equal(enr.test.qs.length, 4);
  // b fails, then gets a new attempt from staff
  const vb = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: b.tok })).json;
  assert.equal((await call('POST', '/portal/trainee/test/submit', { token: b.tok, body: { sid: s.id, answers: pick(vb, { [Q[0].text]: Q[0].options[0] }) } })).json.passed, false);
  assert.equal((await call('POST', '/test/reset', { token: ed, body: { sid: s.id, tid: b.trainee.id } })).status, 403, 'only admin and up reset');
  await call('POST', '/test/reset', { token: sa, body: { sid: s.id, tid: b.trainee.id } });
  const eb = (await call('GET', '/session?id=' + s.id, { token: sa })).json.enrs.find(e => e.tid === b.trainee.id);
  assert.equal(eb.test, undefined); assert.equal(eb.exam, undefined);
});

test('review mode and open questions: trainer of the session or admin marks them, readers / other trainers cannot', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx;
  const x = (await call('POST', '/test/save', { token: sa, body: { bid: ctx.blank.id, title: 'Rigging — final test', grading: 'rate', passRate: 80, questions: [...Q.slice(0, 2), { kind: 'open', text: 'Describe a pre-use check.', points: 3 }] } })).json.test;
  const a = await mk(ctx, '1AAA111');
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: x.id, traineeIds: [a.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: a.trainee.id } }); await openExam(ctx, s);
  const v = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json;
  const open = v.questions.find(q => q.kind === 'open');
  const r = (await call('POST', '/portal/trainee/test/submit', { token: a.tok, body: { sid: s.id, answers: pick(v, { [Q[0].text]: Q[0].options[1], [Q[1].text]: Q[1].options[1], [open.text]: 'Inspect hooks, slings, tags.' }) } })).json;
  assert.deepEqual(r, { status: 'review' }, 'open question -> review, no score shown yet');
  // the trainer portal shows the answers and the correct ones
  const td = (await call('GET', '/portal/trainer/session?id=' + s.id, { token: tk })).json;
  assert.equal(td.trainees[0].test.status, 'review'); assert.equal(td.trainees[0].test.answers, undefined, 'the session page carries no answers or key');
  const full = (await call('GET', `/portal/trainer/test?sid=${s.id}&tid=${a.trainee.id}`, { token: tk })).json.test;
  assert.equal(full.answers[open.id], 'Inspect hooks, slings, tags.');
  assert.ok((await ctx.app.store.get('sessions', s.id)).keySeen, 'opening the answers is recorded on the session');
  assert.equal((await call('POST', '/portal/trainer/test/grade', { token: tk, body: { sid: s.id, tid: a.trainee.id, passed: true } })).json.error, 'marksMissing');
  const rd = await ctx.app.mkStaff('rd@kvet.az', 'reader'), ed = await ctx.app.mkStaff('ed@kvet.az', 'editor');
  for (const tok of [rd, ed]) assert.equal((await call('POST', '/test/grade', { token: tok, body: { sid: s.id, tid: a.trainee.id, marks: { [open.id]: 3 }, passed: true } })).status, 403);
  const other = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Other', surname: 'Trainer', fin: 'TRN9999' }) })).json;
  const ok2 = (await call('POST', '/login', { body: { role: 'trainer', login: other.creds.login, password: other.creds.password } })).json.token;
  assert.equal((await call('POST', '/portal/trainer/test/grade', { token: ok2, body: { sid: s.id, tid: a.trainee.id, marks: { [open.id]: 3 }, passed: true } })).status, 403);
  const g = (await call('POST', '/portal/trainer/test/grade', { token: tk, body: { sid: s.id, tid: a.trainee.id, marks: { [open.id]: 2 }, passed: true, note: 'Good' } })).json.test;
  assert.equal(g.status, 'graded'); assert.equal(g.score, 4); assert.equal(g.max, 5); assert.equal(g.pct, 80); assert.ok(g.sign.name.includes('Rəşad'), 'the grader signs the result');
  assert.equal((await call('GET', '/verify-sign?c=' + g.sign.code)).json.status, 'VALID');
  const home = (await call('GET', '/portal/trainee/home', { token: a.tok })).json.sessions[0];
  assert.equal(home.test, 'graded'); assert.deepEqual(home.testResult, { pct: 80, passed: true });
  // an admin can correct it afterwards
  const g2 = (await call('POST', '/test/grade', { token: sa, body: { sid: s.id, tid: a.trainee.id, marks: { [open.id]: 0 }, passed: false } })).json.enr;
  assert.equal(g2.exam.passed, false); assert.equal(g2.test.pct, 40);
});

test('declaration of health: required before the practical, signed by the trainee; toolbox talk signed by the candidates, then the trainer', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx, a = await mk(ctx, '1AAA111');
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', sheetId: ctx.sheet.id, traineeIds: [a.trainee.id] } })).json.session;
  await call('POST', '/portal/trainer/confirm', { token: tk, body: { sid: s.id, tid: a.trainee.id } });
  assert.equal((await call('GET', '/portal/trainee/home', { token: a.tok })).json.sessions[0].needDoh, true);
  assert.equal((await call('POST', '/portal/trainer/practical', { token: tk, body: { sid: s.id, tid: a.trainee.id, data: {} } })).json.error, 'needDoh');
  const answers = { epilepsy: 'N', heart: 'N', angina: 'N', breath: 'N', diabetes: 'N', hearing: 'N', vision: 'N', mental: 'N', medical: 'N', medication: 'Y' };
  const D = o => call('POST', '/portal/trainee/doh', { token: a.tok, body: { sid: s.id, dob: '1990-05-01', answers, agree: true, ...o } });
  assert.equal((await D({ answers: { ...answers, heart: undefined } })).json.error, 'answerAll');
  assert.equal((await D({})).json.error, 'needDetails', 'a YES answer needs details');
  assert.equal((await D({ details: 'x', agree: false })).json.error, 'needAgree');
  const d = (await D({ details: 'Blood pressure tablets' })).json.doh;
  assert.equal(d.sign.name, 'Azər Qocayev'); assert.equal((await call('GET', '/verify-sign?c=' + d.sign.code)).json.doc, 'doh');
  assert.equal((await D({ details: 'again' })).json.error, 'dohDone');
  assert.equal((await call('POST', '/portal/trainer/doh/paper', { token: tk, body: { sid: s.id, tid: a.trainee.id } })).json.error, 'dohDone', 'an online declaration is not replaced by "paper"');
  assert.equal((await call('GET', '/portal/trainer/session?id=' + s.id, { token: tk })).json.trainees[0].doh.answers.medication, 'Y');
  assert.equal((await call('POST', '/portal/trainer/practical', { token: tk, body: { sid: s.id, tid: a.trainee.id, data: {} } })).status, 200);
  // no declaration on sessions without a practical
  const s2 = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', traineeIds: [a.trainee.id] } })).json.session;
  assert.equal((await call('POST', '/portal/trainee/doh', { token: a.tok, body: { sid: s2.id, dob: '1990-05-01', answers, details: 'x', agree: true } })).json.error, 'noSheet');

  // toolbox talk
  assert.equal((await call('POST', '/portal/trainer/tbt', { token: tk, body: { sid: s.id } })).json.error, 'needTopic');
  const tb = (await call('POST', '/portal/trainer/tbt', { token: tk, body: { sid: s.id, topic: 'Lifting operations near power lines', location: 'Yard 2', trades: { [a.trainee.id]: 'Rigger' } } })).json.tbt;
  assert.equal(tb.sign, undefined, 'opened for the candidates; the trainer signs last'); assert.equal(tb.open, true); assert.equal(tb.trades[a.trainee.id], 'Rigger');
  const ack = (await call('POST', '/portal/trainee/tbt', { token: a.tok, body: { sid: s.id } })).json; assert.ok(ack.sign.code, 'the candidate signs the toolbox talk');
  assert.equal((await call('POST', '/portal/trainee/tbt', { token: a.tok, body: { sid: s.id } })).json.error, 'dupSign');
  const ts = (await call('POST', '/portal/trainer/sign/tbt', { token: tk, body: { sid: s.id } })).json.sign;
  const sg = (await call('GET', '/session?id=' + s.id, { token: sa })).json.signs;
  assert.equal(sg.tbt.code, ts.code); assert.equal(sg.tbtP[a.trainee.id].code, ack.sign.code); assert.equal(sg.doh[a.trainee.id].code, d.sign.code);
  await call('POST', '/session/tbt', { token: sa, body: { sid: s.id, topic: 'Changed by office' } });
  const after = (await call('GET', '/session?id=' + s.id, { token: sa })).json.signs;
  assert.equal(after.tbt, null, 'a changed talk withdraws the trainer signature'); assert.equal(after.tbtP[a.trainee.id], undefined, '... and the candidates sign it again');
});

test('drafts and random draw: an incomplete (imported) test is saved as a draft and cannot be used; attempts draw per section', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const mc = (i, g, c = 0) => ({ kind: 'mc', text: 'Q' + i, options: ['a', 'b', 'c'], correct: c, grp: g });
  const qs = [...Array.from({ length: 10 }, (_, i) => mc(i, 'g1')), ...Array.from({ length: 6 }, (_, i) => mc(10 + i, 'g2')), { kind: 'open', text: 'Explain', grp: 'open' }, { kind: 'mc', text: 'no answer yet', options: ['x', 'y'], correct: -1, grp: 'g2' }];
  assert.equal((await call('POST', '/test/save', { token: sa, body: { bid: ctx.blank.id, questions: qs } })).json.error, 'badQuestion');
  const d = (await call('POST', '/test/save', { token: sa, body: { bid: ctx.blank.id, questions: qs, draft: true, pickBy: { g1: 4, g2: 2, nothing: 3 } } })).json.test;
  assert.equal(d.draft, true); assert.deepEqual(d.pickBy, { g1: 4, g2: 2 });
  const t = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '1AAA111' }) })).json;
  assert.equal((await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: d.id, traineeIds: [t.trainee.id] } })).json.error, 'testDraft');
  // completed -> no longer a draft
  qs[17].correct = 1;
  const x = (await call('POST', '/test/save', { token: sa, body: { ...d, questions: qs } })).json.test; assert.equal(x.draft, false);
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: x.id, traineeIds: [t.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: t.trainee.id } });
  const tok = (await call('POST', '/login', { body: { role: 'trainee', login: t.trainee.login, password: t.creds.password } })).json.token;
  await openExam(ctx, s);
  const v = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: tok })).json;
  assert.equal(v.questions.length, 4 + 2 + 1, '4 of section 1, 2 of section 2, every open question');
  assert.equal(v.questions.filter(q => q.kind === 'open').length, 1);
});

test('the question bank is independent of trainings: a test needs only a name and can be used by any session', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  assert.equal((await call('POST', '/test/save', { token: sa, body: { questions: Q } })).json.error, 'needTitle');
  const x = (await call('POST', '/test/save', { token: sa, body: { title: 'COSHH', questions: Q } })).json.test;
  assert.equal(x.bid, ''); assert.equal(x.title, 'COSHH');
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: x.id, traineeIds: [] } })).json.session;
  assert.equal(s.examId, x.id);
});

test('live updates: revision counters change only for the pages concerned', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx;
  const a = await mk(ctx, '1AAA111'), b = await mk(ctx, '2BBB222');
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', traineeIds: [a.trainee.id] } })).json.session;
  const R = async () => ({ staff: (await call('GET', '/rev', { token: sa })).json.rev, tr: (await call('GET', '/portal/trainer/rev?sid=' + s.id, { token: tk })).json.rev, a: (await call('GET', '/portal/trainee/rev', { token: a.tok })).json.rev, b: (await call('GET', '/portal/trainee/rev', { token: b.tok })).json.rev });
  const r0 = await R(), r00 = await R();
  assert.deepEqual(r0, r00, 'reading does not change anything');
  await call('POST', '/portal/trainer/confirm', { token: tk, body: { sid: s.id, tid: a.trainee.id } });
  const r1 = await R();
  assert.notEqual(r1.staff, r0.staff); assert.notEqual(r1.tr, r0.tr, 'the trainer sees it'); assert.notEqual(r1.a, r0.a, 'the trainee concerned sees it'); assert.equal(r1.b, r0.b, 'other trainees are not disturbed');
});

test('exam engine: K random questions per candidate, pool check, shuffled choices with ids, same set after refresh, autosave, closing hands in', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx;
  const bank = Array.from({ length: 10 }, (_, i) => ({ kind: 'mc', text: 'Question ' + i, options: ['right ' + i, 'wrong A', 'wrong B', 'wrong C'], correct: 0 }));
  const x = (await call('POST', '/test/save', { token: sa, body: { title: 'Pool of 10', questions: bank, passRate: 60 } })).json.test;
  assert.ok(x.questions.every(q => typeof q.correct === 'string' && q.options.every(o => /^[a-z0-9]{6}$/.test(o.id))), 'choices carry their own random ids');
  const a = await mk(ctx, '1AAA111'), b = await mk(ctx, '2BBB222');
  const base = { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: x.id, traineeIds: [a.trainee.id, b.trainee.id] };
  const bad = (await call('POST', '/session/save', { token: sa, body: { ...base, examCount: 15 } })).json;
  assert.equal(bad.error, 'poolTooSmall'); assert.equal(bad.n, 10);
  const s = (await call('POST', '/session/save', { token: sa, body: { ...base, examCount: 5 } })).json.session;
  for (const t of [a, b]) await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: t.trainee.id } });
  // only the session's trainer or staff may start it
  assert.equal((await call('POST', '/portal/trainer/exam', { token: tk, body: { sid: s.id, open: true } })).json.exam.open, true);
  const va = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json, vb = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: b.tok })).json;
  assert.equal(va.questions.length, 5); assert.equal(vb.questions.length, 5);
  assert.deepEqual((await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json.questions, va.questions, 'a refresh shows exactly the same questions and choice order');
  const idsA = new Set(va.questions.flatMap(q => q.options.map(o => o.id))), stored = new Set(x.questions.flatMap(q => q.options.map(o => o.id)));
  assert.ok([...idsA].every(id => !stored.has(id)), 'per-attempt ids: nothing about the bank can be read');
  let orders = 0; for (let i = 0; i < 5; i++) if (va.questions[i].options[0].text.startsWith('right')) orders++;
  assert.ok(orders < 5, 'choices are shuffled');
  // progressive saving, then a refresh restores the answers
  const ans = Object.fromEntries(va.questions.slice(0, 3).map(q => [q.id, q.options.find(o => o.text.startsWith('right')).id]));
  assert.equal((await call('POST', '/portal/trainee/test/save', { token: a.tok, body: { sid: s.id, answers: { ...ans, bogus: 'x' } } })).json.saved, 3);
  assert.deepEqual((await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json.saved, ans);
  // closing the exam hands in every open attempt with what was saved: 3 of 5 right = 60% = pass
  const cl = (await call('POST', '/portal/trainer/exam', { token: tk, body: { sid: s.id, open: false } })).json.exam;
  assert.equal(cl.open, false); assert.ok(cl.closedAt);
  const enrs = (await call('GET', '/session?id=' + s.id, { token: sa })).json.enrs;
  const ea = enrs.find(e => e.tid === a.trainee.id), eb = enrs.find(e => e.tid === b.trainee.id);
  assert.equal(ea.test.closedBy, 'closed'); assert.equal(ea.exam.score, 60); assert.equal(ea.exam.passed, true);
  assert.equal(eb.exam.passed, false, 'nothing saved -> 0%');
  assert.equal((await call('GET', '/portal/trainee/home', { token: a.tok })).json.sessions[0].test, 'graded');
});

test('exam engine: time limit hands in saved answers; an old test with plain-text choices still works', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const x = (await call('POST', '/test/save', { token: sa, body: { title: 'Timed', timeLimit: 1, questions: Q } })).json.test;
  // an attempt drawn from an old-style test (choices as strings, correct as index) is still marked correctly
  await ctx.app.store.put('tests', [{ id: x.id, data: { ...x, questions: Q.map((q, i) => ({ ...q, id: 'q' + i })) } }]);
  const a = await mk(ctx, '1AAA111');
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: x.id, traineeIds: [a.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: a.trainee.id } }); await openExam(ctx, s);
  const v = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json;
  await call('POST', '/portal/trainee/test/save', { token: a.tok, body: { sid: s.id, answers: pick(v, Object.fromEntries(Q.map(q => [q.text, q.options[q.correct]]))) } });
  ctx.app.clock.t += 4 * 6e4;           // the browser was closed; the time ran out
  assert.equal((await call('POST', '/portal/trainee/test/save', { token: a.tok, body: { sid: s.id, answers: {} } })).json.error, 'timeUp');
  const r = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json;
  assert.equal(r.done, true); assert.equal(r.pct, 100);
});

test('roll call marks only the absent; groups add candidates; deleting a candidate removes them from groups', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx;
  const a = await mk(ctx, '1AAA111'), b = await mk(ctx, '2BBB222'), c3 = await mk(ctx, '3CCC333');
  const g = (await call('POST', '/group/save', { token: sa, body: { name: 'Riggers Nov', traineeIds: [a.trainee.id, b.trainee.id, c3.trainee.id] } })).json.group;
  assert.equal(g.traineeIds.length, 3);
  const rd = await ctx.app.mkStaff('rd@kvet.az', 'reader');
  assert.equal((await call('POST', '/group/save', { token: rd, body: { name: 'x' } })).status, 403);
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', traineeIds: g.traineeIds } })).json.session;
  const r = (await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [b.trainee.id] } })).json;
  assert.deepEqual(r, { present: 2, absent: 1 });
  const enrs = (await call('GET', '/session?id=' + s.id, { token: sa })).json.enrs, eb = enrs.find(e => e.tid === b.trainee.id);
  assert.ok(enrs.find(e => e.tid === a.trainee.id).att); assert.ok(eb.absent); assert.equal(eb.att, undefined);
  // arrives late: marked present individually
  await call('POST', '/portal/trainer/confirm', { token: tk, body: { sid: s.id, tid: b.trainee.id } });
  const eb2 = (await call('GET', '/session?id=' + s.id, { token: sa })).json.enrs.find(e => e.tid === b.trainee.id);
  assert.ok(eb2.att); assert.equal(eb2.absent, undefined);
  // the audit trail has the roll call
  const log = (await call('GET', '/audit?limit=50', { token: sa })).json;
  assert.ok(JSON.stringify(log).includes('attendance.absent'));
  // deleting a candidate takes them out of the group
  assert.equal((await call('POST', '/delete', { token: sa, body: { kind: 'trainee', id: c3.trainee.id } })).status, 200);
  const g2 = (await call('GET', '/groups', { token: sa })).json.list[0];
  assert.deepEqual(g2.traineeIds, [a.trainee.id, b.trainee.id]);
});

test('certificates: a company candidate sees only that a certificate exists; the company sees results and trainer feedback of its own people only', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx;
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Caspian Drilling LLC', email: 'hr@cd.az' } })).json;
  const co2 = (await call('POST', '/company/save', { token: sa, body: { name: 'Other LLC', email: 'x@o.az' } })).json;
  const ct = (await call('POST', '/login', { body: { role: 'company', login: co.creds.login, password: co.creds.password } })).json.token;
  const ct2 = (await call('POST', '/login', { body: { role: 'company', login: co2.creds.login, password: co2.creds.password } })).json.token;
  const mkc = async (fin, coId) => { const r = (await call('POST', '/trainee/save', { token: sa, body: person({ fin, co: coId }) })).json; r.tok = (await call('POST', '/login', { body: { role: 'trainee', login: r.trainee.login, password: r.creds.password } })).json.token; return r; };
  const a = await mkc('1AAA111', co.company.id), p = await mk(ctx, '2BBB222');
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', traineeIds: [a.trainee.id, p.trainee.id] } })).json.session;
  for (const x of [a, p]) {
    await call('POST', '/portal/trainer/confirm', { token: tk, body: { sid: s.id, tid: x.trainee.id } });
    await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: s.id, tid: x.trainee.id, behavior: 'excellent', punctuality: 'ontime', engagement: 5, comment: 'Very careful' } });
    await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid: x.trainee.id, passed: true, score: 88 } });
    assert.equal((await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: x.trainee.id } })).status, 200);
  }
  const ha = (await call('GET', '/portal/trainee/home', { token: a.tok })).json;
  assert.equal(ha.certsViaCompany, true); assert.equal(ha.certs.length, 1);
  assert.equal(ha.certs[0].fact, true); assert.ok(ha.certs[0].expiry); assert.equal(ha.certs[0].no, undefined); assert.equal(ha.certs[0].vh, undefined, 'no certificate document for a company candidate');
  const hp = (await call('GET', '/portal/trainee/home', { token: p.tok })).json;
  assert.equal(hp.certsViaCompany, false); assert.ok(hp.certs[0].no && hp.certs[0].snap, 'a private candidate has the document');
  // company: own candidate's results + the trainer's feedback
  const r = (await call('GET', '/portal/company/person?id=' + a.trainee.id, { token: ct })).json;
  assert.equal(r.sessions[0].ev.comment, 'Very careful'); assert.equal(r.sessions[0].exam.score, 88); assert.equal(r.sessions[0].attendance, 'present');
  assert.equal((await call('GET', '/portal/company/person?id=' + a.trainee.id, { token: ct2 })).status, 404, 'not another company');
  assert.equal((await call('GET', '/portal/company/person?id=' + p.trainee.id, { token: ct })).status, 404, 'not a private candidate');
});

test('training materials: PDF accepted besides PPTX, checked by content', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const pdf = new TextEncoder().encode('%PDF-1.4\n' + '1 0 obj << /Type /Page >> endobj\n'.repeat(5));
  const r = (await call('POST', '/material/upload?title=Rigging%20basics&name=rigging.pdf&slides=5', { token: sa, raw: pdf })).json;
  assert.equal(r.material.format, 'pdf'); assert.match(r.material.key, /\.pdf$/);
  assert.equal((await call('POST', '/material/upload?title=x&name=fake.pdf', { token: sa, raw: new TextEncoder().encode('<html>'.repeat(30)) })).json.error, 'badFile', 'a renamed web page is refused');
});

test('approver and auditor: approver only decides (returns need a note); trainer banks wait for approval; auditor reads, changes nothing, is logged, expires', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx;
  const ap = await ctx.app.mkStaff('ap@kvet.az', 'approver'), au = await ctx.app.mkStaff('au@kvet.az', 'auditor');
  // approver: reads the training section (no question banks or answer keys), creates nothing
  assert.equal((await call('GET', '/certs', { token: ap })).status, 200); assert.equal((await call('GET', '/tests', { token: ap })).status, 403);
  assert.equal((await call('POST', '/test/save', { token: ap, body: { title: 'x', questions: Q } })).status, 403);
  // a trainer's bank: draft -> submitted -> returned with a note -> fixed -> approved -> usable
  const d = (await call('POST', '/portal/trainer/test/save', { token: tk, body: { title: 'Banksman', questions: Q } })).json.test;
  assert.equal(d.status, 'draft');
  const pnd = (await call('POST', '/portal/trainer/test/save', { token: tk, body: { id: d.id, title: 'Banksman', questions: Q, submit: true } })).json.test;
  assert.equal(pnd.status, 'pending');
  assert.equal((await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: d.id, traineeIds: [] } })).json.error, 'testNotApproved');
  const q = (await call('GET', '/approvals', { token: ap })).json; assert.equal(q.tests.length, 1);
  assert.equal((await call('POST', '/approval/decide', { token: ap, body: { kind: 'test', id: d.id, approve: false } })).json.error, 'needNote');
  await call('POST', '/approval/decide', { token: ap, body: { kind: 'test', id: d.id, approve: false, note: 'Question 2: wind speed is 9.8 m/s' } });
  const mine = (await call('GET', '/portal/trainer/tests', { token: tk })).json.list[0];
  assert.equal(mine.status, 'returned'); assert.equal(mine.review.note, 'Question 2: wind speed is 9.8 m/s');
  await call('POST', '/portal/trainer/test/save', { token: tk, body: { id: d.id, title: 'Banksman', questions: Q, submit: true } });
  await call('POST', '/approval/decide', { token: ap, body: { kind: 'test', id: d.id, approve: true } });
  assert.equal((await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: d.id, traineeIds: [] } })).status, 200);
  // a change to the approved test is a proposal; the approved questions stay in use
  await call('POST', '/portal/trainer/test/save', { token: tk, body: { id: d.id, title: 'Banksman', questions: Q.slice(0, 2), submit: true } });
  const live = (await call('GET', '/tests', { token: sa })).json.list.find(x => x.id === d.id);
  assert.equal(live.questions.length, 4); assert.equal(live.proposal.questions.length, 2);
  assert.equal((await call('POST', '/portal/trainer/test/delete', { token: tk, body: { id: d.id } })).json.error, 'testActive');
  // certificates need approval when switched on (superadmin only)
  assert.equal((await call('POST', '/settings/save', { token: au, body: { approvals: { certs: true } } })).status, 403);
  await call('POST', '/settings/save', { token: sa, body: { approvals: { certs: true } } });
  const t = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '9ZZZ999' }) })).json;
  const s2 = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', traineeIds: [t.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s2.id, tid: t.trainee.id } }); await call('POST', '/enr/exam', { token: sa, body: { sid: s2.id, tid: t.trainee.id, passed: true, score: 90 } });
  const cert = (await call('POST', '/issue', { token: sa, body: { sid: s2.id, tid: t.trainee.id } })).json.cert;
  assert.equal(cert.approval.status, 'pending');
  assert.equal((await call('GET', `/verify?n=${encodeURIComponent(cert.no)}&h=${cert.vh}`)).json.status, 'PENDING_APPROVAL');
  const tt = (await call('POST', '/login', { body: { role: 'trainee', login: t.trainee.login, password: t.creds.password } })).json.token;
  assert.equal((await call('GET', '/portal/trainee/home', { token: tt })).json.certs.length, 0, 'not delivered before approval');
  await call('POST', '/approval/decide', { token: ap, body: { kind: 'cert', id: cert.no, approve: true } });
  assert.equal((await call('GET', '/portal/trainee/home', { token: tt })).json.certs.length, 1);
  assert.equal((await call('GET', `/verify?n=${encodeURIComponent(cert.no)}&h=${cert.vh}`)).json.status, 'ACTIVE');
  // auditor: reads everything incl. the audit trail, but no ID/FIN or contact details, cannot change anything, every view is logged
  const st = { ...(await call('GET', '/state', { token: au })).json, trainees: (await call('GET', '/trainees/find', { token: au })).json.list };
  assert.ok(st.trainees.length); assert.equal(st.trainees[0].fin, undefined); assert.equal(st.trainees[0].phone, undefined);
  assert.equal((await call('GET', '/session?id=' + s2.id, { token: au })).status, 200);
  assert.equal((await call('POST', '/enr/exam', { token: au, body: { sid: s2.id, tid: t.trainee.id, passed: false } })).status, 403);
  assert.equal((await call('POST', '/approval/decide', { token: au, body: { kind: 'test', id: d.id, approve: true } })).status, 403);
  assert.equal((await call('GET', '/audit?limit=200', { token: au })).status, 403, 'auditors see the training section only');
  assert.equal((await call('GET', '/tests', { token: au })).status, 403); assert.equal((await call('GET', '/groups', { token: au })).status, 403);
  assert.ok(st.tests.every(x => !x.questions.length), 'no questions or answer keys for auditors');
  const log = (await call('GET', '/audit?limit=200', { token: sa })).json;
  assert.ok(JSON.stringify(log).includes('auditor.view'), 'auditor views are in the audit trail');
  // time-limited account
  await call('POST', '/users/update', { token: sa, body: { id: (await call('GET', '/users', { token: sa })).json.list.find(x => x.email === 'au@kvet.az').id, expires: '2026-10-01' } });
  assert.equal((await call('GET', '/state', { token: au })).json.error, 'accountExpired');
});

test('AI: off by default and switched by the superadmin; chatbot answers only from the knowledge base; candidates never see test questions after the exam', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx;
  const calls = [];
  ctx.app.env.__llm = async ({ system, messages }) => {
    calls.push(system);
    if (system.startsWith('You turn a question')) return 'yük qaldırma sling строп';
    if (system.includes('EXCERPTS')) return /apand/i.test(messages.at(-1).content) ? 'Sapandı hər qaldırmadan əvvəl yoxlayın: etiket, SWL, zədə [1].' : 'NO_ANSWER';
    if (system.includes('You explain')) return 'Because the appointed signaller is the only person who gives signals.';
    return '';
  };
  const a = await mk(ctx, '1AAA111');
  assert.equal((await call('POST', '/portal/trainee/ai/chat', { token: a.tok, body: { q: 'Sapand necə yoxlanılır?' } })).json.error, 'aiOff', 'off by default');
  const ad = await ctx.app.mkStaff('ad@kvet.az', 'admin');
  assert.equal((await call('POST', '/ai/settings', { token: ad, body: { on: true } })).status, 403, 'only the superadmin switches it on');
  await call('POST', '/ai/settings', { token: sa, body: { on: true, chat: true, explain: true, daily: 5 } });
  assert.equal((await call('POST', '/ai/kb/save', { token: ad, body: { title: 'Sapandların yoxlanması', text: 'Sapandı (sling) hər qaldırmadan əvvəl yoxlayın: etiket, SWL, kəsik və zədə olmamalıdır.\n\nZədəli sapand istifadədən çıxarılır və etiketlənir.' } })).status, 200);
  const r = (await call('POST', '/portal/trainee/ai/chat', { token: a.tok, body: { q: 'Sapand necə yoxlanılır?', lang: 'az' } })).json;
  assert.equal(r.grounded, true); assert.deepEqual(r.sources, ['Sapandların yoxlanması']);
  const off = (await call('POST', '/portal/trainee/ai/chat', { token: a.tok, body: { q: 'Kranın qiyməti nə qədərdir?', lang: 'ru' } })).json;
  assert.equal(off.grounded, false); assert.match(off.answer, /базе знаний/, 'not in the knowledge base -> says so, in the asked language');
  for (let i = 0; i < 4; i++) await call('POST', '/portal/trainee/ai/chat', { token: a.tok, body: { q: 'Sapand?' } });
  assert.equal((await call('POST', '/portal/trainee/ai/chat', { token: a.tok, body: { q: 'Sapand?' } })).json.error, 'aiLimit', 'daily limit');
  // explanations
  const x = (await call('POST', '/test/save', { token: sa, body: { title: 'Signals', questions: Q } })).json.test;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', examMode: 'bank', examId: x.id, traineeIds: [a.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: a.trainee.id } }); await openExam(ctx, s);
  const v = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: a.tok })).json;
  await call('POST', '/portal/trainee/test/submit', { token: a.tok, body: { sid: s.id, answers: pick(v, { [Q[0].text]: Q[0].options[0] }) } });
  // test questions are confidential: no question review or AI explanation for candidates, before or after the exam
  await call('POST', '/portal/trainer/exam', { token: tk, body: { sid: s.id, open: false } });
  await call('POST', '/ai/settings', { token: sa, body: { on: true, chat: true, daily: 50 } });
  assert.equal((await call('GET', '/portal/trainee/test/review?sid=' + s.id, { token: a.tok })).status, 404);
  assert.equal((await call('POST', '/portal/trainee/test/explain', { token: a.tok, body: { sid: s.id, qid: 'q1', lang: 'en' } })).status, 404);
  const home = (await call('GET', '/portal/trainee/home', { token: a.tok })).json;
  assert.ok(!JSON.stringify(home).includes(Q[0].text), 'no question text in the candidate portal'); assert.equal(home.ai.explain, undefined);
});

test('AI key: entered by the superadmin, stored encrypted, never sent back, used for the provider call', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const key = 'gsk_TESTKEY1234567890abcd';
  const r = await call('POST', '/ai/settings', { token: sa, body: { on: true, provider: 'groq', key, model: 'llama-test' } });
  assert.equal(r.status, 200); assert.equal(r.json.ready, true); assert.equal(r.json.cfg.keyHint.groq, 'abcd');
  const raw = JSON.stringify(await ctx.app.store.get('settings', 'main'));
  assert.ok(!raw.includes(key), 'not stored in plain text');
  const g = await call('GET', '/ai', { token: sa }); assert.ok(!JSON.stringify(g.json).includes(key) && !JSON.stringify(g.json).includes('"v":'), 'never sent back');
  const ad = await ctx.app.mkStaff('ad2@kvet.az', 'admin'); assert.equal((await call('GET', '/ai', { token: ad })).json.cfg.keyHint, undefined);
  assert.equal((await call('GET', '/ai/models', { token: ad })).status, 403);
  const seen = []; const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { seen.push({ url: String(url), auth: init?.headers?.authorization, body: init?.body && JSON.parse(init.body) });
    return new Response(JSON.stringify(String(url).endsWith('/models') ? { data: [{ id: 'llama-test' }, { id: 'other' }] } : { choices: [{ message: { content: 'Salam / Hello / Привет' } }] }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    const t = await call('POST', '/ai/test', { token: sa, body: {} });
    assert.equal(t.json.text, 'Salam / Hello / Привет');
    assert.equal(seen[0].url, 'https://api.groq.com/openai/v1/chat/completions'); assert.equal(seen[0].auth, 'Bearer ' + key); assert.equal(seen[0].body.model, 'llama-test');
    assert.deepEqual((await call('GET', '/ai/models', { token: sa })).json.models, ['llama-test', 'other']);
  } finally { globalThis.fetch = real; }
  // empty key field keeps the stored key; clearKey removes it
  await call('POST', '/ai/settings', { token: sa, body: { provider: 'groq', key: '' } }); assert.equal((await call('GET', '/ai', { token: sa })).json.cfg.keyHint.groq, 'abcd');
  const cl = await call('POST', '/ai/settings', { token: sa, body: { provider: 'groq', clearKey: true } }); assert.equal(cl.json.ready, false);
  assert.equal((await call('POST', '/ai/settings', { token: sa, body: { provider: 'openai', baseUrl: 'http://insecure.example' } })).status, 400, 'https only');
});

test('AI reports: figures per role (admin, auditor, trainer, company), attention rules, summary only from figures and never changes results', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx;
  const coA = (await call('POST', '/company/save', { token: sa, body: { name: 'Caspian Drilling' } })).json, coB = (await call('POST', '/company/save', { token: sa, body: { name: 'Baku Port' } })).json;
  const cTok = (await call('POST', '/login', { body: { role: 'company', login: coA.creds.login, password: coA.creds.password } })).json.token;
  const ppl = [];
  for (let i = 0; i < 6; i++) { const r = (await call('POST', '/trainee/save', { token: sa, body: { name: 'Ali' + 'abcdef'[i], surname: 'Test', fin: '7AA' + i + 'B1' + i, phone: '+99450123456' + i, co: i < 4 ? coA.company.id : coB.company.id } })).json;
    r.tok = (await call('POST', '/login', { body: { role: 'trainee', login: r.trainee.login, password: r.creds.password } })).json.token; ppl.push(r); }
  const x = (await call('POST', '/test/save', { token: sa, body: { title: 'Signals', questions: Q, passRate: 75 } })).json.test;
  const today = (await call('GET', '/state', { token: sa })).json.today;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: today, examMode: 'bank', examId: x.id, traineeIds: ppl.map(p => p.trainee.id) } })).json.session;
  // roll call: the last one is absent
  assert.equal((await call('POST', '/enr/attendance', { token: sa, body: { sid: s.id, absent: [ppl[5].trainee.id] } })).status, 200);
  await openExam(ctx, s);
  for (const [i, p] of ppl.slice(0, 5).entries()) {
    await call('POST', '/portal/trainee/feedback', { token: p.tok, body: { sid: s.id, r: { g1: 9, g2: i < 3 ? 4 : 9, g3: 8, g4: 8, g6: 7 }, cm: { g2: i === 0 ? 'Trainer spoke too fast' : '' } } });
    const v = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: p.tok })).json;
    const right = i < 2;   // 2 pass, 3 fail
    await call('POST', '/portal/trainee/test/submit', { token: p.tok, body: { sid: s.id, answers: pick(v, Object.fromEntries(Q.map(q => [q.text, right ? q.options[q.correct] : q.options[(q.correct + 1) % q.options.length]]))) } });
  }
  const before = JSON.stringify((await call('GET', '/state', { token: sa })).json.sessions.find(k => k.id === s.id));
  // admin: whole system
  const a = (await call('GET', '/analytics', { token: sa })).json;
  assert.equal(a.kind, 'all'); assert.equal(a.kpi.enrolments, 6); assert.equal(a.kpi.attendance, 83.3); assert.equal(a.kpi.testN, 5); assert.equal(a.kpi.testPass, 40);
  assert.equal(a.feedback.byQ.g2, 6); assert.ok(a.feedback.comments.some(k => /too fast/.test(k.text)));
  assert.ok(a.tests.hardest.length && a.tests.hardest[0].correct === 40);
  assert.ok(a.attention.some(k => k.key === 'atTestPass') && a.attention.some(k => k.key === 'atFbQuestion' && k.args[0] === 'g2'), 'rules flag low pass rate and low trainer score');
  assert.ok(a.people.some(p => p.reason === 'absent'));
  assert.equal(a.ai, false, 'AI off -> no summary, figures still shown');
  assert.equal((await call('POST', '/analytics/summary', { token: sa, body: {} })).json.error, 'aiOff');
  // company: only its own employees (4 of 6)
  const co = (await call('GET', '/portal/company/analytics?co=' + coB.company.id, { token: cTok })).json;
  assert.equal(co.kind, 'company'); assert.equal(co.kpi.enrolments, 4, 'the co parameter is ignored: always the own company');
  assert.ok(co.people.every(p => !/Ali[ef]/.test(p.name)));
  // trainer: own groups only
  const t2 = (await call('POST', '/trainer/save', { token: sa, body: { name: 'Other', surname: 'Trainer', fin: 'TRN9999' } })).json;
  const t2tok = (await call('POST', '/login', { body: { role: 'trainer', login: t2.creds.login, password: t2.creds.password } })).json.token;
  assert.equal((await call('GET', '/portal/trainer/analytics', { token: t2tok })).json.kpi.enrolments, 0);
  assert.equal((await call('GET', '/portal/trainer/analytics', { token: tk })).json.kpi.enrolments, 6);
  // auditor: oversight view, no people, no certificate pipeline; reader/editor: no access
  await ctx.app.mkStaff('aud@iosh.org', 'auditor'); const au = await ctx.app.staff('aud@iosh.org', 'password123');
  const ad = (await call('GET', '/analytics', { token: au })).json;
  assert.equal(ad.kind, 'audit'); assert.deepEqual(ad.people, []); assert.equal(ad.certs, null); assert.equal(ad.kpi.certsIssued, undefined); assert.equal(ad.feedback.byQ.g2, 6);
  const ed = await ctx.app.mkStaff('ed@kvet.az', 'editor'); assert.equal((await call('GET', '/analytics', { token: ed })).status, 403);
  assert.equal((await call('GET', '/analytics', { token: tk })).status, 401);
  // AI on: the model only receives figures (no names) and the result is cached
  let seen = null, n = 0; ctx.app.env.__llm = async ({ system, messages }) => { n++; seen = messages[0].content; return 'Overview: 6 enrolled.\nNeeds attention\n- Pass rate 40%.'; };
  await call('POST', '/ai/settings', { token: sa, body: { on: true } });
  const r = (await call('POST', '/analytics/summary', { token: sa, body: { lang: 'en' } })).json;
  assert.match(r.text, /40%/); assert.ok(!/Ali/.test(seen) && !/E-20/.test(seen), 'no names or learner numbers go to the model');
  assert.equal((await call('POST', '/analytics/summary', { token: sa, body: { lang: 'en' } })).json.cached, true); assert.equal(n, 1);
  assert.equal((await call('POST', '/portal/company/analytics/summary', { token: cTok, body: { lang: 'az' } })).status, 200);
  await call('POST', '/ai/settings', { token: sa, body: { reports: false } });
  assert.equal((await call('POST', '/analytics/summary', { token: sa, body: { lang: 'ru', force: true } })).json.error, 'aiOff', 'reports can be switched off separately');
  assert.equal(JSON.stringify((await call('GET', '/state', { token: sa })).json.sessions.find(k => k.id === s.id)), before, 'reports change nothing');
  // trainee home carries the AI switches
  const h = (await call('GET', '/portal/trainee/home', { token: ppl[0].tok })).json; assert.deepEqual(h.ai, { chat: true });
});
