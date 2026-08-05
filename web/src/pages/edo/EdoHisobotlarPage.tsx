import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, FileText, Download, Loader2, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoDocument } from '../../lib/types';
import { openDocumentPrint } from '../../lib/printDoc';

interface ReportRow {
  id: string;
  index: number;
  number: string;
  createdAt: string;
  createdBy: string;
  type: string;
  typeRaw: string;
  subject: string;
  agreedDate: string | null;
  approvers: string;
  agreementType: string;
}

type ReportTab = 'all' | 'internal' | 'outgoing' | 'incoming';

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'all', label: 'edo.hisobotlar.tab_all' },
  { key: 'internal', label: 'edo.hisobotlar.tab_internal' },
  { key: 'outgoing', label: 'edo.hisobotlar.tab_outgoing' },
  { key: 'incoming', label: 'edo.hisobotlar.tab_incoming' },
];

interface ReportPreview {
  from: string;
  to: string;
  total: number;
  rows: ReportRow[];
}

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

export function EdoHisobotlarPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [{ from, to }, setRange] = useState(defaultRange);
  const [tab, setTab] = useState<ReportTab>('all');
  const [downloading, setDownloading] = useState<'excel' | 'pdf' | null>(null);
  const [rowDownloading, setRowDownloading] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Qidiruvni debounce qilamiz (yozish tugaganda so'rov yuboriladi).
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', new Date(from).toISOString());
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      p.set('to', d.toISOString());
    }
    if (tab !== 'all') p.set('type', tab);
    if (search) p.set('search', search);
    return p.toString();
  }, [from, to, tab, search]);

  const previewQ = useQuery({
    queryKey: ['edo-report-preview', params],
    queryFn: async () =>
      (await api.get<ReportPreview>(`/documents/report/preview?${params}`)).data,
  });

  const download = async (format: 'excel' | 'pdf') => {
    setDownloading(format);
    try {
      const res = await api.get(`/documents/report?format=${format}&${params}`, {
        responseType: 'blob',
      });
      const disposition = res.headers['content-disposition'] as string | undefined;
      const match = disposition?.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `hisobot.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const downloadDoc = async (row: ReportRow) => {
    setRowDownloading(row.id);
    try {
      // Hujjatning to'liq holatini olamiz va aynan ekrandagi ko'rinishini
      // (sarlavha + matn) chop etish/PDF oynasida ochamiz — panelsiz.
      const res = await api.get<EdoDocument>(`/documents/${row.id}`);
      const d = res.data;
      openDocumentPrint(d, true);
    } finally {
      setRowDownloading(null);
    }
  };

  const rows = previewQ.data?.rows ?? [];

  return (
    <div className="w-full px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('edo.hisobotlar.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('edo.hisobotlar.subtitle')}</p>
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

      {/* Eksport paneli */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Download size={16} className="text-asaka-600" />
          <span>{t('edo.hisobotlar.export_hint')}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => download('excel')}
            disabled={downloading !== null}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {downloading === 'excel' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            {t('edo.hisobotlar.export_excel')}
          </button>
          <button
            onClick={() => download('pdf')}
            disabled={downloading !== null}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 transition-colors"
          >
            {downloading === 'pdf' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            {t('edo.hisobotlar.export_pdf')}
          </button>
        </div>
      </div>

      {/* Qidiruv */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('edo.hisobotlar.search_ph')}
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Turi bo'yicha bo'limlar */}
      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={
              tab === tb.key
                ? 'px-4 py-1.5 text-sm font-medium rounded-lg bg-asaka-600 text-white'
                : 'px-4 py-1.5 text-sm font-medium rounded-lg bg-white text-slate-600 border border-slate-200 hover:border-asaka-400 hover:text-asaka-700'
            }
          >
            {t(tb.label)}
          </button>
        ))}
      </div>

      {/* Ko'rish jadvali */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            {t('edo.hisobotlar.preview')}
          </span>
          <span className="text-xs text-slate-500">
            {t('edo.hisobotlar.total', { count: previewQ.data?.total ?? 0 })}
          </span>
        </div>
        {previewQ.isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            {t('edo.hisobotlar.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-3 py-2 w-10">№</th>
                  <th className="px-3 py-2">{t('edo.hisobotlar.col_number')}</th>
                  <th className="px-3 py-2">{t('edo.hisobotlar.col_created')}</th>
                  <th className="px-3 py-2">{t('edo.hisobotlar.col_author')}</th>
                  <th className="px-3 py-2">{t('edo.hisobotlar.col_type')}</th>
                  <th className="px-3 py-2">{t('edo.hisobotlar.col_subject')}</th>
                  <th className="px-3 py-2">{t('edo.hisobotlar.col_agreed_date')}</th>
                  <th className="px-3 py-2">{t('edo.hisobotlar.col_approvers')}</th>
                  <th className="px-3 py-2">{t('edo.hisobotlar.col_agreement_type')}</th>
                  <th className="px-3 py-2 text-right">{t('edo.hisobotlar.col_pdf')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.index} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2 text-slate-400">{r.index}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.number}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.createdAt}</td>
                    <td className="px-3 py-2 text-slate-600">{r.createdBy}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.type}</td>
                    <td className="px-3 py-2 text-slate-800 max-w-xs truncate" title={r.subject}>
                      {r.subject}
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.agreedDate ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-xs truncate" title={r.approvers}>
                      {r.approvers}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.agreementType}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => downloadDoc(r)}
                        disabled={rowDownloading !== null}
                        title={t('edo.hisobotlar.download_pdf')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                      >
                        {rowDownloading === r.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <FileText size={13} />
                        )}
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
