/* Person form shared by admin (trainee, trainer) and the trainer portal (new candidate). Azerbaijani letters are transliterated live into the Global/English fields until those are edited by hand. */
import * as S from './shared.js';
import { $, $$, esc, t, opts } from './ui.js';

/* companies = [{id,name,on}] */
export function personForm(p = {}, { companies = /** @type {any[]} */ ([]), company = false, specialty = false, foreign = true, finView = true, finRequired = true, phoneRequired = false, consent = false } = {}) {
  const f = p.foreign;
  return `<div class="fg" data-person>
  ${foreign ? `<label class="chk full"><input type="checkbox" name="foreign" ${f ? 'checked' : ''}> ${esc(t('foreignPerson'))}</label>` : ''}
  <label class="req">${esc(t('name'))}<input name="name" value="${esc(p.name)}" required maxlength="60"></label>
  <label class="req">${esc(t('surname'))}<input name="surname" value="${esc(p.surname)}" required maxlength="60"></label>
  <label>${esc(t('father'))}<input name="father" value="${esc(p.father)}" maxlength="60" placeholder="${esc(t('fatherHint'))}"></label>
  <div class="full" data-en-block><div class="b sm" style="margin:2px 0 6px">${esc(t('globalNames'))} <span class="auto" data-auto>${esc(t('autoFilled'))}</span></div></div>
  <label data-en-block>${esc(t('name'))} (EN)<input name="nameEn" value="${esc(p.nameEn)}" maxlength="60"></label>
  <label data-en-block>${esc(t('surname'))} (EN)<input name="surnameEn" value="${esc(p.surnameEn)}" maxlength="60"></label>
  <label data-en-block>${esc(t('father'))} (EN)<input name="fatherEn" value="${esc(p.fatherEn)}" maxlength="60"></label>
  ${foreign ? `<label data-fo-block>${esc(t('docType'))}<select name="docType">${opts(['passport', 'residence', 'id', 'other'].map(k => [k, t('doc_' + k)]), p.docType || 'passport')}</select></label>
  <label data-fo-block>${esc(t('nationality'))}<input name="nationality" value="${esc(p.nationality)}" maxlength="60" list="nat-list"><datalist id="nat-list">${['Azerbaijan', 'Türkiye', 'Georgia', 'Russia', 'Ukraine', 'Kazakhstan', 'Uzbekistan', 'Iran', 'India', 'Pakistan', 'Philippines', 'United Kingdom', 'United States', 'Italy', 'France', 'Germany', 'Norway', 'Netherlands'].map(n => `<option value="${n}">`).join('')}</datalist></label>
  <label class="full" data-fo-block>${esc(t('certLang'))}<select name="certLang">${opts([['both', t('certLangBoth')], ['en', t('certLangEn')]], p.certLang || 'both')}</select><span class="hint">${esc(t('certLangHint'))}</span></label>` : ''}
  <label class="${finRequired && !p.finRemovedAt ? 'req' : ''}"><span data-fin-label>${esc(t('finLabel'))}</span><input name="fin" value="${esc(p.fin)}" ${finView ? '' : 'disabled'} ${finRequired && !p.finRemovedAt ? 'required' : ''} maxlength="20" autocomplete="off" style="text-transform:uppercase"><span class="hint">🔒 ${esc(p.finRemovedAt ? t('finRemoved', S.fmtDate(p.finRemovedAt)) : t('finConfidential'))}</span></label>
  <label class="${phoneRequired ? 'req' : ''}">${esc(t('mobile'))}<input name="phone" value="${esc(p.phone)}" inputmode="tel" maxlength="30" placeholder="+994 50 000 00 00" ${phoneRequired ? 'required' : ''}></label>
  ${!finRequired && !p.id ? `<p class="hint full" style="margin-top:-6px">ℹ ${esc(t('finLaterHint'))}</p>` : ''}
  <label>${esc(t('email'))} <span class="mute">(${esc(t('optional'))})</span><input name="email" type="email" value="${esc(p.email)}" maxlength="120"></label>
  ${company ? `<label>${esc(t('company'))}<select name="co">${opts(companies.filter(c => c.on !== false || c.id === p.co).map(c => [c.id, c.name]), p.co || '', t('privateOpt'))}</select><span class="hint">${esc(t('privateHint'))}</span></label>` : ''}
  ${specialty ? `<label class="full">${esc(t('specialty'))}<input name="specialty" value="${esc(p.specialty)}" maxlength="160"></label>` : ''}
  ${consent ? `<label class="chk full"><input type="checkbox" name="consent" ${p.consent ? 'checked' : ''}> ${esc(t('consentBox'))}${p.consent?.at ? ` <span class="mute xs">(${esc(S.fmtDate(p.consent.at))})</span>` : ''}</label>` : ''}
  <label class="chk full"><input type="checkbox" name="on" ${p.on === false ? '' : 'checked'}> ${esc(t('active'))}</label></div>`;
}

export function bindPerson(root) {
  const g = n => $(`[name=${n}]`, root), pairs = [['name', 'nameEn'], ['surname', 'surnameEn'], ['father', 'fatherEn']];
  const fo = g('foreign'), auto = $('[data-auto]', root);
  const touched = new Set(pairs.filter(([a, b]) => g(b).value && g(b).value !== S.transliterateAzToEn(g(a).value)).map(([, b]) => b));
  const sync = () => { const isF = fo?.checked; $$('[data-en-block]', root).forEach(e => e.classList.toggle('hide', !!isF)); $$('[data-fo-block]', root).forEach(e => e.classList.toggle('hide', !isF)); const fl = $('[data-fin-label]', root); if (fl) fl.textContent = isF ? t('docNumber') : t('finLabel'); };
  const upd = () => { auto.classList.toggle('hide', touched.size === pairs.length && false); };
  for (const [a, b] of pairs) {
    g(a).addEventListener('input', () => { if (!touched.has(b) && !fo?.checked) g(b).value = S.transliterateAzToEn(g(a).value); });
    g(b).addEventListener('input', () => { touched.add(b); });
  }
  fo?.addEventListener('change', sync); sync(); upd();
  g('fin')?.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/\s+/g, ''); });
}

