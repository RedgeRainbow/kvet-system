/* Analytics & reports: superadmin / admin see the whole system (filters by training, trainer, company);
   auditors get the feedback and evaluation oversight view (the server decides what each role receives). */
import { A, view, S } from './lib.js';
import { analyticsView } from '../analytics.js';

export default async function () {
  const auditor = A.role === 'auditor';
  await analyticsView(view(), { base: '/analytics', kind: 'staff', staff: true,
    trainers: (A.trainers || []).map(x => [x.id, S.fullAz(x, false)]).sort((a, b) => a[1].localeCompare(b[1])),
    companies: auditor ? null : (A.companies || []).map(x => [x.id, x.name]).sort((a, b) => a[1].localeCompare(b[1])) });
}
