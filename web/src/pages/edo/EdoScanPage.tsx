import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  ShieldCheck,
  ShieldOff,
  Loader2,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import { publicApi } from '../../lib/api';

type ScanStatus = 'draft' | 'in_review' | 'in_progress' | 'done' | 'rejected' | 'overdue';

interface Snapshot {
  number: string | null;
  docUid: string | null;
  type: 'internal' | 'incoming' | 'outgoing';
  internalKind: 'service_letter' | 'order' | null;
  subject: string;
  status: ScanStatus;
  isSigned: boolean;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  createdByName: string | null;
  createdByDept: string | null;
}

const STATUS_COLORS: Record<ScanStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  in_review: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-sky-100 text-sky-800',
  done: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  overdue: 'bg-rose-100 text-rose-700',
};

export function EdoScanPage() {
  const { t, i18n } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const lang = i18n.language || 'uz';

  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    publicApi
      .get<Snapshot>(`/public/documents/${token}`)
      .then((res) => setData(res.data))
      .catch(() => setError(t('edo.scan.not_found')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fmt = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(lang);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Sarlavha */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-asaka-600 text-white flex items-center justify-center shadow-lg shadow-asaka-600/30 mb-3">
            <QrCode size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">{t('edo.scan.title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('edo.scan.subtitle')}</p>
        </div>

        {/* Kartochka */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {!token && (
            <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <QrCode size={40} className="text-slate-300" />
              {t('edo.scan.no_token')}
            </div>
          )}

          {token && loading && (
            <div className="p-10 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-asaka-500" />
              {t('edo.scan.loading')}
            </div>
          )}

          {token && !loading && error && (
            <div className="p-8 text-center flex flex-col items-center gap-3">
              <AlertTriangle size={40} className="text-amber-400" />
              <p className="text-sm text-slate-600">{error}</p>
              <button
                onClick={load}
                className="mt-1 text-sm font-medium text-asaka-600 hover:text-asaka-700"
              >
                {t('edo.scan.retry')}
              </button>
            </div>
          )}

          {token && !loading && !error && data && (
            <div>
              {/* Status banner */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-asaka-50 text-asaka-600 flex items-center justify-center shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">
                      {data.number || t('edo.scan.no_number')}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {t(`edo.doc_type.${data.type}`)}
                      {data.internalKind
                        ? ` · ${t(`edo.internal_kind.${data.internalKind}`)}`
                        : ''}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLORS[data.status]}`}
                >
                  {t(`edo.status.${data.status}`)}
                </span>
              </div>

              {/* Mavzu */}
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                  {t('edo.scan.subject')}
                </div>
                <div className="text-sm text-slate-700 leading-snug">{data.subject}</div>
              </div>

              {/* Imzo holati */}
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                {data.isSigned ? (
                  <>
                    <ShieldCheck size={18} className="text-emerald-500" />
                    <span className="text-sm text-emerald-700 font-medium">
                      {t('edo.scan.signed')}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldOff size={18} className="text-slate-400" />
                    <span className="text-sm text-slate-500">{t('edo.scan.not_signed')}</span>
                  </>
                )}
              </div>

              {/* Tafsilotlar */}
              <dl className="px-5 py-4 space-y-3">
                <Row label={t('edo.scan.created_by')} value={data.createdByName || '—'} />
                <Row label={t('edo.scan.department')} value={data.createdByDept || '—'} />
                <Row label={t('edo.scan.created_at')} value={fmt(data.createdAt)} />
                {data.deadline && (
                  <Row label={t('edo.scan.deadline')} value={fmt(data.deadline)} />
                )}
                {data.closedAt && (
                  <Row label={t('edo.scan.closed_at')} value={fmt(data.closedAt)} />
                )}
                <Row label={t('edo.scan.updated_at')} value={fmt(data.updatedAt)} />
              </dl>
            </div>
          )}
        </div>

        <p className="text-[11px] text-center text-slate-400 mt-6 px-6 leading-relaxed">
          {t('edo.scan.footer')}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs text-slate-400 shrink-0">{label}</dt>
      <dd className="text-sm text-slate-700 text-right">{value}</dd>
    </div>
  );
}
