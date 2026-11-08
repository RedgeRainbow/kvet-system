/* Practical sheet form (used by trainers and staff). It mirrors the paper marking sheets:
   - penalty (overhead crane): per criterion a number of FAULTS x PENALTY points = AWARD, time block (duration / excess time worked out), mandatory disqualification, total against the limit
   - rating (appointed person): 1-5 or N/A per duty
   - passfail: Pass / Fail / N/A per criterion
   Live total and PASS/FAIL use the same scoring code as the server. */
import * as S from './shared.js';
import { esc, t, badge } from './ui.js';

/* auto = values for header fields that fill themselves: { candidate, company, date, learnerNo, training, location } */
export function practicalForm(sheet, prac, { candidate = '', att = '', examiner = '', auto = {}, readOnly = false } = {}) {
  const ro = readOnly ? 'disabled' : '';
  let n = 0;
  const pen = sheet.mode === 'penalty';
  const hdrInput = h => {
    const ty = h.type || 'text';
    if (ty === 'duration' || ty === 'excess') return `<label>${esc(h.label)}<input data-h="${esc(h.id)}" data-ty="${ty}" readonly tabindex="-1" style="background:var(--soft)"></label>`;
    return `<label>${esc(h.label)}<input data-h="${esc(h.id)}" data-ty="${ty}" ${ty === 'time' ? 'type="time"' : ty === 'number' ? 'type="number" min="0" max="999" inputmode="numeric"' : 'maxlength="120"'} ${ro}></label>`;
  };
  const ctl = it => {
    if (sheet.mode === 'passfail') return `<span class="pf" data-i="${esc(it.id)}">${[['P', t('pass')], ['F', t('fail')], ['NA', 'N/A']].map(([v, l]) => `<button type="button" class="${v === 'NA' ? 'NA' : v}" data-v="${v}" ${ro}>${esc(l)}</button>`).join('')}</span>`;
    if (sheet.mode === 'rating') return `<span class="pf" data-i="${esc(it.id)}">${[1, 2, 3, 4, 5].map(v => `<button type="button" class="r" data-v="${v}" title="${esc(t('scale' + v))}" ${ro}>${v}</button>`).join('')}<button type="button" class="n" data-v="NA" ${ro}>N/A</button></span>`;
    const r = S.penaltyRange(it), range = r.max > r.min;
    return `<span class="fault" data-i="${esc(it.id)}"><button type="button" class="btn ghost sm" data-f="-1" aria-label="−" ${ro}>−</button><b class="fn" data-n>0</b><button type="button" class="btn ghost sm" data-f="1" aria-label="+" ${ro}>+</button>`
      + `<span class="x">×</span>${range ? `<select data-p ${ro}>${Array.from({ length: Math.round(r.max - r.min) + 1 }, (_, k) => r.min + k).map(v => `<option value="${v}" ${v === r.max ? 'selected' : ''}>${v}</option>`).join('')}</select>` : `<b class="pv">${esc(r.max)}</b>`}<span class="x">=</span><b class="aw" data-aw>0</b></span>`;
  };
  // header fields: grouped into boxes like the paper form (Candidate / Truck Type / Time), loose fields in a plain grid
  const hdrBlock = () => {
    const hf = sheet.headerFields || []; if (!hf.length) return '';
    const groups = [...new Set(hf.map(h => h.group || ''))], loose = hf.filter(h => !h.group);
    return (groups.some(Boolean) ? `<div class="hgrp">${groups.filter(Boolean).map(g => `<div class="hbox"><h4>${esc(g)}</h4>${hf.filter(h => h.group === g).map(hdrInput).join('')}</div>`).join('')}</div>` : '')
      + (loose.length ? `<div class="fg">${loose.map(hdrInput).join('')}</div>` : '');
  };
  const html = `<div class="ps" id="ps"><p class="mute" style="margin-top:0"><b>${esc(candidate)}</b> ${att ? `· <span class="mono">${esc(att)}</span>` : ''}</p>
   ${sheet.note ? `<div class="banner">${esc(sheet.note)}</div>` : ''}
   ${hdrBlock()}
   ${pen ? `<div class="pen-head"><span>${esc(t('criteria'))}</span><span>${esc(t('faults'))} × ${esc(t('penalty'))} = ${esc(t('award'))}</span></div>` : ''}
   ${(sheet.sections || []).map(s => `<h3>${esc(s.title)}</h3>${s.items.map(it => `<div class="pi"><span class="n">${++n}</span><span class="tx">${esc(it.text)}${pen ? ` <span class="mute xs">(${esc(it.penalty)})</span>` : ''}</span>${ctl(it)}</div>`).join('')}`).join('')}
   ${(sheet.disq || []).length && sheet.mode !== 'rating' ? `<h3>${esc(t('disqualification'))}</h3><div class="col">${sheet.disq.map(d => `<label class="chk"><input type="checkbox" data-d="${esc(d.id)}" ${ro}> ${esc(d.text)}</label>`).join('')}</div>` : ''}
   ${sheet.timePenalty ? `<label style="margin-top:12px">${esc(t('timePenalties'))}<input type="number" min="0" max="999" id="tp" value="0" ${ro} style="max-width:140px"><span class="hint" id="tph"></span></label>` : ''}
   <label style="margin-top:12px">${esc(t('commentsTask'))}<textarea id="pc" maxlength="2000" ${ro}></textarea></label>
   <div class="fg"><label>${esc(t('examiner'))}<input id="pe" maxlength="120" value="${esc(examiner)}" ${ro}></label><label>${esc(t('examinerReg'))}<input id="pr" maxlength="40" ${ro}></label></div>
   ${pen ? `<label class="done"><input type="checkbox" id="pdn" ${ro}> ${esc(t('pracDone'))}</label><p class="hint">${esc(t('pracDoneHint'))}</p>` : ''}
   <div class="totals" id="tot"></div></div>`;
  return { html, bind(root) {
    const legacy = prac?.answers || {};
    const m = { done: !!prac?.done || (pen && !!prac && prac.result !== 'INCOMPLETE' && prac.done === undefined), answers: { ...legacy }, faults: { ...(prac?.faults || {}) }, pts: { ...(prac?.pts || {}) }, disq: [...(prac?.disq || [])], header: { ...(prac?.header || {}) }, timePenalty: prac?.timePenalty ?? undefined, comments: prac?.comments || '' };
    if (pen) { for (const it of S.sheetItems(sheet)) if (!(it.id in m.faults) && Number(legacy[it.id]) > 0) { m.faults[it.id] = 1; m.pts[it.id] = Number(legacy[it.id]); } m.answers = {}; }
    // header fields that fill themselves (still editable)
    for (const h of sheet.headerFields || []) if (!m.header[h.id] && h.auto && auto[h.auto]) m.header[h.id] = String(auto[h.auto]);
    const ps = root.querySelector('#ps'), tp = ps.querySelector('#tp');
    let tpTouched = prac?.timePenalty !== undefined && prac?.timePenalty !== null;
    ps.querySelectorAll('[data-h]').forEach(i => { if (!['duration', 'excess'].includes(i.dataset.ty)) i.value = m.header[i.dataset.h] || ''; });
    ps.querySelectorAll('[data-d]').forEach(i => (i.checked = m.disq.includes(i.dataset.d)));
    ps.querySelector('#pc').value = m.comments; ps.querySelector('#pr').value = prac?.examinerReg || '';
    const dn = ps.querySelector('#pdn'); if (dn) dn.checked = m.done;
    if (pen) ps.querySelectorAll('.fault').forEach(g => { const s = g.querySelector('[data-p]'); if (s && m.pts[g.dataset.i] !== undefined) s.value = m.pts[g.dataset.i]; });
    const calc = () => {
      const tc = S.timeCalc(sheet, m.header);
      ps.querySelectorAll('[data-ty=duration]').forEach(i => (i.value = tc.duration === null ? '' : S.fmtMin(tc.duration)));
      ps.querySelectorAll('[data-ty=excess]').forEach(i => (i.value = tc.excess === null ? '' : S.fmtMin(tc.excess)));
      if (tp) {
        const sug = S.suggestTimePenalty(sheet, m.header);
        if (!tpTouched) { m.timePenalty = sug; tp.value = sug; } else tp.value = m.timePenalty ?? 0;
        const hint = ps.querySelector('#tph'); if (hint) hint.textContent = tc.excess ? t('timeAuto', S.fmtMin(tc.excess), sug) : '';
      }
    };
    const clean = () => { try { return S.validateSheetData(sheet, { ...m, timePenalty: m.timePenalty ?? undefined }); } catch { return { ...m }; } };
    const paint = () => {
      calc();
      if (pen) ps.querySelectorAll('.fault').forEach(g => {
        const id = g.dataset.i, f = m.faults[id] || 0, sel = g.querySelector('[data-p]'), r = S.penaltyRange(S.sheetItems(sheet).find(x => x.id === id));
        const p = sel ? Number(sel.value) : r.max; g.querySelector('[data-n]').textContent = f; g.querySelector('[data-aw]').textContent = f * p; g.closest('.pi').classList.toggle('hit', f > 0);
      });
      else ps.querySelectorAll('.pf').forEach(g => { const v = m.answers[g.dataset.i]; g.querySelectorAll('button').forEach(b => b.classList.toggle('on', v !== undefined && String(v) === b.dataset.v)); });
      const c = clean(), r = S.evaluateSheet(sheet, c);
      const tpv = pen && sheet.timePenalty ? Number(c.timePenalty) || 0 : 0;
      ps.querySelector('#tot').innerHTML = `${pen ? `<span class="sumrow"><span>${esc(t('faultPoints'))}: <b>${r.total - tpv}</b></span>${sheet.timePenalty ? `<span>${esc(t('timePenalties'))}: <b>${tpv}</b></span>` : ''}</span>` : ''}<b>${esc(t('total'))}: ${r.total}${pen ? ' / ' + esc(sheet.rule?.maxPenalty ?? 40) : r.max ? ' / ' + r.max : ''}</b>${r.avg !== null ? `<span>${esc(t('average'))}: ${r.avg.toFixed(2)}</span>` : ''}<span class="grow"></span>${badge(r.result === 'PASS' ? 'PASS' : r.result === 'FAIL' ? 'FAIL' : 'PENDING', t('pr_' + r.result))}${r.reason ? `<span class="mute sm">${esc(t('why_' + r.reason))}</span>` : ''}`;
    };
    ps.addEventListener('click', e => {
      const fb = e.target.closest('.fault [data-f]');
      if (fb && !fb.disabled) {
        const g = fb.closest('.fault'), id = g.dataset.i; m.faults[id] = Math.max(0, Math.min(99, (m.faults[id] || 0) + Number(fb.dataset.f)));
        if (!m.faults[id]) { delete m.faults[id]; delete m.pts[id]; } else { const s = g.querySelector('[data-p]'); if (s) m.pts[id] = Number(s.value); }
        return paint();
      }
      const b = e.target.closest('.pf button'); if (!b || b.disabled) return;
      const id = b.parentElement.dataset.i, raw = b.dataset.v, v = raw === 'P' || raw === 'F' || raw === 'NA' ? raw : Number(raw);
      if (m.answers[id] === v) delete m.answers[id]; else m.answers[id] = v; paint();
    });
    ps.addEventListener('change', e => { const s = e.target.closest('[data-p]'); if (s) { const id = s.closest('.fault').dataset.i; if (m.faults[id]) m.pts[id] = Number(s.value); paint(); } });
    ps.addEventListener('input', e => {
      const x = e.target;
      if (x.id === 'pdn') m.done = x.checked; else if (x.dataset.h) m.header[x.dataset.h] = x.value; else if (x.id === 'tp') { m.timePenalty = Number(x.value) || 0; tpTouched = true; } else if (x.id === 'pc') m.comments = x.value;
      if (x.dataset.d) m.disq = [...ps.querySelectorAll('[data-d]')].filter(i => i.checked).map(i => i.dataset.d);
      paint();
    });
    paint();
    return { collect: () => { const c = clean(); return { ...c, timePenalty: m.timePenalty ?? c.timePenalty, examiner: ps.querySelector('#pe').value, examinerReg: ps.querySelector('#pr').value }; }, result: () => S.evaluateSheet(sheet, clean()) };
  } };
}
