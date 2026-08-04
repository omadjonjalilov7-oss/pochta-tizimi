import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Avatar } from '../../components/Avatar';
import { DocList } from './EdoDocList';

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
        {tab === 'internal' && (
          <DocList
            queryKey="ctl-internal"
            endpoint="/documents/control/internal"
            titleKey="edo.control.menu_internal"
            emptyKey="edo.list.empty_mine"
            showHolder
          />
        )}
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
