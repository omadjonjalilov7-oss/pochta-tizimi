import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

// ONLYOFFICE Document Server orqali biriktirilgan Word faylni haqiqiy online
// muharrirда ochadi. Config backenddan olinadi (imzolangan), tahrir tugagach
// DS fayl'ни backenddagi callback orqali saqlaydi.
//
// DS brauzer uchun bir xil domen ostida: /onlyoffice/ (nginx reverse proxy).
// Kerak bo'lsa VITE_ONLYOFFICE_URL bilan almashtiriladi.

interface Props {
  documentId: string;
  attId: string;
  filename: string;
  onClose: () => void;
  onSaved?: () => void;
}

declare global {
  interface Window {
    DocsAPI?: any;
  }
}

const DS_BASE = (
  (import.meta as any).env?.VITE_ONLYOFFICE_URL || '/onlyoffice'
).replace(/\/+$/, '');
const API_JS = `${DS_BASE}/web-apps/apps/api/documents/api.js`;

// api.js ni bir marta yuklaydi (window.DocsAPI paydo bo'lguncha kutadi).
function loadDocsApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.DocsAPI) return resolve();
    const existing = document.getElementById('onlyoffice-api-js');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('api.js yuklanmadi')),
      );
      if (window.DocsAPI) resolve();
      return;
    }
    const s = document.createElement('script');
    s.id = 'onlyoffice-api-js';
    s.src = API_JS;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('api.js yuklanmadi'));
    document.head.appendChild(s);
  });
}

export default function OnlyOfficeEditorModal({
  documentId,
  attId,
  filename,
  onClose,
  onSaved,
}: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const containerId = useRef(
    `onlyoffice-${Math.random().toString(36).slice(2)}`,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: config } = await api.get(
          `/onlyoffice/config/${documentId}/${attId}`,
        );
        await loadDocsApi();
        if (cancelled) return;
        if (!window.DocsAPI) throw new Error('DocsAPI topilmadi');

        const fullConfig = {
          ...config,
          width: '100%',
          height: '100%',
          type: 'desktop',
          events: {
            onDocumentStateChange: (e: any) => {
              // e.data === false: hujjat saqlandi (tahrir tugadi).
              if (e && e.data === false) onSaved?.();
            },
            onError: () => {
              /* DS o'z xatolарини ko'rsatadi */
            },
          },
        };

        editorRef.current = new window.DocsAPI.DocEditor(
          containerId.current,
          fullConfig,
        );
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(
          e?.response?.data?.message ||
            e?.message ||
            'Online muharrirni ochib bo‘lmadi',
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        editorRef.current?.destroyEditor?.();
      } catch {}
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, attId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60">
      <div className="flex items-center gap-3 bg-white border-b border-slate-200 px-3 py-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft size={18} />
          Yopish
        </button>
        <span className="text-sm font-medium text-slate-500 truncate">
          {filename}
        </span>
      </div>

      <div className="relative flex-1 bg-white">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            <Loader2 size={22} className="animate-spin mr-2" />
            Yuklanmoqda…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-600">
            {error}
          </div>
        )}
        <div ref={holderRef} className="w-full h-full">
          <div id={containerId.current} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
