import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, FileText, Maximize2 } from 'lucide-react';
import { api } from '../../lib/api';

interface Props {
  documentId: string;
  attId: string;
  filename: string;
  // To'liq ekranda ochish (mavjud AttachmentViewerModal orqali).
  onExpand?: () => void;
  onDownload?: () => void;
  heightClass?: string;
}

type Kind = 'pdf' | 'image' | 'text' | 'office' | 'other';

const NO_PREVIEW_EXTS = [
  '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz',
  '.exe', '.msi', '.dmg', '.iso', '.apk', '.bin', '.dll', '.jar',
];

function detectKind(filename: string): Kind {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
  if (ext === '.pdf') return 'pdf';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'].includes(ext))
    return 'image';
  if (['.txt', '.csv', '.log', '.json', '.xml', '.md', '.html', '.htm'].includes(ext))
    return 'text';
  if (NO_PREVIEW_EXTS.includes(ext)) return 'other';
  return 'office';
}

// Biriktirilgan asosiy hujjatni (kiruvchi hujjatning tashqi fayli) hujjat
// oynasining ICHIDA (modalsiz) ko'rsatadi. Word/Excel serverda PDF'ga
// aylantirilib ko'rsatiladi — kiruvchi shablon bilan bir joyda ko'rinadi.
export default function InlineAttachmentPreview({
  documentId,
  attId,
  filename,
  onExpand,
  onDownload,
  heightClass = 'h-[600px]',
}: Props) {
  const { t } = useTranslation();
  const kind = detectKind(filename);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (kind === 'other') {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const endpoint =
          kind === 'office' || kind === 'pdf'
            ? `/documents/${documentId}/attachments/${attId}/pdf`
            : `/documents/${documentId}/attachments/${attId}/download`;
        const res = await api.get(endpoint, { responseType: 'blob' });
        if (cancelled) return;
        const blob = res.data as Blob;
        if (kind === 'text') {
          const txt = await blob.text();
          if (cancelled) return;
          setTextContent(txt);
        } else {
          const type = kind === 'image' ? blob.type : 'application/pdf';
          const url = URL.createObjectURL(
            type && kind !== 'image' ? new Blob([blob], { type }) : blob,
          );
          urlRef.current = url;
          setBlobUrl(url);
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, attId]);

  const isPdfLike = kind === 'pdf' || kind === 'office';

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={15} className="text-asaka-600 shrink-0" />
          <span className="text-sm font-medium text-slate-700 truncate">{filename}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              title={t('edo.viewer.hint')}
              className="p-1.5 text-slate-400 hover:text-asaka-600 hover:bg-slate-100 rounded"
            >
              <Maximize2 size={15} />
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              title={t('common.download')}
              className="p-1.5 text-slate-400 hover:text-asaka-600 hover:bg-slate-100 rounded"
            >
              <Download size={15} />
            </button>
          )}
        </div>
      </div>

      <div className={`relative ${heightClass} bg-slate-100 overflow-auto`}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 size={26} className="animate-spin" />
            <span className="text-sm">
              {kind === 'office' ? t('edo.viewer.converting') : t('edo.viewer.loading')}
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-sm text-red-600 max-w-md">{t('edo.viewer.err_load')}</p>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 text-sm bg-asaka-600 hover:bg-asaka-700 text-white px-4 py-1.5 rounded-md"
              >
                <Download size={15} />
                {t('common.download')}
              </button>
            )}
          </div>
        )}

        {!loading && !error && isPdfLike && blobUrl && (
          <iframe title={filename} src={blobUrl} className="w-full h-full border-0" />
        )}

        {!loading && !error && kind === 'image' && blobUrl && (
          <div className="min-h-full flex items-center justify-center p-4">
            <img src={blobUrl} alt={filename} className="max-w-full max-h-full object-contain" />
          </div>
        )}

        {!loading && !error && kind === 'text' && textContent !== null && (
          <pre className="p-4 text-sm text-slate-800 whitespace-pre-wrap break-words font-mono">
            {textContent}
          </pre>
        )}

        {!loading && !error && kind === 'other' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <FileText size={38} className="text-slate-400" />
            <p className="text-sm text-slate-600 max-w-md">{t('edo.viewer.unsupported')}</p>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 text-sm bg-asaka-600 hover:bg-asaka-700 text-white px-4 py-1.5 rounded-md"
              >
                <Download size={15} />
                {t('common.download')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
