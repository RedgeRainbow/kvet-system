/* Electronic signatures on documents.
   A signature = who (name, title/role), when, which document, a SHA-256 fingerprint of the document's content at that moment,
   and a short code (ABCD-1234) printed on the document. Anyone can check the code on /verify.html?s=CODE: the page shows the
   signer and time, and says "changed after signing" when the document's content no longer matches the fingerprint.
   Slots (col "signs", id = slot):
     cert|<no>|issuer              certificate, signed by the superadmin or an approver
     att|<session>|trainer         attendance sheet of a one-day session, signed by the trainer only
     att|<session>|day:<date>      attendance of one day of a multi-day session, signed by the trainer for each day
     ev|<session>|trainer          trainer's evaluation of the candidates, signed by the trainer only
     fb|<session>|<tid>|participant training evaluation (feedback), signed by the candidate when sending it during the training
     tbt|<session>|<tid>|participant toolbox talk acknowledged and signed by a candidate (date and time), once the trainer opened it
     exam|<session>|trainer        exam results of the session, signed by the trainer once every result is confirmed
     prac|<session>|<tid>|examiner practical sheet, signed by the examiner when the test is marked completed
     prac|<session>|<tid>|candidate practical sheet, countersigned by the candidate in the trainee portal
     doh|<session>|<tid>|participant declaration of health, signed by the trainee in the trainee portal
     tbt|<session>|trainer          toolbox talk, signed by the trainer (talk by), normally after the candidates
     test|<session>|<tid>|grader    online test result, signed by the trainer when the trainer marks it
     <doc>|<session>|<tid>|approver approval countersignature of a practical sheet, declaration of health or test sheet
                                   by an approver or the superadmin: electronic signature or their uploaded signature image
   Who may sign what is fixed here (SIGNERS): admins sign nothing; staff sign only certificates (superadmin, approver) and
   approval countersignatures; attendance, the trainer's evaluation, toolbox talk and exam results are the trainer's; the
   training evaluation and the toolbox acknowledgement are the candidate's. Attendance and evaluation sheets carry no stamp.
   This is an internal electronic signature (identity = the signed-in account). For a qualified e-signature under Azerbaijani law
   (ASAN İmza / e-imza) see DEPLOY.md. */
import { S, H, audit } from './core.js';
import { notify } from './routes_notify.js';
import { hmac, sha } from './auth.js';

export const slot = { cert: no => `cert|${no}|issuer`, att: (sid, day) => (day ? `att|${sid}|day:${day}` : `att|${sid}|trainer`), prac: (sid, tid, role) => `prac|${sid}|${tid}|${role}`,
  doh: (sid, tid) => `doh|${sid}|${tid}|participant`, tbt: sid => `tbt|${sid}|trainer`, tbtP: (sid, tid) => `tbt|${sid}|${tid}|participant`, test: (sid, tid) => `test|${sid}|${tid}|grader`,
  ev: sid => `ev|${sid}|trainer`, fb: (sid, tid) => `fb|${sid}|${tid}|participant`, exam: sid => `exam|${sid}|trainer`,
  appr: (doc, sid, tid) => `${doc}|${sid}|${tid || '-'}|approver` };
/* documents an approver can countersign (each belongs to one candidate). Attendance, the trainer's evaluation, the training
   evaluation and the toolbox talk are signed only by the trainer / the candidates: no countersignature, no stamp. */
export const APPR_DOCS = { prac: true, doh: true, test: true };
/* who signs which document (account kind -> documents) */
const SIGNERS = { trainer: new Set(['att', 'ev', 'tbt', 'prac', 'test', 'exam']), trainee: new Set(['doh', 'fb', 'tbt', 'prac']) };

/* the signed-in person as a signer */
export async function signerOf(c, doc = '') {
  const u = c.user;
  // staff sign with their own name and surname (set in My account / Users); without a name they cannot sign
  if (u.kind === 'staff') { const s = (await c.D.get('staff', u.id)) || {}; if (!String(s.name || '').trim()) throw new H(409, 'needName'); return { kind: 'staff', id: u.id, name: s.name.trim(), title: String(s.title || '').trim() }; }
  if (u.kind === 'trainer' && SIGNERS.trainer.has(doc)) return { kind: 'trainer', id: c.me.id, name: S.fullAz(c.me, false), title: 'Təlimçi / Trainer' };
  // candidates sign their own documents (the route checks that it is their own)
  if (u.kind === 'trainee' && SIGNERS.trainee.has(doc)) return { kind: 'trainee', id: c.me.id, name: c.me.foreign ? S.fullEn(c.me, false) : S.fullAz(c.me, false), title: 'İştirakçı / Participant' };
  throw new H(403, 'forbidden');
}

/* What exactly is fingerprinted for each kind of document (the content that matters, not timestamps of saving). */
async function content(c, doc, ref) {
  if (doc === 'cert') { const x = await c.D.get('certs', ref.no) || (await c.D.get('archive', ref.no))?.cert; return x && { no: x.no, names: x.snap?.names, att: x.att, bid: x.bid, start: x.start, end: x.end, expiry: x.expiry }; }
  if (doc === 'att' && ref.day) {             // one day of a multi-day session: who was present / absent that day
    const s = await c.D.get('sessions', ref.sid); if (!s) return null;
    const rows = []; for (const tid of [...(s.traineeIds || [])].sort()) { const m = (await c.D.get('enr', `${s.id}|${tid}`))?.days?.[ref.day]; rows.push([tid, m?.absent ? 'A' : m?.at ? 'P' : '']); }
    return rows.some(r => r[1]) ? { sid: s.id, bid: s.bid, day: ref.day, tid: s.tid, rows } : null;
  }
  if (doc === 'att') {
    const s = await c.D.get('sessions', ref.sid); if (!s) return null;
    const rows = []; for (const tid of [...(s.traineeIds || [])].sort()) { const e = await c.D.get('enr', `${s.id}|${tid}`); rows.push([tid, e?.att || null]); }
    return { sid: s.id, bid: s.bid, date: s.date, endDate: s.endDate || '', tid: s.tid, rows };
  }
  if (doc === 'prac') { const e = await c.D.get('enr', `${ref.sid}|${ref.tid}`); if (!e?.prac) return null; const { at, by, ...p } = e.prac; return { sid: ref.sid, tid: ref.tid, prac: p }; }
  if (doc === 'doh') { const e = await c.D.get('enr', `${ref.sid}|${ref.tid}`); if (!e?.doh || e.doh.paper) return null; const { dob, company, answers, details } = e.doh; return { sid: ref.sid, tid: ref.tid, dob, company, answers, details }; }
  if (doc === 'tbt') { const s = await c.D.get('sessions', ref.sid); if (!s?.tbt) return null; const { at, by, sign, open, ...x } = s.tbt;
    if (!ref.tid) return { sid: s.id, tbt: x };
    const e = await c.D.get('enr', `${ref.sid}|${ref.tid}`); return e?.tbtAck ? { sid: s.id, tid: ref.tid, tbt: x } : null; }
  if (doc === 'fb' && ref.tid) { const e = await c.D.get('enr', `${ref.sid}|${ref.tid}`); if (!e?.fb) return null; const { at, by, ...x } = e.fb; return { sid: ref.sid, tid: ref.tid, fb: x }; }
  if (doc === 'exam') {                        // the session's exam results: every candidate's decision / online result
    const s = await c.D.get('sessions', ref.sid); if (!s) return null;
    const rows = []; for (const tid of [...(s.traineeIds || [])].sort()) { const e = await c.D.get('enr', `${s.id}|${tid}`); rows.push([tid, e?.exam ? { passed: e.exam.passed, score: e.exam.score ?? null } : null, e?.test?.status === 'graded' ? { pct: e.test.pct, passed: e.test.passed } : e?.test?.status || null]); }
    return rows.some(r => r[1] || r[2]) ? { sid: s.id, rows } : null;
  }
  if (doc === 'ev' || doc === 'fb') {        // trainer's evaluation of the group / the trainees' training evaluation
    const s = await c.D.get('sessions', ref.sid); if (!s) return null;
    const rows = []; for (const tid of [...(s.traineeIds || [])].sort()) { const e = await c.D.get('enr', `${s.id}|${tid}`); const v = e?.[doc]; if (v) { const { at, by, ...x } = v; rows.push([tid, x]); } }
    return rows.length ? { sid: s.id, doc, rows } : null;
  }
  if (doc === 'test') { const e = await c.D.get('enr', `${ref.sid}|${ref.tid}`); const x = e?.test; if (!x || x.status !== 'graded') return null; return { sid: ref.sid, tid: ref.tid, answers: x.answers, marks: x.marks, pct: x.pct, passed: x.passed }; }
  return null;
}
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x));
export const fingerprint = async (c, doc, ref) => { const x = await content(c, doc, ref); return x ? sha(canon(x)) : null; };

/* Signs a certificate. Only admin / superadmin (checked by the route), always under their own name.
   mode 'esign' = electronic signature stamp; mode 'image' = the signer's own uploaded signature image (+ the electronic record). */
export async function signCert(c, no, mode) {
  const x = await c.D.get('certs', no); if (!x) throw new H(404, 'noRec');
  if (x.revoked) throw new H(409, 'revoked');
  let img = '';
  if (mode === 'image') { const s = (await c.D.get('staff', c.user.id)) || /** @type {import('../../types/records').StaffRecord} */ ({}); if (!s.sigKey) throw new H(409, 'needSigImage'); img = s.sigKey; }
  else if (mode !== 'esign') throw new H(400, 'badInput');
  const pubRec = await sign(c, slot.cert(no), 'cert', { no }, 'issuer');
  x.sign = { ...pubRec, mode, img }; delete x.esign; delete x.sigId;     // the old company-wide signature image is no longer used for new signatures
  await c.D.put('certs', [{ id: no, data: x }]);
  // the holder (and their company) can now see / download it
  if (S.certDelivered(x)) { const tr = x.snap?.blank?.name || ''; await notify(c, 'trainee:' + x.tid, 'nCertReady', [no, tr]); if (x.co) await notify(c, 'company:' + x.co, 'nCoCertReady', [x.snap?.names?.az || x.snap?.names?.en || '', tr, no]); }
  return x;
}
export async function unsignCert(c, no) { const x = await c.D.get('certs', no); if (!x) return null; await unsign(c, [slot.cert(no)]); delete x.sign; delete x.esign; await c.D.put('certs', [{ id: no, data: x }]); return x; }

/* Creates (or renews) the signature in a slot and returns the public part { name, title, at, code }. */
export async function sign(c, id, doc, ref, role, { mode = 'esign' } = {}) {
  // staff (admin and up) do not sign session documents; only certificates (checked by the route) and approval countersignatures
  if (c.user?.kind === 'staff' && !(doc === 'cert' || role === 'approver')) throw new H(403, 'signNotYours');
  const hash = await fingerprint(c, doc, ref); if (!hash) throw new H(409, 'nothingToSign');
  const by = await signerOf(c, doc), at = new Date(c.now()).toISOString();
  let img = '';
  if (mode === 'image') { const st = (await c.D.get('staff', c.user.id)) || /** @type {import('../../types/records').StaffRecord} */ ({}); if (c.user.kind !== 'staff' || !st.sigKey) throw new H(409, 'needSigImage'); img = st.sigKey; }
  const raw = (await hmac(c.env.TOKEN_SECRET, `sign|${id}|${at}`)).slice(0, 8).toUpperCase(), code = raw.slice(0, 4) + '-' + raw.slice(4);
  const rec = { id, doc, ref, role, by, at, hash, code, ...(img ? { mode: 'image', img } : {}) };
  await c.D.put('signs', [{ id, data: rec }]);
  await audit(c, 'sign', `${doc} ${Object.values(ref).join(' ')} · ${role} · ${by.name} · ${code}`);
  return pub(rec);
}
export const pub = r => (r ? { name: r.by.name, title: r.by.title, at: r.at, code: r.code, role: r.role, ...(r.img ? { mode: 'image', img: r.img } : {}) } : null);
export async function unsign(c, ids) { const ex = []; for (const id of ids) if (await c.D.get('signs', id)) ex.push(id); if (ex.length) { await c.D.delMany('signs', ex); await audit(c, 'sign.withdrawn', ex.join(', ')); } }

/* All signatures of one session: { att, prac: { <tid>: { examiner, candidate } } } */
export async function sessionSigns(c, sid) {
  /** @type {any} */
  const out = { att: null, attDays: {}, ev: null, exam: null, tbt: null, tbtP: {}, fb: {}, prac: {}, doh: {}, test: {}, appr: { prac: {}, doh: {}, test: {} } };
  const kinds = ['att', 'ev', 'fb', 'prac', 'doh', 'tbt', 'test', 'exam'], lists = await Promise.all(kinds.map(k => c.D.prefix('signs', `${k}|${sid}|`)));   // all at once
  for (const list of lists) for (const { data: r } of list) {
    if (r.role === 'approver') { if (APPR_DOCS[r.doc]) out.appr[r.doc][r.ref.tid] = pub(r); continue; }     // older countersignatures of other documents are no longer shown
    if (r.doc === 'att') { if (r.ref.day) out.attDays[r.ref.day] = pub(r); else out.att = pub(r); }
    else if (r.doc === 'tbt') { if (r.ref.tid) out.tbtP[r.ref.tid] = pub(r); else out.tbt = pub(r); }
    else if (r.doc === 'ev' || r.doc === 'exam') { if (!r.ref.tid) out[r.doc] = pub(r); }
    else if (r.doc === 'fb') { if (r.ref.tid) out.fb[r.ref.tid] = pub(r); }
    else if (r.doc === 'prac') (out.prac[r.ref.tid] ||= {})[r.role] = pub(r); else if (out[r.doc]) out[r.doc][r.ref.tid] = pub(r);
  }
  return out;
}

/* Public check of a printed code. */
export async function checkCode(c, code) {
  const k = String(code || '').toUpperCase().replace(/[^A-F0-9]/g, ''); if (k.length !== 8) return null;
  const r = (await c.D.byField('signs', 'code', k.slice(0, 4) + '-' + k.slice(4)))[0]?.data; if (!r) return null;
  const now = await fingerprint(c, r.doc, r.ref);
  let status = now === r.hash ? 'VALID' : 'CHANGED';
  if (r.doc === 'cert') { const x = await c.D.get('certs', r.ref.no); if (!x) status = 'WITHDRAWN'; else if (x.revoked) status = 'REVOKED'; }
  return { doc: r.doc, role: r.role, name: r.by.name, title: r.by.title, at: r.at, code: r.code, status, ref: r.doc === 'cert' ? r.ref.no : '' };
}
