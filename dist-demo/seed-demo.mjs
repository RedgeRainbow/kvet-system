#!/usr/bin/env node
/* Fills a DEMO installation with made-up data and creates reviewer logins.
     node seed-demo.mjs --url https://kvet-demo.pages.dev --email you@example.com --password '…' [--reviewers a@x.com,b@y.com] [--role reader|editor]
   Everything here is fictional: names, ID numbers (DEMO…), phones, companies. Never run it against the real system. */
const arg = (n, d = '') => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg('url').replace(/\/+$/, ''), EMAIL = arg('email'), PASS = arg('password'), ROLE = ['reader', 'editor'].includes(arg('role')) ? arg('role') : 'reader';
const REVIEWERS = arg('reviewers').split(',').map(s => s.trim()).filter(Boolean);
if (!URL_ || !EMAIL || !PASS) { console.error('usage: node seed-demo.mjs --url https://… --email … --password … [--reviewers a@x.com,b@y.com] [--role reader|editor]'); process.exit(1); }
if (!/demo|localhost|127\.0\.0\.1/i.test(URL_) && !process.argv.includes('--yes-this-is-a-demo')) { console.error('The address does not look like a demo (no "demo" in it). Add --yes-this-is-a-demo if you are sure.'); process.exit(1); }

let T = '';
async function api(path, body, token = T) {
  const r = await fetch(URL_ + '/api' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${path}: ${d.error || r.status}`); return d;
}
const pw = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 55]).join('');
const day = n => new Date(Date.now() + 4 * 36e5 + n * 864e5).toISOString().slice(0, 10);
const pick = (a, i) => a[i % a.length];

const FIRST = ['Elvin', 'Aysel', 'Rauf', 'Nərmin', 'Orxan', 'Günay', 'Tural', 'Leyla', 'Kamran', 'Səbinə', 'Fuad', 'Aynur', 'Rəşad', 'Lalə', 'Murad', 'Fidan', 'Emil', 'Səidə', 'Vüsal', 'Könül'];
const LAST = ['Məmmədov', 'Əliyeva', 'Hüseynov', 'Quliyeva', 'Həsənov', 'İsmayılova', 'Cəfərov', 'Rzayeva', 'Babayev', 'Nəsirova'];
const FATHER = ['Vaqif', 'Elçin', 'Rasim', 'Mübariz', 'Tofiq', 'Zaur', 'Arif', 'Namiq'];

const out = { staff: [], trainer: null, trainee: null, company: null };
T = (await api('/staff/login', { email: EMAIL, password: PASS })).access;
if (!T) { console.error('Sign-in needs a two-factor code: run this before turning on 2FA for this account.'); process.exit(1); }
console.log('signed in');

await api('/settings/save', { company: { name: 'KVET Training Centre (DEMO)', address: 'Demo address, Baku', phone: '+994 00 000 00 00', email: 'demo@example.com', website: 'example.com' } });
await api('/seed', {});
const st0 = await api('/state'), blank = st0.blanks[0], ogc = st0.sheets.find(s => s.id === 'sample-ogc'), ap = st0.sheets.find(s => s.id === 'sample-ap');

const cos = [];
for (const name of ['Caspian Demo Drilling LLC', 'Demo Port Services', 'Absheron Demo Construction']) cos.push((await api('/company/save', { name, contactPerson: 'Demo Contact', phone: '+994500000000', email: 'hr@example.com' })).company ? (await api('/state')).companies.find(c => c.name === name) : null);
const coLogin = await api('/credentials/reset', { kind: 'company', ids: [cos[0].id] }); out.company = coLogin.list[0];

const trainers = [];
for (const [i, n] of [['Rəşad', 'Əliyev'], ['Nigar', 'Kərimova']].entries()) { const r = await api('/trainer/save', { name: n[0], surname: n[1], father: pick(FATHER, i), fin: 'DEMOT' + String(i + 1).padStart(2, '0'), phone: '+99450000010' + i, specialty: 'Lifting operations (demo)' }); trainers.push(r.trainer); if (!i) out.trainer = r.creds; }

const people = [];
for (let i = 0; i < 18; i++) {
  const female = /a$|ə$|n$|r$/.test(pick(FIRST, i)) && i % 2 === 1;
  const r = await api('/trainee/save', { name: pick(FIRST, i), surname: pick(LAST, i * 3 + (female ? 1 : 0)), father: pick(FATHER, i), fin: 'DEMO' + String(i + 1).padStart(3, '0'), phone: '+99455' + String(1000000 + i), co: i < 15 ? cos[i % 3].id : '', consent: true });
  people.push({ ...r.trainee, creds: r.creds });
}
out.trainee = people[0].creds;

// a finished session with certificates, one running today with a practical sheet, one coming up
const ids = list => list.map(p => p.id);
const past = (await api('/session/save', { bid: blank.id, tid: trainers[0].id, date: day(-40), time: '09:00', location: 'Room 1', traineeIds: ids(people.slice(0, 8)) })).session;
for (const p of people.slice(0, 8)) await api('/enr/confirm', { sid: past.id, tid: p.id });
for (const [i, p] of people.slice(0, 8).entries()) {
  const tk = (await api('/login', { role: 'trainee', login: p.creds.login, password: p.creds.password }, '')).token;
  await api('/portal/trainee/feedback', { sid: past.id, r: { g1: 9, g2: 8 + (i % 3), g3: 9, g4: 8, g6: 10 }, cm: {} }, tk).catch(() => {});
  await api('/enr/exam', { sid: past.id, tid: p.id, passed: i !== 6, score: i !== 6 ? 70 + i * 3 : 48 });
}
for (const r of (await api('/issue/bulk', { items: people.slice(0, 8).map(p => ({ sid: past.id, tid: p.id })) })).results) if (!r.ok) console.log('release', r.error);

const today = (await api('/session/save', { bid: blank.id, tid: trainers[0].id, date: day(0), time: '10:00', location: 'Crane yard', sheetId: ogc.id, traineeIds: ids(people.slice(8, 13)) })).session;
for (const p of people.slice(8, 11)) await api('/enr/confirm', { sid: today.id, tid: p.id });
await api('/enr/practical', { sid: today.id, tid: people[8].id, data: { faults: { i2: 1, i11: 1 }, pts: { i11: 4 }, header: { h4: 'B', h5: '5 t', h10: '10', h11: '10:00', h12: '10:12' }, done: true, comments: 'Demo result' } });
await api('/session/save', { bid: blank.id, tid: trainers[1].id, date: day(7), time: '09:30', location: 'Room 2', sheetId: ap?.id || '', traineeIds: ids(people.slice(13, 18)) });

// a request from the demo company
const ctk = (await api('/login', { role: 'company', login: out.company.login, password: out.company.password }, '')).token;
await api('/portal/company/request', { kind: 'training', bid: blank.id, count: 4, note: 'Four new riggers next month (demo request)' }, ctk);

// reviewer logins (limited role, never superadmin)
for (const email of REVIEWERS) { const password = pw(); await api('/users', { email, password, role: ROLE, name: 'Reviewer ' + email.split('@')[0] }); out.staff.push({ email, password, role: ROLE }); }

console.log('\nDemo data created. Logins to give to the reviewers:\n');
console.log(`Admin panel:   ${URL_}/admin.kvet`); for (const s of out.staff) console.log(`  ${s.email}  /  ${s.password}   (${s.role})`);
console.log(`Trainer:       ${URL_}/trainer.html   ${out.trainer.login} / ${out.trainer.password}`);
console.log(`Trainee:       ${URL_}/trainee.html   ${out.trainee.login} / ${out.trainee.password}`);
console.log(`Company:       ${URL_}/company.html   ${out.company.login} / ${out.company.password}`);
