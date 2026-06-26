import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

/**
 * EDO sahifalari uchun vaqtinchalik skelet — Sprint 1+ da to'ldiriladi.
 */
export function EdoComingSoon({ titleKey, descKey }: { titleKey: string; descKey?: string }) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="bg-brand-50 text-brand-600 rounded-full p-4 mb-4">
        <Construction size={36} />
      </div>
      <h1 className="text-xl font-semibold text-slate-900 mb-2">{t(titleKey)}</h1>
      <p className="text-sm text-slate-500 max-w-md">
        {t(descKey ?? 'edo.coming_soon.default_desc')}
      </p>
    </div>
  );
}
