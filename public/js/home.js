import { esc, t, langSwitch, setLang } from './ui.js';
const app = /** @type {HTMLElement} */ (document.getElementById('app'));
function render() {
  document.title = 'KVET';
  app.innerHTML = `<div class="login-wrap"><div style="width:100%"><div style="text-align:center;margin-bottom:22px"><img class="brandlogo" src="/img/logo.png" alt="KVET" style="height:64px"><h1 style="margin-top:10px">${esc(t('homeTitle'))}</h1><p class="mute">${esc(t('homeSub'))}</p></div>
  <div class="portal-cards">${[['trainer', '🎓', 'portalTrainer', 'portalTrainerD'], ['trainee', '🧑‍🎓', 'portalTrainee', 'portalTraineeD'], ['company', '🏢', 'portalCompany', 'portalCompanyD']]
    .map(([h, i, a, b]) => `<a class="pc" href="/${h}.html"><div class="ic">${i}</div><b>${esc(t(a))}</b><span class="mute sm">${esc(t(b))}</span></a>`).join('')}</div>
  <div style="text-align:center;margin-top:22px">${langSwitch()}</div></div></div>`;
}
document.addEventListener('click', e => { const b = e.target?.closest('[data-lang]'); if (b) { setLang(b.dataset.lang).then(render); } });
render();
