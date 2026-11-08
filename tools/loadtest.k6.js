/* Load test for a STAGING copy of the system (never production): k6 (https://k6.io) simulates candidates sitting an exam.

   Prepare on staging: a session with an online test, N candidates in it (attendance confirmed), exam started.
   Export their logins: Session -> "Login cards" gives login / password; save them as accounts.csv ("login,password" per line).

   Run (100 / 300 / 500 / 1000 simultaneous candidates):
     k6 run -e BASE=https://staging.example.pages.dev -e SID=<session id> -e VUS=300 tools/loadtest.k6.js

   Each virtual candidate: signs in, opens the home page, keeps the live poll running, opens the test, answers every
   question with an autosave per answer (like the real page), waits, and hands in. Pass criteria (thresholds below):
   95 % of requests under 1.5 s, under 1 % failures, every hand-in accepted. */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';

const BASE = __ENV.BASE, SID = __ENV.SID, VUS = Number(__ENV.VUS || 100);
const accounts = new SharedArray('accounts', () => open('./accounts.csv').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split(',')));
const handedIn = new Counter('handed_in'), refused = new Counter('hand_in_refused');

export const options = {
  scenarios: { exam: { executor: 'per-vu-iterations', vus: VUS, iterations: 1, maxDuration: '20m' } },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1500'], hand_in_refused: ['count<1'] },
};
const json = (r) => { try { return r.json(); } catch { return {}; } };
const post = (path, body, tok) => http.post(BASE + '/api' + path, JSON.stringify(body), { headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) } });
const get = (path, tok) => http.get(BASE + '/api' + path, { headers: { authorization: 'Bearer ' + tok } });

export default function () {
  const [login, password] = accounts[(__VU - 1) % accounts.length];
  sleep(Math.random() * 20);                                        // people arrive over ~20 seconds
  const tok = json(post('/login', { role: 'trainee', login, password })).token;
  if (!check(tok, { 'signed in': t => !!t })) return;
  check(get('/portal/trainee/home', tok), { home: r => r.status === 200 });
  const view = json(get('/portal/trainee/test?sid=' + SID, tok));
  if (!check(view, { 'test opened': v => Array.isArray(v.questions) })) return;
  const answers = {};
  for (const q of view.questions) {
    sleep(3 + Math.random() * 6);                                    // reading and answering
    if (q.options?.length) answers[q.id] = q.options[Math.floor(Math.random() * q.options.length)].id; else answers[q.id] = 'answer text';
    check(post('/portal/trainee/test/save', { sid: SID, answers }, tok), { autosave: r => r.status === 200 });
    if (Math.random() < 0.3) get('/portal/trainee/rev', tok);        // the live poll
  }
  const r = post('/portal/trainee/test/submit', { sid: SID, answers }, tok);
  if (r.status === 200) handedIn.add(1); else { refused.add(1); console.warn(`hand-in refused for ${login}: ${r.status} ${r.body}`); }
}
