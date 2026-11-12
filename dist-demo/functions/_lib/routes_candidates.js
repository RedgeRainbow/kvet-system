/* New candidates sent by a company (only for that company). They are registered as trainees only after the superadmin,
   an admin or an approver confirms them (approval queue). ID/FIN and phone are compulsory here.
   col "candreq": { id, co, coName, person, consent, status: pending | approved | returned, at, by, review, traineeId } */
import { H, S, str, need, bool, uid, audit, getSettings } from './core.js';
import { readPerson, createTrainee, sameNamePeople } from './routes_people.js';
import { notify, doneNotes } from './routes_notify.js';

const mask = fin => (fin ? '•••••' + String(fin).slice(-2) : '');
const out = (x, fin) => ({ ...x, person: { ...x.person, fin: fin ? x.person.fin : mask(x.person.fin) } });
async function dupFinChecks(c, fin) {
  need(!(await c.D.get('fins', fin)), 'finRegistered', 409);                       // already a trainee: the centre adds them to a session
  const open = (await c.D.query('candreq', { where: [['status', 'eq', 'pending'], ['person.fin', 'eq', fin]], limit: 1 })).rows[0]; need(!open, 'dupRequest', 409);
}

/** @type {import('../../types/store').Routes} */
export const candidateRoutes = {
  'POST /portal/company/candidate': { auth: 'company', async fn(c) {
    const b = await c.body(), co = c.me, strict = !co.reqOptional;               // ID/FIN + phone required, unless the centre made them optional for this company
    const p = readPerson(b, { finOptional: !strict, phoneRequired: strict });
    const st = await getSettings(c.D); need(!st.privacy?.consentRequired || bool(b.consent), 'needConsent');
    if (p.fin) { await dupFinChecks(c, p.fin); }
    const x = { id: uid('cr'), co: co.id, coName: co.name, person: p, consent: bool(b.consent), status: 'pending', at: new Date(c.now()).toISOString(), by: co.contactPerson || co.name };
    await c.D.put('candreq', [{ id: x.id, data: x }]); await audit(c, 'candidate.request', `${co.name} · ${S.fullAz(p)}`);
    await notify(c, 'staff:a:cand.approve', 'nCandNew', [co.name, S.fullAz(p)], '#/approvals', 'candreq:' + x.id);
    return { request: out(x, false) };
  } },
  /* batch registration from the Excel form (same template as the office; FIN + phone required unless the company is set optional) */
  'POST /portal/company/candidates/import': { auth: 'company', async fn(c) {
    const b = await c.body(), co = c.me, rows = Array.isArray(b.rows) ? b.rows.slice(0, 100) : []; need(rows.length, 'badInput');
    const strict = !co.reqOptional, st = await getSettings(c.D);
    const pending = (await c.D.byField('candreq', 'co', co.id)).map(r => r.data).filter(x => x.status === 'pending' && x.person.fin);
    const openFins = new Set(pending.map(x => x.person.fin)), seen = new Set(), out1 = [], mk = [];
    for (const [i, r] of rows.entries()) {
      const row = { row: r.row ?? i + 2 };
      try {
        const p = readPerson(r, { finOptional: !strict, phoneRequired: strict });
        if (p.fin) {
          if (seen.has(p.fin)) throw new H(409, 'dupInFile'); seen.add(p.fin);
          if (await c.D.get('fins', p.fin)) throw new H(409, 'finRegistered');
          if (openFins.has(p.fin)) throw new H(409, 'dupRequest');
        }
        if (st.privacy?.consentRequired && !bool(r.consent)) throw new H(400, 'needConsent');
        mk.push({ row, person: p, consent: bool(r.consent) });
      } catch (/** @type {any} */ e) { if (!(e instanceof H)) throw e; out1.push({ ...row, status: 'error', error: e.message }); }
    }
    const put = [];
    for (const x of mk) { const rec = { id: uid('cr'), co: co.id, coName: co.name, person: x.person, consent: x.consent, status: 'pending', at: new Date(c.now()).toISOString(), by: co.contactPerson || co.name };
      put.push({ id: rec.id, data: rec }); out1.push({ ...x.row, status: 'queued', name: S.fullAz(x.person) }); }
    if (put.length) await c.D.put('candreq', put);
    out1.sort((a, b) => a.row - b.row); await audit(c, 'candidate.request', `${co.name} · Excel ${put.length}/${rows.length}`);
    return { results: out1 };
  } },
  'GET /portal/company/candidates': { auth: 'company', async fn(c) {
    return { list: (await c.D.byField('candreq', 'co', c.me.id)).map(r => out(r.data, false)).sort((a, b) => b.at.localeCompare(a.at)) };
  } },
  'POST /portal/company/candidate/cancel': { auth: 'company', async fn(c) {
    const b = await c.body(), x = await c.D.get('candreq', str(b.id, 60)); need(x && x.co === c.me.id && x.status === 'pending', 'noRec', 404);
    await c.D.del('candreq', x.id); await audit(c, 'candidate.cancel', `${c.me.name} · ${S.fullAz(x.person)}`); return { ok: 1 };
  } },
};

/* approval queue part (GET /approvals, POST /approval/decide kind "cand") */
export async function pendingCandidates(c) {
  const fin = S.can(c.user.role, 'fin.view');
  const list = (await c.D.query('candreq', { where: [['status', 'eq', 'pending']] })).rows.map(r => r.data);
  // a candidate without ID/FIN whose name already exists: shown to the approver
  const same = await Promise.all(list.map(x => (x.person?.fin ? [] : sameNamePeople(c, x.person))));
  return list.map((x, i) => ({ ...out(x, fin), ...(same[i].length ? { sameName: same[i].map(p => ({ att: p.att || p.login, name: p.name })) } : {}) })).sort((a, b) => a.at.localeCompare(b.at));
}
export async function decideCandidate(c, id, ok, review) {
  need(S.can(c.user.role, 'cand.approve'), 'forbidden', 403);
  const x = await c.D.get('candreq', str(id, 60)); need(x && x.status === 'pending', 'noRec', 404);
  /** @type {any} */ let created = null;
  if (ok) {
    need(await c.D.get('companies', x.co), 'badCompany');
    created = await createTrainee(c, { ...x.person, co: x.co, consent: x.consent, sameNameOk: true }, { strict: false });   // the approval list showed same names
    x.traineeId = created.t.id;
  }
  x.status = ok ? 'approved' : 'returned'; x.review = review;
  await c.D.put('candreq', [{ id: x.id, data: x }]);
  await doneNotes(c, 'candreq:' + x.id);
  await notify(c, 'company:' + x.co, ok ? 'nCandOk' : 'nCandRet', [S.fullAz(x.person), review.note || ''], 'cands');
  await audit(c, ok ? 'candidate.approve' : 'candidate.return', `${x.coName} · ${S.fullAz(x.person)}${created ? ' → ' + created.t.att : ''}${review.note ? ' · ' + review.note : ''}`);
  return { request: out(x, S.can(c.user.role, 'fin.view')), ...(created ? { trainee: { id: created.t.id, att: created.t.att, name: S.fullAz(created.t) }, creds: { login: created.t.login, password: created.password } } : {}) };
}
