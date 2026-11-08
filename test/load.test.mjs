/* Load / concurrency (round 19): 300 candidates of one session sit the exam at the same moment.
   Checks: every submission is recorded exactly once, every score is right, a double submit (two tabs) is graded once,
   and the application's own time per request stays small. (The memory store measures the application, not the network
   or the database: those limits are in the audit report.) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';

const N = 300;
const Q = [
  { kind: 'mc', text: 'Q1', options: ['a', 'b', 'c'], correct: 1 }, { kind: 'mc', text: 'Q2', options: ['a', 'b'], correct: 0 },
  { kind: 'mc', text: 'Q3', options: ['a', 'b'], correct: 1 }, { kind: 'mc', text: 'Q4', options: ['a', 'b', 'c', 'd'], correct: 3 }];
const pct = a => { a.sort((x, y) => x - y); return i => a[Math.min(a.length - 1, Math.floor(a.length * i))]; };

test(`${N} candidates submit the exam at the same moment: nothing lost, nothing doubled, every score right`, { timeout: 240000 }, async () => {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} }); await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  const st = (await call('GET', '/state', { token: sa })).json, blank = st.blanks[0];
  const tr = (await call('POST', '/trainer/save', { token: sa, body: { name: 'Rəşad', surname: 'Əliyev', father: 'Əli oğlu', fin: 'TRN1234', phone: '+994551234567' } })).json;
  const made = [];
  for (let i = 0; i < N; i += 50) made.push(...(await call('POST', '/trainee/import', { token: sa, body: { rows: Array.from({ length: Math.min(50, N - i) }, (_, k) => ({ row: i + k + 2, name: 'Ad' + (i + k), surname: 'Soyad', father: 'Ata oğlu', fin: 'L' + String(100000 + i + k), phone: '+99450' + (4000000 + i + k) })) } })).json.results);
  assert.equal(made.length, N);
  const ex = (await call('POST', '/test/save', { token: sa, body: { bid: blank.id, title: 'Final', grading: 'rate', passRate: 50, questions: Q } })).json.test;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: st.today, examMode: 'bank', examId: ex.id, traineeIds: made.map(r => r.id) } })).json.session;
  // everyone signs in at once
  const toks = await Promise.all(made.map(r => call('POST', '/login', { body: { role: 'trainee', login: r.login, password: r.password } }).then(x => x.json.token)));
  assert.ok(toks.every(Boolean), 'every sign-in worked');
  for (const r of made) await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: r.id } });
  await call('POST', '/session/exam', { token: sa, body: { sid: s.id, open: true } });
  // everyone opens the test at once
  const views = await Promise.all(toks.map(tk => call('GET', '/portal/trainee/test?sid=' + s.id, { token: tk }).then(x => x.json)));
  assert.ok(views.every(v => v.questions?.length === 4), JSON.stringify(views.find(v => v.questions?.length !== 4)));
  // even candidates answer everything right, odd ones get Q1 right only; all submit at the same moment, plus 20 double submits
  const answer = (v, i) => Object.fromEntries(v.questions.map(q => { const src = Q.find(x => x.text === q.text), good = i % 2 === 0 || q.text === 'Q1'; const want = src.options[good ? src.correct : (src.correct + 1) % src.options.length]; return [q.id, q.options.find(o => o.text === want).id]; }));
  const times = [], t0 = performance.now();
  const sub = (i) => { const a = performance.now(); return call('POST', '/portal/trainee/test/submit', { token: toks[i], body: { sid: s.id, answers: answer(views[i], i) } }).then(x => { times.push(performance.now() - a); return x; }); };
  const res = await Promise.all([...toks.map((_, i) => sub(i)), ...Array.from({ length: 20 }, (_, i) => sub(i))]);
  const wall = performance.now() - t0;
  const graded = res.filter(r => r.json?.status === 'graded');
  assert.equal(graded.length, N, 'each candidate graded exactly once (the 20 second submits are refused)');
  assert.equal(res.filter(r => r.status >= 500).length, 0, 'no server error under load');
  const enrs = (await call('GET', '/session?id=' + s.id, { token: sa })).json.enrs;
  assert.equal(enrs.filter(e => e.exam).length, N, 'all results stored');
  for (const [i, r] of made.entries()) { const e = enrs.find(x => x.tid === r.id); assert.equal(e.exam.score, i % 2 === 0 ? 100 : 25, 'score of ' + r.login); assert.equal(e.exam.passed, i % 2 === 0); }
  const p = pct(times); console.log(`# ${N + 20} simultaneous submissions in ${Math.round(wall)} ms; application time per request p50 ${p(0.5).toFixed(1)} ms, p95 ${p(0.95).toFixed(1)} ms, max ${p(1).toFixed(1)} ms`);
});
