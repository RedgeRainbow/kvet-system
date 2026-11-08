/* Operations that both staff and trainers can perform on an enrolment. */
import { H, S, need, str, num, enrOf, saveEnr, audit } from './core.js';
import { sign, unsign, slot } from './signs.js';
import { notify } from './routes_notify.js';

export async function loadSession(c, sid) {
  const s = await c.D.get('sessions', str(sid, 60));
  if (!s) throw new H(404, 'noRec');
  return s;
}
export async function loadEnrolled(c, sid, tid) {
  const s = await loadSession(c, sid);
  need((s.traineeIds || []).includes(str(tid, 60)), 'notEnrolled', 404);
  return { s, e: await enrOf(c.D, s.id, str(tid, 60)) };
}
/* Trainers work only while the session is open: once it is closed or cancelled their marks are frozen (staff can still correct them until the result is released). */
const trainerOpen = (c, s) => { if (c.user?.kind === 'trainer') need(!s.closed && !s.cancelled, 'sessionClosed', 409); };
/* final-day documents of a multi-day training (see shared.js docsReady): trainers and candidates wait until the trainer opens
   them on the final day; the office can still record paper forms / corrections */
export const docsGate = (c, s) => { if (c.user?.kind !== 'staff' && !S.docsReady(s)) throw new H(409, 'docsNotOpen', { day: S.finalDay(s) }); };
/* opens / closes the final-day documents of a multi-day training. A trainer opens them on the final day (not earlier). */
export async function openDocs(c, s, open) {
  need(S.multiDay(s), 'notMultiDay', 409); need(!s.cancelled && !s.closed, 'sessionClosed', 409);
  if (open && c.user?.kind === 'trainer' && c.today() < S.finalDay(s)) throw new H(409, 'notFinalDay', { day: S.finalDay(s) });
  if (open) s.docsOpen = { at: new Date(c.now()).toISOString(), by: c.user?.kind === 'trainer' ? S.fullAz(c.me, false) : c.user?.email || '' }; else delete s.docsOpen;
  await c.D.put('sessions', [{ id: s.id, data: s }]); await audit(c, open ? 'docs.open' : 'docs.close', s.id);
  if (open) await notify(c, (s.traineeIds || []).map(x => 'trainee:' + x), 'nDocsOpen', []);
  return s;
}
/* the attendance signatures a change of attendance withdraws: the one-day sheet, or the changed day */
export const attSlots = (s, day) => (S.multiDay(s) ? (day ? [slot.att(s.id, day)] : S.sessionDays(s).map(d => slot.att(s.id, d))) : [slot.att(s.id)]);
const actor = c => c.user ? { id: c.user.id, name: c.user.email || c.user.name, role: c.user.role || c.user.kind } : null;

/* Attendance confirmed on behalf of a trainee (by trainer or staff). */
export async function confirmFor(c, sid, tid, undo = false) {
  const { s, e } = await loadEnrolled(c, sid, tid);
  need(!s.cancelled, 'sessionClosed', 409); trainerOpen(c, s);
  if (undo) {
    need(!e.fb && !e.ev && !e.prac && !e.exam && !e.final, 'hasData', 409);
    delete e.att; delete e.attBy; delete e.days;
  } else {
    need(!s.closed, 'sessionClosed', 409);
    need(c.today() >= s.date, 'notStarted', 409);
    const at = new Date(c.now()).toISOString(), by = c.user.kind === 'trainer' ? 'trainer' : 'staff';
    if (!e.att) { e.att = at; e.attBy = by; }
    delete e.absent;                               // arrived after all
    if (S.sessionDays(s).length > 1) { const d = S.rollDay(s, c.today(), ''); if (d) { e.days ||= {}; if (!e.days[d]?.at) e.days[d] = { at, by }; } }
  }
  await saveEnr(c.D, e); await audit(c, undo ? 'attendance.undo' : 'attendance.confirm', `${s.id} ${tid}`);
  // the signed attendance (sheet / that day) no longer matches: it has to be signed again
  await unsign(c, attSlots(s, undo ? '' : S.multiDay(s) ? S.rollDay(s, c.today(), '') : ''));
  return e;
}

/* Roll call: everybody counts as present except the ones ticked "absent". Already confirmed people stay as they are,
   unless they are now ticked absent and have nothing recorded yet. */
export async function rollCall(c, sid, absentIds = /** @type {any[]} */ ([]), askedDay = '') {
  const s = await loadSession(c, sid); need(!s.cancelled && !s.closed, 'sessionClosed', 409); need(c.today() >= s.date, 'notStarted', 409);
  const absent = new Set((absentIds || []).map(x => str(x, 60))), by = c.user.kind === 'trainer' ? 'trainer' : 'staff', at = new Date(c.now()).toISOString(), out = { present: 0, absent: 0 };
  // several days (e.g. 2 credits = 2 days): one roll call per day; "attended" = present on at least one day
  if (S.sessionDays(s).length > 1) {
    const asked = str(askedDay, 10);
    // a named day must belong to the session and have come; never fall back silently (that would overwrite another day)
    if (asked) need(S.sessionDays(s).includes(asked) && asked <= c.today(), 'dayNotYet', 409);
    const day = asked || S.rollDay(s, c.today(), ''); need(day, 'notStarted', 409); out.day = day;
    for (const tid of s.traineeIds || []) {
      const e = await enrOf(c.D, s.id, tid); e.days ||= {};
      const was = JSON.stringify(e.days[day] || null);
      e.days[day] = absent.has(tid) ? { absent: { at, by } } : { at: e.days[day]?.at || at, by: e.days[day]?.by || by };
      const marks = Object.values(e.days), firstIn = marks.filter(m => m.at).map(m => m.at).sort()[0];
      if (firstIn) { if (!e.att) { e.att = firstIn; e.attBy = by; } delete e.absent; }
      else if (!(e.fb || e.ev || e.prac || e.exam || e.test || e.final)) { delete e.att; delete e.attBy; e.absent = { at, by }; }
      if (JSON.stringify(e.days[day]) !== was) { await saveEnr(c.D, e); await audit(c, absent.has(tid) ? 'attendance.absent' : 'attendance.confirm', `${s.id} ${tid} ${day}`); }
      absent.has(tid) ? out.absent++ : out.present++;
    }
    await unsign(c, attSlots(s, day));
    return out;
  }
  for (const tid of s.traineeIds || []) {
    const e = await enrOf(c.D, s.id, tid);
    if (absent.has(tid)) {
      if (e.att && (e.fb || e.ev || e.prac || e.exam || e.test || e.final)) continue;     // has results: stays present
      if (e.att || !e.absent) { delete e.att; delete e.attBy; e.absent = { at, by }; await saveEnr(c.D, e); await audit(c, 'attendance.absent', `${s.id} ${tid}`); }
      out.absent++;
    } else {
      if (!e.att) { e.att = at; e.attBy = by; delete e.absent; await saveEnr(c.D, e); await audit(c, 'attendance.confirm', `${s.id} ${tid}`); }
      out.present++;
    }
  }
  await unsign(c, attSlots(s));
  return out;
}

export async function saveEvaluation(c, sid, tid, b) {
  const { s, e } = await loadEnrolled(c, sid, tid); trainerOpen(c, s); docsGate(c, s);
  need(e.att, 'notConfirmed', 409); need(!e.final, 'locked', 409);
  const ev = {
    behavior: S.BEHAVIOR.includes(b.behavior) ? b.behavior : null,
    punctuality: S.PUNCTUALITY.includes(b.punctuality) ? b.punctuality : null,
    engagement: num(b.engagement, 1, 5),
    comment: str(b.comment, 2000),
    at: new Date(c.now()).toISOString(), by: actor(c),
  };
  need(ev.behavior && ev.punctuality && ev.engagement, 'badInput');
  e.ev = ev; await saveEnr(c.D, e); await audit(c, 'trainer.evaluate', `${s.id} ${tid}`);
  await unsign(c, [slot.ev(s.id)]);            // the signed evaluation sheet changed: the trainer signs it again
  return e;
}

export async function savePractical(c, sid, tid, b) {
  const { s, e } = await loadEnrolled(c, sid, tid); trainerOpen(c, s); docsGate(c, s);
  need(s.sheetId, 'noSheet', 409);
  const sheet = await c.D.get('sheets', s.sheetId); need(sheet, 'noRec', 404);
  need(e.att, 'notConfirmed', 409); need(!e.final, 'locked', 409);
  need(e.doh, 'needDoh', 409);                 // declaration of health first (online or paper)
  let clean; try { clean = S.validateSheetData(sheet, b); } catch (/** @type {any} */ x) { throw new H(400, typeof x === 'string' ? x : 'badInput'); }
  const r = S.evaluateSheet(sheet, clean);
  e.prac = { sheetId: sheet.id, ...clean, result: r.result, total: r.total, max: r.max, avg: r.avg, failed: r.failed, reason: r.reason,
    examiner: str(b.examiner, 120) || (c.user.name || c.user.email || ''), examinerReg: str(b.examinerReg, 40), at: new Date(c.now()).toISOString(), by: actor(c) };
  // a changed practical invalidates a previously entered exam decision only when it now fails
  await saveEnr(c.D, e); await audit(c, 'practical.save', `${s.id} ${tid} ${r.result}`);
  // any change withdraws earlier signatures; a finished sheet is signed by the examiner (whoever saved it) straight away
  await unsign(c, [slot.prac(s.id, e.tid, 'examiner')]);
  // practical sheets are signed only by the trainer (trainer portal): automatically when the trainer saves a completed sheet.
  // When staff change a sheet, the signature is withdrawn and the trainer signs it again.
  if (r.result !== 'INCOMPLETE' && c.user?.kind === 'trainer') e.prac.sign = await sign(c, slot.prac(s.id, e.tid, 'examiner'), 'prac', { sid: s.id, tid: e.tid }, 'examiner');
  return e;
}
