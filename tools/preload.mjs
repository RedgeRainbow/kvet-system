/* Writes <link rel="modulepreload"> hints into each page for every module its entry script imports statically.
   Without them the browser discovers the modules one level at a time (main.js -> ui.js -> i18n.js -> dict.js …), one round
   trip per level; with them every module is requested at once. Run after changing imports: node tools/preload.mjs
   (test/preload.test.mjs fails when a page's hints are out of date). */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const IMP = /(?:^|[;\n}])\s*(?:import|export)\s+(?:[^'"`;]*?\sfrom\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;
export function graph(entry) {
  const seen = new Set(), walk = f => {
    if (seen.has(f)) return; seen.add(f);
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(IMP)) walk(resolve(dirname(f), m[1]));
  };
  walk(resolve(ROOT, entry.replace(/^\//, '')));
  return [...seen].map(f => '/' + relative(ROOT, f).split('\\').join('/'));
}
const START = '<!--preload-->', END = '<!--/preload-->';
export function withHints(html) {
  const m = html.match(/<script type="module" src="([^"]+)"><\/script>/); if (!m) return html;
  const links = graph(m[1]).filter(p => p !== m[1]).map(p => `<link rel="modulepreload" href="${p}">`).join('');
  const block = START + links + END, clean = html.replace(new RegExp(START + '[\\s\\S]*?' + END), '');
  return clean.replace('</head>', block + '</head>');
}
export const PAGES = ['index.html', 'trainer.html', 'trainee.html', 'company.html', 'staff-panel-7q3k.html', 'verify.html'];
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const p of PAGES) { const f = resolve(ROOT, p), a = readFileSync(f, 'utf8'), b = withHints(a); if (a !== b) { writeFileSync(f, b); console.log('updated', p); } }
}
