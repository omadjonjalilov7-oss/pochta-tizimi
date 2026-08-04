import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { useAuth } from '../../context/AuthContext';
import type { EdoDocument } from '../../lib/types';

interface MineStats {
  from: string;
  to: string;
  created: { total: number; byStatus: Record<string, number>; byType: Record<string, number> };
  approvals: { total: number; byStatus: Record<string, number> };
  tasks: { total: number; byStatus: Record<string, number> };
}

// Topshiriq holatlari — to'q panel kartochkalari (label edo.task_status.* dan olinadi)
const TASK_CARDS: Array<{ key: string; danger?: boolean }> = [
  { key: 'pending' },
  { key: 'in_progress' },
  { key: 'done' },
  { key: 'overdue', danger: true },
];

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// O'ng panel kengligi chegaralari (px) va saqlash kaliti.
const ASIDE_MIN = 260;
const ASIDE_MAX = 640;
const ASIDE_KEY = 'edo-home-aside-w';

export function EdoHomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const [asideWidth, setAsideWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(ASIDE_KEY));
    return saved >= ASIDE_MIN && saved <= ASIDE_MAX ? saved : 320;
  });

  // Ajratuvchi chiziqni sudrab panel kengligini o'zgartirish.
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: MouseEvent) => {
      const right = rootRef.current?.getBoundingClientRect().right ?? window.innerWidth;
      const w = Math.min(ASIDE_MAX, Math.max(ASIDE_MIN, right - ev.clientX));
      widthRef.current = w;
      setAsideWidth(w);
    };
    const onUp = () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (widthRef.current) localStorage.setItem(ASIDE_KEY, String(Math.round(widthRef.current)));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const { data: stats } = useQuery({
    queryKey: ['edo-home-stats'],
    queryFn: async () => (await api.get<MineStats>('/documents/stats/mine')).data,
  });
  const { data: tasks } = useQuery({
    queryKey: ['edo-home-tasks'],
    queryFn: async () => (await api.get<EdoDocument[]>('/documents/tasks')).data,
  });
  // Menga biriktirilgan ijro topshiriqlari (porucheniyalar)
  const { data: executions } = useQuery({
    queryKey: ['edo-home-executions'],
    queryFn: async () => (await api.get<EdoDocument[]>('/documents/executions')).data,
  });
  const { data: toSign } = useQuery({
    queryKey: ['edo-home-tosign'],
    queryFn: async () => (await api.get<EdoDocument[]>('/documents/to-sign')).data,
  });

  // Hujjatdan menga tegishli (bajarilmagan) topshiriqni topish
  const myTargetOf = (d: EdoDocument) => {
    for (const r of d.resolutions ?? []) {
      const tg = r.targets.find((x) => x.userId === user?.id && x.status !== 'done');
      if (tg) return { text: r.text, deadline: tg.deadline ?? d.deadline };
    }
    return null;
  };
  const myExecutions = (executions ?? [])
    .map((d) => ({ doc: d, task: myTargetOf(d) }))
    .filter((x) => x.task);

  const taskByStatus = stats?.tasks.byStatus ?? {};

  const kelishishCount = tasks?.length ?? 0;
  const imzolashCount = toSign?.length ?? 0;
  const ijroCount = (taskByStatus.pending ?? 0) + (taskByStatus.in_progress ?? 0);
  const overdueCount = taskByStatus.overdue ?? 0;
  // Bajarilmagan topshiriqlar: kutilmoqda + bajarilmoqda + muddati o'tgan
  const unfinishedCount = ijroCount + overdueCount;

  const incomingCards: Array<{
    label: string;
    count: number;
    to: string;
    icon: typeof FileSignature;
    danger?: boolean;
  }> = [
    { label: t('edo.dashboard.card_signing'), count: imzolashCount, to: '/edo/signing', icon: FileSignature },
    { label: t('edo.dashboard.card_approval'), count: kelishishCount, to: '/edo/approval', icon: Handshake },
    { label: t('edo.dashboard.card_tasks'), count: ijroCount, to: '/edo/tasks', icon: ListChecks },
    { label: t('edo.dashboard.card_overdue'), count: overdueCount, to: '/edo/tasks', icon: AlertTriangle, danger: true },
  ];

  return (
    <div ref={rootRef} className="flex h-full">
      {/* Asosiy ustun */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <h1 className="text-xl font-semibold text-slate-900 mb-4">{t('edo.dashboard.title')}</h1>

        {/* To'q panel — topshiriqlar ijro holati */}
        <div className="bg-edonav-900 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">{t('edo.dashboard.exec_title')}</h2>
            <Link
              to="/edo/tasks"
              className="flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 transition"
              title={t('edo.dashboard.all')}
            >
              <span className="text-xs text-slate-300">{t('edo.dashboard.unfinished')}</span>
              <span className={'text-lg font-bold ' + (unfinishedCount > 0 ? 'text-rose-400' : 'text-white')}>
                {unfinishedCount}
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TASK_CARDS.map((c) => {
              const n = taskByStatus[c.key] ?? 0;
              return (
                <Link
                  key={c.key}
                  to="/edo/tasks"
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3.5 flex flex-col gap-1 transition"
                >
                  <span className="text-xs text-slate-300 leading-snug">{t(`edo.task_status.${c.key}`)}</span>
                  <span
                    className={
                      'text-2xl font-bold ' +
                      (c.danger && n > 0 ? 'text-rose-400' : 'text-white')
                    }
                  >
                    {n}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Kelib tushgan topshiriqlar */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('edo.dashboard.incoming_title')}</h2>
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

      {/* Kenglikni o'zgartirish uchun sudraladigan ajratuvchi chiziq */}
      <div
        onMouseDown={startResize}
        title={t('edo.dashboard.resize_hint')}
        className="hidden xl:block w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-asaka-400 active:bg-asaka-500 transition-colors"
      />

      {/* O'ng panel — shaxsiy topshiriqlar */}
      <aside
        style={{ width: asideWidth }}
        className="hidden xl:flex shrink-0 flex-col bg-slate-50/50"
      >
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">{t('edo.dashboard.personal_title')}</h3>
            <Link to="/edo/tasks" className="text-asaka-600 hover:text-asaka-700" title={t('edo.dashboard.all')}>
              <ExternalLink size={16} />
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{t('edo.dashboard.personal_sub')}</p>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {myExecutions.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10">
              <CalendarClock size={28} className="mx-auto mb-2 opacity-50" />
              {t('edo.dashboard.no_tasks')}
            </div>
          ) : (
            myExecutions.map(({ doc: d, task }) => (
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
                {task?.text && (
                  <p className="text-xs text-asaka-700 mt-1 line-clamp-2">{task.text}</p>
                )}
                {task?.deadline && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <CalendarClock size={12} />
                    {fmtDate(task.deadline)}
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
