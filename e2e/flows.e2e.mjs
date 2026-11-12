/* End-to-end tests: the real pages in a real browser (Chromium, via Playwright) against the local server
   (tools/dev-server.mjs: the production /api code on in-memory storage).
     npm run e2e            (needs Playwright + Chromium: npm i -D playwright && npx playwright install chromium)
   Every test fails on any JavaScript error in the page, so a broken screen cannot slip through. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { start } from '../tools/dev-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 8800 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
const STAFF = { email: 'boss@kvet.az', password: 'bosspass123' };

let srv, browser, T = '';
/* setting data up goes through the API (fast); what is tested goes through the pages */
async function api(path, body, token = T) {
  const r = await fetch(BASE + '/api' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${path}: ${r.status} ${d.error || ''}`); return d;
}
/* a page that records every error: uncaught exceptions, console errors, failed API calls (5xx) */
async function page() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource: (the server responded with a status of 4\d\d|net::ERR_CONNECTION_REFUSED)/.test(m.text())) errors.push('console: ' + m.text()); });
  // (connection refused = the optional camera bridge on this computer is not running: expected here)
  p.on('response', r => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return { p, errors, close: () => ctx.close() };
}
async function signIn(p, url, user, password) {
  await p.goto(BASE + url); await p.fill('#lf [name=u]', user); await p.fill('#lf [name=p]', password); await p.click('#lf button');
}
const D = {};

test.before(async () => {
  srv = await start(PORT); browser = await chromium.launch();
  T = (await api('/staff/login', STAFF, '')).access;
  await api('/seed', {});
  const st = await api('/state');
  D.blank = st.blanks[0];
  const co = await api('/company/save', { name: 'E2E Drilling LLC' }); D.company = co;
  const tr = await api('/trainer/save', { name: 'Rauf', surname: 'Həsənov', father: 'Vaqif oğlu', fin: 'TRE2E01', phone: '+994501110000', specialty: 'PA' }); D.trainer = tr;
  const te = await api('/trainee/save', { name: 'Aysel', surname: 'Quliyeva', father: 'Elçin qızı', fin: '7E2E001', phone: '+994502220000', co: co.company.id, consent: true }); D.trainee = te;
  const today = st.today; D.today = today;
  // an online exam for a second candidate (2 questions, the right answer is "b")
  await api('/settings/save', { fbRequired: false });
  const Q = [{ kind: 'mc', text: 'Q one', options: ['a', 'b'], correct: 1 }, { kind: 'mc', text: 'Q two', options: ['a', 'b'], correct: 1 }];
  const ex = (await api('/test/save', { bid: D.blank.id, title: 'E2E test', grading: 'rate', passRate: 50, timeLimit: 10, questions: Q })).test;
  D.examinee = await api('/trainee/save', { name: 'Orxan', surname: 'Babayev', father: 'Arif oğlu', fin: '7E2E002', phone: '+994503330000', consent: true });
  D.session = (await api('/session/save', { bid: D.blank.id, tid: tr.trainer.id, date: today, examMode: 'bank', examId: ex.id, traineeIds: [D.examinee.trainee.id] })).session;
  await api('/enr/confirm', { sid: D.session.id, tid: D.examinee.trainee.id });
  await api('/session/exam', { sid: D.session.id, open: true });
  D.cert = (await api('/cert/issue-direct', { tid: te.trainee.id, bid: D.blank.id, start: today, end: today })).cert;
});
test.after(async () => { await browser?.close(); srv?.close(); });

test('office panel: sign in, then every menu page opens without an error', async () => {
  const { p, errors, close } = await page();
  await signIn(p, '/admin.kvet', STAFF.email, STAFF.password);
  await p.waitForSelector('#nav a[href^="#/"]');
  const routes = await p.$$eval('#nav a[href^="#/"]', as => [...new Set(as.map(a => a.getAttribute('href')))]);
  assert.ok(routes.length >= 15, 'menu has its pages: ' + routes.length);
  for (const r of routes) {
    await p.evaluate(h => { location.hash = h; }, r);
    await p.waitForFunction(() => (document.querySelector('#view')?.textContent || '').trim().length > 20, null, { timeout: 8000 })
      .catch(() => errors.push('empty page ' + r));
    await p.waitForTimeout(150);
  }
  assert.deepEqual(errors, [], errors.join('\n'));
  await close();
});

test('certificate: shown in the office list, its preview renders, and the public QR page confirms it', async () => {
  const { p, errors, close } = await page();
  await signIn(p, '/admin.kvet', STAFF.email, STAFF.password);
  await p.waitForSelector('#nav');
  await p.evaluate(() => { location.hash = '#/certificates'; });
  await p.waitForSelector(`text=${D.cert.no}`);
  await p.click(`text=${D.cert.no}`);
  const doc = await p.waitForSelector('dialog[open] .doc, dialog[open] iframe, .pvbox .doc', { timeout: 8000 });
  assert.ok(doc, 'the certificate preview opens');
  // the verification page anyone reaches by scanning the QR code
  await p.goto(`${BASE}/verify.html?n=${encodeURIComponent(D.cert.no)}&h=${encodeURIComponent(D.cert.vh)}`);
  await p.waitForSelector(`text=${D.cert.no}`);
  const txt = await p.textContent('body');
  assert.match(txt || '', /Quliyeva/i, 'the holder is named');
  // a made-up number is not confirmed
  await p.goto(`${BASE}/verify.html?n=NOPE-1&h=x`); await p.waitForTimeout(600);
  assert.doesNotMatch(await p.textContent('body') || '', /Quliyeva/i);
  assert.deepEqual(errors, [], errors.join('\n'));
  await close();
});

test('portals: trainer, company and candidate sign in, see their home page and open the bell panel', async () => {
  const people = [['/trainer', D.trainer.creds], ['/company', D.company.creds], ['/trainee', D.trainee.creds]];
  for (const [url, cr] of people) {
    const { p, errors, close } = await page();
    await signIn(p, url, cr.login, cr.password);
    if (url === '/trainee') {          // a candidate registered by the office completes a short profile first, if asked
      await p.waitForTimeout(800);
    }
    await p.waitForSelector('#bellBtn', { timeout: 8000 });
    await p.click('#bellBtn'); await p.waitForSelector('#npanel');
    await p.keyboard.press('Escape');
    assert.deepEqual(errors, [], url + ':\n' + errors.join('\n'));
    await close();
  }
});

test('online exam: the network drops before the hand-in; the answers wait on the phone and arrive when it is back', async () => {
  const { p, errors, close } = await page(), cr = D.examinee.creds;
  await signIn(p, '/trainee', cr.login, cr.password);
  await p.click(`[data-test="${D.session.id}"]`);
  await p.waitForSelector('label.tqo');
  const pickB = async n => { const ls = await p.$$('label.tqo'); let k = 0; for (const l of ls) if (/\)\s*b$/.test((await l.textContent() || '').trim()) && k++ === n) { await l.click(); return; } throw new Error('option b not found'); };
  await pickB(0);
  await p.waitForTimeout(3600);                               // the first answer is saved to the server (3 s after a change)
  await p.context().setOffline(true);                         // the phone loses its connection
  await pickB(1);
  await p.click('#tsend');
  await p.click('dialog[open] button:not(.ghost)');           // "Hand in?" -> yes
  await p.waitForSelector('#tnet:not([hidden])', { timeout: 6000 });   // offline banner: the hand-in is waiting on the phone
  const kept = await p.evaluate(sid => localStorage.getItem('kvet.test.' + sid), D.session.id);
  assert.ok(kept && JSON.parse(kept).sub, 'the hand-in is kept on the phone');
  await p.context().setOffline(false);                        // back online: it is sent by itself
  let enr; for (let i = 0; i < 40 && !(enr?.test?.status === 'graded'); i++) { await p.waitForTimeout(500); enr = (await api('/session?id=' + D.session.id)).enrs.find(e => e.tid === D.examinee.trainee.id); }
  assert.equal(enr?.test?.status, 'graded'); assert.equal(enr.test.pct, 100, 'both answers counted');
  assert.deepEqual(errors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError/.test(e)), [], errors.join('\n'));
  await close();
});

test('bell: remind tomorrow, dismiss one event, clear all', async () => {
  const ck = (await api('/login', { role: 'company', login: D.company.creds.login, password: D.company.creds.password }, '')).token;
  for (const note of ['one', 'two']) await api('/portal/company/request', { kind: 'training', bid: D.blank.id, note }, ck);
  const { p, errors, close } = await page();
  await signIn(p, '/admin.kvet', STAFF.email, STAFF.password);
  await p.waitForSelector('#bellBtn'); await p.click('#bellBtn'); await p.waitForSelector('#npanel [data-later]');
  await p.click('#npanel .nrow.todo [data-later]');
  await p.waitForSelector('#npanel .nfoot');                         // "1 to-do put off until tomorrow · Show everything again"
  const before = await p.$$eval('#npanel [data-hide]', b => b.length); assert.ok(before >= 2);
  await p.click('#npanel [data-hide]');
  await p.waitForFunction(n => document.querySelectorAll('#npanel [data-hide]').length === n - 1, before);
  await p.click('#npanel [data-clear]');
  await p.waitForFunction(() => !document.querySelector('#npanel [data-hide]'));
  await p.click('#npanel [data-showall]');
  await p.waitForSelector('#npanel [data-hide]');
  assert.deepEqual(errors, [], errors.join('\n'));
  await close();
});

test('team messages: an approver writes to the superadmin, who reads and answers', async () => {
  await api('/users', { email: 'apv.e2e@kvet.az', password: 'Passw0rd!x', role: 'approver', name: 'Nərmin' });
  await api('/staff/profile', { name: 'Boss', title: 'Director' });
  const a = await page();
  await signIn(a.p, '/admin.kvet', 'apv.e2e@kvet.az', 'Passw0rd!x');
  await a.p.waitForSelector('#nav a[href="#/messages"]'); await a.p.click('#nav a[href="#/messages"]');
  await a.p.click('#newM'); await a.p.waitForSelector('#rl [data-pick]'); await a.p.click('#rl [data-pick]');
  await a.p.fill('#mtxt', 'Salam! Sertifikatı yoxlayın, zəhmət olmasa.'); await a.p.click('#msend button');
  await a.p.waitForSelector('#mlog .msg.user');
  const b = await page();
  await signIn(b.p, '/admin.kvet', STAFF.email, STAFF.password);
  await b.p.waitForSelector('#nav a[href="#/messages"] .n, #nav a[href="#/messages"] [class*=cnt]', { timeout: 8000 }).catch(() => {});
  await b.p.click('#nav a[href="#/messages"]'); await b.p.waitForSelector('#thl [data-th^="dm:"]'); await b.p.click('#thl [data-th^="dm:"]');
  await b.p.waitForSelector('#mlog .msg.assistant');
  await b.p.fill('#mtxt', 'Baxıram.'); await b.p.click('#msend button'); await b.p.waitForSelector('#mlog .msg.user');
  assert.deepEqual([...a.errors, ...b.errors], [], [...a.errors, ...b.errors].join('\n'));
  await a.close(); await b.close();
});

test('signature reminder: beside the menu, ✕ puts it off until tomorrow, also after reloading', async () => {
  const { p, errors, close } = await page();
  await signIn(p, '/admin.kvet', STAFF.email, STAFF.password);
  await p.waitForSelector('#signPill .sp-go', { timeout: 10000 });
  const box = await p.$eval('#signPill', el => el.getBoundingClientRect().left), nav = await p.$eval('#nav', el => el.getBoundingClientRect().right);
  assert.ok(box >= nav, 'does not cover the menu');
  await p.click('#signPill .sp-x'); await p.waitForSelector('#signPill', { state: 'detached' });
  await p.reload(); await p.waitForSelector('#nav'); await p.waitForTimeout(2500);
  assert.equal(await p.$('#signPill'), null, 'still put off after reloading');
  assert.deepEqual(errors, [], errors.join('\n'));
  await close();
});

test('wrong password: a clear message, no sign-in', async () => {
  const { p, errors, close } = await page();
  await signIn(p, '/admin.kvet', STAFF.email, 'wrong-password');
  await p.waitForFunction(() => (document.querySelector('#le')?.textContent || '').length > 3);
  assert.equal(await p.$('#nav'), null);
  assert.deepEqual(errors.filter(e => !e.includes('401')), []);
  await close();
});

test('phone size: the landing page and sign-in fit the screen (no sideways scrolling)', async () => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 }, deviceScaleFactor: 1 }), p = await ctx.newPage();
  for (const u of ['/', '/trainee', '/admin.kvet']) {
    await p.goto(BASE + u); await p.waitForTimeout(300);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 1, `${u} overflows by ${over}px`);
  }
  await ctx.close();
});
