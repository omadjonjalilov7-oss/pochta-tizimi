import { Link } from 'react-router-dom';
import { Star, Paperclip, AlertCircle, AlertTriangle, Inbox } from 'lucide-react';
import { formatDateShort, cn } from '../../lib/utils';
import type { MessageFolder } from '../../lib/types';
import { useMailboxData } from './useMailboxData';

interface Props {
  folder: MessageFolder;
  starredOnly?: boolean;
}

export function MailboxYandex({ folder, starredOnly }: Props) {
  const { search, setSearch, isLoading, filtered, toggleStar, title } = useMailboxData(
    folder,
    starredOnly,
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 flex items-center gap-3 border-b border-slate-200 bg-slate-50">
        <h1 className="text-sm font-bold text-slate-900">{title}</h1>
        <span className="text-xs text-slate-500">{filtered.length}</span>
        <input
          type="search"
          placeholder="Qidirish"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-60 px-2 py-1 text-xs rounded border border-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-200 outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Inbox size={40} className="mx-auto mb-2 text-slate-200" />
            <div className="text-sm">Xabarlar yo'q</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {filtered.map((item) => {
                const unread = !item.isRead && folder === 'inbox';
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b border-slate-100 hover:bg-yellow-50 transition-colors',
                      unread && 'bg-blue-50/30 font-semibold',
                    )}
                  >
                    <td className="px-2 py-1.5 w-8">
                      <button
                        onClick={(e) => toggleStar(e, item)}
                        className="text-slate-300 hover:text-yellow-500"
                      >
                        <Star
                          size={14}
                          className={item.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}
                        />
                      </button>
                    </td>
                    <td className="py-1.5 w-44">
                      <Link
                        to={`/messages/${item.messageId}`}
                        className="block truncate text-slate-900"
                      >
                        {folder === 'sent'
                          ? 'Men'
                          : item.message.fromUser?.fullName || 'Noma\'lum'}
                      </Link>
                    </td>
                    <td className="py-1.5">
                      <Link
                        to={`/messages/${item.messageId}`}
                        className="flex items-center gap-1.5 truncate"
                      >
                        {item.message.importance === 'urgent' && (
                          <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
                        )}
                        {item.message.importance === 'important' && (
                          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                        )}
                        <span className="truncate text-slate-900">
                          {item.message.subject}
                        </span>
                        <span
                          className={cn(
                            'truncate flex-1',
                            unread ? 'font-normal text-slate-600' : 'text-slate-400',
                          )}
                        >
                          — {item.message.body?.slice(0, 60)}
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 w-6 text-slate-400">
                      {item.message.attachments && item.message.attachments.length > 0 && (
                        <Paperclip size={12} />
                      )}
                    </td>
                    <td className="px-2 py-1.5 w-16 text-xs text-slate-500 text-right">
                      {formatDateShort(item.message.sentAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
