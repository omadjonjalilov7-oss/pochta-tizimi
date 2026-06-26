import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, FileSignature } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Pochta ↔ EDO o'rtasida almashtirish uchun header tugmasi.
 * Joriy app bo'rttirib ko'rsatiladi, ikkinchi appga bosish bilan o'tiladi.
 */
export function AppSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const isEdo = location.pathname.startsWith('/edo');

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full bg-slate-100 p-0.5 text-sm',
        className,
      )}
      role="tablist"
      aria-label={t('app_switcher.label')}
    >
      <Link
        to="/inbox"
        role="tab"
        aria-selected={!isEdo}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors',
          !isEdo
            ? 'bg-white text-brand-700 shadow-sm'
            : 'text-slate-500 hover:text-slate-700',
        )}
        title={t('app_switcher.pochta_hint')}
      >
        <Mail size={15} />
        <span>{t('app_switcher.pochta')}</span>
      </Link>
      <Link
        to="/edo"
        role="tab"
        aria-selected={isEdo}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors',
          isEdo
            ? 'bg-white text-brand-700 shadow-sm'
            : 'text-slate-500 hover:text-slate-700',
        )}
        title={t('app_switcher.edo_hint')}
      >
        <FileSignature size={15} />
        <span>{t('app_switcher.edo')}</span>
      </Link>
    </div>
  );
}
