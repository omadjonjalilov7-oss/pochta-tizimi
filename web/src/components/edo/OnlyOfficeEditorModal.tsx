import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

// OnlyOffice Document Server bir xil origin ostida reverse-proxy orqali
// ulanadi: `/onlyoffice/...`. Shu tufayli ham http://192.168.100.252, ham
// https://edo.asaka-motors.uz manzillarida mixed-content muammosi bo'lmaydi.
const ONLYOFFICE_PATH = '/onlyoffice';

declare global {
  interface Window {
    DocsAPI?: any;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadDocsApi(): Promise<void> {
  if (window.DocsAPI) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const src = `${window.location.origin}${ONLYOFFICE_PATH}/web-apps/apps/api/documents/api.js`;
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('load_failed'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  documentId: string;
  attId: string;
  filename: string;
  onClose: () => void;
  // Fayl saqlangach (callback muvaffaqiyatli) hujjatni yangilash uchun.
  onSaved?: () => void;
}

export default function OnlyOfficeEditorModal({
  documentId,
  attId,
  filename,
  onClose,
  onSaved,
}: Props) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const savedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const lang = i18n.language?.startsWith('ru') ? 'ru' : 'ru';
        const { data } = await api.get(
          `/documents/${documentId}/attachments/${attId}/onlyoffice-config`,
          { params: { lang } },
        );
        if (cancelled) return;

        await loadDocsApi();
        if (cancelled) return;
        if (!window.DocsAPI) throw new Error('no_docsapi');

        const config = {
          ...data.config,
          type: 'desktop',
          width: '100%',
          height: '100%',
          events: {
            onDocumentReady: () => {
              if (!cancelled) setLoading(false);
            },
            onError: (event: any) => {
              if (!cancelled) {
                // OnlyOffice xato kodi/matnini ekranга chiqaramiz (diagnostika).
                const code =
                  event?.data?.errorCode ?? event?.data ?? undefined;
                const desc = event?.data?.errorDescription;
                // eslint-disable-next-line no-console
                console.error('[OnlyOffice] onError', event);
                let msg = t('edo.online_edit.err_editor');
                if (code !== undefined && code !== null && code !== '') {
                  msg += ` (kod: ${typeof code === 'object' ? JSON.stringify(code) : code})`;
                }
                if (desc) msg += ` — ${desc}`;
                setError(msg);
                setLoading(false);
              }
            },
            onWarning: (event: any) => {
              // eslint-disable-next-line no-console
              console.warn('[OnlyOffice] onWarning', event);
            },
            // Hujjat o'zgartirilib saqlangani haqida signal.
            onDocumentStateChange: (e: any) => {
              // e.data === false -> o'zgarishlar saqlandi (serverga yozildi)
              if (e && e.data === false) {
                savedRef.current = true;
              }
            },
          },
        };

        // OnlyOffice DOM'ini React'dan TO'LIQ ajratamiz: placeholder div'ni
        // imperativ (DOM API) orqali yaratamiz. Shunda React uning ichidagi
        // iframe'ni hech qachon boshqarmaydi va "insertBefore" to'qnashuvi
        // yuz bermaydi.
        const host = containerRef.current;
        if (!host) throw new Error('no_host');
        host.innerHTML = '';
        const holder = document.createElement('div');
        holder.id = 'onlyoffice-editor-root';
        holder.style.width = '100%';
        holder.style.height = '100%';
        host.appendChild(holder);

        editorRef.current = new window.DocsAPI.DocEditor(
          'onlyoffice-editor-root',
          config,
        );
      } catch (e: any) {
        if (cancelled) return;
        if (e?.message === 'load_failed') {
          setError(t('edo.online_edit.err_connect'));
        } else if (e?.response?.status === 400) {
          setError(t('edo.online_edit.err_disabled'));
        } else {
          setError(t('edo.online_edit.err_generic'));
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        editorRef.current?.destroyEditor?.();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, attId]);

  const handleClose = () => {
    if (savedRef.current) onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-800 truncate">
            {filename}
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            {t('edo.online_edit.autosave_hint')}
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100"
        >
          <X size={16} />
          {t('common.close')}
        </button>
      </div>

      <div className="relative flex-1 bg-slate-100">
        {/* OnlyOffice shu bo'sh konteyner ichiga o'z div/iframe'ini qo'yadi.
            React bu div'ning bolalarini boshqarmaydi. */}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ visibility: error ? 'hidden' : 'visible' }}
        />
        {/* Overlaylar DOIM mount qilingan — faqat display o'zgaradi (React
            hech qachon tugun qo'shib-o'chirmaydi → to'qnashuv yo'q). */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 bg-slate-100"
          style={{ display: loading && !error ? 'flex' : 'none' }}
        >
          <Loader2 size={28} className="animate-spin" />
          <span className="text-sm">{t('edo.online_edit.loading')}</span>
        </div>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 bg-slate-100"
          style={{ display: error ? 'flex' : 'none' }}
        >
          <p className="text-sm text-red-600 max-w-md">{error}</p>
          <button
            type="button"
            onClick={handleClose}
            className="text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-md"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
