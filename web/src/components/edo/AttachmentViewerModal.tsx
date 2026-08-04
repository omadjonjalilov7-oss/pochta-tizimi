import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Loader2, FileText } from 'lucide-react';
import { api } from '../../lib/api';

interface Props {
  documentId: string;
  attId: string;
  filename: string;
  onClose: () => void;
}

type Kind = 'pdf' | 'image' | 'text' | 'office' | 'other';

// Ko'rib bo'lmaydigan (arxiv/ijro) fayllar — faqat yuklab olish mumkin.
const NO_PREVIEW_EXTS = [
  '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz',
  '.exe', '.msi', '.dmg', '.iso', '.apk', '.bin', '.dll', '.jar',
];

function detectKind(filename: string): Kind {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
  if (ext === '.pdf') return 'pdf';
  // Brauzer to'g'ridan-to'g'ri ko'rsata oladigan rasm formatlari.
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'].includes(ext))
    return 'image';
  if (['.txt', '.csv', '.log', '.json', '.xml', '.md', '.html', '.htm'].includes(ext))
    return 'text';
  // Aniq ko'rib bo'lmaydigan (arxiv/ijro) fayllar.
  if (NO_PREVIEW_EXTS.includes(ext)) return 'other';
  // Qolgan BARCHA turlar (Word/Excel/PowerPoint, .tif/.tiff skanerlar,
  // kengaytmasiz yoki noma'lum fayllar) serverda LibreOffice orqali PDF'ga
  // aylantirilib bir xilда ko'rsatiladi.
  return 'office';
}

// Biriktirilgan faylni brauzerda (yuklab olmasdan) ko'rish uchun modal.
// PDF/rasm/matn to'g'ridan-to'g'ri; Word/Excel/PowerPoint serverда PDF'ga
// aylantirilib ko'rsatiladi. Yagona "Orqaga" tugmasi hujjatga qaytaradi.
export default function AttachmentViewerModal({
  documentId,
  attId,
  filename,
  onClose,
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

    // Noma'lum (masalan .zip, .exe) fayllarni ko'rsatib bo'lmaydi.
    if (kind === 'other') {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Office va PDF — serverning PDF endpointidan (Office avtomatik
        // PDF'ga aylantiriladi). Rasm/matn — oddiy download.
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
          // pdf / office / image — object URL orqali ko'rsatamiz.
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

  const handleDownload = async () => {
    try {
      const res = await api.get(
        `/documents/${documentId}/attachments/${attId}/download`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      /* foydalanuvchi qayta urinadi */
    }
  };

  const isPdfLike = kind === 'pdf' || kind === 'office';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-asaka-700 px-2.5 py-1.5 rounded-md hover:bg-slate-100"
        >
          <ArrowLeft size={18} />
          {t('common.back')}
        </button>
        <span className="font-semibold text-slate-800 truncate mx-3 flex-1 text-center">
          {filename}
        </span>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-asaka-700 px-2.5 py-1.5 rounded-md hover:bg-slate-100"
        >
          <Download size={16} />
          <span className="hidden sm:inline">{t('common.download')}</span>
        </button>
      </div>

      <div className="relative flex-1 bg-slate-100 overflow-auto">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">
              {kind === 'office'
                ? t('edo.viewer.converting')
                : t('edo.viewer.loading')}
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-sm text-red-600 max-w-md">
              {t('edo.viewer.err_load')}
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-sm bg-asaka-600 hover:bg-asaka-700 text-white px-4 py-1.5 rounded-md"
            >
              <Download size={15} />
              {t('common.download')}
            </button>
          </div>
        )}

        {!loading && !error && isPdfLike && blobUrl && (
          <iframe
            title={filename}
            src={blobUrl}
            className="w-full h-full border-0"
          />
        )}

        {!loading && !error && kind === 'image' && blobUrl && (
          <div className="min-h-full flex items-center justify-center p-4">
            <img
              src={blobUrl}
              alt={filename}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}

        {!loading && !error && kind === 'text' && textContent !== null && (
          <pre className="p-4 text-sm text-slate-800 whitespace-pre-wrap break-words font-mono">
            {textContent}
          </pre>
        )}

        {!loading && !error && kind === 'other' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <FileText size={40} className="text-slate-400" />
            <p className="text-sm text-slate-600 max-w-md">
              {t('edo.viewer.unsupported')}
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-sm bg-asaka-600 hover:bg-asaka-700 text-white px-4 py-1.5 rounded-md"
            >
              <Download size={15} />
              {t('common.download')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
