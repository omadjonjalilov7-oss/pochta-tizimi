import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Palette, LayoutGrid, Languages } from 'lucide-react';
import { THEMES, type ThemeId, getStoredTheme, setStoredTheme } from '../lib/theme';
import { DESIGNS, type DesignId, getStoredDesign, setStoredDesign } from '../lib/design';
import { SUPPORTED_LANGUAGES, setLanguage, getLanguage, type LanguageCode } from '../i18n';
import { cn } from '../lib/utils';

type ModalType = 'theme' | 'design' | 'language';

function Modal({
  type,
  onClose,
}: {
  type: ModalType;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [originalTheme] = useState<ThemeId>(getStoredTheme());
  const [originalDesign] = useState<DesignId>(getStoredDesign());
  const [originalLang] = useState<LanguageCode>(getLanguage());
  const [theme, setTheme] = useState<ThemeId>(originalTheme);
  const [design, setDesign] = useState<DesignId>(originalDesign);
  const [lang, setLang] = useState<LanguageCode>(originalLang);

  const handlePickTheme = (id: ThemeId) => {
    setTheme(id);
    setStoredTheme(id);
  };

  const handlePickDesign = (id: DesignId) => {
    setDesign(id);
    setStoredDesign(id);
  };

  const handlePickLang = (id: LanguageCode) => {
    setLang(id);
    setLanguage(id);
  };

  const handleCancel = () => {
    if (type === 'theme' && theme !== originalTheme) setStoredTheme(originalTheme);
    if (type === 'design' && design !== originalDesign) setStoredDesign(originalDesign);
    if (type === 'language' && lang !== originalLang) setLanguage(originalLang);
    onClose();
  };

  const titleKey =
    type === 'theme' ? 'themes.title' : type === 'design' ? 'designs.title' : 'language_modal.title';
  const subtitleKey =
    type === 'theme'
      ? 'themes.subtitle'
      : type === 'design'
      ? 'designs.subtitle'
      : 'language_modal.subtitle';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-6 border-b border-slate-200">
          {type === 'theme' ? (
            <Palette size={22} className="text-brand-600" />
          ) : type === 'design' ? (
            <LayoutGrid size={22} className="text-brand-600" />
          ) : (
            <Languages size={22} className="text-brand-600" />
          )}
          <h2 className="text-lg font-semibold text-slate-900 flex-1">{t(titleKey)}</h2>
          <button
            onClick={handleCancel}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-slate-500 mb-5">{t(subtitleKey)}</p>

          {type === 'theme' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEMES.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handlePickTheme(opt.id)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 p-3 rounded-xl border-2 transition text-left',
                    theme === opt.id
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-300 bg-white',
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className="w-8 h-8 rounded-lg shadow-inner flex-shrink-0"
                      style={{ background: opt.preview }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm truncate">
                        {t(`themes.${opt.id}`)}
                      </div>
                    </div>
                    {theme === opt.id && (
                      <Check size={18} className="text-brand-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{t(`themes.${opt.id}_desc`)}</div>
                </button>
              ))}
            </div>
          )}

          {type === 'design' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DESIGNS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handlePickDesign(opt.id)}
                  className={cn(
                    'relative flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition text-left',
                    design === opt.id
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-300 bg-white',
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="font-medium text-slate-900 text-sm">
                      {t(`designs.${opt.id}`)}
                    </div>
                    {design === opt.id && (
                      <Check size={16} className="ml-auto text-brand-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{t(`designs.${opt.id}_desc`)}</div>
                </button>
              ))}
            </div>
          )}

          {type === 'language' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUPPORTED_LANGUAGES.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => handlePickLang(opt.code)}
                  className={cn(
                    'relative flex items-center gap-3 p-4 rounded-xl border-2 transition text-left',
                    lang === opt.code
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-300 bg-white',
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                    {opt.code.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm">{opt.labelNative}</div>
                    <div className="text-xs text-slate-500">{opt.label}</div>
                  </div>
                  {lang === opt.code && (
                    <Check size={18} className="text-brand-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
          >
            {t('common.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useAppearanceModals() {
  const [open, setOpen] = useState<ModalType | null>(null);
  const openTheme = () => setOpen('theme');
  const openDesign = () => setOpen('design');
  const openLanguage = () => setOpen('language');
  const modals = open ? <Modal type={open} onClose={() => setOpen(null)} /> : null;
  return { openTheme, openDesign, openLanguage, modals };
}
