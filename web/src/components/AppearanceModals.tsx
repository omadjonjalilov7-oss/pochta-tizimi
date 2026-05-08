import { useState } from 'react';
import { Check, X, Palette, LayoutGrid } from 'lucide-react';
import { THEMES, type ThemeId, getStoredTheme, setStoredTheme } from '../lib/theme';
import { DESIGNS, type DesignId, getStoredDesign, setStoredDesign } from '../lib/design';
import { cn } from '../lib/utils';

type ModalType = 'theme' | 'design';

function Modal({
  type,
  onClose,
}: {
  type: ModalType;
  onClose: () => void;
}) {
  // Modal yangi mount bo'lganda hozirgi qiymatni eslab qoladi (Bekor qilish uchun)
  const [originalTheme] = useState<ThemeId>(getStoredTheme());
  const [originalDesign] = useState<DesignId>(getStoredDesign());
  const [theme, setTheme] = useState<ThemeId>(originalTheme);
  const [design, setDesign] = useState<DesignId>(originalDesign);

  const handlePickTheme = (id: ThemeId) => {
    setTheme(id);
    setStoredTheme(id); // darhol qo'llanadi (preview)
  };

  const handlePickDesign = (id: DesignId) => {
    setDesign(id);
    setStoredDesign(id);
  };

  const handleCancel = () => {
    // Avvalgi tanlovga qaytarish
    if (type === 'theme' && theme !== originalTheme) {
      setStoredTheme(originalTheme);
    }
    if (type === 'design' && design !== originalDesign) {
      setStoredDesign(originalDesign);
    }
    onClose();
  };

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
          ) : (
            <LayoutGrid size={22} className="text-brand-600" />
          )}
          <h2 className="text-lg font-semibold text-slate-900 flex-1">
            {type === 'theme' ? 'Rang temasi' : 'Interfeys ko\'rinishi'}
          </h2>
          <button
            onClick={handleCancel}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-slate-500 mb-5">
            {type === 'theme'
              ? 'Variantni bosing — darhol qo\'llanadi. Yoqmasa "Bekor qilish".'
              : 'Variantni bosing — darhol qo\'llanadi. Yoqmasa "Bekor qilish".'}
          </p>

          {type === 'theme' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handlePickTheme(t.id)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 p-3 rounded-xl border-2 transition text-left',
                    theme === t.id
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-300 bg-white',
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className="w-8 h-8 rounded-lg shadow-inner flex-shrink-0"
                      style={{ background: t.preview }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm truncate">
                        {t.name}
                      </div>
                    </div>
                    {theme === t.id && (
                      <Check size={18} className="text-brand-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{t.description}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DESIGNS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handlePickDesign(d.id)}
                  className={cn(
                    'relative flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition text-left',
                    design === d.id
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-300 bg-white',
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="font-medium text-slate-900 text-sm">{d.name}</div>
                    {design === d.id && (
                      <Check size={16} className="ml-auto text-brand-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{d.description}</div>
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
            Bekor qilish
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
          >
            OK
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
  const modals = open ? <Modal type={open} onClose={() => setOpen(null)} /> : null;
  return { openTheme, openDesign, modals };
}
