#!/usr/bin/env node
/* Builds a review / demo copy of the system in ../dist-demo:
   - all browser code bundled + minified into a few files (hard to read, no comments, no file structure)
   - copyright notice on top of every script and page
   - a "DEMO" banner on every page
   - its own wrangler.toml (separate Cloudflare project, R2 bucket and Supabase project - never the real ones)
   - no documentation, tests or tools except the demo seeding script
   Usage: node tools/build-demo.mjs   (needs esbuild: `npm i -D esbuild` or a global install) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), out = path.join(root, 'dist-demo');
const require = createRequire(import.meta.url);
let esbuild; for (const p of ['esbuild', '/opt/npm-tools/node_modules/esbuild']) { try { esbuild = require(p); break; } catch {} }
if (!esbuild) { console.error('esbuild is needed: npm i -D esbuild'); process.exit(1); }

const YEAR = new Date().getFullYear();
const NOTICE = `/*! © ${YEAR} KVET (Knowledge Vision Education & Training). All rights reserved. Proprietary software - copying, modification, reuse or distribution without written permission is prohibited. Demo build for review only. */`;
const copy = (a, b) => fs.cpSync(path.join(root, a), path.join(out, b ?? a), { recursive: true });

fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
// server side (never sent to browsers) + database schema
copy('functions'); copy('schema.sql'); copy('package.json');
// the server shares its rules with the browser (public/js/shared.js); the demo ships only the minified browser copy, so the server gets its own
copy('public/js/shared.js', 'functions/_lib/shared.js');
{ const core = path.join(out, 'functions/_lib/core.js'); fs.writeFileSync(core, fs.readFileSync(core, 'utf8').replace("'../../public/js/shared.js'", "'./shared.js'")); }
// static files: everything except the readable browser source and the camera bridge download
fs.mkdirSync(path.join(out, 'public'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'public'))) if (!['js', 'tools', '_cmp'].includes(f)) copy(path.join('public', f));
fs.mkdirSync(path.join(out, 'public/js'), { recursive: true });

// bundle + minify every page's entry script; shared code goes into hashed chunks
const entries = ['home', 'verify', 'admin/main', 'trainer/main', 'trainee/main', 'company/main'].map(e => path.join(root, 'public/js', e + '.js'));
await esbuild.build({ entryPoints: entries, outbase: path.join(root, 'public/js'), outdir: path.join(out, 'public/js'), bundle: true, splitting: true, format: 'esm',
  minify: true, legalComments: 'none', banner: { js: NOTICE }, chunkNames: 'c/[hash]', target: 'es2022', logLevel: 'error' });

// demo banner (a small script: the CSP only allows scripts from the site itself)
fs.writeFileSync(path.join(out, 'public/js/demo.js'), `${NOTICE}\n(()=>{const b=document.createElement('div');b.textContent='DEMO · test məlumatları / test data only · © ${YEAR} KVET – bütün hüquqlar qorunur / all rights reserved';b.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b45309;color:#fff;font:600 12px/1.4 system-ui,sans-serif;text-align:center;padding:5px 8px;pointer-events:none';document.addEventListener('DOMContentLoaded',()=>{document.body.append(b);document.body.style.paddingBottom='28px'});document.title='DEMO · '+document.title})();\n`);
for (const f of fs.readdirSync(path.join(out, 'public')).filter(f => f.endsWith('.html'))) {
  const p = path.join(out, 'public', f); let h = fs.readFileSync(p, 'utf8');
  h = `<!-- © ${YEAR} KVET. All rights reserved. Demo build for review only. -->\n` + h.replace('</head>', '<script src="/js/demo.js"></script></head>');
  fs.writeFileSync(p, h);
}
// demo deployment settings: a SEPARATE Cloudflare project, R2 bucket and Supabase project
fs.writeFileSync(path.join(out, 'wrangler.toml'), `name = "kvet-demo"
pages_build_output_dir = "public"
compatibility_date = "2026-10-01"

[vars]
SUPABASE_URL = "https://YOUR-DEMO-PROJECT.supabase.co"          # a NEW Supabase project, not the real one
SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YOUR_DEMO_KEY"
BOOTSTRAP_ADMIN_EMAIL = "you@example.com"                         # your own e-mail for the demo superadmin

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "kvet-demo"
`);
copy('tools/seed-demo.mjs', 'seed-demo.mjs');
fs.writeFileSync(path.join(out, 'README-DEMO.txt'), `KVET demo build (for review by third parties)
© ${YEAR} KVET. All rights reserved.

This folder is meant for YOU to deploy - do not send the folder itself to anyone.
Steps are in the DEMO section of DEPLOY.md in the full project.
`);
const size = d => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`Demo build ready: ${out}  (browser scripts: ${(size(path.join(out, 'public/js')) / 1024).toFixed(0)} KB minified)`);
