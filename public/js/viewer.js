/* Presentation viewer: renders a .pptx from memory inside the page. No download/save/print controls,
   context menu and common save/print shortcuts are blocked, and a watermark with the viewer's name is overlaid. */
import { openPptx } from './pptx.js';
import { esc, t, fail } from './ui.js';

export async function openViewer({ title, load, watermark = '' }) {
  const ov = document.createElement('div'); ov.className = 'viewer'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', title);
  ov.innerHTML = `<div class="vh"><b>${esc(title)}</b><span class="grow"></span><span id="vc" class="mute">…</span><button class="btn ghost sm" id="vp" style="color:#fff;border-color:#fff">‹</button><button class="btn ghost sm" id="vn" style="color:#fff;border-color:#fff">›</button><button class="btn ghost sm" id="vf" style="color:#fff;border-color:#fff" title="${esc(t('fullscreen'))}">⛶</button><button class="btn sm bad" id="vx">✕ ${esc(t('close'))}</button></div>
   <div class="vs" id="vs"><span class="spin"></span><div class="wm" id="wm"></div></div>`;
  document.body.append(ov); document.body.style.overflow = 'hidden';
  /** @param {string} sel @returns {any} */
  const part = sel => ov.querySelector(sel);
  const vs = part('#vs'); let deck, idx = 0, cur = /** @type {any} */ (null), token = 0;
  const stop = e => e.preventDefault();
  ov.addEventListener('contextmenu', stop); ov.addEventListener('dragstart', stop); ov.addEventListener('copy', stop); ov.addEventListener('cut', stop);
  const onKey = e => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u', 'c', 'a'].includes(e.key.toLowerCase())) return e.preventDefault();
    if (e.key === 'Escape') close(); else if (['ArrowRight', 'PageDown', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); go(idx + 1); } else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) { e.preventDefault(); go(idx - 1); }
  };
  document.addEventListener('keydown', onKey, true);
  const style = document.createElement('style'); style.textContent = '@media print{.viewer{display:none!important}}'; ov.append(style);
  let close = function () { document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', fit); deck?.destroy(); ov.remove(); document.body.style.overflow = ''; if (document.fullscreenElement) document.exitFullscreen?.(); }
  function fit() { if (!cur) return; const k = Math.min(vs.clientWidth / deck.width, vs.clientHeight / deck.height) * 0.98; cur.style.transform = `scale(${k})`; cur.parentElement.style.width = deck.width * k + 'px'; cur.parentElement.style.height = deck.height * k + 'px'; }
  async function go(i) {
    if (!deck || i < 0 || i >= deck.count) return; idx = i; const my = ++token;
    const slide = await deck.render(i); if (my !== token) return;
    vs.querySelector('.slidebox')?.remove(); const box = document.createElement('div'); box.className = 'slidebox'; box.style.cssText = 'position:relative;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.5);background:#fff'; slide.style.transformOrigin = '0 0'; box.append(slide); vs.prepend(box); cur = slide;
    part('#vc').textContent = `${i + 1} / ${deck.count}`; fit();
  }
  part('#vx').onclick = close; part('#vn').onclick = () => go(idx + 1); part('#vp').onclick = () => go(idx - 1);
  part('#vf').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : ov.requestFullscreen?.());
  vs.addEventListener('click', e => { if (e.target?.closest('.slidebox')) go(idx + 1); });
  window.addEventListener('resize', fit);
  // tiled over the whole screen (slides and margins): who is viewing + when, readable on light and dark slides
  if (watermark) { const d = new Date(), stamp = `${esc(watermark)} · ${d.toLocaleDateString('en-GB')} ${d.toTimeString().slice(0, 5)}`;
    part('#wm').innerHTML = `<div class="wm-t">${Array(11).fill(`<div>${Array(5).fill(`<span>${stamp}</span>`).join('')}</div>`).join('')}</div>`; }
  try {
    const buf = await load(), head = new Uint8Array(buf.slice(0, 4));
    if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {       // %PDF: the browser's own PDF viewer, without its toolbar
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
      vs.querySelector('.spin')?.remove(); ['#vp', '#vn', '#vc'].forEach(s => part(s).remove());
      const f = document.createElement('iframe'); f.src = url + '#toolbar=0&navpanes=0&view=FitH'; f.title = title; f.style.cssText = 'width:100%;height:100%;border:0;background:#fff;border-radius:6px';
      vs.prepend(f); const old = close; close = () => { URL.revokeObjectURL(url); old(); }; part('#vx').onclick = close; return { close };
    }
    deck = await openPptx(buf); vs.querySelector('.spin')?.remove(); if (!deck.count) throw new Error('badFile'); await go(0);
  }
  catch (/** @type {any} */ e) { close(); fail(e.message === 'badFile' ? new Error('badFile') : e); }
  return { close };
}
