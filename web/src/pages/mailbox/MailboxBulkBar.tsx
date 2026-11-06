import { useTranslation } from 'react-i18next';
import { CheckCheck, Trash2, X, Loader2, Check } from 'lucide-react';
import type { MessageFolder } from '../../lib/types';
import { cn } from '../../lib/utils';

// Har bir xabar qatoridagi belgilash katakchasi (checkbox). Link ichida bo'lgani
// uchun bosilganda sahifaga o'tmasligi kerak — onToggle ichida preventDefault bor.
export function MailCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="tanlash"
      className={cn(
        'flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors',
        checked
          ? 'bg-brand-600 border-brand-600 text-white'
          : 'border-slate-300 hover:border-brand-400 text-transparent',
      )}
    >
      <Check size={13} />
    </button>
  );
}

interface Props {
  folder: MessageFolder;
  unreadCount: number;
  selectedCount: number;
  busy: boolean;
  onMarkAllRead: () => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onClear: () => void;
}

// Pochta ro'yxati ustidagi amal paneli:
//  - "Hammasini o'qildi" (faqat inbox'da, o'qilmagan bo'lsa) — bir bosishda.
//  - Xabarlar yonidagi katakchalar bilan tanlab, "O'chirish (N)" — bitta tugma.
export function MailboxBulkBar({
  folder,
  unreadCount,
  selectedCount,
  busy,
  onMarkAllRead,
  onSelectAll,
  onDeleteSelected,
  onClear,
}: Props) {
  const { t } = useTranslation();
  const showMarkAll = folder === 'inbox' && unreadCount > 0;
  const hasSelection = selectedCount > 0;

  // Hech qanday amal ko'rsatilmasa — panelni umuman chizmaymiz.
  if (!showMarkAll && !hasSelection) return null;

  const confirmDelete = () => {
    if (window.confirm(t('mailbox.delete_confirm', { count: selectedCount }))) {
      onDeleteSelected();
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showMarkAll && (
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
          {t('mailbox.mark_all_read')}
        </button>
      )}

      {hasSelection ? (
        <>
          <span className="text-xs md:text-sm text-slate-500">
            {t('mailbox.selected_count', { count: selectedCount })}
          </span>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {t('mailbox.delete_selected')}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs md:text-sm text-slate-500 hover:text-slate-700 rounded-lg px-2 py-1.5"
          >
            <X size={15} />
            {t('mailbox.clear_selection')}
          </button>
        </>
      ) : (
        showMarkAll && (
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs md:text-sm text-slate-500 hover:text-slate-700 rounded-lg px-2 py-1.5"
          >
            {t('mailbox.select_all')}
          </button>
        )
      )}
    </div>
  );
}
