/* Approval queue and the trainers' own question banks.

   What waits for approval (status / field):
     tests       new tests by trainers (always) and by editors (Settings -> Approvals -> tests): status 'pending';
                 changes to an active test: x.proposal (the active version stays in use until approved)
     materials   uploaded presentations (Settings -> Approvals -> materials): status 'pending'
     certs       released certificates (Settings -> Approvals -> certificates): approval.status 'pending'
   The approver (and admin / superadmin) approves, or returns the item with a compulsory note. Approving publishes it:
   a test / presentation becomes usable in sessions, a certificate reaches the candidate, the company and the QR page. */
import { signCert } from './signs.js';
import { pendingCandidates, decideCandidate } from './routes_candidates.js';
import { pendingLinks, decideLink } from './identity.js';
import { H, S, str, need, bool, audit, getSettings } from './core.js';
import { testFields, storeTest } from './routes_tests.js';

const testItem = x => ({ id: x.id, title: x.title, bid: x.bid || '', owner: x.owner || null, at: x.proposal?.at || x.updatedAt || x.createdAt, change: !!x.proposal,
  current: x.proposal ? { questions: x.questions, title: x.title } : null, ...(x.proposal ? { ...x.proposal, id: x.id } : x), status: x.status });
const pendingTest = x => x.status === 'pending' || (x.proposal && !x.proposal.returned);

/** @type {import('../../types/store').Routes} */
export const approvalRoutes = {
  'GET /approvals': { auth: 'staff', act: 'approve', async fn(c) {
    const cand = S.can(c.user.role, 'cand.approve');
    const [testRows, matRows, certRows, candidates, links, st] = await Promise.all([c.D.all('tests'), c.D.all('materials'), c.D.query('certs', { where: [['approval.status', 'eq', 'pending']] }),
      cand ? pendingCandidates(c) : [], cand ? pendingLinks(c) : [], getSettings(c.D)]);
    const tests = testRows.map(r => r.data).filter(pendingTest).map(testItem);
    const materials = matRows.map(r => r.data).filter(m => m.status === 'pending');
    const certs = certRows.rows.map(r => r.data).map(({ vh, sk, exp, cox, ...x }) => x);
    return { tests, materials, certs, candidates, links, settings: S.approvalsCfg(st) };
  } },
  'POST /approval/decide': { auth: 'staff', act: 'approve', async fn(c) {
    const b = await c.body(), ok = bool(b.approve), note = str(b.note, 1000), at = new Date(c.now()).toISOString(), by = c.user.email;
    need(ok || note, 'needNote');                                        // returning an item always says why
    const review = { by, at, note, decision: ok ? 'approved' : 'returned' };
    if (b.kind === 'test') {
      const x = await c.D.get('tests', str(b.id, 60)); need(x && pendingTest(x), 'noRec', 404);
      if (x.proposal) { if (ok) { const { by: _b, at: _a, returned: _r, ...f } = x.proposal; Object.assign(x, f, { updatedAt: at }); delete x.proposal; } else x.proposal.returned = review; }
      else x.status = ok ? 'active' : 'returned';
      x.review = review; await c.D.put('tests', [{ id: x.id, data: x }]);
      await audit(c, ok ? 'approval.approve' : 'approval.return', `test · ${x.title}${note ? ' · ' + note : ''}`, { entity: { kind: 'test', id: x.id, label: x.title } });
      return { test: x };
    }
    if (b.kind === 'material') {
      const x = await c.D.get('materials', str(b.id, 60)); need(x && x.status === 'pending', 'noRec', 404);
      x.status = ok ? 'active' : 'returned'; x.review = review; await c.D.put('materials', [{ id: x.id, data: x }]);
      await audit(c, ok ? 'approval.approve' : 'approval.return', `material · ${x.title}${note ? ' · ' + note : ''}`);
      return { material: x };
    }
    if (b.kind === 'cert') {
      const no = S.normCertNo(b.id), x = await c.D.get('certs', no); need(x && x.approval?.status === 'pending', 'noRec', 404);
      // four eyes: approving is a second person's look. Returning one's own release is fine.
      need(!(ok && x.approval.by === by && c.user.role !== 'superadmin'), 'ownRelease', 409);
      // approving and signing in one step (approver / superadmin): the signature is checked first, so nothing is half done
      const mode = ok && ['esign', 'image'].includes(b.sign) ? b.sign : '';
      if (mode) { need(S.can(c.user.role, 'cert.sign'), 'forbidden', 403); const me = (await c.D.get('staff', c.user.id)) || /** @type {import('../../types/records').StaffRecord} */ ({}); need(String(me.name || '').trim(), 'needName', 409); if (mode === 'image') need(me.sigKey, 'needSigImage', 409); }
      x.approval = { ...x.approval, status: ok ? 'approved' : 'returned', review }; await c.D.put('certs', [{ id: no, data: x }]);
      await audit(c, ok ? 'approval.approve' : 'approval.return', `certificate · ${no}${note ? ' · ' + note : ''}`, { entity: { kind: 'cert', id: no, label: no } });
      return { cert: mode ? await signCert(c, no, mode) : x };
    }
    if (b.kind === 'cand') return decideCandidate(c, b.id, ok, review);
    if (b.kind === 'link') { need(S.can(c.user.role, 'cand.approve'), 'forbidden', 403); return decideLink(c, b.id, ok, review); }
    throw new H(400, 'badInput');
  } },
  /* a returned certificate is corrected (Certificates -> edit) and sent back to the approver */
  'POST /cert/resubmit': { auth: 'staff', act: 'cert.update', async fn(c) {
    const no = S.normCertNo((await c.body()).no), x = await c.D.get('certs', no); need(x && x.approval?.status === 'returned', 'noRec', 404);
    x.approval = { status: 'pending', at: new Date(c.now()).toISOString(), by: c.user.email, again: true }; await c.D.put('certs', [{ id: no, data: x }]);
    await audit(c, 'approval.resubmit', `certificate · ${no}`); return { cert: x };
  } },

  /* ---------------------------------------------- a trainer's own question banks (always reviewed) */
  'GET /portal/trainer/tests': { auth: 'trainer', async fn(c) {
    const mine = (await c.D.all('tests')).map(r => r.data).filter(x => x.owner?.kind === 'trainer' && x.owner.id === c.me.id).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return { list: mine, blanks: (await c.D.all('blanks')).map(r => ({ id: r.id, name: r.data.name })) };
  } },
  'POST /portal/trainer/test/save': { auth: 'trainer', async fn(c) {
    const b = await c.body(), f = await testFields(c, b);
    /** @type {any} */ let x = null; if (b.id) { x = await c.D.get('tests', str(b.id, 60)); need(x && x.owner?.kind === 'trainer' && x.owner.id === c.me.id, 'noRec', 404); }
    return { test: await storeTest(c, x, f, { submit: bool(b.submit), direct: false, owner: { kind: 'trainer', id: c.me.id, name: S.fullAz(c.me, false) } }) };
  } },
  'POST /portal/trainer/test/delete': { auth: 'trainer', async fn(c) {
    const b = await c.body(), x = await c.D.get('tests', str(b.id, 60)); need(x && x.owner?.kind === 'trainer' && x.owner.id === c.me.id, 'noRec', 404);
    need((x.status || 'active') !== 'active', 'testActive', 409);         // an approved test is removed by the office
    await c.D.del('tests', x.id); await audit(c, 'test.delete', `${x.title} (by trainer)`); return { ok: 1 };
  } },
};
