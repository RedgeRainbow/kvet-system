import { esc } from './ui.js';

/* the chat bubbles, shared look with the trainee portal */
export const chatHtml = (list, waiting = false) => list.map(m => `<div class="msg ${m.role}${m.error ? ' err' : ''}${m.role === 'assistant' && m.grounded === false ? ' nokb' : ''}"><div class="b">${esc(m.text)}</div>${m.sources?.length ? `<div class="src">📚 ${m.sources.map(esc).join(' · ')}</div>` : ''}</div>`).join('') + (waiting ? `<div class="msg assistant"><div class="b"><span class="spin" style="width:14px;height:14px"></span></div></div>` : '');
