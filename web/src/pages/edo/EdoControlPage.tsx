import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Inbox,
  Send,
  FileText,
  FileCheck2,
  MessageCircleQuestion,
  ClipboardList,
  ClipboardCheck,
  Plug,
  Construction,
  Search,
  MessageSquareText,
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Avatar } from '../../components/Avatar';
import { DocList } from './EdoDocList';
import type { EdoDocument, EdoResolutionTarget } from '../../lib/types';

// ── Backend javob turlari ──
interface ControlTypeRow {
  type: string;
  documents: number;
  orders: number;
  inProgress: number;
  notDone: number;
  done: number;
  doneLate: number;
  renewed: number;
}
interface ControlManager {
  id: string;
  fullName: string;
  avatarPath: string | null;
  position: string | null;
  department: string | null;
  orders: number;
  inProgress: number;
  notDone: number;
  done: number;
  doneLate: number;
  onApproval: number;
}
interface ControlStats {
  byType: ControlTypeRow[];
  total: Omit<ControlTypeRow, 'type'>;
  managers: ControlManager[];
}

type TabKey =
  | 'dashboard'
  | 'incoming'
  | 'appeals'
  | 'outgoing'
  | 'internal'
  | 'plan'
  | 'ready-internal'
  | 'received'
  | 'integrations';

interface MenuItem {
  key: TabKey;
  icon: typeof Inbox;
  labelKey: string;
  ready: boolean; // false → hozircha placeholder
}

const MENU: MenuItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, labelKey: 'edo.control.menu_dashboard', ready: true },
  { key: 'incoming', icon: Inbox, labelKey: 'edo.control.menu_incoming', ready: true },
  { key: 'appeals', icon: MessageCircleQuestion, labelKey: 'edo.control.menu_appeals', ready: false },
  { key: 'outgoing', icon: Send, labelKey: 'edo.control.menu_outgoing', ready: true },
  { key: 'internal', icon: FileText, labelKey: 'edo.control.menu_internal', ready: true },
  { key: 'plan', icon: ClipboardList, labelKey: 'edo.control.menu_plan', ready: false },
  { key: 'ready-internal', icon: FileCheck2, labelKey: 'edo.control.menu_ready_internal', ready: true },
  { key: 'received', icon: ClipboardCheck, labelKey: 'edo.control.menu_received', ready: false },
  { key: 'integrations', icon: Plug, labelKey: 'edo.control.menu_integrations', ready: false },
];

const TAB_KEYS: TabKey[] = [
  'dashboard', 'incoming', 'appeals', 'outgoing', 'internal',
  'plan', 'ready-internal', 'received', 'integrations',
];

export function EdoControlPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<TabKey>(
    initialTab && (TAB_KEYS as string[]).includes(initialTab) ? (initialTab as TabKey) : 'dashboard',
  );

  return (
    <div className="flex h-full">
      {/* ── Nazorat chap menyusi ── */}
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-slate-50/70 overflow-y-auto py-4 hidden md:block">
        <div className="px-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {t('edo.control.section')}
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {MENU.map((m) => (
            <button
              key={m.key}
              onClick={() => setTab(m.key)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors',
                tab === m.key
                  ? 'bg-asaka-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900',
              )}
            >
              <m.icon size={17} className="shrink-0" />
              <span className="flex-1">{t(m.labelKey)}</span>
              {!m.ready && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {t('edo.control.soon_badge')}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Mobil menyu (yuqorida gorizontal) ── */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="md:hidden border-b border-slate-200 bg-slate-50 px-2 py-2 flex gap-1 overflow-x-auto">
          {MENU.map((m) => (
            <button
              key={m.key}
              onClick={() => setTab(m.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap',
                tab === m.key ? 'bg-asaka-600 text-white' : 'bg-white text-slate-600 border border-slate-200',
              )}
            >
              <m.icon size={14} />
              {t(m.labelKey)}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && <ControlDashboard />}
        {tab === 'incoming' && (
          <DocList
            queryKey="ctl-incoming"
            endpoint="/documents/control/incoming"
            titleKey="edo.control.menu_incoming"
            emptyKey="edo.list.empty_incoming"
            showHolder
          />
        )}
        {tab === 'outgoing' && (
          <DocList
            queryKey="ctl-outgoing"
            endpoint="/documents/control/outgoing"
            titleKey="edo.control.menu_outgoing"
            emptyKey="edo.list.empty_outgoing"
            showHolder
          />
        )}
        {tab === 'internal' && <InternalControl />}
        {tab === 'ready-internal' && (
          <DocList
            queryKey="ctl-ready-internal"
            endpoint="/documents/control/ready-internal"
            titleKey="edo.control.menu_ready_internal"
            emptyKey="edo.list.empty_archive"
          />
        )}
        {(tab === 'appeals' || tab === 'plan' || tab === 'received' || tab === 'integrations') && (
          <ComingSoon labelKey={MENU.find((m) => m.key === tab)!.labelKey} />
        )}
      </div>
    </div>
  );
}

function ComingSoon({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 mb-4">
        <Construction size={30} />
      </div>
      <h2 className="text-lg font-semibold text-slate-800 mb-1">{t(labelKey)}</h2>
      <p className="text-sm text-slate-500">{t('edo.control.coming_soon')}</p>
    </div>
  );
}

// ── Ichki hujjatlar nazorati — gorizontal tabli oyna ──
type ITab = 'info' | 'recontrol' | 'tasks' | 'answers' | 'unaccepted' | 'unfinished';

// Bitta topshiriq (rezolyutsiya ijrochisi) — hujjat konteksti bilan
interface FlatTarget {
  doc: EdoDocument;
  resText: string;
  target: EdoResolutionTarget;
}

function InternalControl() {
  const { t } = useTranslation();
  const [itab, setItab] = useState<ITab>('info');

  // Ochiq topshiriqlar — rezolyutsiya ijrochilari bilan to'liq hujjatlar
  const { data: openDocs } = useQuery({
    queryKey: ['ctl-open-tasks'],
    queryFn: async () => (await api.get<EdoDocument[]>('/documents/control/open-tasks')).data,
  });

  // Barcha topshiriqlarni yassilash (hujjat + rezolyutsiya matni + ijrochi)
  const flat = useMemo<FlatTarget[]>(() => {
    const out: FlatTarget[] = [];
    for (const d of openDocs ?? []) {
      for (const r of d.resolutions ?? []) {
        for (const tg of r.targets ?? []) {
          out.push({ doc: d, resText: r.text, target: tg });
        }
      }
    }
    return out;
  }, [openDocs]);

  const unfinished = flat.filter((f) => f.target.status !== 'done');
  const answers = flat.filter((f) => (f.target.doneNote ?? '').trim().length > 0);

  const TABS: { key: ITab; labelKey: string; count?: number }[] = [
    { key: 'info', labelKey: 'edo.control.itab_info' },
    { key: 'recontrol', labelKey: 'edo.control.itab_recontrol' },
    { key: 'tasks', labelKey: 'edo.control.itab_tasks', count: flat.length },
    { key: 'answers', labelKey: 'edo.control.itab_answers', count: answers.length },
    { key: 'unaccepted', labelKey: 'edo.control.itab_unaccepted' },
    { key: 'unfinished', labelKey: 'edo.control.itab_unfinished', count: unfinished.length },
  ];

  return (
    <div>
      {/* Gorizontal tablar */}
      <div className="border-b border-slate-200 bg-white px-2 sm:px-4 flex gap-1 overflow-x-auto">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setItab(tb.key)}
            className={cn(
              'relative px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2',
              itab === tb.key
                ? 'text-asaka-700 border-b-2 border-asaka-600'
                : 'text-slate-500 hover:text-slate-800 border-b-2 border-transparent',
            )}
          >
            {t(tb.labelKey)}
            {tb.count != null && tb.count > 0 && (
              <span
                className={cn(
                  'text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
                  itab === tb.key ? 'bg-asaka-100 text-asaka-700' : 'bg-slate-100 text-slate-500',
                )}
              >
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {itab === 'info' && <ControlDashboard />}
      {itab === 'tasks' && (
        <DocList
          queryKey="ctl-open-tasks-list"
          endpoint="/documents/control/open-tasks"
          titleKey="edo.control.itab_tasks"
          emptyKey="edo.control.tasks_none"
          showHolder
        />
      )}
      {itab === 'answers' && <AnswersView answers={answers} />}
      {itab === 'unfinished' && <UnfinishedView items={unfinished} />}
      {(itab === 'recontrol' || itab === 'unaccepted') && (
        <ComingSoon labelKey={TABS.find((x) => x.key === itab)!.labelKey} />
      )}
    </div>
  );
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Berilgan javoblar (3-rasm) — bajarilmagan topshiriqlarga yozilgan javoblar ──
function AnswersView({ answers }: { answers: FlatTarget[] }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return answers;
    return answers.filter(
      (a) =>
        (a.resText ?? '').toLowerCase().includes(s) ||
        (a.target.doneNote ?? '').toLowerCase().includes(s) ||
        (a.doc.subject ?? '').toLowerCase().includes(s) ||
        (a.target.user.fullName ?? '').toLowerCase().includes(s),
    );
  }, [answers, q]);

  return (
    <div className="px-4 md:px-6 py-5 space-y-4">
      {/* Qidiruv */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('edo.list.search_ph')}
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-12">
          <MessageSquareText size={30} className="mx-auto mb-2 opacity-50" />
          {t('edo.control.ans_none')}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Link
              key={a.target.id}
              to={`/edo/documents/${a.doc.id}`}
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-asaka-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText size={15} className="text-asaka-600 shrink-0" />
                <span className="text-xs font-mono text-slate-500">{a.doc.number ?? '—'}</span>
                <span className="text-sm font-medium text-slate-800 truncate">{a.doc.subject}</span>
              </div>

              {/* Topshiriq mazmuni */}
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 mb-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase mb-0.5">
                  {t('edo.control.ans_task')}
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.resText}</p>
              </div>

              {/* Berilgan javob */}
              <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-3 py-2">
                <div className="text-[11px] font-semibold text-emerald-600 uppercase mb-0.5">
                  {t('edo.control.ans_given')}
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{a.target.doneNote}</p>
              </div>

              {/* Ijrochi + sana */}
              <div className="flex items-center gap-2 mt-2.5 text-xs text-slate-500">
                <Avatar
                  fullName={a.target.user.fullName}
                  avatarPath={a.target.user.avatarPath ?? undefined}
                  size="sm"
                />
                <span className="font-medium text-slate-700">{a.target.user.fullName}</span>
                {a.target.doneAt && (
                  <span className="ml-auto">
                    {t('edo.control.answered_at')}: {fmtDate(a.target.doneAt)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bajarilmagan topshiriqlar ro'yxati ──
function UnfinishedView({ items }: { items: FlatTarget[] }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <div className="px-6 py-12 text-center text-sm text-slate-400">{t('edo.control.tasks_none')}</div>;
  }
  return (
    <div className="px-4 md:px-6 py-5 space-y-2">
      {items.map((a) => (
        <Link
          key={a.target.id}
          to={`/edo/documents/${a.doc.id}`}
          className="block bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-asaka-300 hover:shadow-sm transition"
        >
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-asaka-600 shrink-0" />
            <span className="text-xs font-mono text-slate-500">{a.doc.number ?? '—'}</span>
            <span className="text-sm font-medium text-slate-800 truncate">{a.doc.subject}</span>
            <span
              className={cn(
                'ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                a.target.status === 'overdue'
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-sky-50 text-sky-600',
              )}
            >
              {t(`edo.task_status.${a.target.status}`)}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1.5 line-clamp-2">{a.resText}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <Avatar
              fullName={a.target.user.fullName}
              avatarPath={a.target.user.avatarPath ?? undefined}
              size="sm"
            />
            <span className="font-medium text-slate-700">{a.target.user.fullName}</span>
            {a.target.deadline && <span className="ml-auto">{fmtDate(a.target.deadline)}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}

function ControlDashboard() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['control-stats'],
    queryFn: async () => (await api.get<ControlStats>('/documents/control/stats')).data,
  });

  if (isLoading) {
    return <div className="p-8 text-slate-400">{t('common.loading')}</div>;
  }
  if (!data) return null;

  const chips: { labelKey: string; value: number; cls: string }[] = [
    { labelKey: 'edo.control.k_orders', value: data.total.orders, cls: 'bg-violet-50 text-violet-700' },
    { labelKey: 'edo.control.k_in_progress', value: data.total.inProgress, cls: 'bg-sky-50 text-sky-700' },
    { labelKey: 'edo.control.k_not_done', value: data.total.notDone, cls: 'bg-rose-50 text-rose-700' },
    { labelKey: 'edo.control.k_done', value: data.total.done, cls: 'bg-emerald-50 text-emerald-700' },
    { labelKey: 'edo.control.k_done_late', value: data.total.doneLate, cls: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <div className="px-4 md:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('edo.control.dash_title')}</h1>
        <p className="text-sm text-slate-500">{t('edo.control.dash_subtitle')}</p>
      </div>

      {/* Umumiy ko'rsatkichlar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {chips.map((c) => (
          <div key={c.labelKey} className={cn('rounded-xl px-4 py-3', c.cls)}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs font-medium opacity-80">{t(c.labelKey)}</div>
          </div>
        ))}
      </div>

      {/* Hujjat turi bo'yicha jadval */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">
          {t('edo.control.by_documents')}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-5 py-2.5 font-medium">{t('edo.control.col_doc_type')}</th>
                <th className="px-3 py-2.5 font-medium text-center">{t('edo.control.col_docs')}</th>
                <th className="px-3 py-2.5 font-medium text-center">{t('edo.control.col_orders')}</th>
                <th className="px-3 py-2.5 font-medium text-center">{t('edo.control.col_in_progress')}</th>
                <th className="px-3 py-2.5 font-medium text-center">{t('edo.control.col_not_done')}</th>
                <th className="px-3 py-2.5 font-medium text-center">{t('edo.control.col_done')}</th>
                <th className="px-3 py-2.5 font-medium text-center">{t('edo.control.col_done_late')}</th>
                <th className="px-3 py-2.5 font-medium text-center">{t('edo.control.col_renewed')}</th>
              </tr>
            </thead>
            <tbody>
              {data.byType.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    {t('edo.control.no_orders')}
                  </td>
                </tr>
              ) : (
                data.byType.map((r) => (
                  <tr key={r.type} className="border-b border-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {t(`edo.doc_type.${r.type}`)}
                    </td>
                    <td className="px-3 py-3 text-center">{r.documents}</td>
                    <td className="px-3 py-3 text-center">{r.orders}</td>
                    <td className="px-3 py-3 text-center text-sky-600">{r.inProgress}</td>
                    <td className="px-3 py-3 text-center text-rose-600">{r.notDone}</td>
                    <td className="px-3 py-3 text-center text-emerald-600">{r.done}</td>
                    <td className="px-3 py-3 text-center text-amber-600">{r.doneLate}</td>
                    <td className="px-3 py-3 text-center text-slate-400">{r.renewed}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.byType.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold text-slate-800">
                  <td className="px-5 py-3">{t('edo.control.total')}</td>
                  <td className="px-3 py-3 text-center">{data.total.documents}</td>
                  <td className="px-3 py-3 text-center">{data.total.orders}</td>
                  <td className="px-3 py-3 text-center text-sky-600">{data.total.inProgress}</td>
                  <td className="px-3 py-3 text-center text-rose-600">{data.total.notDone}</td>
                  <td className="px-3 py-3 text-center text-emerald-600">{data.total.done}</td>
                  <td className="px-3 py-3 text-center text-amber-600">{data.total.doneLate}</td>
                  <td className="px-3 py-3 text-center text-slate-400">{data.total.renewed}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Rahbarlar bo'yicha kartalar */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">{t('edo.control.managers')}</h2>
        {data.managers.length === 0 ? (
          <div className="text-sm text-slate-400">{t('edo.control.no_orders')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.managers.map((m) => (
              <ManagerCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerCard({ m }: { m: ControlManager }) {
  const { t } = useTranslation();
  const total = m.orders || 1;
  const rows: { labelKey: string; value: number; bar: string; text: string }[] = [
    { labelKey: 'edo.control.k_orders', value: m.orders, bar: 'bg-emerald-500', text: 'text-emerald-700' },
    { labelKey: 'edo.control.k_in_progress', value: m.inProgress, bar: 'bg-sky-500', text: 'text-sky-700' },
    { labelKey: 'edo.control.k_done', value: m.done, bar: 'bg-emerald-400', text: 'text-emerald-700' },
    { labelKey: 'edo.control.k_done_late', value: m.doneLate, bar: 'bg-amber-400', text: 'text-amber-700' },
    { labelKey: 'edo.control.k_overdue', value: m.notDone, bar: 'bg-rose-500', text: 'text-rose-700' },
    { labelKey: 'edo.control.k_on_approval', value: m.onApproval, bar: 'bg-violet-400', text: 'text-violet-700' },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar fullName={m.fullName} avatarPath={m.avatarPath ?? undefined} size="sm" />
        <div className="min-w-0">
          <div className="font-medium text-slate-900 truncate">{m.fullName}</div>
          <div className="text-xs text-slate-500 truncate">
            {[m.department, m.position].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.labelKey} className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-28 shrink-0">{t(r.labelKey)}</span>
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full', r.bar)}
                style={{ width: `${Math.min(100, (r.value / total) * 100)}%` }}
              />
            </div>
            <span className={cn('text-xs font-semibold w-6 text-right', r.text)}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
