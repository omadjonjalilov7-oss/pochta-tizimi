import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoDocument, DocumentStatus } from '../../lib/types';
import { cn } from '../../lib/utils';

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const STATUS_DOT: Record<DocumentStatus, string> = {
  draft: 'bg-slate-400',
  in_review: 'bg-amber-500',
  in_progress: 'bg-sky-500',
  done: 'bg-emerald-500',
  rejected: 'bg-red-500',
  overdue: 'bg-rose-600',
};

export function EdoCalendarPage() {
  const { t } = useTranslation();
  const months = t('edo.calendar.months', { returnObjects: true }) as string[];
  const weekdays = t('edo.calendar.weekdays', { returnObjects: true }) as string[];

  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  // Ko'rinayotgan oy oralig'i (dushanbadan boshlab to'ldirilgan to'r)
  const { gridStart, gridEnd, monthDays } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    // Dushanba = 0 bo'ladigan qilib siljitamiz
    const firstDow = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - firstDow);
    const lastDow = (last.getDay() + 6) % 7;
    const end = new Date(year, month, last.getDate() + (6 - lastDow));
    const days: Date[] = [];
    const d = new Date(start);
    while (d <= end) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return { gridStart: start, gridEnd: end, monthDays: days };
  }, [cursor]);

  const { data: docs = [] } = useQuery({
    queryKey: ['edo-calendar', ymd(gridStart), ymd(gridEnd)],
    queryFn: async () => {
      const from = new Date(gridStart);
      from.setHours(0, 0, 0, 0);
      const to = new Date(gridEnd);
      to.setHours(23, 59, 59, 999);
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      return (await api.get<EdoDocument[]>(`/documents/calendar?${params}`)).data;
    },
  });

  // Sana bo'yicha guruhlash
  const byDay = useMemo(() => {
    const map: Record<string, EdoDocument[]> = {};
    for (const doc of docs) {
      if (!doc.deadline) continue;
      const key = ymd(new Date(doc.deadline));
      (map[key] ??= []).push(doc);
    }
    return map;
  }, [docs]);

  const todayKey = ymd(new Date());
  const goPrev = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => {
    const n = new Date();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
  };

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-900">
          {months[cursor.getMonth()]} {cursor.getFullYear()}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            {t('edo.calendar.today')}
          </button>
          <button onClick={goPrev} className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
            <ChevronLeft size={18} />
          </button>
          <button onClick={goNext} className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Hafta kunlari */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {weekdays.map((w) => (
            <div key={w} className="px-2 py-2 text-center text-xs font-semibold text-slate-500">
              {w}
            </div>
          ))}
        </div>
        {/* Kunlar to'ri */}
        <div className="grid grid-cols-7">
          {monthDays.map((day) => {
            const key = ymd(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const dayDocs = byDay[key] ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={cn(
                  'min-h-[104px] border-b border-r border-slate-100 p-1.5 flex flex-col gap-1',
                  !inMonth && 'bg-slate-50/60',
                )}
              >
                <div
                  className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    isToday ? 'bg-asaka-600 text-white' : inMonth ? 'text-slate-700' : 'text-slate-400',
                  )}
                >
                  {day.getDate()}
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {dayDocs.slice(0, 3).map((doc) => {
                    const past =
                      new Date(doc.deadline!).getTime() < Date.now() && doc.status !== 'done';
                    return (
                      <Link
                        key={doc.id}
                        to={`/edo/documents/${doc.id}`}
                        title={`${doc.number} — ${doc.subject}`}
                        className={cn(
                          'flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded truncate transition',
                          past
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'bg-slate-100 text-slate-700 hover:bg-asaka-50 hover:text-asaka-700',
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[doc.status])} />
                        <span className="truncate">{doc.subject}</span>
                      </Link>
                    );
                  })}
                  {dayDocs.length > 3 && (
                    <span className="text-[11px] text-slate-400 px-1.5">+{dayDocs.length - 3}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
