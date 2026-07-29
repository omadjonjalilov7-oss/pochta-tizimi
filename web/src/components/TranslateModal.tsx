import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, X, Loader2, ArrowRight, Copy, Check } from 'lucide-react';
import DOMPurify from 'dompurify';
import { api } from '../lib/api';

// Xabar (subject + body) ni Gemini orqali tarjima qiladi. API kaliti serverda,
// frontend faqat /api/translate ga murojaat qiladi.
//
// onApply berilsa — "yozish" rejimi: tarjimani xabarga qo'llash tugmasi chiqadi.
// Aks holda — "ko'rish" rejimi: faqat natija + nusxa olish tugmasi.
interface Props {
  subject: string;
  body: string; // HTML
  onClose: () => void;
  onApply?: (subject: string, body: string) => void;
}

const LANGS = [
  { code: 'uz', label: "O'zbek (lotin)" },
  { code: 'uzc', label: 'Ўзбек (крилл)' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

export function TranslateModal({ subject, body, onClose, onApply }: Props) {
  const { t } = useTranslation();
  const [from, setFrom] = useState('auto');
  const [to, setTo] = useState('ru');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const { data } = await api.post<{ items: string[] }>('/translate', {
        items: [subject || '', body || ''],
        from,
        to,
      });
      setResult({ subject: data.items[0] ?? '', body: data.items[1] ?? '' });
    } catch (e: any) {
      setError(e?.response?.data?.message || t('translate_modal.error'));
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = result.body;
    const plain = `${result.subject}\n\n${tmp.textContent || ''}`.trim();
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard ruxsati yo'q — e'tiborsiz qoldiramiz
    }
  };

  const selCls =
    'h-9 text-sm border border-slate-300 rounded-lg px-2 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Languages size={20} />
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              {t('translate_modal.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Kontent */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Til tanlash */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('translate_modal.from')}
              </label>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className={selCls}>
                <option value="auto">{t('translate_modal.auto')}</option>
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <ArrowRight size={18} className="text-slate-400 mb-2" />
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('translate_modal.to')}
              </label>
              <select value={to} onChange={(e) => setTo(e.target.value)} className={selCls}>
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-4 h-9 rounded-lg text-sm"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Languages size={15} />}
              {t('translate_modal.translate')}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Natija */}
          {result && (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  {t('translate_modal.subject')}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900">
                  {result.subject || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  {t('translate_modal.body')}
                </div>
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 max-h-64 overflow-y-auto prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.body) }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Pastki tugmalar */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {t('common.close')}
          </button>
          {result && !onApply && (
            <button
              onClick={copyResult}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              {copied ? t('translate_modal.copied') : t('translate_modal.copy')}
            </button>
          )}
          {result && onApply && (
            <button
              onClick={() => {
                onApply(result.subject, result.body);
                onClose();
              }}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2 rounded-lg text-sm"
            >
              <Check size={15} />
              {t('translate_modal.apply')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
