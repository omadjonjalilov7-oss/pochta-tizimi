import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface Bucket {
  total: number;
  pending: number;
  inProgress: number;
  done: number;
  doneLate: number;
  overdue: number;
}

interface Overview {
  documents: {
    total: number;
    draft: number;
    inReview: number;
    inProgress: number;
    done: number;
    rejected: number;
    overdue: number;
  };
  tasks: Bucket;
  signatures: number;
  approvals: { pending: number; approved: number; rejected: number; done: number };
}

type DeptRow = Bucket & { departmentId: string; name: string; documents: number };
type StaffRow = Bucket & { userId: string; fullName: string; department: string; position: string };
type SignRow = { userId: string; fullName: string; position: string; count: number };
type ApprovalRow = { userId: string; fullName: string; position: string; total: number; pending: number; approved: number; rejected: number };

type TabKey = 'overview' | 'departments' | 'staff' | 'signing' | 'approvals';

function defaultRange() {
  const to = new Date();
  // Standart: joriy yil boshidan bugungi kungacha — barcha yillik ma'lumot ko'rinadi
  const from = new Date(to.getFullYear(), 0, 1);
  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return { from: fmt(from), to: fmt(to) };
}

function StatCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-800',
    sky: 'text-sky-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    indigo: 'text-indigo-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center">
      <div className={cn('text-2xl font-bold', tones[tone] || tones.slate)}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

export function EdoStatsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'chancellery';
  const { view } = useParams<{ view?: string }>();
  const [{ from, to }, setRange] = useState(defaultRange);
  const validViews: TabKey[] = ['overview', 'departments', 'staff', 'signing', 'approvals'];
  const tab: TabKey = validViews.includes(view as TabKey) ? (view as TabKey) : 'overview';

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', new Date(from).toISOString());
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      p.set('to', d.toISOString());
    }
    return p.toString();
  }, [from, to]);

  const overviewQ = useQuery({
    queryKey: ['stats-overview', params],
    queryFn: async () => (await api.get<Overview>(`/stats/overview?${params}`)).data,
    enabled: isStaff && tab === 'overview',
  });
  const deptQ = useQuery({
    queryKey: ['stats-departments', params],
    queryFn: async () => (await api.get<DeptRow[]>(`/stats/departments?${params}`)).data,
    enabled: isStaff && tab === 'departments',
  });
  const staffQ = useQuery({
    queryKey: ['stats-staff', params],
    queryFn: async () => (await api.get<StaffRow[]>(`/stats/staff?${params}`)).data,
    enabled: isStaff && tab === 'staff',
  });
  const signQ = useQuery({
    queryKey: ['stats-signing', params],
    queryFn: async () => (await api.get<SignRow[]>(`/stats/signing?${params}`)).data,
    enabled: isStaff && tab === 'signing',
  });
  const apprQ = useQuery({
    queryKey: ['stats-approvals', params],
    queryFn: async () => (await api.get<ApprovalRow[]>(`/stats/approvals?${params}`)).data,
    enabled: isStaff && tab === 'approvals',
  });

  if (!isStaff) return <Navigate to="/edo" replace />;

  const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide';
  const td = 'px-3 py-2 text-sm text-slate-700 whitespace-nowrap';

  return (
    <div className="w-full px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t(`edo.stats.tab_${tab}`)}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('edo.stats.subtitle')}</p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('edo.reports.from')}</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('edo.reports.to')}</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
            />
          </div>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          {overviewQ.isLoading && <div className="text-sm text-slate-400">{t('common.loading')}</div>}
          {overviewQ.data && (
            <>
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {t('edo.stats.documents')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <StatCard label={t('edo.stats.total')} value={overviewQ.data.documents.total} />
                  <StatCard label={t('edo.stats.draft')} value={overviewQ.data.documents.draft} />
                  <StatCard label={t('edo.stats.in_review')} value={overviewQ.data.documents.inReview} tone="amber" />
                  <StatCard label={t('edo.stats.in_progress')} value={overviewQ.data.documents.inProgress} tone="sky" />
                  <StatCard label={t('edo.stats.done')} value={overviewQ.data.documents.done} tone="emerald" />
                  <StatCard label={t('edo.stats.rejected')} value={overviewQ.data.documents.rejected} tone="rose" />
                  <StatCard label={t('edo.stats.overdue')} value={overviewQ.data.documents.overdue} tone="rose" />
                </div>
              </section>
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {t('edo.stats.tasks')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard label={t('edo.stats.total')} value={overviewQ.data.tasks.total} />
                  <StatCard label={t('edo.stats.pending')} value={overviewQ.data.tasks.pending} />
                  <StatCard label={t('edo.stats.in_progress')} value={overviewQ.data.tasks.inProgress} tone="sky" />
                  <StatCard label={t('edo.stats.done')} value={overviewQ.data.tasks.done} tone="emerald" />
                  <StatCard label={t('edo.stats.done_late')} value={overviewQ.data.tasks.doneLate} tone="amber" />
                  <StatCard label={t('edo.stats.overdue')} value={overviewQ.data.tasks.overdue} tone="rose" />
                </div>
              </section>
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {t('edo.stats.other')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label={t('edo.stats.signatures')} value={overviewQ.data.signatures} tone="indigo" />
                  <StatCard label={t('edo.stats.appr_pending')} value={overviewQ.data.approvals.pending} tone="amber" />
                  <StatCard label={t('edo.stats.appr_approved')} value={overviewQ.data.approvals.approved} tone="emerald" />
                  <StatCard label={t('edo.stats.appr_rejected')} value={overviewQ.data.approvals.rejected} tone="rose" />
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {tab === 'departments' && (
        <TableWrap loading={deptQ.isLoading} empty={!deptQ.data?.length} t={t}>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>{t('edo.stats.department')}</th>
                <th className={th}>{t('edo.stats.documents')}</th>
                <th className={th}>{t('edo.stats.tasks_total')}</th>
                <th className={th}>{t('edo.stats.pending')}</th>
                <th className={th}>{t('edo.stats.in_progress')}</th>
                <th className={th}>{t('edo.stats.done')}</th>
                <th className={th}>{t('edo.stats.done_late')}</th>
                <th className={th}>{t('edo.stats.overdue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deptQ.data?.map((r) => (
                <tr key={r.departmentId} className="hover:bg-slate-50">
                  <td className={cn(td, 'font-medium text-slate-900')}>{r.name}</td>
                  <td className={cn(td, 'text-indigo-600 font-medium')}>{r.documents}</td>
                  <td className={td}>{r.total}</td>
                  <td className={td}>{r.pending}</td>
                  <td className={cn(td, 'text-sky-600')}>{r.inProgress}</td>
                  <td className={cn(td, 'text-emerald-600')}>{r.done}</td>
                  <td className={cn(td, 'text-amber-600')}>{r.doneLate}</td>
                  <td className={cn(td, 'text-rose-600')}>{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {tab === 'staff' && (
        <TableWrap loading={staffQ.isLoading} empty={!staffQ.data?.length} t={t}>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>{t('edo.stats.employee')}</th>
                <th className={th}>{t('edo.stats.department')}</th>
                <th className={th}>{t('edo.stats.total')}</th>
                <th className={th}>{t('edo.stats.pending')}</th>
                <th className={th}>{t('edo.stats.in_progress')}</th>
                <th className={th}>{t('edo.stats.done')}</th>
                <th className={th}>{t('edo.stats.done_late')}</th>
                <th className={th}>{t('edo.stats.overdue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffQ.data?.map((r) => (
                <tr key={r.userId} className="hover:bg-slate-50">
                  <td className={cn(td, 'font-medium text-slate-900')}>{r.fullName}</td>
                  <td className={cn(td, 'text-slate-500')}>{r.department}</td>
                  <td className={td}>{r.total}</td>
                  <td className={td}>{r.pending}</td>
                  <td className={cn(td, 'text-sky-600')}>{r.inProgress}</td>
                  <td className={cn(td, 'text-emerald-600')}>{r.done}</td>
                  <td className={cn(td, 'text-amber-600')}>{r.doneLate}</td>
                  <td className={cn(td, 'text-rose-600')}>{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {tab === 'signing' && (
        <TableWrap loading={signQ.isLoading} empty={!signQ.data?.length} t={t}>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>{t('edo.stats.employee')}</th>
                <th className={th}>{t('edo.stats.position')}</th>
                <th className={th}>{t('edo.stats.signatures')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {signQ.data?.map((r) => (
                <tr key={r.userId} className="hover:bg-slate-50">
                  <td className={cn(td, 'font-medium text-slate-900')}>{r.fullName}</td>
                  <td className={cn(td, 'text-slate-500')}>{r.position}</td>
                  <td className={cn(td, 'text-indigo-600 font-semibold')}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {tab === 'approvals' && (
        <TableWrap loading={apprQ.isLoading} empty={!apprQ.data?.length} t={t}>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>{t('edo.stats.employee')}</th>
                <th className={th}>{t('edo.stats.position')}</th>
                <th className={th}>{t('edo.stats.total')}</th>
                <th className={th}>{t('edo.stats.appr_pending')}</th>
                <th className={th}>{t('edo.stats.appr_approved')}</th>
                <th className={th}>{t('edo.stats.appr_rejected')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apprQ.data?.map((r) => (
                <tr key={r.userId} className="hover:bg-slate-50">
                  <td className={cn(td, 'font-medium text-slate-900')}>{r.fullName}</td>
                  <td className={cn(td, 'text-slate-500')}>{r.position}</td>
                  <td className={td}>{r.total}</td>
                  <td className={cn(td, 'text-amber-600')}>{r.pending}</td>
                  <td className={cn(td, 'text-emerald-600')}>{r.approved}</td>
                  <td className={cn(td, 'text-rose-600')}>{r.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}

function TableWrap({
  loading,
  empty,
  t,
  children,
}: {
  loading: boolean;
  empty: boolean;
  t: (k: string) => string;
  children: React.ReactNode;
}) {
  if (loading) return <div className="text-sm text-slate-400">{t('common.loading')}</div>;
  if (empty) return <div className="text-sm text-slate-400 py-8 text-center">{t('edo.stats.empty')}</div>;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">{children}</div>
  );
}
