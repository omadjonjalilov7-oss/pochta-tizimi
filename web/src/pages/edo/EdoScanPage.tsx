import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  ShieldCheck,
  ShieldOff,
  Loader2,
  AlertTriangle,
  QrCode,
  Users,
  Clock,
  X,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { publicApi } from '../../lib/api';

type ScanStatus = 'draft' | 'in_review' | 'in_progress' | 'done' | 'rejected' | 'overdue';

interface ChainItem {
  fullName: string;
  position: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'done';
  order: number;
  actedAt: string | null;
  rejectReason: string | null;
}

interface HistoryItem {
  action: string;
  actorName: string | null;
  createdAt: string;
}

interface Snapshot {
  number: string | null;
  docUid: string | null;
  type: 'internal' | 'incoming' | 'outgoing';
  internalKind: string | null;
  subject: string;
  status: ScanStatus;
  isSigned: boolean;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  createdByName: string | null;
  createdByDept: string | null;
  body: string | null;
  renderedHtml: string | null;
  chain: ChainItem[];
  history: HistoryItem[];
}

const STATUS_COLORS: Record<ScanStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  in_review: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-sky-100 text-sky-800',
  done: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  overdue: 'bg-rose-100 text-rose-700',
};

const P_STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-700',
  approved: 'text-emerald-700',
  rejected: 'text-red-700',
  done: 'text-emerald-700',
};

export function EdoScanPage() {
  const { t, i18n } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const lang = i18n.language || 'uz';

  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'chain' | 'history' | null>(null);

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

  const docContent = data?.renderedHtml ?? data?.body ?? '';
  const isHtml = /^\s*<[a-z]/i.test(docContent);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-3xl">
        {/* Sarlavha */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-asaka-600 text-white flex items-center justify-center shadow-lg shadow-asaka-600/30 mb-3">
            <QrCode size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">{t('edo.scan.title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('edo.scan.subtitle')}</p>
        </div>

        {!token && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
            <QrCode size={40} className="text-slate-300" />
            {t('edo.scan.no_token')}
          </div>
        )}

        {token && loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-asaka-500" />
            {t('edo.scan.loading')}
          </div>
        )}

        {token && !loading && error && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center flex flex-col items-center gap-3">
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
          <div className="space-y-4">
            {/* Hujjat sarlavhasi */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-asaka-50 text-asaka-600 flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {data.number || t('edo.scan.no_number')}
                    </span>
                    {data.docUid && (
                      <span className="font-mono text-xs bg-asaka-50 text-asaka-700 px-2 py-0.5 rounded">
                        {data.docUid}
                      </span>
                    )}
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_COLORS[data.status]}`}
                    >
                      {t(`edo.status.${data.status}`)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {t(`edo.doc_type.${data.type}`)}
                      {data.internalKind ? ` · ${t(`edo.internal_kind.${data.internalKind}`)}` : ''}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 leading-snug">
                    {data.subject}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                    <span>{data.createdByName || '—'}</span>
                    {data.createdByDept && <span>· {data.createdByDept}</span>}
                    <span>· {fmt(data.createdAt)}</span>
                    {data.isSigned ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <ShieldCheck size={13} /> {t('edo.scan.signed')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <ShieldOff size={13} /> {t('edo.scan.not_signed')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Zanjir / Tarix tugmalari */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => setModal('chain')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg"
                >
                  <Users size={14} />
                  {t('edo.view.chain')}
                  <span className="text-slate-400">({data.chain.length})</span>
                </button>
                <button
                  onClick={() => setModal('history')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg"
                >
                  <Clock size={14} />
                  {t('edo.view.history')}
                  <span className="text-slate-400">({data.history.length})</span>
                </button>
              </div>
            </div>

            {/* Hujjat matni / to'ldirilgan shablon */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                {t('edo.view.body')}
              </div>
              {isHtml ? (
                <div
                  className="edo-rendered p-5 overflow-x-auto text-sm text-slate-800"
                  dangerouslySetInnerHTML={{ __html: docContent }}
                />
              ) : (
                <div className="p-5 whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
                  {docContent || '—'}
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-[11px] text-center text-slate-400 mt-6 px-6 leading-relaxed">
          {t('edo.scan.footer')}
        </p>
      </div>

      {/* Zanjir modali */}
      {modal === 'chain' && data && (
        <ScanModal title={t('edo.view.chain')} onClose={() => setModal(null)}>
          {data.chain.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">—</p>
          ) : (
            <ol className="space-y-3">
              {data.chain.map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800">{c.fullName}</div>
                    {c.position && <div className="text-xs text-slate-400">{c.position}</div>}
                    {c.rejectReason && (
                      <div className="text-xs text-red-600 mt-0.5">{c.rejectReason}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-medium inline-flex items-center gap-1 ${P_STATUS_COLORS[c.status] ?? 'text-slate-500'}`}
                    >
                      {c.status === 'approved' || c.status === 'done' ? (
                        <CheckCircle2 size={13} />
                      ) : c.status === 'rejected' ? (
                        <XCircle size={13} />
                      ) : null}
                      {t(`edo.p_status.${c.status}`)}
                    </div>
                    {c.actedAt && (
                      <div className="text-[11px] text-slate-400 mt-0.5">{fmt(c.actedAt)}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ScanModal>
      )}

      {/* Tarix modali */}
      {modal === 'history' && data && (
        <ScanModal title={t('edo.view.history')} onClose={() => setModal(null)}>
          {data.history.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">—</p>
          ) : (
            <ol className="space-y-3">
              {data.history.map((h, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="h-2 w-2 rounded-full bg-asaka-400 shrink-0 mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-400">{fmt(h.createdAt)}</div>
                    <div className="text-sm text-slate-800">
                      <span className="font-medium">{h.actorName || t('edo.view.system_actor')}</span>
                      <span className="ml-1 text-slate-500">{t(`edo.action.${h.action}`, h.action)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ScanModal>
      )}
    </div>
  );
}

function ScanModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
