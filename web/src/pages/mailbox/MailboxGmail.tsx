import { Link } from 'react-router-dom';
import { Star, Paperclip, AlertCircle, AlertTriangle, Inbox } from 'lucide-react';
import { formatDateShort, cn } from '../../lib/utils';
import type { MessageFolder } from '../../lib/types';
import { useMailboxData } from './useMailboxData';

interface Props {
  folder: MessageFolder;
  starredOnly?: boolean;
}

export function MailboxGmail({ folder, starredOnly }: Props) {
  const { search, setSearch, isLoading, filtered, toggleStar, title } = useMailboxData(
    folder,
    starredOnly,
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 flex items-center gap-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700 px-2">{title}</h2>
        <span className="text-xs text-slate-400">{filtered.length}</span>
        <div className="ml-auto">
          <input
            type="search"
            placeholder="Filtrlash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 px-3 py-1 text-xs rounded border border-slate-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Inbox size={48} className="mx-auto mb-3 text-slate-200" />
            <div className="text-sm">Xabarlar yo'q</div>
          </div>
        ) : (
          <ul>
            {filtered.map((item) => {
              const unread = !item.isRead && folder === 'inbox';
              return (
                <li key={item.id}>
                  <Link
                    to={`/messages/${item.messageId}`}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2 border-b border-slate-100 hover:shadow-md hover:z-10 relative transition-shadow',
                      unread ? 'bg-white font-bold' : 'bg-slate-50 text-slate-700',
                    )}
                  >
                    <button
                      onClick={(e) => toggleStar(e, item)}
                      className="flex-shrink-0 text-slate-300 hover:text-yellow-500"
                    >
                      <Star
                        size={16}
                        className={item.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}
                      />
                    </button>

                    <span className="text-sm truncate w-44 flex-shrink-0">
                      {folder === 'sent'
                        ? 'Men'
                        : item.message.fromUser?.fullName || 'Noma\'lum'}
                    </span>

                    <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                      {item.message.importance === 'urgent' && (
                        <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                      )}
                      {item.message.importance === 'important' && (
                        <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                      )}
                      <span className="truncate">{item.message.subject}</span>
                      <span className={cn('truncate', unread ? 'font-normal text-slate-500' : 'text-slate-400')}>
                        — {item.message.body?.slice(0, 80)}
                      </span>
                    </div>

                    {item.message.attachments && item.message.attachments.length > 0 && (
                      <Paperclip size={14} className="text-slate-400 flex-shrink-0" />
                    )}

                    <span className="text-xs flex-shrink-0 w-16 text-right">
                      {formatDateShort(item.message.sentAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
