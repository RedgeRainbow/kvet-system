/* Scheduled jobs. Run daily by the small cron Worker (workers/cron) through POST /api/cron/run, and on demand from Admin.
   - backup     : one backup a day, the last 90 are kept
   - reminders  : e-mail (and optional SMS) before certificates expire, once per threshold (e.g. 90 and 30 days)
   - retention  : removes the ID/FIN of people with no valid certificate and no training for N years (Settings -> Privacy)
   - locks      : nothing to do (login counters expire by themselves); kept for symmetry */
import { S, audit, getSettings, remindCfg, privacyCfg, getMany } from './core.js';
import { sendMail, sendSms, mailReady } from './mail.js';

const escH = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* Which certificates are due a reminder today. A certificate gets each threshold once (cert.rem = { "90": iso, "30": iso }). */
export async function dueReminders(c) {
  const st = await getSettings(c.D), cfg = remindCfg(st), today = c.today();
  // only certificates still current that expire within the longest reminder period (database query)
  const horizon = new Date(Date.parse(today + 'T00:00:00Z') + Math.max(0, ...cfg.days) * 864e5).toISOString().slice(0, 10);
  const certs = (await c.D.query('certs', { where: [['revoked', 'null', true], ['renewed', 'null', true], ['exp', 'gte', today], ['exp', 'lte', horizon]] })).rows.map(r => r.data);
  const out = [];
  for (const x of certs) {
    if (x.st === 'REVOKED' || x.st === 'RENEWED') continue;
    const left = S.daysBetween(today, x.expiry); if (left < 0) continue;
    const due = cfg.days.filter(d => left <= d && !x.rem?.[d]); if (!due.length) continue;
    out.push({ cert: x, left, due });
  }
  return { cfg, st, list: out };
}

/** @param {any} [c] @param {any} o1 */
export async function runReminders(c, { dry = false } = {}) {
  const { cfg, st, list } = await dueReminders(c);
  const info = st.company || {}, sent = { company: 0, trainee: 0, sms: 0, skipped: 0 };
  if (dry || !cfg.on || !list.length) return { dry: true, on: cfg.on, mail: mailReady(c.env), due: list.map(r => ({ no: r.cert.no, name: r.cert.snap?.names?.en, expiry: r.cert.expiry, left: r.left, co: r.cert.co })), sent };
  const [trainees, companies, blanks] = await Promise.all([getMany(c.D, 'trainees', list.map(r => r.cert.tid)), ...['companies', 'blanks'].map(async k => new Map((await c.D.all(k)).map(r => [r.id, r.data])))]);
  const name = r => r.cert.snap?.names?.en || r.cert.snap?.names?.az || r.cert.att, course = r => blanks.get(r.cert.bid)?.name || r.cert.snap?.blank?.qualEn || '';
  const line = r => `${name(r)} · ${course(r)} · ${r.cert.no} · ${S.fmtDate(r.cert.expiry)} (${r.left} d)`;
  const sign = `<p>${escH(info.name || 'KVET')}<br>${escH([info.phone, info.email, info.website].filter(Boolean).join(' · '))}</p>`;
  // companies: one digest per company
  if (cfg.toCompany) {
    const byCo = new Map(); for (const r of list) if (r.cert.co) { if (!byCo.has(r.cert.co)) byCo.set(r.cert.co, []); byCo.get(r.cert.co).push(r); }
    for (const [co, rows] of byCo) {
      const x = companies.get(co); if (!x?.email) { sent.skipped += rows.length; continue; }
      const ok = await sendMail(c.env, { to: x.email, subject: `Sertifikatların müddəti bitir / Certificates expiring – ${x.name}`,
        html: `<p>Hörmətli ${escH(x.contactPerson || x.name)},</p><p>Aşağıdakı əməkdaşlarınızın sertifikatlarının müddəti yaxınlaşır. Yeniləmə təlimi üçün bizimlə əlaqə saxlayın.<br><i>The certificates below expire soon. Please contact us to book refresher training.</i></p><ul>${rows.map(r => `<li>${escH(line(r))}</li>`).join('')}</ul>${sign}` });
      if (ok) sent.company++;
    }
  }
  // trainees: one e-mail each (+ SMS when a gateway is configured)
  if (cfg.toTrainee) for (const r of list) {
    const t = trainees.get(r.cert.tid); if (!t) continue;
    if (t.email && await sendMail(c.env, { to: t.email, subject: `Sertifikatınızın müddəti bitir / Your certificate expires on ${S.fmtDate(r.cert.expiry)}`,
      html: `<p>${escH(name(r))},</p><p>${escH(course(r))} sertifikatınızın (${escH(r.cert.no)}) müddəti ${escH(S.fmtDate(r.cert.expiry))} tarixində bitir.<br><i>Your ${escH(course(r))} certificate (${escH(r.cert.no)}) expires on ${escH(S.fmtDate(r.cert.expiry))}.</i></p>${sign}` })) sent.trainee++;
    if (t.phone && await sendSms(c.env, { to: t.phone, text: `${info.name || 'KVET'}: ${course(r)} sertifikatınız ${S.fmtDate(r.cert.expiry)} bitir / certificate expires.` })) sent.sms++;
  }
  // mark every due threshold as done, also when nobody could be reached (so it is not retried every day)
  const at = new Date(c.now()).toISOString();
  await c.D.put('certs', list.map(r => { const { st: _s, sk: _k, ...doc } = r.cert; doc.rem = { ...(doc.rem || {}) }; for (const d of r.due) doc.rem[d] = at; return { id: doc.no, data: doc }; }));
  await audit(c, 'reminder.sent', `${list.length} certificate(s) · company mails ${sent.company} · trainee mails ${sent.trainee} · sms ${sent.sms}`);
  return { dry: false, on: true, count: list.length, sent };
}

/* People whose ID/FIN is no longer needed: no certificate valid in the last N years and no training in that time. */
export async function dueRetention(c) {
  const st = await getSettings(c.D), years = privacyCfg(st).finYears; if (!years) return { years, list: [] };
  const today = c.today(), limit = `${Number(today.slice(0, 4)) - years}${today.slice(4)}`;
  const last = new Map(), bump = (tid, d) => { if (d && (!last.has(tid) || d > last.get(tid))) last.set(tid, d); };
  // light fields only (who, when): the whole history is scanned, but not the records themselves
  const [certs, sessions, people] = await Promise.all([c.D.query('certs', { fields: ['tid', 'expiry'] }), c.D.query('sessions', { fields: ['traineeIds', 'date', 'endDate'] }), c.D.query('trainees', { where: [['fin', 'empty', false]], fields: ['fin', 'createdAt'] })]);
  for (const { data: x } of certs.rows) bump(x.tid, x.expiry);
  for (const { data: s } of sessions.rows) for (const tid of s.traineeIds || []) bump(tid, S.sessionEnd(s));
  const ids = people.rows.filter(r => (last.get(r.id) || (r.data.createdAt || '').slice(0, 10)) < limit).map(r => r.id);
  const list = [...(await getMany(c.D, 'trainees', ids)).values()].filter(t => t.fin);
  return { years, limit, list };
}
/** @param {any} [c] @param {any} o1 */
export async function runRetention(c, { dry = false } = {}) {
  const { years, limit, list } = await dueRetention(c);
  if (dry || !list.length) return { dry: true, years, limit, count: list.length, people: list.slice(0, 200).map(t => ({ id: t.id, att: t.att, name: S.fullAz(t) })) };
  const at = new Date(c.now()).toISOString();
  await c.D.delMany('fins', list.map(t => t.fin));
  await c.D.put('trainees', list.map(t => ({ id: t.id, data: { ...t, fin: '', finRemovedAt: at } })));
  await audit(c, 'privacy.retention', `ID/FIN removed for ${list.length} person(s) inactive since before ${limit}`);
  return { dry: false, years, count: list.length };
}
