import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../public/js/shared.js';

test('transliteration follows the requested example', () => {
  assert.equal(S.transliterateAzToEn('Qocayev'), 'Gojayev');
  assert.equal(S.transliterateAzToEn('Azər'), 'Azar');
  assert.equal(S.transliterateAzToEn('Məmməd oğlu'), 'Mammad oghlu');
  assert.equal(S.transliterateAzToEn('Şamil Xəlilov Çingiz Cəfər'), 'Shamil Khalilov Chingiz Jafar');
  assert.equal(S.transliterateAzToEn('Vüqar İsmayılov'), 'Vugar Ismayilov');
  assert.equal(S.transliterateAzToEn('Ələsgər'), 'Alasgar');
});
test('names: foreigners only get the English line', () => {
  const az = { name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', nameEn: 'Azar', surnameEn: 'Gojayev', fatherEn: 'Mammad oghlu' };
  assert.deepEqual(S.certNames(az), { az: 'Azər Qocayev', en: 'Azar Gojayev' });
  assert.equal(S.certNames(az, true).az, 'Azər Qocayev Məmməd oğlu');
  assert.deepEqual(S.certNames({ name: 'John', surname: 'Smith', nameEn: 'John', surnameEn: 'Smith', foreign: true }), { az: '', en: 'John Smith' });
});
test('expiry: 24 months from 23.10.2026 is 22.10.2028; month ends', () => {
  assert.equal(S.expiryFrom('2026-10-23', 24), '2028-10-22');
  assert.equal(S.expiryFrom('2026-01-31', 1), '2026-02-27');
  assert.equal(S.expiryFrom('2024-02-29', 12), '2025-02-27'); // anniversary clamps to 28 Feb, minus one day
});
test('certificate numbers', () => {
  const cfg = S.numCfg({});
  assert.equal(S.fmtCertNo(cfg, 'CRT', 2026, 1), 'CRT/26/0001');
  assert.equal(S.fmtCertNo({ ...cfg, yearFmt: 'YYYY', sep: '-', pad: 5 }, 'AP', 2026, 42), 'AP-2026-00042');
  assert.equal(S.learnerNo(2026, 3566), 'E-202603566');
});
test('practical: penalty sheet (over 40 fails, disqualifier fails)', () => {
  const sh = { mode: 'penalty', rule: { maxPenalty: 40 }, disq: [{ id: 'd1', text: 'x' }], sections: [{ items: Array.from({ length: 10 }, (_, i) => ({ id: 'i' + i, text: 't', penalty: '5' })) }] };
  const a = {}; for (let i = 0; i < 8; i++) a['i' + i] = 5;
  assert.equal(S.evaluateSheet(sh, { answers: {} }).result, 'INCOMPLETE');   // an untouched sheet is not a pass
  assert.equal(S.evaluateSheet(sh, { answers: a }).result, 'INCOMPLETE');    // not yet marked as completed
  assert.equal(S.evaluateSheet(sh, { answers: a, done: true }).result, 'PASS');  // 40 is not over 40
  a.i8 = 1; assert.equal(S.evaluateSheet(sh, { answers: a }).result, 'FAIL'); // 41
  assert.equal(S.evaluateSheet(sh, { answers: {}, disq: ['d1'] }).result, 'FAIL');
  assert.equal(S.evaluateSheet(sh, { answers: { i0: 5 }, timePenalty: 40 }).result, 'FAIL');
});
test('practical: pass/fail sheet - one fail fails, incomplete is pending', () => {
  const sh = { mode: 'passfail', sections: [{ items: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }] }] };
  assert.equal(S.evaluateSheet(sh, { answers: { a: 'P' } }).result, 'INCOMPLETE');
  assert.equal(S.evaluateSheet(sh, { answers: { a: 'P', b: 'NA' } }).result, 'PASS');
  assert.equal(S.evaluateSheet(sh, { answers: { a: 'F' } }).result, 'FAIL');
});
test('practical: rating sheet', () => {
  const sh = { mode: 'rating', rule: { minAvg: 3, failBelow: 2 }, sections: [{ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }] };
  assert.equal(S.evaluateSheet(sh, { answers: { a: 4, b: 3, c: 'NA' } }).result, 'PASS');
  assert.equal(S.evaluateSheet(sh, { answers: { a: 3, b: 3, c: 2 } }).result, 'FAIL');   // avg 2.67
  assert.equal(S.evaluateSheet(sh, { answers: { a: 5, b: 5, c: 1 } }).result, 'FAIL');   // unsafe
  assert.equal(S.evaluateSheet(sh, { answers: { a: 5 } }).result, 'INCOMPLETE');
  assert.throws(() => S.validateSheetData(sh, { answers: { zz: 3 } }));
  assert.throws(() => S.validateSheetData(sh, { answers: { a: 9 } }));
});
test('outcome: practical fail is automatic fail, exam decides otherwise', () => {
  const s = { sheetId: 'x' };
  assert.equal(S.computeOutcome({}, s).outcome, 'ABSENT');
  assert.equal(S.computeOutcome({ att: 1 }, s).outcome, 'PENDING_PRACTICAL');
  assert.equal(S.computeOutcome({ att: 1, prac: { result: 'FAIL' }, exam: { passed: true } }, s).outcome, 'FAIL');
  assert.equal(S.computeOutcome({ att: 1, prac: { result: 'PASS' } }, s).outcome, 'PENDING_EXAM');
  assert.equal(S.computeOutcome({ att: 1, prac: { result: 'PASS' }, exam: { passed: true } }, s).outcome, 'PASS');
  assert.equal(S.computeOutcome({ att: 1, exam: { passed: true } }, {}).outcome, 'PASS');
  assert.equal(S.computeOutcome({ att: 1, exam: { passed: false } }, {}).outcome, 'FAIL');
});
test('roles', () => {
  assert.ok(S.can('superadmin', 'delete')); assert.ok(!S.can('admin', 'delete')); assert.ok(S.can('admin', 'issue'));
  assert.ok(!S.can('editor', 'issue')); assert.ok(!S.can('editor', 'fin.view')); assert.ok(!S.can('auditor', 'blank.save')); assert.ok(S.can('auditor', 'view')); assert.ok(!S.can('auditor', 'download')); assert.ok(!S.can('auditor', 'library'));
  assert.equal(S.legacyRole('reader'), 'auditor'); assert.ok(!('reader' in S.RANK));
  // certificates and session documents: signed only by the superadmin and the approver
  assert.ok(!S.can('admin', 'cert.sign')); assert.ok(S.can('superadmin', 'cert.sign')); assert.ok(S.can('approver', 'cert.sign')); assert.ok(S.can('approver', 'doc.sign')); assert.ok(!S.can('admin', 'doc.sign'));
  assert.ok(!S.can('admin', 'backup.restore')); assert.ok(!S.can('admin', 'camera'));
});
test('cert status, renewal and counters', () => {
  const mk = (no, tid, start, expiry, extra = {}) => ({ no, tid, bid: 'b', start, expiry, issuedAt: start, ...extra });
  const list = S.annotateCerts([mk('1', 't1', '2024-01-01', '2026-01-01'), mk('2', 't1', '2025-12-01', '2027-12-01'), mk('3', 't2', '2025-01-01', '2026-11-20'), mk('4', 't3', '2024-01-01', '2025-01-01'), mk('5', 't4', '2026-01-01', '2028-01-01', { revoked: { at: 'x' } })], '2026-10-29');
  assert.deepEqual(list.map(c => c.st), ['RENEWED', 'ACTIVE', 'SOON', 'EXPIRED', 'REVOKED']);
  assert.deepEqual(S.certCounters(list), { total: 3, ACTIVE: 1, SOON: 1, EXPIRED: 1 });
});
test('sessions status', () => {
  const s = { date: '2026-10-29' };
  assert.equal(S.sessionStatus(s, { total: 2, finalized: 0 }, '2026-10-28'), 'upcoming');
  assert.equal(S.sessionStatus(s, { total: 2, finalized: 0 }, '2026-10-29'), 'ongoing');
  assert.equal(S.sessionStatus(s, { total: 2, finalized: 0 }, '2026-10-30'), 'review');
  assert.equal(S.sessionStatus(s, { total: 2, finalized: 2 }, '2026-10-30'), 'completed');
  assert.equal(S.sessionStatus({ ...s, endDate: '2026-10-31' }, { total: 1, finalized: 0 }, '2026-10-30'), 'ongoing');
});
