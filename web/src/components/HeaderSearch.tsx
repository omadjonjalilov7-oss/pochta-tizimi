import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

const MAILBOX_PATHS = ['/inbox', '/sent', '/starred', '/archive', '/trash'];

interface Props {
  /** Tashqi wrapper class — har bir layout o'z stilini berishi uchun */
  wrapperClassName?: string;
  /** Input class — Gmail oq fonli, Outlook ko'k header fonli */
  inputClassName?: string;
  /** Icon class — turli ranglar uchun */
  iconClassName?: string;
  iconSize?: number;
  placeholder?: string;
}

/**
 * Layout headeridagi global qidirish maydoni.
 * URL `?q=` parametri orqali `useMailboxData` bilan sinxronlashadi —
 * mailbox papkasida turganda joyida qidiradi, boshqa sahifada (profil/admin/compose)
 * bo'lsa Kiruvchiga o'tib qidiradi.
 */
export function HeaderSearch({
  wrapperClassName,
  inputClassName,
  iconClassName,
  iconSize = 16,
  placeholder,
}: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get('q') ?? '';

  const onMailbox = MAILBOX_PATHS.includes(location.pathname);

  const handleChange = (newValue: string) => {
    if (onMailbox) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newValue) next.set('q', newValue);
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    } else {
      // Boshqa sahifada turgan bo'lsak — Kiruvchiga o'tib qidiramiz
      const params = new URLSearchParams();
      if (newValue) params.set('q', newValue);
      const qs = params.toString();
      navigate(`/inbox${qs ? `?${qs}` : ''}`);
    }
  };

  return (
    <div className={wrapperClassName ?? 'relative'}>
      <Search
        size={iconSize}
        className={iconClassName ?? 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? t('mailbox.search_placeholder')}
        className={inputClassName ?? 'w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none'}
      />
    </div>
  );
}
