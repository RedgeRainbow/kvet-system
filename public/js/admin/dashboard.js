import { findCerts, A, can, view, api, S, $, $$, esc, t, lang, empty, blank, trainerName, statusBadge, stBadge, pageHead } from './lib.js';

let period = '';
/* the last 36 months, newest first, named in the current language */
const MONTHS = { ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], az: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
function monthOpts(today, cur) {
  let y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)); const out = [];
  for (let i = 0; i < 36; i++) { const v = `${y}-${String(m).padStart(2, '0')}`; out.push(`<option value="${v}" ${v === cur ? 'selected' : ''}>${MONTHS[lang] || MONTHS.az[m - 1]} ${y}</option>`); if (--m < 1) { m = 12; y--; } }
  return out.join('');
}
export default async function ({ rerender }) {
  const el = view(), cfg = A.settings.dash || S.dashCfg({}), [{ counts: k }, soonR] = await Promise.all([findCerts({ size: 0 }), findCerts({ exp: cfg.expDays, sort: 'expiry', size: 8, counts: '0' })]);   // counted by the server
  period = period || cfg.period;
  const st = await api('/stats?' + (/^\d{4}-\d{2}$/.test(period) ? 'period=' + period : 'period=' + period), { kind: 'staff' });
  const queue = can('issue') ? (await api('/issue/queue', { kind: 'staff' })).list : [];
  const live = A.sessions.filter(s => s.status === 'ongoing'), review = A.sessions.filter(s => s.status === 'review');
  const soon = soonR.certs;
  const range = `${st.from}..${st.to}`, nExp = soonR.total;
  const L = {
    issued: '#/certificates/' + S.buildFilter({ issued: range }), exp: '#/certificates/' + S.buildFilter({ exp: cfg.expDays }),
    sess: '#/sessions/' + S.buildFilter({ from: st.from, to: st.to }),
  };
  const pct = st.passRate === null ? '—' : st.passRate.toFixed(1) + '%';
  const TILES = {
    issued: [st.issued, t('tileIssued'), '', L.issued], passRate: [pct, t('tilePassRate'), st.passRate !== null && st.passRate < 70 ? 'warn' : 'ok', L.sess],
    expiring: [nExp, t('tileExpiring', cfg.expDays), 'warn', L.exp], trained: [st.trained, t('tileTrained'), '', L.sess], passed: [st.passed, t('tilePassed'), 'ok', L.sess],
    ongoing: [live.length, t('ongoingSessions'), '', '#/sessions/st=ongoing'], ready: [queue.filter(x => x.outcome === 'PASS').length, t('readyToRelease'), 'ok', '#/issue'],
    soon: [k.SOON, t('cs_SOON'), 'warn', '#/certificates/st=SOON'], expired: [k.EXPIRED, t('cs_EXPIRED'), 'bad', '#/certificates/st=EXPIRED'],
  };
  const tile = ([n, label, cls, href]) => `<a class="stat ${cls}" href="${href}" style="text-decoration:none;display:block"><b>${esc(n)}</b><span>${esc(label)}</span></a>`;
  const tiles = S.DASH_TILES.filter(x => cfg.tiles.includes(x) && (x !== 'ready' || can('issue'))).map(x => tile(TILES[x])).join('');
  const label = period === 'month' ? t('thisMonth') : period === 'lastMonth' ? t('lastMonth') : period === 'year' ? t('thisYear') : period;
  const line = (n, text, href, cls = '') => `<a class="dl ${cls}" href="${href}"><b>${esc(n)}</b> <span>${esc(text)}</span></a>`;
  const bars = (rows, key, nameOf, href) => { const mx = Math.max(1, ...rows.map(r => r[key])); return rows.length ? rows.map(r => `<a class="hb" href="${href(r)}"><span class="nm">${esc(nameOf(r))}</span><span class="tr"><span class="fl" style="width:${Math.max(3, Math.round(r[key] / mx * 100))}%"></span></span><b>${r[key]}</b></a>`).join('') : empty('📊', t('none')); };
  el.innerHTML = pageHead(t('navDashboard')) + `<div class="grid g3" style="margin-bottom:16px">${tiles}</div>
   <div class="bar"><div class="seg">${[['month', t('thisMonth')], ['lastMonth', t('lastMonth')], ['year', t('thisYear')]].map(([v, l]) => `<button data-p="${v}" class="${period === v ? 'on' : ''}">${esc(l)}</button>`).join('')}</div><select id="pm" class="monthsel" aria-label="${esc(t('pickMonth'))}"><option value="">${esc(t('pickMonth'))}…</option>${monthOpts(A.today, period)}</select><span class="mute sm">${esc(S.fmtDate(st.from))} – ${esc(S.fmtDate(st.to))}</span></div>
   <div class="card info-sec"><h2>${esc(label)}</h2><div class="dls">
     ${line(st.trained, t('lineTrained'), L.sess)}${line(st.passed, t('linePassed'), L.sess, 'ok')}${line(pct, t('linePassRate'), L.sess, 'ok')}${line(st.issued, t('lineIssued'), L.issued)}${line(nExp, t('lineExpiring', cfg.expDays), L.exp, 'warn')}</div>
     ${st.pending ? `<p class="mute sm" style="margin:8px 0 0">${esc(t('awaitingResults', st.pending))}</p>` : ''}</div>
   <div class="grid g2"><div class="card"><div class="ch"><h2>${esc(t('volByCompany'))}</h2><span class="grow"></span><span class="mute sm">${esc(t('topN', st.byCompany.length, st.companiesTotal))}</span></div>${bars(st.byCompany, 'trainees', r => r.name || t('private'), r => '#/trainees/' + S.buildFilter({ co: r.id || '-' }))}</div>
   <div class="card"><div class="ch"><h2>${esc(t('mostDelivered'))}</h2><span class="grow"></span><span class="mute sm">${esc(t('topN', st.byCourse.length, st.coursesTotal))}</span></div>${bars(st.byCourse, 'trainees', r => `${r.name} · ${t('nSessions', r.sessions)}`, r => '#/sessions/' + S.buildFilter({ bid: r.bid, from: st.from, to: st.to }))}</div></div>
   <div class="grid g2"><div class="card"><h2>${esc(t('todaySessions'))}</h2>${live.map(s => `<a class="sess" href="#/sessions/${esc(s.id)}" style="text-decoration:none"><b>${esc(blank(s.bid)?.name || '')}</b> ${statusBadge(s.status)}<br><span class="mute sm">${esc(trainerName(s.tid))} · ${esc(t('progressLine', s.stats.confirmed, s.stats.total, s.stats.finalized))}</span></a>`).join('') || empty('📅', t('noLive'))}</div>
   <div class="card"><h2>${esc(t('needsAttention'))}</h2>${review.map(s => `<a class="sess" href="#/sessions/${esc(s.id)}" style="text-decoration:none"><b>${esc(blank(s.bid)?.name || '')}</b> · ${esc(S.fmtDate(s.date))} ${statusBadge(s.status)}<br><span class="mute sm">${esc(t('progressLine', s.stats.confirmed, s.stats.total, s.stats.finalized))}</span></a>`).join('') || empty('✅', t('allClear'))}</div></div>
   <div class="card"><div class="ch"><h2>${esc(t('expiringN', cfg.expDays))}</h2><span class="grow"></span><a class="btn ghost sm" href="${L.exp}">${esc(t('showAll'))}</a></div>${soon.length ? `<div class="tw"><table><tbody>${soon.map(c => `<tr><td class="mono">${esc(c.no)}</td><td>${esc(c.snap.names.az || c.snap.names.en)}</td><td>${esc(c.snap.blank.name)}</td><td>${esc(c.snap.company || t('private'))}</td><td>${esc(S.fmtDate(c.expiry))}</td><td>${stBadge(c.st)}</td></tr>`).join('')}</tbody></table></div>` : empty('👍', t('none'))}</div>
   <div class="grid g4"><a class="stat" href="#/trainees" style="text-decoration:none"><b>${A.counts?.trainees ?? 0}</b><span>${esc(t('navTrainees'))}</span></a><a class="stat" href="#/companies" style="text-decoration:none"><b>${A.companies.length}</b><span>${esc(t('navCompanies'))}</span></a><a class="stat" href="#/trainers" style="text-decoration:none"><b>${A.trainers.length}</b><span>${esc(t('navTrainers'))}</span></a><a class="stat ok" href="#/certificates" style="text-decoration:none"><b>${k.total}</b><span>${esc(t('cTotal'))}</span></a></div>`;
  $$('[data-p]', el).forEach(b => (b.onclick = () => { period = b.dataset.p; rerender(); }));
  $('#pm').onchange = e => { if (e.target.value) { period = e.target.value; rerender(); } };
}
