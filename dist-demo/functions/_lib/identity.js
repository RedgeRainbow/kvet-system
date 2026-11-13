/* Who a candidate is.
   - A candidate is identified by ID/FIN, never by name: people with the same name, surname and father's name are different
     candidates when their FIN differs. ID/FIN and learner number are unique in the system (one each per candidate).
   - Registered without FIN or phone (allowed for the office), a candidate gets a TEMPORARY account: id and login "T-XXXXXX",
     no learner number, no certificate. At the first sign-in the candidate gives the FIN and phone:
       * FIN not known yet -> full registration: learner number (E-YYYYNNNNN) given and bound to the FIN; the temporary record
         becomes the permanent one (sessions, results, groups move with it); the sign-in is the learner number from now on.
       * FIN already registered (a returning candidate, e.g. renewing a certificate) -> no second record: a link request goes
         to the office (Approvals); once confirmed the new training moves onto the existing record and learner number.
   - Renewal: the same person keeps the same record and learner number; a newer certificate for the same training replaces
     the older one (status RENEWED). */
import { H, S, str, need, audit, enrId, sessionsOf, getMany } from './core.js';
import { claimLogin, loginKey, candidatePassword, pbk, rnd } from './auth.js';
import { unsign } from './signs.js';

export const isTemp = t => !!t?.temp;
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const tempId = () => 'T-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALNUM[b % ALNUM.length]).join('');

/* Moves everything that refers to trainee `from` onto trainee `to` (sessions, enrolments, groups, candidate requests).
   Signatures on the moved documents are withdrawn (their fingerprint names the old record); they are signed again. */
export async function moveTrainee(c, from, to) {
  const D = c.D, moved = { sessions: 0, enr: 0 };
  for (const s of await sessionsOf(D, from)) {
    s.traineeIds = [...new Set(s.traineeIds.map(x => (x === from ? to : x)))]; await D.put('sessions', [{ id: s.id, data: s }]); moved.sessions++;
    const old = await D.get('enr', enrId(s.id, from));
    if (old) {
      if (!(await D.get('enr', enrId(s.id, to)))) await D.put('enr', [{ id: enrId(s.id, to), data: { ...old, tid: to } }]);
      await D.del('enr', enrId(s.id, from)); moved.enr++;
    }
    await unsign(c, [...['prac', 'doh', 'test'].flatMap(k => (k === 'prac' ? [`prac|${s.id}|${from}|examiner`, `prac|${s.id}|${from}|candidate`] : [`${k}|${s.id}|${from}|${k === 'doh' ? 'participant' : 'grader'}`])),
      `fb|${s.id}|${from}|participant`, `tbt|${s.id}|${from}|participant`]);
  }
  for (const { data: g } of await D.all('groups')) if ((g.traineeIds || []).includes(from)) { g.traineeIds = [...new Set(g.traineeIds.map(x => (x === from ? to : x)))]; await D.put('groups', [{ id: g.id, data: g }]); }
  for (const { data: r } of (await D.query('candreq', { where: [['traineeId', 'eq', from]] })).rows) { r.traineeId = to; await D.put('candreq', [{ id: r.id, data: r }]); }
  // the conversation with the centre moves along
  const th = await D.get('threads', 'trainee:' + from);
  if (th && !(await D.get('threads', 'trainee:' + to))) {
    const ms = (await D.query('msgs', { where: [['th', 'eq', th.id]], limit: 5000 })).rows;
    await D.put('threads', [{ id: 'trainee:' + to, data: { ...th, id: 'trainee:' + to, acc: to } }]);
    if (ms.length) await D.put('msgs', ms.map(r => ({ id: r.id, data: { ...r.data, th: 'trainee:' + to } })));
    await D.del('threads', th.id);
  }
  return moved;
}

/* ---------------------------------------------------------------- learner (attendance) numbers
   E-<year><5 digits>, one counter per year in the database: it starts again at 00001 every 1 January (Baku time) and only
   ever goes up, so a number is never handed out twice, even after its person is deleted (gaps are normal).
   A number the office typed in by hand (a person from an earlier year) is skipped when the counter reaches it.
   Until round 22 one counter ran across years ("attendance"): the current year continues from it once. */
export const attYear = c => Number(S.bakuToday(c.now()).slice(0, 4));
async function attCounter(c) {
  const D = c.D, year = attYear(c), name = 'attendance|' + year;
  if (!(await D.peek('attendance|moved'))) {                    // once: carry the old single counter over into this year
    const old = await D.peek('attendance'); if (old) await D.bump(name, old);
    await D.bump('attendance|moved', year);
  }
  return { year, name };
}
/* is this learner number free (no person has it as their number or as their record key)? */
export async function attFree(D, att, exceptId = '') {
  const [byKey, byNo] = await Promise.all([D.get('trainees', att), D.byField('trainees', 'att', att)]);
  return (!byKey || byKey.id === exceptId) && !byNo.some(r => r.id !== exceptId);
}
/* the next k free learner numbers */
export async function nextAtts(c, k = 1) {
  const { year, name } = await attCounter(c), D = c.D;
  const first = k === 1 ? await D.seq(name) : await D.seqN(name, k);
  const out = Array.from({ length: k }, (_, i) => S.learnerNo(year, first + i));
  const [byKey, byNo] = await Promise.all([D.getMany('trainees', out), D.inList('trainees', 'att', out, ['att'])]);
  const taken = new Set([...byKey.map(r => r.id), ...byNo.map(r => r.data.att)]);
  for (let i = 0; i < out.length; i++) {
    for (let tries = 0; taken.has(out[i]) && tries < 200; tries++) { const n = S.learnerNo(year, await D.seq(name)); if (!taken.has(n) && await attFree(D, n)) out[i] = n; }
    taken.add(out[i]);
  }
  return out;
}

/* temporary account -> registered candidate (new learner number); returns the new record */
export async function completeTemp(c, t, { fin, phone, docType }) {
  const D = c.D, [att] = await nextAtts(c);
  const had = t.fin && t.fin === fin, stamp = new Date(c.now()).toISOString();
  if (had) await D.put('fins', [{ id: fin, data: { id: att, at: stamp } }]);          // the office already gave the FIN
  else try { await D.insert('fins', fin, { id: att, at: stamp }); } catch (/** @type {any} */ e) { if (e instanceof H && e.message === 'dup') throw new H(409, 'finExists'); throw e; }
  /** @type {any} */ let x;
  try {
    const login = await claimLogin(D, 'trainee', att, att);
    const { temp, tempLogin, ...rest } = t;
    x = { ...rest, id: att, att, fin, phone, ...(t.foreign && docType ? { docType } : {}), login, registeredAt: stamp, wasTemp: t.id };
    await D.put('trainees', [{ id: att, data: x }]);
  } catch (e) {
    // the new record was not written: the ID/FIN goes back to where it was (the temporary account, or nobody)
    try { if (had) await D.put('fins', [{ id: fin, data: { id: t.id, at: stamp } }]); else await D.del('fins', fin); } catch {}
    throw e;
  }
  await moveTrainee(c, t.id, att);
  await D.del('trainees', t.id); await D.del('logins', loginKey('trainee', t.login));
  await audit(c, 'trainee.register', `${t.id} → ${att} ${S.fullAz(x)} (FIN and phone given at the first sign-in)`, { entity: { kind: 'trainee', id: att, label: `${att} ${S.fullAz(x)}` } });
  return x;
}

/* a temporary account whose FIN belongs to an existing candidate: link request for the office (col "links") */
export async function requestLink(c, t, { fin, phone }) {
  const D = c.D, ex = await D.get('fins', fin), existing = ex && await D.get('trainees', ex.id); need(existing, 'finExists', 409);
  const open = (await D.query('links', { where: [['tempId', 'eq', t.id], ['status', 'eq', 'pending']], limit: 1 })).rows[0]?.data;
  const x = open || { id: 'L' + rnd(6), tempId: t.id, existingId: existing.id, fin, phone, status: 'pending', at: new Date(c.now()).toISOString() };
  Object.assign(x, { fin, phone, existingId: existing.id }); await D.put('links', [{ id: x.id, data: x }]);
  t.linkPending = x.id; await D.put('trainees', [{ id: t.id, data: t }]);
  await audit(c, 'trainee.linkRequest', `${t.id} → ${existing.att} (same FIN)`);
  return { att: existing.att };
}
/* office decision on a link request (approval queue) */
export async function decideLink(c, id, ok, review) {
  const D = c.D, x = await D.get('links', str(id, 40)); need(x && x.status === 'pending', 'noRec', 404);
  const t = await D.get('trainees', x.tempId), ex = await D.get('trainees', x.existingId); need(ex, 'noRec', 404);
  if (ok && t) {
    await moveTrainee(c, t.id, ex.id);
    if (!ex.phone && x.phone) { ex.phone = x.phone; await D.put('trainees', [{ id: ex.id, data: ex }]); }
    await D.del('trainees', t.id); await D.del('logins', loginKey('trainee', t.login));
  } else if (t) { delete t.linkPending; t.linkReturned = review.note; await D.put('trainees', [{ id: t.id, data: t }]); }
  x.status = ok ? 'approved' : 'returned'; x.review = review; await D.put('links', [{ id: x.id, data: x }]);
  await audit(c, ok ? 'trainee.link' : 'trainee.linkReturn', `${x.tempId} → ${ex.att}${review.note ? ' · ' + review.note : ''}`);
  return { link: x };
}
export async function pendingLinks(c) {
  const out = [], list = (await c.D.query('links', { where: [['status', 'eq', 'pending']] })).rows.map(r => r.data);
  const ppl = await getMany(c.D, 'trainees', list.flatMap(x => [x.tempId, x.existingId]));
  for (const x of list) {
    const t = ppl.get(x.tempId), ex = ppl.get(x.existingId);
    out.push({ ...x, fin: S.can(c.user.role, 'fin.view') ? x.fin : '•••••' + String(x.fin).slice(-2),
      temp: t && { id: t.id, name: S.fullAz(t), createdAt: t.createdAt }, existing: ex && { id: ex.id, att: ex.att, name: S.fullAz(ex), phone: S.can(c.user.role, 'fin.view') ? ex.phone : '' } });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
/* fresh sign-in details for a new account */
export async function tempCreds(c, id) { const password = candidatePassword(), salt = rnd(16); return { login: await claimLogin(c.D, 'trainee', id, id), password, salt, hash: await pbk(password, salt) }; }
