/* AZ / EN / RU. dict.js holds Azerbaijani + English, dict_ru.js Russian; test/i18n.test.mjs checks that every t('key') used in the app exists in all three. */
import { DICT } from './dict.js';
let RU = {};                                   // Russian is loaded only when it is used (saves ~120 KB for everyone else)
const loadRu = async () => { if (!RU.__ok) { try { RU = (await import('./dict_ru.js')).RU; RU.__ok = 1; } catch {} } };
export const LANGS = ['az', 'en', 'ru'];
const LS = (() => { try { return localStorage; } catch { return {}; } })();
export let lang = LANGS.includes(LS.kvetLang) ? LS.kvetLang : 'az';
if (lang === 'ru') await loadRu();
export function t(key, ...v) {
  const e = DICT[key];
  if (!e) { console.warn('i18n missing:', key); return key; }
  let s = lang === 'ru' ? RU[key] ?? e[1] : e[lang === 'en' ? 1 : 0];
  v.forEach((x, i) => { s = s.replaceAll('{' + i + '}', x); });
  return s;
}
export const tr = key => (DICT[key] ? t(key) : key);          // translate only when a key exists (server error codes)
export async function setLang(l) { const n = LANGS.includes(l) ? l : 'az'; if (n === 'ru') await loadRu(); lang = n; try { LS.kvetLang = lang; } catch {} document.documentElement.lang = lang; }
document.documentElement.lang = lang;
export const langSwitch = () => `<div class="seg" role="group" aria-label="Language">${LANGS.map(l => `<button data-lang="${l}" class="${lang === l ? 'on' : ''}" lang="${l}">${l.toUpperCase()}</button>`).join('')}</div>`;
