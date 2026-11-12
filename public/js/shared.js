/* Pure logic shared by the Worker (server), the browser and the tests.
   Nothing in here touches the DOM, the network or any storage. */

/* ------------------------------------------------------------------ roles */
export const RANK = { editor: 2, admin: 3, superadmin: 4, approver: 1, auditor: 1, emergency: 3 };
/* the former read-only "reader" role is now the auditor role (an old reader account signs in as an auditor) */
export const legacyRole = r => (r === 'reader' ? 'auditor' : r === 'creator' ? 'editor' : r);
export const ROLES = Object.keys(RANK).filter(r => r !== 'emergency');
/* Two roles do not follow the ladder above; they have a fixed list of what they may do:
   - approver: the approval queue (approve / return with a comment, confirm candidates sent by companies), reading the training
               section (trainings, their documents, certificates) and signing: certificates and every session document
               (electronic signature or the approver's own uploaded signature image). Creates and deletes nothing.
   - auditor : read-only access to the training section only (trainings, their documents, certificates) and the analytics;
               no ID/FIN, no contact details, no changes and no file downloads. Every page an auditor opens is logged. */
export const ROLE_ONLY = {
  approver: new Set(['state', 'view', 'approve', 'material.view', 'cert.sign', 'doc.sign', 'cand.approve', 'download']),
  auditor: new Set(['state', 'view', 'material.view', 'analytics']),
};
/* Hidden break-glass account "admin_emergency" (role "emergency"): admin rights, plus managing users and the settings that
   only the superadmin has, so that a locked-out superadmin can be restored (new password, two-factor reset, role). It does not
   delete, restore backups or sign. It exists only while the EMERGENCY_PASSWORD secret is set in Cloudflare; every use is
   logged and shown to the superadmin. It is not a user in Users and is never offered as a role. */
export const ROLE_PLUS = { emergency: new Set(['users', 'perf', 'analytics']) };
export const ASSIGNABLE = r => r !== 'emergency';
/* What each role sees in the admin panel menu (roles not listed: everything their actions allow). */
export const ROLE_NAV = { approver: ['approvals', 'sessions', 'certificates', 'messages'], auditor: ['analytics', 'sessions', 'certificates', 'messages'] };

/* Minimum role rank for every protected action. The server enforces it, the UI only hides buttons with it. */
export const MIN = {
  view: 1, state: 1, 'material.view': 1, libdocs: 3, messages: 3,
  // library (question banks, groups, AI settings page) and the dashboard: editor and up (not auditors / approvers)
  library: 2, dashboard: 2,
  // taking files out of the system (PDF, ZIP, Excel, certificate download): everyone except auditors
  download: 1,
  // confirming new candidates sent by a company
  'cand.approve': 3,
  // approval queue: admin and up, and the approver role
  approve: 3,
  // AI knowledge base (switching the AI module on / off is superadmin: 'users')
  'ai.kb': 3,
  // analytics dashboards with AI summary: admin and up (auditors see the oversight view, trainers and companies their own in their portals)
  analytics: 3,
  // performance and feedback analysis of individual trainers and trainees: superadmin / admin
  perf: 3,
  // content
  'blank.save': 2, 'sheet.save': 2, 'material.save': 2, 'session.save': 2, 'exam.save': 2, 'practical.save': 2,
  'attendance.confirm': 2, 'test.save': 2, 'seed': 3,
  // online tests: reviewing answers and deciding pass / fail (the session's own trainer may do it too, in the trainer portal)
  'test.review': 3,
  // people and portals (they carry the confidential ID/FIN, so admin and up)
  'company.save': 3, 'trainer.save': 3, 'trainee.save': 3, 'trainee.att': 3, 'trainee.import': 3, 'credentials.reset': 3,
  // certificates
  'issue': 3, 'cert.update': 3, 'cert.revoke': 3,
  // signing certificates and session documents: superadmin (and the approver role, see ROLE_ONLY)
  'cert.sign': 4, 'doc.sign': 4,
  // system
  'settings.save': 3, 'backup.create': 3, 'backup.view': 3, 'audit.view': 3, 'fin.view': 3, 'requests': 3,
  // backups hold every ID/FIN and password hash: download is superadmin only
  'backup.download': 4,
  // destructive or high-risk: superadmin only
  'delete': 4, 'archive': 4, 'users': 4, 'backup.restore': 4, 'backup.delete': 4, 'camera': 4, 'cert.delete': 4,
};
export const can = (role, action) => (ROLE_ONLY[role] ? ROLE_ONLY[role].has(action) : (RANK[role] || 0) >= (MIN[action] ?? 99) || !!ROLE_PLUS[role]?.has(action));

/* ----------------------------------------------------------- transliteration
   Azerbaijani (Latin) -> international Latin, as used on passports/ISO style documents.
   Qocayev Azər Məmməd oğlu -> Gojayev Azar Mammad oghlu */
const TR = {
  ə: 'a', Ə: 'A', ı: 'i', I: 'I', İ: 'I', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U',
  ş: 'sh', Ş: 'Sh', ç: 'ch', Ç: 'Ch', ğ: 'gh', Ğ: 'Gh',
  c: 'j', C: 'J', x: 'kh', X: 'Kh', q: 'g', Q: 'G', j: 'zh', J: 'Zh',
};
export const transliterateAzToEn = s => String(s ?? '').replace(/[əƏıIİöÖüÜşŞçÇğĞcCxXqQjJ]/g, c => TR[c] ?? c);
export const hasAzChars = s => /[əƏıİöÖüÜşŞçÇğĞ]/.test(String(s ?? ''));

/* ----------------------------------------------------------------- names */
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
export const cleanName = clean;
/* AZ display: "Azər Qocayev Məmməd oğlu" (name surname father) */
export const fullAz = (p, withFather = true) => [p.name, p.surname, withFather ? p.father : ''].map(clean).filter(Boolean).join(' ');
export const fullEn = (p, withFather = true) => [p.nameEn || transliterateAzToEn(p.name), p.surnameEn || transliterateAzToEn(p.surname), withFather ? (p.fatherEn || transliterateAzToEn(p.father)) : ''].map(clean).filter(Boolean).join(' ');
/* What goes on a certificate: foreigners only get the English line. */
export function certNames(p, withFather = false) {
  const en = fullEn(p, withFather);
  return p.foreign ? { az: '', en } : { az: fullAz(p, withFather), en };
}
export const initials = s => clean(s).split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

/* ----------------------------------------------------------- validation */
export const goodFin = (v, foreign) => foreign ? /^[A-Za-z0-9-]{4,20}$/.test(v) : /^[A-Za-z0-9]{7}$/.test(v);
/* text for searching: lower case, accents removed, ə -> e, ı -> i ("Məmmədov", "MEMMEDOV" and "memmedov" all match) */
export const foldText = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ə/g, 'e').replace(/ı/g, 'i');
export const normFin = v => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');
export const normPhone = v => { const s = String(v ?? '').trim().replace(/[^\d+]/g, ''); return s; };
export const goodPhone = v => normPhone(v).replace(/\D/g, '').length >= 7;
export const goodEmail = v => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
export const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !isNaN(Date.parse(v + 'T00:00:00Z'));

/* ----------------------------------------------------------------- dates */
export const bakuToday = (now = Date.now()) => new Date(now + 4 * 36e5).toISOString().slice(0, 10);
export const bakuNow = (now = Date.now()) => new Date(now + 4 * 36e5).toISOString().slice(0, 16).replace('T', ' ');
export const pad = (n, l = 2) => String(n).padStart(l, '0');
export function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const x = new Date(d); return isNaN(x.getTime()) ? '' : `${pad(x.getUTCDate())}.${pad(x.getUTCMonth() + 1)}.${x.getUTCFullYear()}`;
}
export function fmtDateTime(iso) {
  if (!iso) return '';
  const x = new Date(new Date(iso).getTime() + 4 * 36e5); if (isNaN(x.getTime())) return '';
  return `${pad(x.getUTCDate())}.${pad(x.getUTCMonth() + 1)}.${x.getUTCFullYear()} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
}
export const fmtTime = iso => fmtDateTime(iso).slice(11);
/* YYYY-MM-DD + n months - 1 day (training on 23.10.2026 for 24 months is valid till 22.10.2028) */
export function expiryFrom(startIso, months) {
  const [y, m, d] = String(startIso).slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + Number(months || 0), d));
  if (t.getUTCDate() !== d) t.setUTCDate(0);        // 31 Jan + 1 month -> end of Feb
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}
export const daysBetween = (a, b) => Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 864e5);

/* ------------------------------------------------------------ numbering */
export const DEFAULT_NUM = { prefix: 'CRT', sep: '/', yearFmt: 'YY', pad: 4, start: 1 };
export const numCfg = st => ({ ...DEFAULT_NUM, ...(st?.num || {}) });
export const yearPart = (cfg, year) => cfg.yearFmt === 'YYYY' ? String(year) : String(year).slice(2);
export const fmtCertNo = (cfg, prefix, year, n) => `${prefix || cfg.prefix}${cfg.sep}${yearPart(cfg, year)}${cfg.sep}${String(n).padStart(cfg.pad, '0')}`;
export const certCounterName = (cfg, prefix, year) => `cert:${prefix || cfg.prefix}:${year}`;
export const normCertNo = v => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');
export const goodCertNo = v => /^[A-Z0-9][A-Z0-9/._-]{2,39}$/.test(v);
export const learnerNo = (year, seq) => `E-${year}${String(seq).padStart(5, '0')}`;

/* ---------------------------------------------------- certificate status */
export const SOON_DAYS = 60;
/* Adds .st to every certificate: ACTIVE | SOON | EXPIRED | REVOKED | RENEWED.
   A certificate is RENEWED when the same person holds a newer valid one for the same training. */
export function annotateCerts(certs, today, soonDays = SOON_DAYS) {
  const newest = new Map();
  for (const c of certs) {
    if (c.revoked) continue;
    const k = c.tid + '|' + c.bid, cur = newest.get(k);
    if (!cur || c.start > cur.start || (c.start === cur.start && c.issuedAt > cur.issuedAt)) newest.set(k, c);
  }
  return certs.map(c => {
    let st;
    if (c.revoked) st = 'REVOKED';
    else if (newest.get(c.tid + '|' + c.bid) !== c) st = 'RENEWED';
    else { const left = daysBetween(today, c.expiry); st = left < 0 ? 'EXPIRED' : left <= soonDays ? 'SOON' : 'ACTIVE'; }
    return { ...c, st };
  });
}
/* Valid certificate that ends within the next `days` days (not revoked, not renewed, not yet expired). */
export const expiringWithin = (c, today, days) => c.st !== 'REVOKED' && c.st !== 'RENEWED' && daysBetween(today, c.expiry) >= 0 && daysBetween(today, c.expiry) <= days;
export function certCounters(annotated) {
  const k = { total: 0, ACTIVE: 0, SOON: 0, EXPIRED: 0 };
  for (const c of annotated) if (c.st in k) { k.total++; k[c.st]++; }
  return k;
}

/* ------------------------------------------------------- certificate texts
   Every fixed text of the certificate can be changed in the template (blank.labels) and per certificate (snap.blank.labels).
   An empty label hides its line (e.g. no completion date). Credits: "{0}" = the number of credits. */
export const CERT_LABELS = {
  intro: { az: 'Bu sertifikatla təsdiq olunur ki,', en: 'This is to certify that,' },
  provider: { az: 'Təsdiqlənmiş Təlim Mərkəzi:', en: 'Approved Training Provider:' },
  start: { az: 'Təlimin Başlama Tarixi', en: 'Training Start Date' },
  end: { az: 'Təlimin Bitmə Tarixi', en: 'Training Completion Date' },
  credits: { az: '{0} Kredit', en: '{0} Credits' },
  learner: { az: 'İştirakçı Nömrəsi:', en: 'Learner Number:' },
  trainer: { az: 'Təsdiq olunmuş Təlimçi:', en: 'Approved Trainer:' },
  valid: { az: 'Etibarlıdır:', en: 'Valid till:' },
  signature: { az: 'İmza', en: 'Signature' },
  chief: { az: 'Baş icraçı', en: 'Chief Executive' },
};
export const certLabel = (blank, k) => { const x = blank?.labels?.[k]; return { az: x?.az ?? CERT_LABELS[k].az, en: x?.en ?? CERT_LABELS[k].en }; };
export const cleanLabels = v => Object.fromEntries(Object.keys(CERT_LABELS).filter(k => v && v[k] && typeof v[k] === 'object').map(k => [k, { az: String(v[k].az ?? '').trim().slice(0, 120), en: String(v[k].en ?? '').trim().slice(0, 120) }]));
/* The company line of a certificate: hidden, the company's name, or a text written for it (e.g. "Holding / Branch").
   coMode '' = the setting (Settings -> "company on certificates"). Older certificates: showCo. */
export const CO_MODES = ['', 'show', 'hide', 'custom'];
export function certCompanyLine(snap) {
  const m = snap?.coMode || (snap?.showCo ? 'show' : 'hide');
  return m === 'custom' ? String(snap.coText || '').trim() : m === 'show' ? String(snap.company || '').trim() : '';
}

/* --------------------------------------------------------------- sessions */
export const sessionEnd = s => s.endDate || s.date;
/* every calendar day of a session (a 2-credit training = 2 days); at most 31 */
export function sessionDays(s) {
  const out = [], end = sessionEnd(s); let d = s.date;
  while (d && d <= end && out.length < 31) { out.push(d); d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10); }
  return out.length ? out : [s.date];
}
/* the day a roll call is for: the asked day if it belongs to the session and has come, else today (or the last day so far) */
export function rollDay(s, today, asked) {
  const days = sessionDays(s).filter(d => d <= today);
  return days.includes(asked) ? asked : days.includes(today) ? today : days[days.length - 1] || null;
}
/* Multi-day trainings (2 credits = 2 days or more): attendance every day (signed by the trainer for each day); the training
   evaluation, the trainer's evaluation, the exam, the practical, the toolbox talk and the declaration of health belong to the
   final day and open when the trainer opens them on that day (s.docsOpen). One-day trainings: open during the session. */
export const multiDay = s => sessionDays(s).length > 1;
export const finalDay = s => sessionEnd(s);
export const docsReady = s => !multiDay(s) || !!s.docsOpen;
/* per-day attendance of one enrolment: { date: 'P' | 'A' | '' } */
export const dayMarks = (s, e) => Object.fromEntries(sessionDays(s).map(d => [d, e?.days?.[d]?.absent ? 'A' : e?.days?.[d]?.at ? 'P' : '']));
/* upcoming | ongoing | review (training over, results pending) | completed | cancelled */
export function sessionStatus(s, stats, today) {
  if (s.cancelled) return 'cancelled';
  if (s.closed) return 'completed';
  if (stats && stats.total > 0 && stats.finalized >= stats.total) return 'completed';
  if (today < s.date) return 'upcoming';
  if (today <= sessionEnd(s)) return 'ongoing';
  return 'review';
}
export const sessionActiveOn = (s, today) => !s.cancelled && !s.closed && today >= s.date && today <= sessionEnd(s);

/* ------------------------------------------------- practical sheet scoring */
export const BEHAVIOR = ['excellent', 'good', 'satisfactory', 'poor'];
export const PUNCTUALITY = ['ontime', 'late', 'vlate'];
export const SHEET_MODES = ['passfail', 'penalty', 'rating'];
export const sheetItems = sh => (sh.sections || []).flatMap(s => s.items || []);
/* "3-5" -> {min:3,max:5}; "5" -> {min:5,max:5} */
export function penaltyRange(it) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*$/.exec(String(it.penalty ?? ''));
  if (!m) return { min: 0, max: 0 };
  const a = Number(m[1]), b = m[2] === undefined ? a : Number(m[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}
export function defaultRule(mode) {
  return mode === 'penalty' ? { maxPenalty: 40 } : mode === 'rating' ? { minAvg: 3, failBelow: 2 } : {};
}
/* data = { answers:{itemId:value}, disq:[id], timePenalty:Number }
   passfail: 'P' | 'F' | 'NA'      penalty: points (number, 0 = no fault)      rating: 1..5 | 'NA'
   Returns { result: PASS|FAIL|INCOMPLETE, total, max, avg, failed:[itemId], reason } */
export function evaluateSheet(sheet, data) {
  const items = sheetItems(sheet), a = data?.answers || {}, rule = { ...defaultRule(sheet.mode), ...(sheet.rule || {}) };
  /** @type {{ result: string, total: number, max: number, avg: number | null, failed: string[], reason: string }} */
  const out = { result: 'PASS', total: 0, max: 0, avg: null, failed: [], reason: '' };
  const disq = (data?.disq || []).filter(id => (sheet.disq || []).some(d => d.id === id));
  if (sheet.mode === 'penalty') {
    let total = 0;
    for (const it of items) {
      const v = Number(a[it.id] || 0); if (!(v > 0)) continue;
      total += v; out.failed.push(it.id);
    }
    total += Math.max(0, Number(data?.timePenalty) || 0);
    out.total = total; out.max = rule.maxPenalty;
    if (disq.length) { out.result = 'FAIL'; out.reason = 'disq'; }
    else if (total > rule.maxPenalty) { out.result = 'FAIL'; out.reason = 'penalty'; }
    // a penalty sheet with no faults looks the same as an empty one: it only counts once the examiner marks the test as completed
    else if (!data?.done) out.result = 'INCOMPLETE';
    return out;
  }
  const answered = items.filter(it => a[it.id] !== undefined && a[it.id] !== null && a[it.id] !== '');
  if (sheet.mode === 'passfail') {
    for (const it of items) if (a[it.id] === 'F') out.failed.push(it.id);
    out.total = items.filter(it => a[it.id] === 'P').length; out.max = items.filter(it => a[it.id] !== 'NA').length;
    if (disq.length) { out.result = 'FAIL'; out.reason = 'disq'; }
    else if (out.failed.length) { out.result = 'FAIL'; out.reason = 'item'; }          // one fail fails the candidate
    else if (answered.length < items.length) out.result = 'INCOMPLETE';
    return out;
  }
  // rating
  const rated = items.filter(it => typeof a[it.id] === 'number');
  for (const it of rated) if (a[it.id] < (rule.failBelow ?? 2)) out.failed.push(it.id);
  out.total = rated.reduce((s, it) => s + a[it.id], 0); out.max = rated.length * 5;
  out.avg = rated.length ? out.total / rated.length : null;
  if (disq.length) { out.result = 'FAIL'; out.reason = 'disq'; }
  else if (out.failed.length) { out.result = 'FAIL'; out.reason = 'item'; }
  else if (answered.length < items.length) out.result = 'INCOMPLETE';
  else if (out.avg === null || out.avg < (rule.minAvg ?? 3)) { out.result = 'FAIL'; out.reason = 'avg'; }
  return out;
}
/* ---- header fields: type text | time | number | duration | excess, optional auto-fill from the session.
   Time roles drive the overhead-crane style time block: duration = finish - start, excess = max(0, duration - set time). */
export const HEADER_TYPES = ['text', 'time', 'number', 'duration', 'excess'];
export const HEADER_AUTO = ['', 'candidate', 'company', 'date', 'learnerNo', 'training', 'location'];
export const toMin = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
export const fmtMin = n => (n === null || n === undefined || !Number.isFinite(n) ? '' : `${Math.floor(n / 60)}:${pad(n % 60)}`);
/* Returns { duration, excess } in minutes (null when it cannot be worked out). `set` is the allowed time in minutes. */
export function timeCalc(sheet, header = {}) {
  const f = type => (sheet.headerFields || []).find(h => (h.type || 'text') === type);
  const st = f('time') && (sheet.headerFields || []).filter(h => h.type === 'time');
  const set = f('number'), start = st?.[0], finish = st?.[1];
  const a = start ? toMin(header[start.id]) : null, b = finish ? toMin(header[finish.id]) : null;
  /** @type {any} */ let duration = null; if (a !== null && b !== null) duration = b >= a ? b - a : b + 1440 - a;
  const allowed = set ? Number(header[set.id]) : NaN;
  const excess = duration !== null && Number.isFinite(allowed) && allowed > 0 ? Math.max(0, duration - allowed) : null;
  return { duration, excess };
}
/* Time penalty suggested from the excess time: `timeRate` points per started minute (sheet setting, default 1). */
export const suggestTimePenalty = (sheet, header) => { const { excess } = timeCalc(sheet, header); return excess ? Math.ceil(excess) * (Number(sheet.timeRate) > 0 ? Number(sheet.timeRate) : 1) : 0; };

/* Throws a string key when the submitted data does not fit the sheet definition.
   penalty sheets: { faults:{itemId:n}, pts:{itemId:pointsPerFault} } -> award = n x points (range items "3-5" accept any whole value inside the range);
   the old shape { answers:{itemId:points} } still works (one fault). */
export function validateSheetData(sheet, data) {
  const items = new Map(sheetItems(sheet).map(i => [i.id, i])), a = data?.answers || {}, clean = {}, faults = {}, pts = {};
  if (sheet.mode === 'penalty') {
    for (const id of Object.keys(data?.faults || {})) if (!items.has(id)) throw 'badInput';
    for (const [id, it] of items) {
      const r = penaltyRange(it), hasF = data?.faults && id in data.faults;
      if (hasF) {
        const n = Number(data.faults[id]); if (!Number.isInteger(n) || n < 0 || n > 99) throw 'badInput';
        if (!n) continue;
        let p = data.pts?.[id] === undefined || data.pts?.[id] === '' ? r.max : Number(data.pts[id]);
        if (!Number.isFinite(p) || p < r.min || p > r.max) throw 'badInput';
        faults[id] = n; pts[id] = p; clean[id] = n * p;
      } else if (id in a) {
        const v = a[id]; if (v === null || v === '' || v === undefined) continue;
        const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > Math.max(r.max, 0) * 2 + 10) throw 'badInput';
        if (n > 0) { clean[id] = n; faults[id] = 1; pts[id] = n; }
      }
    }
  } else {
    for (const [id, v] of Object.entries(a)) {
      const it = items.get(id); if (!it) throw 'badInput';
      if (v === null || v === '' || v === undefined) continue;
      if (sheet.mode === 'passfail') { if (!['P', 'F', 'NA'].includes(v)) throw 'badInput'; clean[id] = v; }
      else if (sheet.mode === 'rating') { if (v === 'NA') clean[id] = 'NA'; else if (Number.isInteger(v) && v >= 1 && v <= 5) clean[id] = v; else throw 'badInput'; }
    }
  }
  const disq = [...new Set(data?.disq || [])].filter(id => (sheet.disq || []).some(d => d.id === id));
  const header = {}; for (const f of sheet.headerFields || []) header[f.id] = String(data?.header?.[f.id] ?? '').slice(0, 120);
  const tc = timeCalc(sheet, header);
  for (const f of sheet.headerFields || []) { if (f.type === 'duration') header[f.id] = tc.duration === null ? '' : fmtMin(tc.duration); if (f.type === 'excess') header[f.id] = tc.excess === null ? '' : fmtMin(tc.excess); }
  const out = { done: !!data?.done, answers: clean, disq, header, timePenalty: Math.max(0, Math.min(999, data?.timePenalty === undefined || data?.timePenalty === null || data?.timePenalty === '' ? (sheet.timePenalty ? suggestTimePenalty(sheet, header) : 0) : Number(data.timePenalty) || 0)), comments: String(data?.comments ?? '').slice(0, 2000) };
  if (sheet.mode === 'penalty') { out.faults = faults; out.pts = pts; }
  return out;
}

/* ----------------------------------------------- outcome of one enrolment
   PASS | FAIL | PENDING_PRACTICAL | PENDING_EXAM | ABSENT */
export function computeOutcome(enr, session, opts = {}) {
  if (!enr?.att) return { outcome: 'ABSENT', reason: 'absent' };
  if (session?.sheetId) {
    if (!enr.prac || enr.prac.result === 'INCOMPLETE') return { outcome: 'PENDING_PRACTICAL' };
    if (enr.prac.result === 'FAIL') return { outcome: 'FAIL', reason: 'practical' };       // one practical fail = automatic fail
  }
  if (enr.exam?.passed === false) return { outcome: 'FAIL', reason: 'exam' };
  if (enr.exam?.passed === true) return opts.fbRequired && !enr.fb ? { outcome: 'PENDING_FEEDBACK' } : { outcome: 'PASS' };
  return { outcome: 'PENDING_EXAM' };
}

/* ------------------------------------------------------------- feedback */
export const FB_GROUPS = ['g1', 'g2', 'g3', 'g4', 'g6'];      // "skill & confidence" (g5) was removed on request

/* ------------------------------------------------------------ dashboard
   Which tiles the dashboard shows and the look-ahead window of the "expiring" tile; both editable in Settings. */
export const DASH_TILES = ['issued', 'passRate', 'expiring', 'trained', 'passed', 'ongoing', 'ready', 'soon', 'expired'];
export const DEFAULT_DASH = { expDays: 90, tiles: ['issued', 'passRate', 'expiring', 'ongoing', 'ready', 'expired'], top: 8, period: 'month' };
export function dashCfg(st) {
  const d = st?.dash || {};
  return { expDays: Number.isInteger(d.expDays) && d.expDays >= 1 && d.expDays <= 730 ? d.expDays : DEFAULT_DASH.expDays,
    tiles: Array.isArray(d.tiles) ? d.tiles.filter(k => DASH_TILES.includes(k)) : DEFAULT_DASH.tiles,
    top: [5, 8, 10, 15, 20].includes(d.top) ? d.top : DEFAULT_DASH.top, period: ['month', 'lastMonth', 'year'].includes(d.period) ? d.period : DEFAULT_DASH.period };
}
/* [from, to] (inclusive YYYY-MM-DD) for a dashboard period name or a "YYYY-MM" month. */
export function periodRange(p, today) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)), last = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const mon = (yy, mm) => [`${yy}-${pad(mm)}-01`, `${yy}-${pad(mm)}-${pad(last(yy, mm))}`];
  if (p === 'year') return [`${y}-01-01`, `${y}-12-31`];
  if (p === 'lastMonth') return m === 1 ? mon(y - 1, 12) : mon(y, m - 1);
  if (/^\d{4}-\d{2}$/.test(p || '')) return mon(Number(p.slice(0, 4)), Number(p.slice(5)));
  return mon(y, m);
}
/* Hash filters: "#/certificates/issued=2026-10-01..2026-10-31~bid=b1" -> { issued:'...', bid:'b1' } */
export const parseFilter = tok => Object.fromEntries(String(tok || '').split('~').filter(x => x.includes('=')).map(x => [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1)]));
export const buildFilter = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${v}`).join('~');

/* -------------------------------------------------------------- helpers */
export const slug = s => transliterateAzToEn(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
export const uniq = a => [...new Set(a)];
/* Login names: only folds the Azerbaijani letters (ə ş ç ğ ı ö ü), so "Caspian Drilling" -> "caspiandrilling" (not "jaspian…"). */
const LOGIN_FOLD = { ə: 'a', Ə: 'a', ş: 'sh', Ş: 'sh', ç: 'ch', Ç: 'ch', ğ: 'gh', Ğ: 'gh', ı: 'i', I: 'i', İ: 'i', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u' };
export const loginSlug = s => String(s ?? '').replace(/[əƏşŞçÇğĞıIİöÖüÜ]/g, c => LOGIN_FOLD[c]).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
export const isPrivateCompany = (name, id) => !id || /^(private|fərdi|ferdi|individual)$/i.test(String(name || '').trim());

/* ------------------------------------------------- declaration of health (form KLN-A-006)
   Compulsory for every candidate of a session with a practical part. */
export const DOH_Q = [
  ['epilepsy', 'Epilepsi', 'Epilepsy', 'Эпилепсия'], ['heart', 'Ürək tutması', 'Heart attack', 'Инфаркт'], ['angina', 'Angina', 'Angina', 'Стенокардия'],
  ['breath', 'Nəfəs çatmazlığı və ya nəfəs alarkən çətinlik', 'Shortness of breath or difficulty with breathing', 'Одышка или затруднённое дыхание'], ['diabetes', 'Diabet', 'Diabetes', 'Диабет'],
  ['hearing', 'Eşitmə xəsarı', 'Hearing impairment', 'Нарушение слуха'], ['vision', 'Optik kömək ilə düzəldilə bilməyən görmə xəsarı', 'Visual impairment not correctable by optical aids', 'Нарушение зрения, не корректируемое оптикой'],
  ['mental', 'Hər hansı əqli və ya psixoloji narahatlıq', 'Any mental or psychological disorders', 'Любые психические или психологические расстройства'],
  ['medical', 'Avadanlıqlardan istifadə və ya sinif fəaliyyətinə qoşulmanıza maneə olan hər hansı bir tibbi səbəbiniz varmı?', 'Is there any medical reason you are aware of that may impair your ability to operate the equipment or to take part in classroom activities?', 'Есть ли известные вам медицинские причины, которые могут помешать работе с оборудованием или участию в занятиях?'],
  ['medication', 'Hər hansı bir dərman vasitəsindən istifadə edirsinizmi?', 'Are you currently taking any prescribed or non-prescribed medication?', 'Принимаете ли вы сейчас какие-либо лекарства (по назначению или без)?'],
];
/* uploaded question pictures: qimg/<16 hex>.<webp|jpg|png> */
export const goodQImg = v => typeof v === 'string' && /^[a-f0-9]{16}\.(webp|jpg|png)$/.test(v);
export const qImgUrl = k => '/api/qimg/' + k;
export const dohYes = d => !!d && !d.paper && DOH_Q.some(([k]) => d.answers?.[k] === 'Y');

/* ------------------------------------------------------------ online tests
   Question: { id, kind: 'mc' | 'open', text, options: [..], correct: index, points }.
   Multiple-choice answers are marked automatically; open answers always need a reviewer (marks[qid]). */
export function testScore(qs, answers = {}, marks = {}) {
  let score = 0, max = 0, open = 0, pending = 0;
  for (const q of qs || []) {
    const pts = q.points || 1; max += pts;
    if (q.kind === 'open') { open++; const m = marks[q.id]; if (m === undefined || m === null || m === '') pending++; else score += Math.max(0, Math.min(pts, Number(m) || 0)); }
    else if (answers[q.id] === q.correct) score += pts;
  }
  return { score, max, open, pending, pct: max ? Math.round((score / max) * 1000) / 10 : 0 };
}

/* Questions from pasted text. One block per question:
     1. Question text                 (numbering optional; a block is separated by an empty line or the next number)
     A) option        B. option       (letters A-J with ) . or :)
     *C) correct      or  C) correct *   or a line  "Answer: C" / "Cavab: C" / "Correct: C"
   A question without options is an open question. Returns { questions, errors: [line numbers] }. */
export function parseQuestions(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n'), out = [], errors = [];
  /** @type {any} */ let cur = null;
  const flush = () => { if (!cur) return; const q = cur; cur = null; if (!q.text) return;
    if (!q.options.length) out.push({ kind: 'open', text: q.text, points: 1 });
    else { if (q.correct < 0 || q.correct >= q.options.length) errors.push(q.line); out.push({ kind: 'mc', text: q.text, options: q.options, correct: q.correct, points: 1 }); } };
  lines.forEach((raw, i) => {
    const l = raw.trim(); if (!l) { flush(); return; }
    const ans = /^(answer|correct|cavab|düzgün cavab|duzgun cavab|doğru cavab)\s*[:\-]\s*([A-Ja-j])\b/i.exec(l);
    if (ans && cur) { cur.correct = ans[2].toUpperCase().charCodeAt(0) - 65; return; }
    const opt = /^(\*?)\s*([A-Ja-j])\s*[).:]\s*(.+?)\s*(\*?)$/.exec(l);
    if (opt && cur && (cur.options.length || /[?:.]$|\S/.test(cur.text)) && opt[2].toUpperCase().charCodeAt(0) - 65 === cur.options.length) {
      if (opt[1] || opt[4]) cur.correct = cur.options.length; cur.options.push(opt[3].replace(/\s*\*$/, '')); return;
    }
    const num = /^(?:sual\s*)?(\d{1,3})\s*[).:-]\s*(.+)$/i.exec(l);
    if (num || !cur || cur.options.length) { flush(); cur = { text: (num ? num[2] : l).trim(), options: [], correct: -1, line: i + 1 }; return; }
    cur.text += ' ' + l;                          // a question over several lines
  });
  flush();
  return { questions: out, errors };
}
/* Questions from spreadsheet rows: Question | Type | A | B | C | D | E | F | Correct (letter) | Points. First row = header. */
export function questionsFromRows(rows) {
  const out = [], errors = [];
  (rows || []).slice(1).forEach((r, i) => {
    const text = String(r[0] ?? '').trim(); if (!text) return;
    const options = r.slice(2, 8).map(x => String(x ?? '').trim()).filter(Boolean), open = /open|açıq|aciq/i.test(String(r[1] ?? '')) || !options.length;
    const points = Math.min(100, Math.max(1, parseInt(r[9], 10) || 1));
    if (open) return out.push({ kind: 'open', text, points });
    const c = String(r[8] ?? '').trim().toUpperCase(), correct = /^[A-F]$/.test(c) ? c.charCodeAt(0) - 65 : /^\d$/.test(c) ? Number(c) - 1 : -1;
    if (correct < 0 || correct >= options.length) errors.push(i + 2);
    out.push({ kind: 'mc', text, options, correct, points });
  });
  return { questions: out, errors };
}

/* ---------------------------------------------- answer choices with their own ids
   Choices are { id, text }. The correct answer and the trainee's answer are option ids, never positions, so shuffling the
   choices cannot change a result. Older tests stored plain strings + the index of the correct one: optList() gives those
   the index as id, which keeps old attempts gradable. */
export const optList = q => (q?.options || []).map((o, k) => (o && typeof o === 'object' ? o : { id: k, text: String(o ?? '') }));
export const optText = (q, id) => optList(q).find(o => o.id === id)?.text;
/* choices that refer to other choices ("all of the above", "A and B") must keep their order */
export const keepOrder = q => optList(q).some(o => /hamısı|hamisi|heç biri|hec biri|\b[A-F]\s*(və|ve|and|и)\s*[A-F]\b|all of the above|none of the above|both|все (перечисленные|вышеперечисленное)|ни один/i.test(o.text));

/* ------------------------------------------------------------ approvals
   A test / presentation is usable when it is complete and approved ("active"; older records have no status = active).
   A change to an active test by someone who may not publish is kept as a proposal until approved; the active version stays in use. */
export const usable = x => !!x && !x.draft && (x.status || 'active') === 'active';
export const APPROVAL_KINDS = ['tests', 'materials', 'certs'];
export const approvalsCfg = st => Object.fromEntries(APPROVAL_KINDS.map(k => [k, !!st?.approvals?.[k]]));
/* may this person publish without the approver? admins always; editors unless the setting asks for approval; trainers never */
export const mayPublish = (user, st, what) => user?.kind === 'staff' && (RANK[user.role] >= RANK.admin && !ROLE_ONLY[user.role] || (user.role === 'editor' && !approvalsCfg(st)[what]));
/* a certificate reaches the candidate, the company and the QR page only when it is not waiting for (or returned by) the approver */
export const certDelivered = x => !x?.approval || x.approval.status === 'approved';
