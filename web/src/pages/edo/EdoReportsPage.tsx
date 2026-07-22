import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3, Users, Clock, FileCheck2, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface MineStats {
  from: string;
  to: string;
  created: { total: number; byStatus: Record<string, number>; byType: Record<string, number> };
  approvals: { total: number; byStatus: Record<string, number> };
  tasks: { total: number; byStatus: Record<string, number> };
}

interface GlobalStats {
  from: string;
  to: string;
  total: number;
  closed: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  topCreators: { name: string; count: number }[];
  avgCloseHours: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  in_review: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-sky-100 text-sky-800',
  done: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  overdue: 'bg-rose-100 text-rose-700',
  approved: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-slate-100 text-slate-700',
};

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return { from: fmt(from), to: fmt(to) };
}

export function EdoReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canSeeAll = user?.role === 'admin' || user?.role === 'chancellery';
  const [{ from, to }, setRange] = useState(defaultRange);

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

  const mineQ = useQuery({
    queryKey: ['edo-stats-mine', params],
    queryFn: async () =>
      (await api.get<MineStats>(`/documents/stats/mine?${params}`)).data,
  });

  const globalQ = useQuery({
    queryKey: ['edo-stats-global', params],
    queryFn: async () =>
      (await api.get<GlobalStats>(`/documents/stats/global?${params}`)).data,
    enabled: canSeeAll,
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('edo.reports.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('edo.reports.subtitle')}</p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('edo.reports.from')}
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('edo.reports.to')}
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Mening statistikam */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <BarChart3 size={14} />
          {t('edo.reports.my_section')}
        </h2>
        {mineQ.isLoading ? (
          <div className="text-slate-400 text-sm">{t('common.loading')}</div>
        ) : mineQ.data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              icon={<FileCheck2 size={18} className="text-asaka-600" />}
              title={t('edo.reports.my_created')}
              total={mineQ.data.created.total}
              breakdown={mineQ.data.created.byStatus}
              labelKey="edo.status"
            />
            <StatCard
              icon={<Users size={18} className="text-amber-600" />}
              title={t('edo.reports.my_approvals')}
              total={mineQ.data.approvals.total}
              breakdown={mineQ.data.approvals.byStatus}
              labelKey="edo.p_status"
            />
            <StatCard
              icon={<Clock size={18} className="text-sky-600" />}
              title={t('edo.reports.my_tasks')}
              total={mineQ.data.tasks.total}
              breakdown={mineQ.data.tasks.byStatus}
              labelKey="edo.task_status"
            />
          </div>
        ) : null}

        {mineQ.data && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Object.entries(mineQ.data.created.byType).map(([type, count]) => (
              <div
                key={type}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between"
              >
                <span className="text-xs text-slate-600">{t(`edo.doc_type.${type}`)}</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Global (admin/konselyariya) statistika */}
      {canSeeAll && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <BarChart3 size={14} />
            {t('edo.reports.global_section')}
          </h2>
          {globalQ.isLoading ? (
            <div className="text-slate-400 text-sm">{t('common.loading')}</div>
          ) : globalQ.data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <KpiTile label={t('edo.reports.global_total')} value={globalQ.data.total} />
                <KpiTile label={t('edo.reports.global_closed')} value={globalQ.data.closed} />
                <KpiTile
                  label={t('edo.reports.global_open')}
                  value={globalQ.data.total - globalQ.data.closed}
                />
                <KpiTile
                  label={t('edo.reports.avg_close_hours')}
                  value={globalQ.data.avgCloseHours}
                  suffix={t('edo.reports.hours')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <BreakdownBlock
                  title={t('edo.reports.by_status')}
                  data={globalQ.data.byStatus}
                  labelKey="edo.status"
                />
                <BreakdownBlock
                  title={t('edo.reports.by_type')}
                  data={globalQ.data.byType}
                  labelKey="edo.doc_type"
                />
              </div>

              {globalQ.data.topCreators.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    {t('edo.reports.top_creators')}
                  </div>
                  <ol className="space-y-1">
                    {globalQ.data.topCreators.map((c, i) => (
                      <li
                        key={c.name + i}
                        className="flex items-center gap-3 text-sm border-b border-slate-100 py-1.5 last:border-b-0"
                      >
                        <span className="font-mono text-xs text-slate-400 w-6">#{i + 1}</span>
                        <span className="flex-1 text-slate-800">{c.name}</span>
                        <span className="font-semibold text-slate-900">{c.count}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle size={14} />
              {t('edo.reports.global_unavailable')}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  title,
  total,
  breakdown,
  labelKey,
}: {
  icon: React.ReactNode;
  title: string;
  total: number;
  breakdown: Record<string, number>;
  labelKey: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {title}
        </span>
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-3">{total}</div>
      <div className="space-y-1.5">
        {Object.entries(breakdown).length === 0 ? (
          <div className="text-xs text-slate-400">—</div>
        ) : (
          Object.entries(breakdown).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded font-medium',
                  STATUS_COLORS[k] || 'bg-slate-100 text-slate-600',
                )}
              >
                {t(`${labelKey}.${k}`, k)}
              </span>
              <span className="ml-auto font-semibold text-slate-700">{v}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BreakdownBlock({
  title,
  data,
  labelKey,
}: {
  title: string;
  data: Record<string, number>;
  labelKey: string;
}) {
  const { t } = useTranslation();
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        {title}
      </div>
      <div className="space-y-1.5">
        {Object.entries(data).length === 0 ? (
          <div className="text-xs text-slate-400">—</div>
        ) : (
          Object.entries(data)
            .sort(([, a], [, b]) => b - a)
            .map(([k, v]) => {
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded font-medium min-w-[110px] inline-block',
                      STATUS_COLORS[k] || 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {t(`${labelKey}.${k}`, k)}
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-asaka-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-semibold text-slate-700 w-10 text-right">{v}</span>
                  <span className="text-slate-400 w-10 text-right">{pct}%</span>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

function KpiTile({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-900">
        {value}
        {suffix && <span className="text-sm font-normal text-slate-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
