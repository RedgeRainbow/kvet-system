import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withHints, PAGES, graph } from '../tools/preload.mjs';

test('pages preload their whole static module graph (run node tools/preload.mjs after changing imports)', () => {
  for (const p of PAGES) { const h = readFileSync('public/' + p, 'utf8'); assert.equal(h, withHints(h), p + ' preload hints out of date'); }
});
test('Russian dictionary is not in any page graph (loaded on demand)', () => {
  for (const e of ['/js/trainer/main.js', '/js/admin/main.js', '/js/trainee/main.js', '/js/company/main.js']) assert.ok(!graph(e).includes('/js/dict_ru.js'), e);
});
