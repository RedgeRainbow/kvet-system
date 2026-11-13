/* Staff routes: companies, trainers, trainees (+ batch import) and portal credentials. */
import { H, S, str, need, bool, uid, audit, diff, traineeOut, trainerOut, stripSecret } from './core.js';
import { claimLogin, genPassword, candidatePassword, pbk, rnd, loginKey, wideKey } from './auth.js';
import { tempId, nextAtts, attFree } from './identity.js';
import { unsign, slot } from './signs.js';

export const DOC_TYPES = ['id', 'passport', 'residence', 'other'];

/* ------------------------------------------------------------ credentials */
async function newCreds(c, role, wanted, id) {
  const login = await claimLogin(c.D, role, wanted, id), password = role === 'trainee' ? candidatePassword() : genPassword(), salt = rnd(16);
  return { login, password, salt, hash: await pbk(password, salt), pv: 0 };
}
async function resetCreds(acc, kind) { const password = kind === 'trainee' ? candidatePassword() : genPassword(); acc.salt = rnd(16); acc.hash = await pbk(password, acc.salt); delete acc.it; delete acc.pwAt; acc.pv = (acc.pv || 0) + 1; return password; }   // pwAt gone: a generated password again (settings.forcePw)
const COL = { trainee: 'trainees', trainer: 'trainers', company: 'companies' };

/* -------------------------------------------------------------- person form */
export function readPerson(b, { foreignAllowed = true, finOptional = false, phoneRequired = false } = {}) {
  const p = {
    name: S.cleanName(str(b.name, 60)), surname: S.cleanName(str(b.surname, 60)), father: S.cleanName(str(b.father, 60)),
    nameEn: S.cleanName(str(b.nameEn, 60)), surnameEn: S.cleanName(str(b.surnameEn, 60)), fatherEn: S.cleanName(str(b.fatherEn, 60)),
    foreign: foreignAllowed && bool(b.foreign), fin: S.normFin(b.fin), phone: S.normPhone(b.phone), email: str(b.email, 120).toLowerCase(),
  };
  need(p.name && p.surname, 'badName');
  if (!p.nameEn) p.nameEn = p.foreign ? p.name : S.transliterateAzToEn(p.name);
  if (!p.surnameEn) p.surnameEn = p.foreign ? p.surname : S.transliterateAzToEn(p.surname);
  if (!p.fatherEn && p.father) p.fatherEn = p.foreign ? p.father : S.transliterateAzToEn(p.father);
  need((finOptional && !p.fin) || S.goodFin(p.fin, p.foreign), 'badId');
  if (foreignAllowed) {
    // foreign candidates: which document the number comes from, nationality and the certificate language
    p.docType = DOC_TYPES.includes(b.docType) ? b.docType : p.foreign ? 'passport' : 'id';
    p.nationality = p.foreign ? str(b.nationality, 60) : '';
    p.certLang = p.foreign && b.certLang === 'en' ? 'en' : 'both';
  }
  need(!phoneRequired || p.phone, 'needPhone');
  need(!p.phone || S.goodPhone(p.phone), 'badPhone');
  need(S.goodEmail(p.email), 'badEmail');
  return p;
}

/* reveal = the caller may see who already holds this ID/FIN (staff with fin.view only). Everyone else just learns "already registered". */
export async function claimFin(D, fin, id, reveal = false) {
  try { await D.insert('fins', fin, { id, at: new Date().toISOString() }); }
  catch (/** @type {any} */ e) {
    if (e instanceof H && e.message === 'dup') {
      const ex = await D.get('fins', fin), t = ex && await D.get('trainees', ex.id);
      // a claim that belongs to nobody (a registration that failed half-way, or a person deleted by hand): taken over, unless
      // it was made within the last minute (a registration of that person may be on its way right now)
      if (!t && !(ex?.at && Date.now() - Date.parse(ex.at) < 60e3)) { await D.put('fins', [{ id: fin, data: { id, at: new Date().toISOString() } }]); return; }
      if (!reveal) throw new H(409, 'dupFin');
      throw new H(409, 'dupFin', { existing: t ? { id: t.id, att: t.att, name: S.fullAz(t) } : null });
    }
    throw e;
  }
}
const canSeeFin = c => c.user?.kind === 'staff' && S.can(c.user.role, 'fin.view');
const consentOf = (c, b) => (b.consent ? { at: new Date(c.now()).toISOString(), by: c.user?.email || c.user?.name || '' } : null);
async function companyId(D, v) {
  const id = str(v, 60); if (!id) return '';
  need(await D.get('companies', id), 'badCompany'); return id;
}

/* people already registered with exactly the same name, surname and father's name (accents / ə ignored). Without an ID/FIN the
   system cannot tell them apart, so the office is warned before a second account is made (it may still go ahead). */
export async function sameNamePeople(c, p, exceptId = '') {
  const f = x => S.foldText(x || '').trim().replace(/\s+/g, ' '), key = [p.name, p.surname, p.father].map(f).join('|');
  if (!f(p.name) || !f(p.surname)) return [];
  const { rows } = await c.D.query('trainees', { search: [p.name, p.surname, p.father].filter(Boolean).join(' '), limit: 50 });
  return rows.map(r => r.data).filter(t => t.id !== exceptId && [t.name, t.surname, t.father].map(f).join('|') === key)
    .map(t => ({ id: t.id, att: t.att || '', login: t.login, temp: !!t.temp, name: S.fullAz(t), createdAt: t.createdAt || '' }));
}

/* ID/FIN and phone: optional when the office (admin / superadmin) registers someone (the trainee then gives them at the first
   sign-in), compulsory when a trainer adds a candidate or a company sends one. */
export async function createTrainee(c, b, { strict = c.user?.kind !== 'staff' } = {}) {
  const p = readPerson(b, { finOptional: !strict, phoneRequired: strict }), co = await companyId(c.D, b.co);
  const st = (await c.D.get('settings', 'main')) || {};
  need(!st.privacy?.consentRequired || b.consent, 'needConsent');
  // no ID/FIN: warn about people with the very same name (the office confirms with sameNameOk to go ahead)
  let sameName = 0;
  if (!p.fin) { const same = await sameNamePeople(c, p); sameName = same.length; if (same.length && !bool(b.sameNameOk)) throw new H(409, 'sameName', { people: same.slice(0, 10) }); }
  // without FIN or phone: a temporary account (no learner number yet); the candidate completes it at the first sign-in
  if (!p.fin || !p.phone) {
    const id = tempId(); if (p.fin) await claimFin(c.D, p.fin, id, canSeeFin(c));
    try {
      const cred = await newCreds(c, 'trainee', id, id);
      const t = { id, att: '', temp: true, ...p, co, on: true, consent: consentOf(c, b), createdAt: new Date(c.now()).toISOString(), createdBy: { kind: c.user?.kind || 'staff', name: c.user?.name || c.user?.email || '' }, login: cred.login, salt: cred.salt, hash: cred.hash, pv: 0 };
      await c.D.put('trainees', [{ id, data: t }]);
      return { t, password: cred.password, sameName };
    } catch (e) { if (p.fin) await releaseFin(c.D, p.fin, id); throw e; }
  }
  const [att] = await nextAtts(c);
  if (p.fin) await claimFin(c.D, p.fin, att, canSeeFin(c));
  try {
    const cred = await newCreds(c, 'trainee', att, att);
    const t = { id: att, att, ...p, co, on: true, consent: consentOf(c, b), createdAt: new Date(c.now()).toISOString(), createdBy: { kind: c.user?.kind || 'staff', name: c.user?.name || c.user?.email || '' }, login: cred.login, salt: cred.salt, hash: cred.hash, pv: 0 };
    await c.D.put('trainees', [{ id: att, data: t }]);
    return { t, password: cred.password };
  } catch (e) { if (p.fin) await releaseFin(c.D, p.fin, att); throw e; }
}
/* the registration failed after its ID/FIN was claimed: the claim is given back (only if it is still this one) */
export async function releaseFin(D, fin, id) { try { const ex = await D.get('fins', fin); if (ex?.id === id) await D.del('fins', fin); } catch {} }
/* Rebuilds the ID/FIN register from the people themselves (System -> repair): claims of nobody are removed, missing ones added. */
export async function rebuildFins(c) {
  const [fins, people] = await Promise.all([c.D.all('fins'), c.D.query('trainees', { where: [['fin', 'empty', false]], fields: ['fin'] })]);
  const want = new Map(), dup = []; for (const r of people.rows) { if (want.has(r.data.fin)) dup.push(r.data.fin); else want.set(r.data.fin, r.id); }
  const have = new Map(fins.map(r => [r.id, r.data?.id])), fresh = new Date(c.now() - 60e3).toISOString();
  const drop = fins.filter(r => !want.has(r.id) && !(r.data?.at > fresh)).map(r => r.id), add = [...want].filter(([fin, id]) => have.get(fin) !== id && !dup.includes(fin));
  if (drop.length) await c.D.delMany('fins', drop);
  if (add.length) await c.D.put('fins', add.map(([fin, id]) => ({ id: fin, data: { id, at: new Date(c.now()).toISOString() } })));
  return { removed: drop.length, added: add.length, shared: [...new Set(dup)].length };
}

/** @type {import('../../types/store').Routes} */
export const peopleRoutes = {
  /* ------------------------------------------------------------ companies */
  'POST /company/save': { auth: 'staff', act: 'company.save', async fn(c) {
    const b = await c.body(); let x;
    const f = {
      name: str(b.name, 120), contactPerson: str(b.contactPerson, 120), contractNo: str(b.contractNo, 60), contractDate: str(b.contractDate, 10),
      phone: S.normPhone(b.phone), email: str(b.email, 120).toLowerCase(), address: str(b.address, 250), taxId: str(b.taxId, 30), notes: str(b.notes, 1000), on: b.on !== false,
      reqOptional: bool(b.reqOptional),   // the centre may let this company register candidates without ID/FIN and phone
    };
    need(f.name, 'badInput'); need(!f.contractDate || S.isDate(f.contractDate), 'badInput'); need(!f.phone || S.goodPhone(f.phone), 'badPhone'); need(S.goodEmail(f.email), 'badEmail');
    if (b.id) { x = await c.D.get('companies', str(b.id, 60)); need(x, 'noRec', 404); const was = { ...x }; Object.assign(x, f); await c.D.put('companies', [{ id: x.id, data: x }]); await audit(c, 'company.update', x.name, { entity: { kind: 'company', id: x.id, label: x.name }, changes: diff(was, x, Object.keys(f)) }); return { company: stripSecret(x) }; }
    const id = uid('c');
    const cred = await newCreds(c, 'company', S.loginSlug(f.name).slice(0, 16) || 'co', id);
    x = { id, ...f, login: cred.login, salt: cred.salt, hash: cred.hash, pv: 0, createdAt: new Date(c.now()).toISOString() };
    await c.D.put('companies', [{ id, data: x }]); await audit(c, 'company.create', x.name, { entity: { kind: 'company', id, label: x.name } });
    return { company: stripSecret(x), creds: { login: cred.login, password: cred.password } };
  } },

  /* ------------------------------------------------------------- trainers */
  'POST /trainer/save': { auth: 'staff', act: 'trainer.save', async fn(c) {
    const b = await c.body(), p = readPerson(b, { foreignAllowed: false });
    const extra = { specialty: str(b.specialty, 160), on: b.on !== false };
    if (b.id) { const x = await c.D.get('trainers', str(b.id, 60)); need(x, 'noRec', 404); const was = { ...x }; Object.assign(x, p, extra); await c.D.put('trainers', [{ id: x.id, data: x }]); await audit(c, 'trainer.update', S.fullAz(x), { entity: { kind: 'trainer', id: x.id, label: S.fullAz(x) }, changes: diff(was, x, [...Object.keys(p), ...Object.keys(extra)]) }); return { trainer: trainerOut(x, true) }; }
    const id = uid('t'), cred = await newCreds(c, 'trainer', 'trainer_' + S.loginSlug(p.nameEn || p.name), id);
    const x = { id, ...p, ...extra, login: cred.login, salt: cred.salt, hash: cred.hash, pv: 0, createdAt: new Date(c.now()).toISOString() };
    await c.D.put('trainers', [{ id, data: x }]); await audit(c, 'trainer.create', S.fullAz(x), { entity: { kind: 'trainer', id, label: S.fullAz(x) } });
    return { trainer: trainerOut(x, true), creds: { login: cred.login, password: cred.password } };
  } },

  /* ------------------------------------------------------------- trainees */
  /* Change a candidate's learner (attendance) number, e.g. to the one they had in an earlier year.
     The record keeps its key, so sessions, results, signatures and certificates stay attached. The sign-in name follows the
     number when it was the number. Certificates keep the number printed on them unless "certs" is asked for: then their
     copies change too, and a signed one has to be signed again (its content changed). */
  'POST /trainee/att': { auth: 'staff', act: 'trainee.att', async fn(c) {
    const b = await c.body(), x = await c.D.get('trainees', str(b.id, 60)); need(x, 'noRec', 404); need(!x.temp, 'tempAccount', 409);
    const att = str(b.att, 40).trim().toUpperCase(); need(/^[A-Z0-9][A-Z0-9._/-]{2,39}$/.test(att), 'badAttNo');
    const old = x.att || '';
    if (att === old) return { trainee: traineeOut(x, true), certs: 0, unsigned: 0 };
    need(await attFree(c.D, att, x.id), 'attTaken', 409);
    // the sign-in name follows the number (only when it was the number; a name chosen by hand stays)
    let login = x.login;
    if (String(x.login || '').toLowerCase() === old.toLowerCase()) {
      try { await c.D.insert('logins', loginKey('trainee', att), { login: att, id: x.id }); login = att; await c.D.del('logins', loginKey('trainee', old)); }
      catch (/** @type {any} */ e) { if (!(e instanceof H) || e.message !== 'dup') throw e; }    // that sign-in name is taken: keep the old one
    }
    x.att = att; x.login = login; x.attWas = [...new Set([...(x.attWas || []), old].filter(Boolean))].slice(-5);
    await c.D.put('trainees', [{ id: x.id, data: x }]);
    let certs = 0, unsigned = 0;
    if (b.certs) {
      const list = (await c.D.byField('certs', 'tid', x.id)).map(r => r.data).filter(k => (k.snap?.att || k.att) !== att);
      for (const k of list) { if (k.sign || k.esign) { unsigned++; delete k.sign; delete k.esign; } k.att = att; if (k.snap) k.snap.att = att; }
      if (list.length) { await c.D.put('certs', list.map(k => ({ id: k.no, data: k }))); await unsign(c, list.map(k => slot.cert(k.no))); }
      certs = list.length;
    }
    await audit(c, 'trainee.renumber', `${old || '—'} → ${att} ${S.fullAz(x)}${certs ? ` · ${certs} certificate(s)` : ''}`, { entity: { kind: 'trainee', id: x.id, label: `${att} ${S.fullAz(x)}` }, changes: [{ f: 'att', from: old, to: att }] });
    return { trainee: traineeOut(x, true), certs, unsigned, login };
  } },
  'POST /trainee/save': { auth: 'staff', act: 'trainee.save', async fn(c) {
    const b = await c.body();
    if (!b.id) { const { t, password } = await createTrainee(c, b); await audit(c, 'trainee.create', `${t.att} ${S.fullAz(t)}`, { entity: { kind: 'trainee', id: t.id, label: `${t.att} ${S.fullAz(t)}` } }); return { trainee: traineeOut(t, true), creds: { login: t.login, password } }; }
    const x = await c.D.get('trainees', str(b.id, 60)); need(x, 'noRec', 404);
    const p = readPerson(b, { finOptional: true }), co = await companyId(c.D, b.co);
    if (p.fin && p.fin !== x.fin) { await claimFin(c.D, p.fin, x.id, true); if (x.fin) await c.D.del('fins', x.fin); delete x.finRemovedAt; }
    if (!p.fin) p.fin = x.fin || '';
    const was = { ...x }; Object.assign(x, p, { co, on: b.on !== false });
    if (b.consent && !x.consent) x.consent = consentOf(c, b); else if (b.consent === false) x.consent = null;
    await c.D.put('trainees', [{ id: x.id, data: x }]); await audit(c, 'trainee.update', `${x.att} ${S.fullAz(x)}`, { entity: { kind: 'trainee', id: x.id, label: `${x.att} ${S.fullAz(x)}` }, changes: diff(was, x, [...Object.keys(p), 'co', 'on']) });
    return { trainee: traineeOut(x, true) };
  } },

  /* Batch registration from the Excel form. The browser sends at most 100 rows per request (Workers have a CPU and
     sub-request budget); learner numbers, ID/FIN claims, logins and the people themselves are written in a few bulk requests. */
  'POST /trainee/import': { auth: 'staff', act: 'trainee.import', async fn(c) {
    const b = await c.body(), rows = Array.isArray(b.rows) ? b.rows.slice(0, 300) : [];
    need(rows.length, 'badInput');
    // a part sent again (the answer was lost on the way): the first run's results are returned, nobody is created twice.
    // Passwords are never stored, so those rows say the password must be reset (login cards).
    const pk = /^[a-z0-9]{8,40}$/.test(String(b.pk || '')) ? 'imp|' + b.pk : '';
    if (pk) { const done = await c.D.get('importres', pk); if (done) return { results: done.results.map(r => (r.status === 'created' ? { ...r, password: '', pwLost: true } : r)), repeated: true }; }
    const st = (await c.D.get('settings', 'main')) || {};
    const cos = (await c.D.all('companies')).map(r => r.data), byName = new Map(cos.map(x => [x.name.trim().toLowerCase(), x.id]));
    const seen = new Set(), out = [], ok = [];
    for (const [i, r] of rows.entries()) {
      const row = { row: r.row ?? i + 2 };
      try {
        const p = readPerson(r, { finOptional: true });
        if (p.fin) { if (seen.has(p.fin)) throw new H(409, 'dupInFile'); seen.add(p.fin); }
        let co = ''; const cname = str(r.company, 120);
        if (cname && !S.isPrivateCompany(cname, 'x')) { co = byName.get(cname.toLowerCase()) || ''; if (!co) throw new H(400, 'badCompany'); }
        if (st.privacy?.consentRequired && !bool(r.consent)) throw new H(400, 'needConsent');
        ok.push({ row, p, co, cname, consent: bool(r.consent) });
      } catch (/** @type {any} */ e) { if (!(e instanceof H)) throw e; out.push({ ...row, status: 'error', error: e.message }); }
    }
    // rows without ID/FIN: temporary accounts, made together (a handful of database calls for the whole batch, not several per
    // person - large imports otherwise exceed the platform's per-request limits). Same names (already registered, or twice in the
    // file) are reported, not refused.
    const noFin = ok.filter(k => !k.p.fin);
    if (noFin.length) {
      const f = x => S.foldText(x || '').trim().replace(/\s+/g, ' '), key = p => [p.name, p.surname, p.father].map(f).join('|');
      const cap = w => w.charAt(0).toLocaleUpperCase('az') + w.slice(1).toLocaleLowerCase('az');
      const sur = [...new Set(noFin.flatMap(k => [k.p.surname, k.p.surname.toLocaleUpperCase('az'), k.p.surname.toLocaleLowerCase('az'), cap(k.p.surname)]))];
      const known = new Map();
      for (let i = 0; i < sur.length; i += 200) for (const r of (await c.D.query('trainees', { where: [['surname', 'in', sur.slice(i, i + 200)]], limit: 5000, fields: ['name', 'surname', 'father'] })).rows) { const k = key(r.data); known.set(k, (known.get(k) || 0) + 1); }
      const inFile = new Map(); for (const k of noFin) inFile.set(key(k.p), (inFile.get(key(k.p)) || 0) + 1);
      const now = new Date(c.now()).toISOString(), made = noFin.map(x => ({ x, id: tempId() }));
      const claimed = new Set(await c.D.insertMany('logins', made.map(m => ({ id: loginKey('trainee', m.id), data: { login: m.id, id: m.id } }))));
      const people = [];
      for (const m of made) {
        const login = claimed.has(loginKey('trainee', m.id)) ? m.id : await claimLogin(c.D, 'trainee', m.id, m.id), password = candidatePassword(), salt = rnd(16);
        const t = { id: m.id, att: '', temp: true, ...m.x.p, co: m.x.co, on: true, consent: m.x.consent ? { at: now, by: c.user.email } : null, createdAt: now, createdBy: { kind: 'staff', name: c.user?.email || '' }, login, salt, hash: await pbk(password, salt), pv: 0 };
        people.push({ id: m.id, data: t });
        const same = (known.get(key(m.x.p)) || 0) + (inFile.get(key(m.x.p)) || 1) - 1;
        out.push({ ...m.x.row, status: 'created', temp: true, id: t.id, att: '', name: S.fullAz(t), company: m.x.cname, login, password, ...(same ? { sameName: same } : {}) });
      }
      await c.D.put('trainees', people);
    }
    // rows with an ID/FIN but no phone: temporary accounts that keep their ID/FIN (one by one: the ID/FIN is claimed)
    for (const x of ok.filter(k => k.p.fin && !k.p.phone)) {
      try { const { t, password, sameName } = await createTrainee(c, { ...x.p, co: x.co, consent: x.consent, sameNameOk: true });   // the import reports same names instead of stopping
        out.push({ ...x.row, status: 'created', temp: true, id: t.id, att: '', name: S.fullAz(t), company: x.cname, login: t.login, password, ...(sameName ? { sameName } : {}) }); }
      catch (/** @type {any} */ e) { if (!(e instanceof H)) throw e; out.push({ ...x.row, status: e.message === 'dupFin' ? 'exists' : 'error', error: e.message, existing: e.extra?.existing || null }); }
    }
    ok.splice(0, ok.length, ...ok.filter(k => k.p.fin && k.p.phone));
    if (ok.length) {
      const atts = await nextAtts(c, ok.length), now = new Date(c.now()).toISOString();
      ok.forEach((x, i) => (x.att = atts[i]));
      const claimed = new Set(await c.D.insertMany('fins', ok.filter(x => x.p.fin).map(x => ({ id: x.p.fin, data: { id: x.att, at: now } }))));
      const fresh = ok.filter(x => !x.p.fin || claimed.has(x.p.fin));
      for (const x of ok) if (x.p.fin && !claimed.has(x.p.fin)) {
        const ex = await c.D.get('fins', x.p.fin), t = ex && await c.D.get('trainees', ex.id);
        out.push({ ...x.row, status: 'exists', error: 'dupFin', existing: t ? { id: t.id, att: t.att, name: S.fullAz(t) } : null });
      }
      const logins = new Set(await c.D.insertMany('logins', fresh.map(x => ({ id: loginKey('trainee', x.att), data: { login: x.att, id: x.att } }))));
      const people = [];
      for (const x of fresh) {
        const password = candidatePassword(), salt = rnd(16), login = logins.has(loginKey('trainee', x.att)) ? x.att : await claimLogin(c.D, 'trainee', x.att, x.att);
        const t = { id: x.att, att: x.att, ...x.p, co: x.co, on: true, consent: x.consent ? { at: now, by: c.user.email } : null, createdAt: now, login, salt, hash: await pbk(password, salt), pv: 0 };
        people.push({ id: t.id, data: t });
        out.push({ ...x.row, status: 'created', id: t.id, att: t.att, name: S.fullAz(t), company: x.cname, login, password });
      }
      await c.D.put('trainees', people);
    }
    out.sort((a, b) => a.row - b.row);
    await audit(c, 'trainee.import', `${out.filter(x => x.status === 'created').length}/${rows.length}`);
    if (pk) await c.D.put('importres', [{ id: pk, data: { at: new Date(c.now()).toISOString(), results: out.map(({ password, ...r }) => r) } }]);
    return { results: out };
  } },

  /* New one-time passwords (shown once). Also invalidates the person's open portal sessions. */
  'POST /credentials/reset': { auth: 'staff', act: 'credentials.reset', async fn(c) {
    const b = await c.body(), col = COL[b.kind], ids = [...new Set((b.ids || []).map(x => str(x, 60)))].slice(0, 500);
    need(col && ids.length, 'badInput');
    const out = [];
    for (const id of ids) {
      const x = await c.D.get(col, id); if (!x) continue;
      const password = await resetCreds(x, b.kind); await c.D.put(col, [{ id, data: x }]);
      await c.D.lockOk(loginKey(b.kind, x.login)); await c.D.lockOk(wideKey(loginKey(b.kind, x.login)));
      out.push({ id, name: b.kind === 'company' ? x.name : S.fullAz(x), att: x.att, login: x.login, password });
    }
    await audit(c, 'credentials.reset', `${b.kind} x${out.length}: ${out.map(o => o.login).slice(0, 8).join(', ')}`, { entity: out.length === 1 ? { kind: b.kind, id: out[0].id, label: out[0].name } : undefined });
    return { list: out };
  } },
};
