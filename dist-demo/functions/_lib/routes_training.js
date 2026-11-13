/* Staff routes: blanks, practical sheets, materials, sessions, results, certificate release, certificates. */
import { H, S, J, str, num, need, bool, uid, httpUrl, audit, diff, getSettings, buildSnap, enrOf, saveEnr, enrsOfSession, sessionRow, enrId, getMany, daysBefore, RECENT_DAYS } from './core.js';
import { rnd } from './auth.js';
import { confirmFor, savePractical, loadEnrolled, loadSession, rollCall, openDocs } from './ops.js';
import { vh } from './routes_public.js';
import { notify } from './routes_notify.js';
import { sign, unsign, slot, sessionSigns, signCert, unsignCert, APPR_DOCS } from './signs.js';
import { poolSize } from './routes_tests.js';
import { strip, clean } from './routes_find.js';
import { certSt } from './search.js';

/* ------------------------------------------------------------------ blanks */
function readBlank(b) {
  const x = {
    name: str(b.name, 100), prefix: str(b.prefix, 12).toUpperCase().replace(/[^A-Z0-9]/g, ''), months: num(b.months, 0, 240, 24), credits: num(b.credits, 0, 99, 0),
    provider: str(b.provider, 160), titleAz: str(b.titleAz, 120), titleEn: str(b.titleEn, 120), qualAz: str(b.qualAz, 160), qualEn: str(b.qualEn, 160),
    descAz: str(b.descAz, 1200), descEn: str(b.descEn, 1200), footAz: str(b.footAz, 500), footEn: str(b.footEn, 500),
    defaultSheetId: str(b.defaultSheetId, 60), category: str(b.category, 60), note: str(b.note, 300), labels: S.cleanLabels(b.labels),
  };
  need(x.name && x.titleAz && x.titleEn, 'badInput');
  return x;
}

/* certificate lines of a session -> a certificate snapshot */
function applyLines(snap, s) {
  const coMode = s.coMode || snap.coMode || (snap.showCo ? 'show' : 'hide');
  Object.assign(snap, { details: s.certDetails || '', reg: s.certReg || '', coMode, coText: s.coText || '', showCo: coMode === 'show' });
}
async function certLinesBehind(c, s) {
  const certs = (await c.D.query('certs', { where: [['sid', 'eq', s.id], ['revoked', 'null', true]] })).rows.map(r => r.data);
  return certs.filter(x => { const t = structuredClone(x.snap || {}); applyLines(t, s); return ['details', 'reg', 'coMode', 'coText'].some(k => (t[k] || '') !== (x.snap?.[k] || '')); });
}

/* ------------------------------------------------------------------ sheets */
const idList = (arr, p) => { const seen = new Set(); return (arr || []).map((x, i) => { let id = str(x.id, 20) || p + (i + 1); while (seen.has(id)) id += 'x'; seen.add(id); return { ...x, id }; }); };
function readSheet(b) {
  const mode = S.SHEET_MODES.includes(b.mode) ? b.mode : null; need(mode && str(b.name, 140), 'badInput');
  const sections = idList(b.sections, 's').slice(0, 30).map(s => ({ id: s.id, title: str(s.title, 120), ...(mode === 'penalty' && bool(s.col2) ? { col2: true } : {}),
    items: idList(s.items, 'i' + s.id + '_').slice(0, 80).map(it => ({ id: it.id, text: str(it.text, 240), ...(mode === 'penalty' ? { penalty: str(it.penalty, 8) || '3' } : {}) })) }));
  need(sections.some(s => s.items.length) && sections.every(s => s.items.every(i => i.text)), 'badInput');
  const rule = mode === 'penalty' ? { maxPenalty: num(b.rule?.maxPenalty, 0, 9999, 40) } : mode === 'rating' ? { minAvg: num(b.rule?.minAvg, 1, 5, 3), failBelow: num(b.rule?.failBelow, 1, 5, 2) } : {};
  return { name: str(b.name, 140), mode, title: str(b.title, 120), subtitle: str(b.subtitle, 120), note: str(b.note, 600), disqNote: str(b.disqNote, 200), sections, rule, timePenalty: mode === 'penalty' && bool(b.timePenalty),
    headerFields: idList(b.headerFields, 'h').slice(0, 24).map(h => ({ id: h.id, label: str(h.label, 60), type: S.HEADER_TYPES.includes(h.type) ? h.type : 'text', auto: S.HEADER_AUTO.includes(h.auto) ? h.auto : '', group: str(h.group, 40) })).filter(h => h.label),
    ...(mode === 'penalty' ? { timeRate: num(b.timeRate, 0, 100, 1) } : {}),
    disq: mode === 'rating' ? [] : idList(b.disq, 'd').slice(0, 20).map(d => ({ id: d.id, text: str(d.text, 120) })).filter(d => d.text) };
}

/* ---------------------------------------------------------- number allocation */
async function suggestNo(c, st, prefix, year) {
  const cfg = S.numCfg(st), name = S.certCounterName(cfg, prefix, year);
  let n = Math.max(await c.D.peek(name), cfg.start - 1) + 1;
  for (let i = 0; i < 5000; i++, n++) { const no = S.fmtCertNo(cfg, prefix, year, n); if (!(await c.D.get('certs', no)) && !(await c.D.get('retired', no)) && !(await c.D.get('archive', no))) return { no, n, name, cfg }; }
  throw new H(500, 'server');
}
/* Inserts the certificate with a unique number. `requested` = number typed/confirmed in the Issue form. */
async function insertCert(c, st, prefix, year, requested, build) {
  const cfg = S.numCfg(st), name = S.certCounterName(cfg, prefix, year);
  if (requested) {
    const no = S.normCertNo(requested); need(S.goodCertNo(no), 'badCertNo');
    if (await c.D.get('retired', no) || await c.D.get('archive', no)) throw new H(409, 'dupCert');     // numbers are never reused
    const doc = await build(no);
    try { await c.D.insert('certs', no, doc); } catch (/** @type {any} */ e) { if (e instanceof H && e.message === 'dup') throw new H(409, 'dupCert'); throw e; }
    const head = `${prefix || cfg.prefix}${cfg.sep}${S.yearPart(cfg, year)}${cfg.sep}`, tail = no.startsWith(head) ? no.slice(head.length) : '';
    if (/^\d+$/.test(tail)) await c.D.bump(name, Number(tail));
    return doc;
  }
  for (let i = 0; i < 25; i++) {
    if ((await c.D.peek(name)) < cfg.start - 1) await c.D.bump(name, cfg.start - 1);
    const no = S.fmtCertNo(cfg, prefix, year, await c.D.seq(name));
    if (await c.D.get('retired', no) || await c.D.get('archive', no)) continue;
    const doc = await build(no);
    try { await c.D.insert('certs', no, doc); return doc; } catch (/** @type {any} */ e) { if (!(e instanceof H && e.message === 'dup')) throw e; }
  }
  throw new H(500, 'server');
}


/* bid for a direct certificate: the chosen template, so renewals group with session certificates of the same training */
const s_bid = (b, blank) => blank.id;
/* apply the superadmin's field overrides onto a certificate snapshot (only non-empty values replace the defaults) */
function applyCertOverrides(snap, o) {
  const v = k => { const x = (o[k] ?? '').toString().trim(); return x; };
  if (v('nameAz') || v('nameEn')) snap.names = { az: v('nameAz') || snap.names.az, en: v('nameEn') || snap.names.en };
  for (const k of ['titleAz', 'titleEn', 'qualAz', 'qualEn', 'descAz', 'descEn', 'footAz', 'footEn', 'provider']) if (o[k] !== undefined && String(o[k]).trim()) snap.blank[k] = String(o[k]).slice(0, 2000);
  if (o.trainingName !== undefined && String(o.trainingName).trim()) snap.blank.name = String(o.trainingName).slice(0, 200);
  if (o.credits !== undefined && String(o.credits).trim()) snap.blank.credits = String(o.credits).slice(0, 20);
  if (o.trainerName !== undefined) snap.trainer = String(o.trainerName).slice(0, 120);
  if (o.companyName !== undefined && String(o.companyName).trim()) { snap.company = String(o.companyName).slice(0, 120); if (!o.coMode) { snap.coMode = 'show'; snap.showCo = true; } }
  if (o.labels) snap.blank.labels = S.cleanLabels(o.labels);
}

/** @type {import('../../types/store').Routes} */
export const trainingRoutes = {
  /* ---------------------------------------------------------------- blanks */
  'POST /blank/save': { auth: 'staff', act: 'blank.save', async fn(c) {
    const b = await c.body(), f = readBlank(b); let x;
    if (f.defaultSheetId) need(await c.D.get('sheets', f.defaultSheetId), 'badInput');
    /** @type {any} */ let was = null;
    if (b.id) { x = await c.D.get('blanks', str(b.id, 60)); need(x, 'noRec', 404); was = { ...x }; Object.assign(x, f); }
    else x = { id: uid('b'), ...f, createdAt: new Date(c.now()).toISOString() };
    await c.D.put('blanks', [{ id: x.id, data: x }]); await audit(c, b.id ? 'blank.update' : 'blank.create', x.name, { entity: { kind: 'blank', id: x.id, label: x.name }, changes: was ? diff(was, x, Object.keys(f)) : [] });
    return { blank: x };
  } },

  /* ----------------------------------------------------------------- sheets */
  'POST /sheet/save': { auth: 'staff', act: 'sheet.save', async fn(c) {
    const b = await c.body(), f = readSheet(b); let x, was = /** @type {any} */ (null);
    if (b.id) { x = await c.D.get('sheets', str(b.id, 60)); need(x, 'noRec', 404); need(x.mode === f.mode || !(await c.D.query('enr', { where: [['prac.sheetId', 'eq', x.id]], limit: 1 })).rows.length, 'sheetModeLocked', 409); was = { ...x }; Object.assign(x, f); }
    else x = { id: uid('p'), ...f, createdAt: new Date(c.now()).toISOString() };
    await c.D.put('sheets', [{ id: x.id, data: x }]); await audit(c, b.id ? 'sheet.update' : 'sheet.create', x.name, { entity: { kind: 'sheet', id: x.id, label: x.name }, changes: was ? diff({ name: was.name, mode: was.mode, note: was.note, rule: was.rule, items: S.sheetItems(was).map(i => i.text + ':' + (i.penalty || '')).join('|'), disq: (was.disq || []).length }, { name: x.name, mode: x.mode, note: x.note, rule: x.rule, items: S.sheetItems(x).map(i => i.text + ':' + (i.penalty || '')).join('|'), disq: (x.disq || []).length }) : [] });
    return { sheet: x };
  } },

  /* -------------------------------------------------------------- materials */
  'POST /material/upload': { auth: 'staff', act: 'material.save', raw: true, async fn(c) {
    const title = str(c.url.searchParams.get('title'), 140), file = str(c.url.searchParams.get('name'), 200), slides = num(c.url.searchParams.get('slides'), 0, 2000, 0);
    const buf = await c.req.arrayBuffer(); need(title && buf.byteLength > 100 && buf.byteLength <= 60e6, 'badInput');
    // PowerPoint (.pptx, a zip: "PK") or PDF ("%PDF"); checked by content, not only by the name
    const sig = new Uint8Array(buf.slice(0, 4)), pptx = sig[0] === 0x50 && sig[1] === 0x4b && /\.pptx$/i.test(file), pdf = sig[0] === 0x25 && sig[1] === 0x50 && sig[2] === 0x44 && sig[3] === 0x46 && /\.pdf$/i.test(file);
    need(pptx || pdf, 'badFile');
    const id = uid('m'), key = id + '-' + rnd(6) + (pdf ? '.pdf' : '.pptx');
    await c.B.put('materials/' + key, buf, { httpMetadata: { contentType: 'application/octet-stream' } });
    const x = { id, title, key, fileName: file, format: pdf ? 'pdf' : 'pptx', size: buf.byteLength, slides, at: new Date(c.now()).toISOString(), by: c.user.email,
      status: S.mayPublish(c.user, await getSettings(c.D), 'materials') ? 'active' : 'pending' };
    await c.D.put('materials', [{ id, data: x }]); await audit(c, 'material.upload', title);
    return J({ material: x });
  } },
  'POST /material/update': { auth: 'staff', act: 'material.save', async fn(c) {
    const b = await c.body(), x = await c.D.get('materials', str(b.id, 60)); need(x, 'noRec', 404);
    need(str(b.title, 140), 'badInput'); x.title = str(b.title, 140); await c.D.put('materials', [{ id: x.id, data: x }]); return { material: x };
  } },
  'GET /material/get': { auth: 'staff', act: 'material.view', raw: true, async fn(c) {
    const x = await c.D.get('materials', str(c.url.searchParams.get('id'), 60)); need(x, 'noRec', 404);
    const o = await c.B.get('materials/' + x.key); need(o, 'noRec', 404);
    return new Response(o.body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store, private', 'x-content-type-options': 'nosniff' } });
  } },

  /* --------------------------------------------------------------- sessions */
  'POST /session/save': { auth: 'staff', act: 'session.save', async fn(c) {
    const b = await c.body(), today = c.today();
    const f = { bid: str(b.bid, 60), tid: str(b.tid, 60), date: str(b.date, 10), endDate: str(b.endDate, 10), time: str(b.time, 5), location: str(b.location, 160), notes: str(b.notes, 600),
      sheetId: str(b.sheetId, 60), materials: [...new Set((b.materials || []).map(x => str(x, 60)))].slice(0, 30), traineeIds: [...new Set((b.traineeIds || []).map(x => str(x, 60)))].slice(0, 500),
      // printed on this session's certificates (they can differ every time): details under the training name, a registration
      // line above "valid till", and the company line
      certDetails: str(b.certDetails, 600), certReg: str(b.certReg, 160), coMode: S.CO_MODES.includes(b.coMode) ? b.coMode : '', coText: str(b.coText, 200) };
    need(await c.D.get('blanks', f.bid), 'badInput'); const tr = await c.D.get('trainers', f.tid); need(tr && tr.on !== false, 'badTrainer');
    need(S.isDate(f.date), 'badDate'); need(!f.endDate || (S.isDate(f.endDate) && f.endDate >= f.date && S.daysBetween(f.date, f.endDate) < MAX_DAYS), 'badDate'); if (f.endDate === f.date) f.endDate = '';
    need(!f.time || /^\d{2}:\d{2}$/.test(f.time), 'badInput');
    if (f.sheetId) need(await c.D.get('sheets', f.sheetId), 'badInput');
    for (const m of f.materials) { const mx = await c.D.get('materials', m); need(mx, 'badInput'); need(S.usable(mx), 'materialNotApproved', 409); }
    for (const t of await Promise.all(f.traineeIds.map(id => c.D.get('trainees', id)))) need(t, 'badInput');
    const link = httpUrl(b.examLink); need(link !== null, 'badLink'); f.examLink = link;
    // exam: none | external link | test from the question bank (old sessions with only a link count as 'link')
    f.examMode = ['', 'link', 'bank'].includes(b.examMode) ? b.examMode : link ? 'link' : ''; f.examId = '';
    if (f.examMode === 'link') need(link, 'badLink');
    f.examCount = 0; f.examMinutes = f.examMode === 'bank' ? num(b.examMinutes, 0, 600, 0) : 0;   // exam duration for this session (0 = the test's own time limit)
    if (f.examMode === 'bank') {
      f.examId = str(b.examId, 60); const x = f.examId && await c.D.get('tests', f.examId); need(x, 'needTest'); need(!x.draft, 'testDraft', 409); need(S.usable(x), 'testNotApproved', 409); f.examLink = '';
      // questions per candidate: never more than the test holds
      f.examCount = num(b.examCount, 0, 1000, 0); if (f.examCount > poolSize(x)) throw new H(400, 'poolTooSmall', { n: poolSize(x), k: f.examCount });
    }
    if (!f.examMode) f.examLink = '';
    let s;
    if (b.id) {
      s = await c.D.get('sessions', str(b.id, 60)); need(s, 'noRec', 404);
      // The form sends its whole candidate list. With baseIds (the list as the form loaded it) only what the person changed
      // in the form is applied to the list as it is NOW: a candidate the trainer added in the meantime stays, one the
      // trainer removed is not brought back.
      if (Array.isArray(b.baseIds)) {
        const base = new Set(b.baseIds.map(x => str(x, 60))), sent = new Set(f.traineeIds), cur = s.traineeIds || [];
        f.traineeIds = [...cur.filter(id => !(base.has(id) && !sent.has(id))), ...f.traineeIds.filter(id => !base.has(id) && !cur.includes(id))].slice(0, 500);
      }
      for (const gone of (s.traineeIds || []).filter(t => !f.traineeIds.includes(t))) {
        const e = await c.D.get('enr', enrId(s.id, gone));
        if (e && (e.att || e.fb || e.ev || e.prac || e.exam || e.final)) throw new H(409, 'hasData', { tid: gone });
        await c.D.del('enr', enrId(s.id, gone));
      }
      var was = { ...s }; Object.assign(s, f);
    } else s = { id: uid('s'), ...f, createdAt: new Date(c.now()).toISOString(), by: c.user.email };
    const warnings = clashes(s, await overlapping(c.D, s.date, s.endDate || s.date));
    await c.D.put('sessions', [{ id: s.id, data: s }]); await audit(c, b.id ? 'session.update' : 'session.create', `${s.id} ${s.date}`, { entity: { kind: 'session', id: s.id, label: `${s.date} ${(await c.D.get('blanks', s.bid))?.name || ''}` }, changes: was ? diff({ ...was, traineeIds: (was.traineeIds || []).length, materials: (was.materials || []).length }, { ...s, traineeIds: s.traineeIds.length, materials: s.materials.length }, [...Object.keys(f)]) : [] });
    // the trainer (new session / now theirs) and the candidates added to it are told
    { const tn = (await c.D.get('blanks', s.bid))?.name || '', when = S.fmtDate(s.date) + (s.endDate ? ' – ' + S.fmtDate(s.endDate) : '');
      if (!was || was.tid !== s.tid) await notify(c, 'trainer:' + s.tid, 'nSessionNew', [tn, when], '#/' + s.id);
      const added = s.traineeIds.filter(x => !(was?.traineeIds || []).includes(x)); if (added.length) await notify(c, added.map(x => 'trainee:' + x), 'nSessionAdded', [tn, when]); }
    // certificates already issued from this session whose lines differ: the office is asked whether to update them
    const certsBehind = b.id ? (await certLinesBehind(c, s)).length : 0;
    return { session: sessionRow(s, await enrsOfSession(c.D, s), today), warnings, certsBehind };
  } },
  /* The session's certificate lines (details, registration line, company line) copied onto the certificates already issued
     from it. { id, withdraw }: withdraw = the signatures are withdrawn (they are signed again); otherwise they are kept - the
     signed data (names, learner number, training, dates) does not change. */
  'POST /session/cert-lines': { auth: 'staff', act: 'cert.update', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.id, 60)); need(s, 'noRec', 404);
    const list = await certLinesBehind(c, s), withdraw = bool(b.withdraw), appr = S.approvalsCfg(await getSettings(c.D)).certs;
    for (const x of list) {
      applyLines(x.snap, s);
      if (withdraw) { await unsign(c, [slot.cert(x.no)]); delete x.sign; delete x.esign; if (appr) x.approval = { status: 'pending', at: new Date(c.now()).toISOString(), by: c.user.email, change: true }; }
    }
    if (list.length) await c.D.put('certs', list.map(x => ({ id: x.no, data: x })));
    await audit(c, 'cert.lines', `${s.id} · ${list.length} certificate(s)${withdraw ? ' · signatures withdrawn' : ''}`);
    return { updated: list.length };
  } },
  'GET /session/clashes': { auth: 'staff', act: 'view', async fn(c) {
    // the sessions the office panel holds (recent window and later), or a period asked for
    const q = c.url.searchParams, qf = q.get('from') || '', qt = q.get('to') || '', from = S.isDate(qf) ? qf : daysBefore(c.today(), RECENT_DAYS), to = S.isDate(qt) ? qt : '9999-12-31';
    const all = await overlapping(c.D, from, to), out = {};
    for (const s of all) { if (s.date < from) continue; const w = clashes(s, all); if (w.length) out[s.id] = w; }
    return { clashes: out };
  } },
  'POST /session/close': { auth: 'staff', act: 'session.save', async fn(c) {
    const b = await c.body(), s = await c.D.get('sessions', str(b.id, 60)); need(s, 'noRec', 404);
    if ('closed' in b) s.closed = bool(b.closed); if ('cancelled' in b) s.cancelled = bool(b.cancelled);
    await c.D.put('sessions', [{ id: s.id, data: s }]); await audit(c, 'session.status', `${s.id} closed=${!!s.closed} cancelled=${!!s.cancelled}`);
    return { session: sessionRow(s, await enrsOfSession(c.D, s), c.today()) };
  } },

  'GET /session': { auth: 'staff', act: 'view', async fn(c) {
    const s = await c.D.get('sessions', str(c.url.searchParams.get('id'), 60)); need(s, 'noRec', 404);
    const [enrs, certs, st, signs, people] = await Promise.all([enrsOfSession(c.D, s), c.D.query('certs', { where: [['sid', 'eq', s.id]] }), getSettings(c.D), sessionSigns(c, s.id), getMany(c.D, 'trainees', s.traineeIds || [])]);
    const today = c.today(), soon = st.soonDays ?? S.SOON_DAYS;
    // people: the participants' records (the office panel no longer holds every trainee)
    return { session: sessionRow(s, enrs, today), enrs, certs: certs.rows.map(r => ({ ...clean(r.data), st: certSt(r.data, today, soon) })), signs, people: [...people.values()].map(t => strip(c, clean(t))) };
  } },

  /* ------------------------------------------------- enrolment (admin side) */
  'POST /enr/confirm': { auth: 'staff', act: 'attendance.confirm', async fn(c) {
    const b = await c.body(); return { enr: await confirmFor(c, b.sid, b.tid, bool(b.undo)) };
  } },
  'POST /enr/attendance': { auth: 'staff', act: 'attendance.confirm', async fn(c) { const b = await c.body(); return rollCall(c, b.sid, b.absent, b.day); } },
  /* approval countersignature on any session document: approver or superadmin, electronic or with their own signature image */
  'POST /sign/doc': { auth: 'staff', act: 'doc.sign', async fn(c) {
    const b = await c.body(), doc = str(b.doc, 10), s = await loadSession(c, b.sid); need(doc in APPR_DOCS, 'badInput');
    const tid = APPR_DOCS[doc] ? str(b.tid, 60) : ''; need(!APPR_DOCS[doc] || (s.traineeIds || []).includes(tid), 'badInput');
    const mode = b.mode === 'image' ? 'image' : 'esign';
    const sg = await sign(c, slot.appr(doc, s.id, tid), doc, { sid: s.id, ...(tid ? { tid } : {}) }, 'approver', { mode });
    return { sign: sg, signs: await sessionSigns(c, s.id) };
  } },
  'POST /sign/doc/withdraw': { auth: 'staff', act: 'doc.sign', async fn(c) {
    const b = await c.body(), doc = str(b.doc, 10), s = await loadSession(c, b.sid); need(doc in APPR_DOCS, 'badInput');
    const id = slot.appr(doc, s.id, APPR_DOCS[doc] ? str(b.tid, 60) : ''), r = await c.D.get('signs', id); need(r, 'noRec', 404);
    need(r.by.id === c.user.id || c.user.role === 'superadmin', 'forbidden', 403);     // only the signer (or the superadmin) withdraws it
    await unsign(c, [id]); return { signs: await sessionSigns(c, s.id) };
  } },
  /* attendance sheets are signed only by the trainer (trainer portal): the office does not sign them */
  /* final-day documents of a multi-day training: opened by the trainer on the final day (the office can also open / close them) */
  'POST /session/docs': { auth: 'staff', act: 'session.save', async fn(c) { const b = await c.body(), s = await loadSession(c, b.sid); return { session: await openDocs(c, s, bool(b.open)) }; } },
  'POST /enr/practical': { auth: 'staff', act: 'practical.save', async fn(c) {
    const b = await c.body(); return { enr: await savePractical(c, b.sid, b.tid, b.data || {}) };
  } },
  /* Exam result. Not possible after a failed practical (automatic fail) or while the practical is still open. */
  'POST /enr/exam': { auth: 'staff', act: 'exam.save', async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    need(e.att, 'notConfirmed', 409); need(!e.final, 'locked', 409);
    if (s.sheetId) { need(e.prac && e.prac.result !== 'INCOMPLETE', 'needPractical', 409); need(e.prac.result !== 'FAIL', 'practicalFail', 409); }
    if (b.passed === null || b.passed === undefined) delete e.exam;
    else {
      need(typeof b.passed === 'boolean', 'badInput');
      e.exam = { passed: b.passed, score: num(b.score, 0, 1000), note: str(b.note, 500), at: new Date(c.now()).toISOString(), by: c.user.email };
    }
    await saveEnr(c.D, e); await unsign(c, [slot.exam(s.id)]); await audit(c, 'exam.save', `${s.id} ${b.tid} ${b.passed}`);
    return { enr: e };
  } },
  /* Exam results from a CSV file (learner number; score; optional PASS/FAIL). Rows are matched to this session's candidates. */
  'POST /enr/exam/bulk': { auth: 'staff', act: 'exam.save', async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid), rows = Array.isArray(b.rows) ? b.rows.slice(0, 500) : []; need(rows.length, 'badInput');
    const passMark = num(b.passMark, 0, 1000, null), byAtt = new Map();
    for (const tid of s.traineeIds || []) { const t = await c.D.get('trainees', tid); if (t) byAtt.set(String(t.att).toUpperCase(), t); }
    const out = [];
    for (const [i, r] of rows.entries()) {
      const att = str(r.att, 20).toUpperCase(), t = byAtt.get(att), res = { row: r.row ?? i + 1, att };
      try {
        need(t, 'notEnrolled', 404);
        const e = await enrOf(c.D, s.id, t.id); need(e.att, 'notConfirmed', 409); need(!e.final, 'locked', 409);
        if (s.sheetId) { need(e.prac && e.prac.result !== 'INCOMPLETE', 'needPractical', 409); need(e.prac.result !== 'FAIL', 'practicalFail', 409); }
        const score = num(String(r.score ?? '').replace(',', '.'), 0, 1000), word = str(r.result, 10).toUpperCase();
        const passed = /^(PASS|P|KEÇDİ|KECDI|1|YES)$/.test(word) ? true : /^(FAIL|F|KƏSİLDİ|KESILDI|0|NO)$/.test(word) ? false : score !== null && passMark !== null ? score >= passMark : null;
        need(passed !== null, 'badInput');
        e.exam = { passed, score, note: 'CSV', at: new Date(c.now()).toISOString(), by: c.user.email }; await saveEnr(c.D, e); await unsign(c, [slot.exam(e.sid)]);
        out.push({ ...res, ok: true, passed, score, name: S.fullAz(t) });
      } catch (/** @type {any} */ x) { if (!(x instanceof H)) throw x; out.push({ ...res, ok: false, error: x.message, name: t ? S.fullAz(t) : '' }); }
    }
    await audit(c, 'exam.import', `${s.id} ${out.filter(x => x.ok).length}/${rows.length}`, { entity: { kind: 'session', id: s.id, label: s.date } });
    return { results: out };
  } },
  'POST /enr/reopen': { auth: 'staff', act: 'issue', async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    need(e.final && !e.final.certNo, 'badInput', 409); delete e.final; await saveEnr(c.D, e); await c.D.del('rel', enrId(s.id, b.tid)); await audit(c, 'enr.reopen', `${s.id} ${b.tid}`);
    return { enr: e };
  } },

  /* ------------------------------------------------------- issue / release */
  /* Open results only: enrolments with attendance and no final decision (database index), not every enrolment ever. */
  'GET /issue/queue': { auth: 'staff', act: 'issue', async fn(c) {
    const today = c.today(), out = [];
    const [open, st, blanks, cos] = await Promise.all([c.D.query('enr', { where: [['final', 'null', true], ['att', 'null', false]] }), getSettings(c.D),
      c.D.all('blanks').then(r => new Map(r.map(x => [x.id, x.data]))), c.D.all('companies').then(r => new Map(r.map(x => [x.id, x.data.name])))]);
    const enrs = open.rows.map(r => r.data), opts = outcomeOpts(st);
    const [sessions, trainees] = await Promise.all([getMany(c.D, 'sessions', enrs.map(e => e.sid)), getMany(c.D, 'trainees', enrs.map(e => e.tid))]);
    for (const e of enrs) {
      const s = sessions.get(e.sid), t = trainees.get(e.tid);
      if (!s || s.cancelled || !t || !(s.traineeIds || []).includes(e.tid)) continue;
      out.push({ sid: s.id, tid: e.tid, date: s.date, endDate: s.endDate || '', status: S.sessionStatus(s, null, today), blank: blanks.get(s.bid)?.name || '', bid: s.bid, att: t.att, az: S.fullAz(t), en: S.fullEn(t), foreign: !!t.foreign,
        company: S.isPrivateCompany(cos.get(t.co), t.co) ? '' : cos.get(t.co), ...S.computeOutcome(e, s, opts) });
    }
    return { list: out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) };
  } },

  'GET /issue/suggest': { auth: 'staff', act: 'issue', async fn(c) {
    const st = await getSettings(c.D), blank = await c.D.get('blanks', str(c.url.searchParams.get('bid'), 60)); need(blank, 'noRec', 404);
    const end = str(c.url.searchParams.get('end'), 10); need(S.isDate(end), 'badDate');
    const year = Number(c.today().slice(0, 4)), sg = await suggestNo(c, st, blank.prefix, year);
    return { no: sg.no, expiry: S.expiryFrom(end, blank.months), months: blank.months };
  } },

  /* Release: decides PASS/FAIL. FAIL never creates a certificate. PASS creates it with the confirmed number + expiry. */
  'POST /issue': { auth: 'staff', act: 'issue', async fn(c) { const b = await c.body(); return release(c, b.sid, b.tid, { no: b.no, expiry: b.expiry, signMode: str(b.sign, 10) }); } },
  /* Several releases in one go ("Release all ready"). Each one is independent; numbers are allocated automatically. */
  'POST /issue/bulk': { auth: 'staff', act: 'issue', async fn(c) {
    const b = await c.body(), items = Array.isArray(b.items) ? b.items.slice(0, 60) : []; need(items.length, 'badInput');
    const out = [];
    for (const it of items) {
      try { const r = await release(c, it.sid, it.tid, { signMode: str(b.sign, 10) }); out.push({ sid: it.sid, tid: it.tid, ok: true, ...r }); }
      catch (/** @type {any} */ e) { if (!(e instanceof H)) throw e; out.push({ sid: it.sid, tid: it.tid, ok: false, error: e.message }); }
    }
    return { results: out };
  } },


  /* Direct certificate (superadmin only): a fully custom certificate issued without a training session, e.g. for an external
     achievement or a correction. It is tied to an existing trainee (so the learner number and renewals stay correct); every
     printed field can be overridden. The number is unique, like every other certificate. "renewOf" carries the learner
     number forward when renewing an expired certificate. */
  'POST /cert/issue-direct': { auth: 'staff', act: 'issue', async fn(c) {
    need(c.user.role === 'superadmin', 'forbidden', 403);
    const b = await c.body(), st = await getSettings(c.D);
    const trainee = await c.D.get('trainees', str(b.tid, 60)); need(trainee, 'noTrainee', 404); need(!trainee.temp && trainee.att, 'tempAccount', 409);
    const blank = await c.D.get('blanks', str(b.bid, 60)); need(blank, 'badBlank', 400);
    const trainer = b.trainerId ? await c.D.get('trainers', str(b.trainerId, 60)) : null;
    const company = trainee.co ? await c.D.get('companies', trainee.co) : null;
    const start = str(b.start, 10) || c.today(); need(S.isDate(start), 'badDate');
    const end = str(b.end, 10) || start; need(S.isDate(end) && end >= start, 'badDate');
    const expiry = str(b.expiry, 10) || S.expiryFrom(end, blank.months); need(S.isDate(expiry) && expiry >= end, 'badDate');
    const snap = buildSnap({ trainee, company, trainer, blank, st, session: { certDetails: str(b.custom?.details, 600), certReg: str(b.custom?.reg, 160), coMode: S.CO_MODES.includes(b.custom?.coMode) ? b.custom.coMode : '', coText: str(b.custom?.coText, 200) } });
    applyCertOverrides(snap, b.custom || {});
    const year = Number(start.slice(0, 4)), at = new Date(c.now()).toISOString();
    const doc = await insertCert(c, st, blank.prefix, year, str(b.no, 40), async n => ({ no: n, tid: trainee.id, att: trainee.att, sid: '', bid: s_bid(b, blank),
      co: company && !S.isPrivateCompany(company.name, company.id) ? company.id : '', start, end, expiry, issuedAt: at, by: c.user.email, direct: true, vh: await vh(c.env, n), snap,
      ...(S.approvalsCfg(st).certs && str(b.sign, 10) !== 'esign' && str(b.sign, 10) !== 'image' ? { approval: { status: 'pending', at, by: c.user.email } } : {}) }));
    await audit(c, 'cert.direct', `${doc.no} ${trainee.att}${b.renewOf ? ' · renew of ' + S.normCertNo(b.renewOf) : ''}`, { entity: { kind: 'cert', id: doc.no, label: doc.no } });
    const mode = str(b.sign, 10);
    if (mode && S.can(c.user.role, 'cert.sign')) { try { return { cert: await signCert(c, doc.no, mode) }; } catch (/** @type {any} */ x) { if (!(x instanceof H)) throw x; return { cert: doc, signError: x.message }; } }
    return { cert: doc };
  } },

  /* ----------------------------------------------------------- certificates */
  // GET /certs: routes_find.js (searched and paged in the database)
  'POST /cert/update': { auth: 'staff', act: 'cert.update', async fn(c) {
    const b = await c.body(), no = S.normCertNo(b.no), x = await c.D.get('certs', no); need(x, 'noRec', 404);
    const p = b.patch || {}, was = { names: x.snap.names, company: x.snap.company, trainer: x.snap.trainer, start: x.start, end: x.end, expiry: x.expiry, texts: JSON.stringify([x.snap.blank, x.snap.details, x.snap.reg, x.snap.coMode, x.snap.coText, x.snap.att]) };
    if (p.names) { x.snap.names = { az: str(p.names.az, 160), en: str(p.names.en, 160) }; need(x.snap.names.en, 'badInput'); }
    if ('company' in p) x.snap.company = str(p.company, 160);
    if ('trainer' in p) x.snap.trainer = str(p.trainer, 120);
    // every text printed on the certificate (the certificate's own copy; the template is not changed)
    if ('coMode' in p) { x.snap.coMode = S.CO_MODES.includes(p.coMode) && p.coMode ? p.coMode : 'hide'; x.snap.showCo = x.snap.coMode === 'show'; }
    if ('coText' in p) x.snap.coText = str(p.coText, 200);
    if ('details' in p) x.snap.details = str(p.details, 600);
    if ('reg' in p) x.snap.reg = str(p.reg, 160);
    if ('att' in p) x.snap.att = str(p.att, 40);
    if ('lang' in p) x.snap.lang = p.lang === 'en' ? 'en' : 'both';
    const bl = p.blank || {}, LIM = { name: 100, titleAz: 120, titleEn: 120, qualAz: 160, qualEn: 160, descAz: 1200, descEn: 1200, footAz: 500, footEn: 500, provider: 160 };
    for (const [k, n] of Object.entries(LIM)) if (k in bl) x.snap.blank[k] = str(bl[k], n);
    if ('credits' in bl) x.snap.blank.credits = num(bl.credits, 0, 99, 0);
    if (bl.labels) x.snap.blank.labels = S.cleanLabels(bl.labels);
    need(x.snap.blank.titleAz || x.snap.blank.titleEn, 'badInput');
    for (const k of ['start', 'end', 'expiry']) if (p[k]) { need(S.isDate(p[k]), 'badDate'); x[k] = p[k]; }
    const end = x.end || x.start; need(end >= x.start && (!x.expiry || x.expiry >= end), 'badDate');
    // a corrected certificate is approved again when certificate approval is on
    if (S.approvalsCfg(await getSettings(c.D)).certs) x.approval = { status: 'pending', at: new Date(c.now()).toISOString(), by: c.user.email, change: true };
    const nn = p.newNo && S.normCertNo(p.newNo);
    if (nn && nn !== no) {
      need(S.goodCertNo(nn), 'badCertNo'); x.no = nn; x.vh = await vh(c.env, nn);
      try { await c.D.insert('certs', nn, x); } catch (/** @type {any} */ e) { if (e instanceof H && e.message === 'dup') throw new H(409, 'dupCert'); throw e; }
      await c.D.del('certs', no); await c.D.put('retired', [{ id: no, data: { now: nn, at: new Date(c.now()).toISOString(), by: c.user.email } }]);
      const e = await c.D.get('enr', enrId(x.sid, x.tid)); if (e?.final) { e.final.certNo = nn; await saveEnr(c.D, e); }
    } else await c.D.put('certs', [{ id: no, data: x }]);
    // the content changed: the person who changed it signs it again
    // the content changed: an existing signature no longer applies and has to be given again
    await unsign(c, [slot.cert(no), slot.cert(x.no)]); if (x.sign || x.esign) { delete x.sign; delete x.esign; await c.D.put('certs', [{ id: x.no, data: x }]); }
    await audit(c, 'cert.update', `${no}${nn && nn !== no ? ' -> ' + nn : ''}`, { entity: { kind: 'cert', id: x.no, label: x.no }, changes: [...diff(was, { names: x.snap.names, company: x.snap.company, trainer: x.snap.trainer, start: x.start, end: x.end, expiry: x.expiry, texts: JSON.stringify([x.snap.blank, x.snap.details, x.snap.reg, x.snap.coMode, x.snap.coText, x.snap.att]) }), ...(nn && nn !== no ? [{ f: 'no', from: no, to: nn }] : [])] });
    return { cert: x };
  } },
  /* Signing certificates: admin / superadmin only, under their own name; electronically or with their own signature image.
     { nos: [...], mode: 'esign' | 'image' }  ·  /cert/unsign { no } withdraws a signature. */
  'POST /cert/sign': { auth: 'staff', act: 'cert.sign', async fn(c) {
    const b = await c.body(), nos = [...new Set((b.nos || [b.no]).filter(Boolean).map(x => S.normCertNo(x)))].slice(0, 100); need(nos.length, 'badInput');
    const out = [];
    for (const no of nos) { try { const x = await signCert(c, no, str(b.mode, 10)); out.push({ no, ok: true, sign: x.sign }); } catch (/** @type {any} */ e) { if (!(e instanceof H) || ['needName', 'needSigImage'].includes(e.message)) throw e; out.push({ no, ok: false, error: e.message }); } }
    return { results: out };
  } },
  'POST /cert/unsign': { auth: 'staff', act: 'cert.sign', async fn(c) { const b = await c.body(), x = await unsignCert(c, S.normCertNo(b.no)); need(x, 'noRec', 404); return { cert: x }; } },
  'POST /cert/revoke': { auth: 'staff', act: 'cert.revoke', async fn(c) {
    const b = await c.body(), no = S.normCertNo(b.no), x = await c.D.get('certs', no); need(x, 'noRec', 404);
    if (bool(b.revoke)) x.revoked = { at: new Date(c.now()).toISOString(), by: c.user.email, reason: str(b.reason, 300) }; else delete x.revoked;
    await c.D.put('certs', [{ id: no, data: x }]); await audit(c, bool(b.revoke) ? 'cert.revoke' : 'cert.restore', no + (x.revoked?.reason ? ' · ' + x.revoked.reason : ''), { entity: { kind: 'cert', id: no, label: no } });
    return { cert: x };
  } },
};

export { suggestNo };

export const outcomeOpts = st => ({ fbRequired: st.fbRequired !== false });

/* One release, made safe against double clicks / parallel requests: the enrolment is reserved first with a unique row
   (col "rel", id "<session>|<trainee>"); a second request for the same person fails with "alreadyReleased". */
/** @param {any} c @param {string} sid @param {string} tid @param {{no?: string, expiry?: string, signMode?: string}} [o] */
async function release(c, sid, tid, { no, expiry: wanted, signMode = '' } = {}) {
  const { s, e } = await loadEnrolled(c, sid, tid), st = await getSettings(c.D);
  need(!e.final, 'alreadyReleased', 409);
  const o = S.computeOutcome(e, s, outcomeOpts(st));
  if (o.outcome.startsWith('PENDING')) throw new H(409, { PENDING_PRACTICAL: 'needPractical', PENDING_FEEDBACK: 'needFeedback' }[o.outcome] || 'needExam');
  const key = enrId(s.id, e.tid);
  try { await c.D.insert('rel', key, { at: new Date(c.now()).toISOString(), by: c.user.email }); } catch (/** @type {any} */ x) {
    if (!(x instanceof H && x.message === 'dup')) throw x;
    // Reserved, but no result on the enrolment: an earlier release stopped half-way. If it got as far as the certificate, that
    // certificate is the result (never a second one); a reservation older than two minutes with nothing behind it is taken over.
    const made = (await c.D.query('certs', { where: [['sid', 'eq', s.id], ['tid', 'eq', e.tid], ['revoked', 'null', true]], limit: 1 })).rows[0]?.data;
    if (made) {
      e.final = { outcome: 'PASS', certNo: made.no, at: made.issuedAt, by: made.by }; await saveEnr(c.D, e);
      await audit(c, 'release.recovered', `${made.no} ${s.id} ${e.tid}`, { entity: { kind: 'cert', id: made.no, label: made.no } });
      return { result: 'PASS', cert: made, recovered: true };
    }
    const r = await c.D.get('rel', key); if (r && c.now() - Date.parse(r.at) < 120e3) throw new H(409, 'alreadyReleased');
    await c.D.put('rel', [{ id: key, data: { at: new Date(c.now()).toISOString(), by: c.user.email, tookOver: true } }]);
  }
  /** @type {any} */ let made = null;
  try {
    const at = new Date(c.now()).toISOString();
    if (o.outcome !== 'PASS') {
      e.final = { outcome: 'FAIL', reason: o.reason || o.outcome.toLowerCase(), at, by: c.user.email };
      await saveEnr(c.D, e); await audit(c, 'release.fail', `${s.id} ${e.tid} ${e.final.reason}`);
      return { result: 'FAIL', reason: e.final.reason };
    }
    const [trainee, trainer, blank] = await Promise.all([c.D.get('trainees', e.tid), s.tid ? c.D.get('trainers', s.tid) : null, c.D.get('blanks', s.bid)]);
    need(trainee && blank, 'noRec', 404); need(!trainee.temp && trainee.att, 'tempAccount', 409);   // a learner number is needed first
    const company = trainee.co ? await c.D.get('companies', trainee.co) : null, end = S.sessionEnd(s);
    const expiry = str(wanted, 10) || S.expiryFrom(end, blank.months); need(S.isDate(expiry) && expiry >= end, 'badDate');
    const year = Number(c.today().slice(0, 4));
    const doc = await insertCert(c, st, blank.prefix, year, str(no, 40), async n => ({ no: n, tid: trainee.id, att: trainee.att, sid: s.id, bid: s.bid, co: company && !S.isPrivateCompany(company.name, company.id) ? company.id : '',
      start: s.date, end, expiry, issuedAt: at, by: c.user.email, vh: await vh(c.env, n), snap: buildSnap({ trainee, company, trainer, blank, st, session: s }),
      // with certificate approval on, the certificate reaches the candidate / company / QR page only after the approver's decision
      ...(S.approvalsCfg(st).certs ? { approval: { status: 'pending', at, by: c.user.email } } : {}) }));
    made = doc;
    e.final = { outcome: 'PASS', certNo: doc.no, at, by: c.user.email }; await saveEnr(c.D, e);
    await audit(c, 'release.pass', `${doc.no} ${trainee.att}`, { entity: { kind: 'cert', id: doc.no, label: doc.no } });
    // optional: sign straight away (admin / superadmin only)
    if (signMode && S.can(c.user.role, 'cert.sign')) { try { return { result: 'PASS', cert: await signCert(c, doc.no, signMode) }; } catch (/** @type {any} */ x) { if (!(x instanceof H)) throw x; return { result: 'PASS', cert: doc, signError: x.message }; } }
    return { result: 'PASS', cert: doc };
  } catch (/** @type {any} */ x) { if (!made) await c.D.del('rel', key).catch(() => {}); throw x; }   // a certificate exists: the reservation stays, the next try finishes it
}

/* Trainer double-booked, or the same room used twice at overlapping dates (same start time or no time given). */
/* sessions that may overlap the period [from, to] (a session lasts at most MAX_DAYS) */
const MAX_DAYS = 62;
const overlapping = async (D, from, to) => (await D.query('sessions', { where: [['date', 'gte', daysBefore(from, MAX_DAYS)], ['date', 'lte', to]] })).rows.map(r => r.data);
export function clashes(s, all) {
  if (s.cancelled) return [];
  const end = x => x.endDate || x.date, over = x => x.date <= end(s) && s.date <= end(x), room = v => String(v || '').trim().toLowerCase(), out = [];
  for (const x of all) {
    if (x.id === s.id || x.cancelled || !over(x)) continue;
    if (s.tid && x.tid === s.tid) out.push({ kind: 'trainer', id: x.id, date: x.date });
    else if (room(s.location) && room(s.location) === room(x.location) && (!s.time || !x.time || s.time === x.time)) out.push({ kind: 'room', id: x.id, date: x.date });
  }
  return out;
}
