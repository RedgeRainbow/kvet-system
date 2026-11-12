/* Trainer, trainee and company portal routes. Portals never receive the ID/FIN. */
import { aiCfg, aiReady } from './ai.js';
import { H, S, str, need, num, bool, audit, enrId, getSettings, assetsOut, publicSettings, personLite, enrOf, saveEnr, enrsOfSession, sessionRow, enrsFor, sessionsOf, daysBefore } from './core.js';
import { confirmFor, saveEvaluation, savePractical, loadEnrolled, rollCall, openDocs, docsGate } from './ops.js';
import { pbk, rnd, same, mkTok } from './auth.js';
import { sign, slot, sessionSigns } from './signs.js';
import { certSt } from './search.js';
import { createTrainee, claimFin } from './routes_people.js';
import { completeTemp, requestLink } from './identity.js';
import { testState } from './routes_tests.js';
import { notify } from './routes_notify.js';

const blankLite = b => b && ({ id: b.id, name: b.name, titleAz: b.titleAz, titleEn: b.titleEn, qualAz: b.qualAz, qualEn: b.qualEn, credits: b.credits || 0 });
const names = x => ({ az: S.fullAz(x), en: S.fullEn(x) });
/* what the trainer's session page shows of a test; the questions and the key are fetched separately (and that is recorded) */
const testSummary = x => ({ status: x.status, pct: x.pct, passed: x.passed, at: x.at, late: x.late, title: x.title, grading: x.grading, passRate: x.passRate, closedBy: x.closedBy, warns: (x.warns || []).length });

/* ------------------------------------------------------------------ trainer */
/** @type {import('../../types/store').Routes} */
const trainerRoutes = {
  'GET /portal/trainer/home': { auth: 'trainer', async fn(c) {
    const today = c.today(), me = c.me;
    // the last 12 months and later; the full history on request (?all=1)
    const all = c.url.searchParams.get('all') === '1', since = daysBefore(today, 365), mine = [['tid', 'eq', me.id]];
    const [sessions, blanks, older] = await Promise.all([c.D.query('sessions', { where: all ? mine : [...mine, ['date', 'gte', since]] }).then(r => r.rows.map(x => x.data)), c.D.all('blanks').then(r => new Map(r.map(x => [x.id, x.data]))),
      all ? 0 : c.D.query('sessions', { where: [...mine, ['date', 'lt', since]], limit: 0, count: true }).then(r => r.total || 0)]);
    const by = await enrsFor(c.D, sessions.map(s => s.id));      // this trainer's sessions only, light fields
    // documents still to sign, for the sessions that have started and are not finished (at most 30)
    const live = sessions.filter(s => !s.cancelled && !s.closed && today >= s.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
    const todo = new Map(/** @type {[string, number][]} */ (await Promise.all(live.map(async s => { const [sg, enrs] = await Promise.all([sessionSigns(c, s.id), enrsOfSession(c.D, s)]); return [s.id, trainerTodo(s, enrs, sg, today).length]; }))));
    return { today, me: { id: me.id, ...names(me), specialty: me.specialty || '', login: me.login },
      sessions: sessions.map(s => ({ ...sessionRow(s, by.get(s.id), today), blank: blankLite(blanks.get(s.bid)), todo: todo.get(s.id) || 0 })).sort((a, b) => (a.date < b.date ? 1 : -1)), older,
      info: (await getSettings(c.D)).company || {} };
  } },


  /* Candidates the trainer can pick: only people who are (or were) in the trainer's OWN sessions. Anyone else is added by their exact
     learner number (GET /portal/trainer/lookup). Names, learner number and company only - never ID/FIN, phone or e-mail. */
  'GET /portal/trainer/candidates': { auth: 'trainer', async fn(c) {
    const cos = (await c.D.all('companies')).map(r => r.data).filter(x => x.on !== false), coName = new Map(cos.map(x => [x.id, x.name]));
    const mine = new Set((await c.D.byField('sessions', 'tid', c.me.id)).flatMap(r => r.data.traineeIds || []));
    const list = [];
    for (const id of mine) { const x = await c.D.get('trainees', id); if (x && x.on !== false) list.push({ ...personLite(x), company: S.isPrivateCompany(coName.get(x.co || ''), x.co) ? '' : coName.get(x.co || '') || '' }); }
    return { list, companies: cos.map(x => ({ id: x.id, name: x.name })).sort((a, b) => a.name.localeCompare(b.name)) };
  } },
  'GET /portal/trainer/lookup': { auth: 'trainer', async fn(c) {
    const att = str(c.url.searchParams.get('att'), 20).toUpperCase(); need(/^E-\d{9}$/.test(att), 'badInput');
    const x = await c.D.get('trainees', att); need(x && x.on !== false, 'noRec', 404);
    const co = x.co ? await c.D.get('companies', x.co) : null;
    await audit(c, 'trainer.lookup', att);
    return { person: { ...personLite(x), company: co && !S.isPrivateCompany(co.name, co.id) ? co.name : '' } };
  } },
  /* New candidate registered by a trainer. The ID/FIN is write-only: needed once for the unique-person check, never shown back. Optionally joins the trainer's own session straight away. */
  'POST /portal/trainer/trainee/save': { auth: 'trainer', async fn(c) {
    const b = await c.body(); let s = /** @type {any} */ (null);
    if (b.sid) { s = await c.D.get('sessions', str(b.sid, 60)); need(s && s.tid === c.me.id, 'noRec', 404); need(!s.cancelled && !s.closed, 'sessionClosed', 409); }
    const { t, password } = await createTrainee(c, { ...b, co: str(b.co, 60) });
    await audit(c, 'trainee.create', `${t.att} ${S.fullAz(t)} (by trainer)`, { entity: { kind: 'trainee', id: t.id, label: `${t.att} ${S.fullAz(t)}` } });
    if (s && !(s.traineeIds || []).includes(t.id)) { s.traineeIds = [...(s.traineeIds || []), t.id]; await c.D.put('sessions', [{ id: s.id, data: s }]); await audit(c, 'session.trainees', `${s.id} +${t.att}`, { entity: { kind: 'session', id: s.id, label: s.date } }); }
    return { trainee: personLite(t), creds: { login: t.login, password } };
  } },
  /* Add / remove candidates on one of the trainer's own sessions. Anyone who already has attendance or results stays. */
  'POST /portal/trainer/session/trainees': { auth: 'trainer', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.sid, 60)); need(s && s.tid === c.me.id, 'noRec', 404); need(!s.cancelled && !s.closed, 'sessionClosed', 409);
    const add = [...new Set((b.add || []).map(x => str(x, 60)))].slice(0, 200), rem = [...new Set((b.remove || []).map(x => str(x, 60)))].slice(0, 200);
    for (const t of await Promise.all(add.map(id => c.D.get('trainees', id)))) need(t && t.on !== false, 'badInput');
    for (const id of rem) { const e = await c.D.get('enr', enrId(s.id, id)); if (e && (e.fb || e.ev || e.prac || e.exam || e.test || e.doh || e.final)) throw new H(409, 'hasData', { tid: id }); await c.D.del('enr', enrId(s.id, id)); }   // attendance alone does not block removal from the session
    s.traineeIds = [...new Set([...(s.traineeIds || []).filter(x => !rem.includes(x)), ...add])].slice(0, 500);
    await c.D.put('sessions', [{ id: s.id, data: s }]); await audit(c, 'session.trainees', `${s.id} +${add.length} -${rem.length}`, { entity: { kind: 'session', id: s.id, label: s.date } });
    return { ok: 1, count: s.traineeIds.length };
  } },

  'GET /portal/trainer/session': { auth: 'trainer', async fn(c) {
    const s = await c.D.get('sessions', str(c.url.searchParams.get('id'), 60));
    need(s && s.tid === c.me.id, 'noRec', 404);
    const today = c.today(), enrs = await enrsOfSession(c.D, s);
    const [blank, sheet, cos, st] = await Promise.all([c.D.get('blanks', s.bid), s.sheetId ? c.D.get('sheets', s.sheetId) : null, c.D.all('companies'), getSettings(c.D)]);
    const coName = new Map(cos.map(r => [r.id, r.data.name]));
    const mats = (await Promise.all((s.materials || []).map(id => c.D.get('materials', id)))).filter(m => !!m).map(m => /** @type {import('../../types/records').Material} */ (m)).map(m => ({ id: m.id, title: m.title, slides: m.slides }));
    const trainees = [], people = await Promise.all(enrs.map(e => c.D.get('trainees', e.tid)));      // one batched query
    for (const [i, e] of enrs.entries()) {
      const t = people[i]; if (!t) continue;
      trainees.push({ ...personLite(t), company: S.isPrivateCompany(coName.get(t.co), t.co) ? '' : coName.get(t.co), att: t.att,
        attAt: e.att || null, attBy: e.attBy || null, fbDone: !!e.fb, ev: e.ev || null, prac: e.prac || null, final: e.final ? { outcome: e.final.outcome } : null,
        doh: e.doh || null, test: e.test?.at ? testSummary(e.test) : null, testStarted: !!(e.test && !e.test.at), exam: e.exam || null, absent: e.absent || null, days: e.days || null, hasData: !!(e.fb || e.ev || e.prac || e.exam || e.test || e.final || e.doh),
        fbAt: e.fb?.at || null, tbtAck: e.tbtAck?.at || null });
    }
    const signs = await sessionSigns(c, s.id);
    return { today, session: sessionRow(s, enrs, today), signs, todo: trainerTodo(s, enrs, signs, today), multi: S.multiDay(s), finalDay: S.finalDay(s), docsReady: S.docsReady(s), blank: blankLite(blank), sheet, materials: mats, trainees, test: s.examMode === 'bank' ? await c.D.get('tests', s.examId || '') : null,
      trainer: { id: c.me.id, ...names(c.me) }, info: st.company || {}, assets: await assetsOut(c.D, st) };
  } },

  /* the trainer signs the attendance sheet of an own session; a multi-day training: one signature per day (b.day) */
  'POST /portal/trainer/sign/att': { auth: 'trainer', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.sid, 60)); need(s && s.tid === c.me.id, 'noRec', 404); need(!s.cancelled, 'sessionClosed', 409);
    if (!S.multiDay(s)) return { sign: await sign(c, slot.att(s.id), 'att', { sid: s.id }, 'trainer') };
    const day = str(b.day, 10) || S.rollDay(s, c.today(), ''); need(S.sessionDays(s).includes(day) && day <= c.today(), 'dayNotYet', 409);
    return { sign: await sign(c, slot.att(s.id, day), 'att', { sid: s.id, day }, 'trainer'), day };
  } },
  /* the trainer signs the evaluation of the candidates, or the exam results once they are all confirmed */
  'POST /portal/trainer/sign/doc': { auth: 'trainer', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.sid, 60)); need(s && s.tid === c.me.id, 'noRec', 404); need(!s.cancelled, 'sessionClosed', 409);
    const doc = str(b.doc, 10), enrs = await enrsOfSession(c.D, s), present = enrs.filter(e => e.att);
    if (doc === 'ev') { need(present.length && present.every(e => e.ev), 'evIncomplete', 409); return { sign: await sign(c, slot.ev(s.id), 'ev', { sid: s.id }, 'trainer') }; }
    if (doc === 'exam') { need(examConfirmed(present), 'examNotConfirmed', 409); return { sign: await sign(c, slot.exam(s.id), 'exam', { sid: s.id }, 'trainer') }; }
    throw new H(400, 'badInput');
  } },
  /* the trainer opens the final-day documents of a multi-day training (on the final day) */
  'POST /portal/trainer/docs': { auth: 'trainer', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.sid, 60)); need(s && s.tid === c.me.id, 'noRec', 404);
    const x = await openDocs(c, s, b.open !== false); return { docsOpen: x.docsOpen || null };
  } },
  /* roll call: the trainer ticks only who is absent; everybody else is saved as present */
  'POST /portal/trainer/attendance': { auth: 'trainer', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.sid, 60)); need(s && s.tid === c.me.id, 'noRec', 404);
    return rollCall(c, s.id, b.absent, b.day);
  } },
  /* the trainer confirms attendance for every candidate of the session in one go */
  'POST /portal/trainer/confirm-all': { auth: 'trainer', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.sid, 60)); need(s && s.tid === c.me.id, 'noRec', 404);
    let n = 0; for (const tid of s.traineeIds || []) { const e = await enrOf(c.D, s.id, tid); if (!e.att) { await confirmFor(c, s.id, tid); n++; } }
    return { confirmed: n };
  } },
  /* the trainer signs a practical sheet again (e.g. after the office corrected it) */
  'POST /portal/trainer/sign/prac': { auth: 'trainer', async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid); need(s.tid === c.me.id, 'forbidden', 403); need(!s.cancelled, 'sessionClosed', 409);
    need(e.prac && e.prac.result !== 'INCOMPLETE', 'nothingToSign', 409);
    return { sign: await sign(c, slot.prac(s.id, e.tid, 'examiner'), 'prac', { sid: s.id, tid: e.tid }, 'examiner') };
  } },
  'POST /portal/trainer/confirm': { auth: 'trainer', async fn(c) {
    const b = await c.body(), { s } = await loadEnrolled(c, b.sid, b.tid); need(s.tid === c.me.id, 'forbidden', 403);
    const e = await confirmFor(c, b.sid, b.tid, bool(b.undo)); return { att: e.att || null, attBy: e.attBy || null };
  } },
  'POST /portal/trainer/evaluate': { auth: 'trainer', async fn(c) {
    const b = await c.body(), { s } = await loadEnrolled(c, b.sid, b.tid); need(s.tid === c.me.id, 'forbidden', 403);
    return { ev: (await saveEvaluation(c, b.sid, b.tid, b)).ev };
  } },
  'POST /portal/trainer/practical': { auth: 'trainer', async fn(c) {
    const b = await c.body(), { s } = await loadEnrolled(c, b.sid, b.tid); need(s.tid === c.me.id, 'forbidden', 403);
    return { prac: (await savePractical(c, b.sid, b.tid, b.data || {})).prac };
  } },

  /* The presentation bytes are only handed to the assigned trainer while the session is on, never as a file download. */
  'GET /portal/trainer/material': { auth: 'trainer', raw: true, async fn(c) {
    const sid = str(c.url.searchParams.get('sid'), 60), id = str(c.url.searchParams.get('id'), 60);
    const s = await c.D.get('sessions', sid);
    need(s && s.tid === c.me.id && (s.materials || []).includes(id), 'noRec', 404);
    { const mx = await c.D.get('materials', id); need(S.usable(mx), 'materialNotApproved', 409); }
    need(!s.cancelled && c.today() >= s.date, 'notStarted', 409);
    const m = await c.D.get('materials', id), o = m && await c.B.get('materials/' + m.key); need(o, 'noRec', 404);
    await audit(c, 'material.view', `${m.title} (${s.id})`);
    return new Response(o.body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store, private', 'content-disposition': 'inline', 'x-content-type-options': 'nosniff' } });
  } },
};

/* ------------------------------------------------------------------ trainee */
async function certsOf(c, tid) {
  const st = await getSettings(c.D);
  const list = (await c.D.byField('certs', 'tid', tid)).map(r => r.data).filter(S.certDelivered);
  return S.annotateCerts(list, c.today(), st.soonDays ?? S.SOON_DAYS);
}
/* A candidate sent by a company sees only THAT they hold a certificate (training, dates, status); the document itself
   (view, print, download) belongs to the company. Private candidates get their own certificates. */
const certFact = x => ({ fact: true, training: x.snap?.blank?.name || '', start: x.start, end: x.end, expiry: x.expiry, st: x.st });
/** @type {import('../../types/store').Routes} */
const traineeRoutes = {
  /* first sign-in of someone registered without ID/FIN or phone: these are asked for before the portal opens */
  /* first sign-in of someone registered without ID/FIN or phone (temporary account): these are asked for before the portal opens.
     New FIN -> full registration with a learner number (a new sign-in token is returned: the record is now the learner number).
     FIN already registered -> a link request to the office (the same person must not get a second record). */
  'POST /portal/trainee/profile/complete': { auth: 'trainee', async fn(c) {
    const b = await c.body(), me = c.me, fin = me.fin || S.normFin(b.fin), phone = me.phone || S.normPhone(b.phone);
    need(S.goodFin(fin, me.foreign), 'badId'); need(phone && S.goodPhone(phone), 'badPhone');
    if (me.linkPending) throw new H(409, 'linkPending');
    const owner = await c.D.get('fins', fin);
    if (owner && owner.id !== me.id) {
      if (!me.temp) throw new H(409, 'dupFin');
      const r = await requestLink(c, me, { fin, phone }); return { linkPending: true, att: '••••' + String(r.att).slice(-4) };
    }
    if (me.temp) {
      const x = await completeTemp(c, me, { fin, phone, docType: b.docType });
      return { registered: true, att: x.att, login: x.login, token: await mkTok(c.env, { r: 'trainee', id: x.id, pv: x.pv || 0 }) };
    }
    // an older full record that only missed a detail
    if (!me.fin) { await claimFin(c.D, fin, me.id); me.fin = fin; }
    if (!me.phone) me.phone = phone;
    await c.D.put('trainees', [{ id: me.id, data: me }]); await audit(c, 'trainee.profile', `${me.att} completed ID/FIN and phone at first sign-in`);
    return { ok: 1 };
  } },
  'GET /portal/trainee/home': { auth: 'trainee', async fn(c) {
    const me = c.me, today = c.today(), st = await getSettings(c.D);
    if (me.temp || !me.fin || !me.phone) return { needProfile: { fin: !me.fin, phone: !me.phone, foreign: !!me.foreign, temp: !!me.temp, linkPending: !!me.linkPending, linkReturned: me.linkReturned || '' }, me: { att: me.att, ...names(me), foreign: !!me.foreign }, today, settings: publicSettings(st), assets: await assetsOut(c.D, st), info: st.company || {} };
    // everything at once: sessions, templates, trainers, the company, certificates and the AI switches; then each session in parallel
    const [all, blankRows, trainerRows, co, certs0, aiFlags, assets] = await Promise.all([sessionsOf(c.D, me.id), c.D.all('blanks'), c.D.all('trainers'), me.co ? c.D.get('companies', me.co) : null, certsOf(c, me.id),
      (async () => { c.settings = st; const cfg = aiCfg(st), ok = cfg.on && (await aiReady(c)); return { chat: ok && cfg.chat }; })(), assetsOut(c.D, st)]);
    const blanks = new Map(blankRows.map(r => [r.id, r.data])), trainers = new Map(trainerRows.map(r => [r.id, r.data]));
    const sessions = await Promise.all(all.map(async s => {
      const [e, sg] = await Promise.all([enrOf(c.D, s.id, me.id), sessionSigns(c, s.id)]), tr = trainers.get(s.tid);
      return ({ id: s.id, date: s.date, endDate: s.endDate || '', time: s.time || '', location: s.location || '', blank: blankLite(blanks.get(s.bid)), trainer: tr ? S.fullEn(tr, false) : '',
        cancelled: !!s.cancelled, closed: !!s.closed, active: S.sessionActiveOn(s, today), upcoming: today < s.date,
        att: e.att || null, fbDone: !!e.fb, fbOpen: !e.fb && !e.final && !!e.att && !s.cancelled && !s.closed && today >= s.date && today <= S.sessionEnd(s) && S.docsReady(s),
        multi: S.multiDay(s), finalDay: S.finalDay(s), docsReady: S.docsReady(s), fbSigned: !!sg.fb[me.id],
        tbt: s.tbt?.open && !s.cancelled ? { topic: s.tbt.topic, notes: s.tbt.notes || '', date: s.tbt.date || s.date, acked: e.tbtAck?.at || null, canSign: !!e.att && !e.tbtAck && !s.closed && S.docsReady(s) } : null, examLink: e.fb && s.examMode !== 'bank' ? (s.examLink || '') : '', hasExam: s.examMode === 'bank' || !!s.examLink,
        test: testState(s, e), testResult: e.test?.status === 'graded' ? { pct: e.test.pct, passed: e.test.passed } : null, examOpen: !!s.exam?.open, fbRequired: st.fbRequired !== false,
        needDoh: !!s.sheetId, doh: e.doh ? { at: e.doh.at, paper: !!e.doh.paper } : null,
        final: e.final ? { outcome: e.final.outcome, certNo: e.final.certNo || null } : null,
        prac: e.prac && e.prac.result !== 'INCOMPLETE' ? { result: e.prac.result, total: e.prac.total, max: e.prac.max } : null, pracSigns: sg.prac[me.id] || {} });
    }));
    sessions.sort((a, b) => (a.date < b.date ? 1 : -1));
    const viaCompany = !!co && !S.isPrivateCompany(co.name, co.id);
    const certs = certs0.filter(x => x.st !== 'REVOKED');
    return { today, company: co && !S.isPrivateCompany(co.name, co.id) ? co.name : '', me: { ...personLite(me), login: me.login, ...names(me), phone: me.phone || '', email: me.email || '' },
      ai: aiFlags,
      sessions, certs: viaCompany ? certs.map(certFact) : certs, certsViaCompany: viaCompany, info: st.company || {}, assets, settings: publicSettings(st) };
  } },

  'POST /portal/trainee/feedback': { auth: 'trainee', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.sid, 60));
    need(s && (s.traineeIds || []).includes(c.me.id), 'noRec', 404);
    const e = await enrOf(c.D, s.id, c.me.id);
    need(e.att, 'notConfirmed', 409); need(!e.fb, 'dupFb', 409);
    // the training evaluation is given (and signed by the candidate) during the training; multi-day: on the final day
    need(!s.cancelled && !s.closed && c.today() >= s.date && c.today() <= S.sessionEnd(s), 'notDuringTraining', 409); docsGate(c, s);
    const r = {}, cm = {};
    for (const g of S.FB_GROUPS) { const v = b.r?.[g]; need(Number.isInteger(v) && v >= 1 && v <= 10, 'badRating'); r[g] = v; cm[g] = str(b.cm?.[g], 2000); }
    e.fb = { r, cm, at: new Date(c.now()).toISOString() };
    await saveEnr(c.D, e); await audit(c, 'feedback', `${s.id} ${c.me.id}`);
    const sg = await sign(c, slot.fb(s.id, c.me.id), 'fb', { sid: s.id, tid: c.me.id }, 'participant');
    return { examLink: s.examLink || '', sign: sg };
  } },
  /* the candidate acknowledges and signs the toolbox talk the trainer opened (date and time are recorded) */
  'POST /portal/trainee/tbt': { auth: 'trainee', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.sid, 60)); need(s && (s.traineeIds || []).includes(c.me.id), 'noRec', 404);
    need(s.tbt?.open && !s.cancelled && !s.closed, 'tbtNotOpen', 409); docsGate(c, s);
    const e = await enrOf(c.D, s.id, c.me.id); need(e.att, 'notConfirmed', 409); need(!e.tbtAck, 'dupSign', 409);
    e.tbtAck = { at: new Date(c.now()).toISOString() }; await saveEnr(c.D, e); await audit(c, 'tbt.ack', `${s.id} ${c.me.id}`);
    return { sign: await sign(c, slot.tbtP(s.id, c.me.id), 'tbt', { sid: s.id, tid: c.me.id }, 'participant') };
  } },
};

/* ------------------------------------------------------- own password (all portals) */
const PCOL = { trainer: 'trainers', trainee: 'trainees', company: 'companies' };
const passwordRoutes = Object.fromEntries(Object.keys(PCOL).map(kind => [`POST /portal/${kind}/password`, { auth: kind, async fn(c) {
  const b = await c.body(), acc = await c.D.get(PCOL[kind], c.me.id), nw = String(b.next || '');
  need(acc && acc.salt && same(await pbk(String(b.current || ''), acc.salt), acc.hash), 'badPassword', 400);
  need(nw.length >= 8 && nw.length <= 100 && /[A-Za-z]/.test(nw) && /\d/.test(nw), 'weakPassword');
  acc.salt = rnd(16); acc.hash = await pbk(nw, acc.salt); acc.pv = (acc.pv || 0) + 1;      // signs out every other device
  await c.D.put(PCOL[kind], [{ id: acc.id, data: acc }]); await audit(c, 'password.change', `${kind} ${acc.login}`);
  return { token: await mkTok(c.env, { r: kind, id: acc.id, pv: acc.pv }) };
} }]));

/* ------------------------------------------------------------------ company */
const REQ_KINDS = ['training', 'renewal'];
/** @type {import('../../types/store').Routes} */
const companyRoutes = {
  /* Training / renewal requests sent to the training centre; staff answer them in Admin -> Requests. */
  'POST /portal/company/request': { auth: 'company', async fn(c) {
    const b = await c.body(), kind = REQ_KINDS.includes(b.kind) ? b.kind : null; need(kind, 'badInput');
    const own = new Set((await c.D.byField('trainees', 'co', c.me.id)).map(r => r.id));
    const people = [...new Set((b.people || []).map(x => str(x, 60)))].filter(id => own.has(id)).slice(0, 200);
    // only the company's own certificates (numbers of other companies' certificates are dropped)
    const askCerts = [...new Set((b.certs || []).map(x => S.normCertNo(str(x, 40))))].slice(0, 200);
    const certs = askCerts.length ? (await c.D.getMany('certs', askCerts)).filter(r => r.data && (r.data.co === c.me.id || own.has(r.data.tid))).map(r => r.id) : [];
    const bid = str(b.bid, 60); if (bid) need(await c.D.get('blanks', bid), 'badInput');
    const x = { id: 'q' + Date.now().toString(36) + rnd(2), co: c.me.id, coName: c.me.name, kind, bid, people, certs, count: num(b.count, 0, 999, people.length || 0),
      date: S.isDate(b.date) ? b.date : '', note: str(b.note, 1000), contact: str(b.contact, 160), status: 'new', at: new Date(c.now()).toISOString() };
    need(x.bid || x.certs.length || x.note, 'badInput');
    await c.D.put('requests', [{ id: x.id, data: x }]); await audit(c, 'request.create', `${c.me.name} · ${kind}`);
    await notify(c, 'staff:a:requests', 'nRqNew', [c.me.name], '#/requests', 'request:' + x.id);
    return { request: x };
  } },
  /* results of one of the company's OWN candidates: attendance, trainer's feedback, practical, exam, outcome per session */
  'GET /portal/company/person': { auth: 'company', async fn(c) {
    const x = await c.D.get('trainees', str(c.url.searchParams.get('id'), 60)); need(x && x.co === c.me.id, 'noRec', 404);
    const blanks = new Map((await c.D.all('blanks')).map(r => [r.id, r.data])), trainers = new Map((await c.D.all('trainers')).map(r => [r.id, r.data]));
    const out = [];
    for (const s of (await sessionsOf(c.D, x.id)).sort((a, b) => (a.date < b.date ? 1 : -1))) {
      const e = await enrOf(c.D, s.id, x.id), tr = trainers.get(s.tid);
      out.push({ sid: s.id, date: s.date, endDate: s.endDate || '', training: blanks.get(s.bid)?.name || '', trainer: tr ? S.fullEn(tr, false) : '', cancelled: !!s.cancelled,
        attendance: e.att ? 'present' : e.absent ? 'absent' : 'pending', ev: e.ev ? { behavior: e.ev.behavior, punctuality: e.ev.punctuality, engagement: e.ev.engagement, comment: e.ev.comment || '' } : null,
        practical: e.prac && e.prac.result !== 'INCOMPLETE' ? { result: e.prac.result, total: e.prac.total, max: e.prac.max } : null,
        exam: e.exam ? { passed: e.exam.passed, score: e.exam.score ?? null } : e.test?.at ? { pending: true } : null,
        outcome: e.final?.outcome || S.computeOutcome(e, s, { fbRequired: false }).outcome, certNo: e.final?.certNo || null });
    }
    await audit(c, 'company.view.person', `${c.me.name} · ${x.att}`);
    return { person: { ...personLite(x), ...names(x) }, sessions: out };
  } },
  'GET /portal/company/requests': { auth: 'company', async fn(c) {
    return { list: (await c.D.byField('requests', 'co', c.me.id)).map(r => r.data).sort((a, b) => ((a.at || '') < (b.at || '') ? 1 : -1)), blanks: (await c.D.all('blanks')).map(r => ({ id: r.id, name: r.data.name })) };
  } },
  'GET /portal/company/cert': { auth: 'company', async fn(c) {
    const x = await c.D.get('certs', S.normCertNo(str(c.url.searchParams.get('no'), 60))); need(x && x.co === c.me.id && !x.revoked && S.certDelivered(x), 'noRec', 404);
    const st = await getSettings(c.D), { by, sk, exp, cox, ...o } = x; return { cert: { ...o, st: certSt(x, c.today(), st.soonDays ?? S.SOON_DAYS) } };
  } },
  'GET /portal/company/home': { auth: 'company', async fn(c) {
    const co = c.me, st = await getSettings(c.D), today = c.today();
    const trainees = (await c.D.byField('trainees', 'co', co.id)).map(r => r.data);
    // current certificates only (not revoked, not replaced by a renewal), with a light snapshot; the full certificate for
    // viewing / PDF comes from GET /portal/company/cert. Years of history stay out of the page.
    const soon = st.soonDays ?? S.SOON_DAYS;
    const certs = (await c.D.query('certs', { where: [['co', 'eq', co.id], ['revoked', 'null', true], ['renewed', 'null', true]] })).rows.map(r => r.data).filter(S.certDelivered);
    const live = certs.map(({ by, vh, sk, exp, cox, snap, ...x }) => ({ ...x, st: certSt(x, today, soon), snap: snap && { names: snap.names, foreign: snap.foreign, att: snap.att, company: snap.company, blank: { name: snap.blank?.name || '' } } }));   // no staff e-mail addresses in the company portal
    const nBy = new Map(); for (const x of live) nBy.set(x.tid, (nBy.get(x.tid) || 0) + 1);
    return { today, company: { id: co.id, name: co.name, contactPerson: co.contactPerson || '', phone: co.phone || '', email: co.email || '', reqOptional: !!co.reqOptional },
      trainees: trainees.map(t => ({ ...personLite(t), certs: nBy.get(t.id) || 0 })),
      certs: live, counters: S.certCounters(live), assets: await assetsOut(c.D, st), info: st.company || {}, settings: publicSettings(st) };
  } },
};

/* exam results are confirmed when every candidate present has a decision and no online test waits for review */
export const examConfirmed = present => present.length > 0 && present.every(e => e.exam && e.test?.status !== 'review');
/* what the trainer still has to do / sign in a session (shown as warnings in the trainer portal) */
export function trainerTodo(s, enrs, sg, today) {
  if (s.cancelled) return [];
  const out = [], present = enrs.filter(e => e.att), started = today >= s.date;
  if (S.multiDay(s)) { for (const d of S.sessionDays(s)) if (d <= today && !sg.attDays[d] && enrs.some(e => e.days?.[d])) out.push({ doc: 'att', day: d }); }
  else if (started && present.length && !sg.att) out.push({ doc: 'att' });
  if (S.multiDay(s) && !s.docsOpen && today >= S.finalDay(s)) out.push({ doc: 'docsOpen' });
  if (present.length && present.every(e => e.ev) && !sg.ev) out.push({ doc: 'ev' });
  if (s.tbt && !sg.tbt) out.push({ doc: 'tbt', acks: present.filter(e => e.tbtAck).length, of: present.length });
  for (const e of present) if (e.prac && e.prac.result !== 'INCOMPLETE' && !sg.prac[e.tid]?.examiner) out.push({ doc: 'prac', tid: e.tid });
  if (examConfirmed(present) && !sg.exam) out.push({ doc: 'exam' });
  return out;
}
export const portalRoutes = { ...trainerRoutes, ...traineeRoutes, ...companyRoutes, ...passwordRoutes };
