import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileSignature,
  Handshake,
  ListChecks,
  AlertTriangle,
  ExternalLink,
  CalendarClock,
  FileText,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoDocument } from '../../lib/types';

interface MineStats {
  from: string;
  to: string;
  created: { total: number; byStatus: Record<string, number>; byType: Record<string, number> };
  approvals: { total: number; byStatus: Record<string, number> };
  tasks: { total: number; byStatus: Record<string, number> };
}

// Hujjat holatlari — to'q panel kartochkalari
const STATUS_CARDS: Array<{ key: string; label: string; danger?: boolean }> = [
  { key: 'draft', label: 'Qoralama' },
  { key: 'in_review', label: 'Kelishuvda' },
  { key: 'in_progress', label: 'Ijroda' },
  { key: 'done', label: 'Bajarilgan' },
  { key: 'rejected', label: 'Rad etilgan', danger: true },
  { key: 'overdue', label: "Muddati o'tgan", danger: true },
];

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function EdoHomePage() {
  const { data: stats } = useQuery({
    queryKey: ['edo-home-stats'],
    queryFn: async () => (await api.get<MineStats>('/documents/stats/mine')).data,
  });
  const { data: tasks } = useQuery({
    queryKey: ['edo-home-tasks'],
    queryFn: async () => (await api.get<EdoDocument[]>('/documents/tasks')).data,
  });
  const { data: toSign } = useQuery({
    queryKey: ['edo-home-tosign'],
    queryFn: async () => (await api.get<EdoDocument[]>('/documents/to-sign')).data,
  });

  const createdByStatus = stats?.created.byStatus ?? {};
  const taskByStatus = stats?.tasks.byStatus ?? {};

  const kelishishCount = tasks?.length ?? 0;
  const imzolashCount = toSign?.length ?? 0;
  const ijroCount = (taskByStatus.pending ?? 0) + (taskByStatus.in_progress ?? 0);
  const overdueCount = taskByStatus.overdue ?? 0;

  const incomingCards: Array<{
    label: string;
    count: number;
    to: string;
    icon: typeof FileSignature;
    danger?: boolean;
  }> = [
    { label: 'Imzolash uchun', count: imzolashCount, to: '/edo/signing', icon: FileSignature },
    { label: 'Kelishish uchun', count: kelishishCount, to: '/edo/approval', icon: Handshake },
    { label: 'Ijro topshiriqlari', count: ijroCount, to: '/edo/tasks', icon: ListChecks },
    { label: "Muddati o'tgan", count: overdueCount, to: '/edo/tasks', icon: AlertTriangle, danger: true },
  ];

  return (
    <div className="flex h-full">
      {/* Asosiy ustun */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <h1 className="text-xl font-semibold text-slate-900 mb-4">Hujjatlar ijro holati</h1>

        {/* To'q panel — holat kesimi */}
        <div className="bg-edonav-900 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STATUS_CARDS.map((c) => {
              const n = createdByStatus[c.key] ?? 0;
              return (
                <div
                  key={c.key}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 flex flex-col gap-1"
                >
                  <span className="text-xs text-slate-300 leading-snug">{c.label}</span>
                  <span
                    className={
                      'text-2xl font-bold ' +
                      (c.danger && n > 0 ? 'text-rose-400' : 'text-white')
                    }
                  >
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kelib tushgan topshiriqlar */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">Kelib tushgan topshiriqlar</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {incomingCards.map((c) => (
              <Link
                key={c.label}
                to={c.to}
                className={
                  'group bg-white border rounded-xl px-5 py-6 flex flex-col items-center text-center transition hover:shadow-md ' +
                  (c.danger && c.count > 0
                    ? 'border-rose-300 hover:border-rose-400'
                    : 'border-slate-200 hover:border-asaka-300')
                }
              >
                <c.icon
                  size={22}
                  className={
                    'mb-2 ' + (c.danger && c.count > 0 ? 'text-rose-500' : 'text-asaka-600')
                  }
                />
                <span
                  className={
                    'text-3xl font-bold ' +
                    (c.danger && c.count > 0 ? 'text-rose-600' : 'text-slate-900')
                  }
                >
                  {c.count}
                </span>
                <span className="text-sm text-slate-500 mt-1">{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* O'ng panel — shaxsiy topshiriqlar */}
      <aside className="hidden xl:flex w-80 shrink-0 border-l border-slate-200 flex-col bg-slate-50/50">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Shaxsiy topshiriqlar</h3>
            <Link to="/edo/tasks" className="text-asaka-600 hover:text-asaka-700" title="Barchasi">
              <ExternalLink size={16} />
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Muddati yaqinlashayotgan</p>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {(tasks ?? []).length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10">
              <CalendarClock size={28} className="mx-auto mb-2 opacity-50" />
              Topshiriq yo'q
            </div>
          ) : (
            (tasks ?? []).slice(0, 8).map((d) => (
              <Link
                key={d.id}
                to={`/edo/documents/${d.id}`}
                className="block bg-white border border-slate-200 rounded-lg px-3 py-2.5 hover:border-asaka-300 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-asaka-600 shrink-0" />
                  <span className="text-xs font-mono text-slate-500">{d.number}</span>
                </div>
                <p className="text-sm text-slate-800 mt-1 line-clamp-2">{d.subject}</p>
                {d.deadline && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <CalendarClock size={12} />
                    {fmtDate(d.deadline)}
                  </p>
                )}
              </Link>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
