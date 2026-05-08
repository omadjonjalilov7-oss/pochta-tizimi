import { Link, useLocation } from 'react-router-dom';
import { Star, Paperclip, AlertCircle, AlertTriangle, Search, Inbox as InboxIcon } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { formatDateShort, cn } from '../../lib/utils';
import type { MessageFolder } from '../../lib/types';
import { useMailboxData } from './useMailboxData';

interface Props {
  folder: MessageFolder;
  starredOnly?: boolean;
  width?: number;
}

export function MailboxOutlook({ folder, starredOnly, width }: Props) {
  const { search, setSearch, isLoading, filtered, toggleStar, title } = useMailboxData(
    folder,
    starredOnly,
  );
  const location = useLocation();
  const activeId = location.pathname.startsWith('/messages/')
    ? location.pathname.split('/').pop()
    : null;

  return (
    <>
      {/* Message list column */}
      <div
        style={width ? { width } : undefined}
        className={cn('flex flex-col border-r border-slate-200 bg-white flex-shrink-0', !width && 'w-96')}
      >
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-800 mb-1.5">{title}</div>
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Qidirish"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <InboxIcon size={36} className="mx-auto mb-2 text-slate-200" />
              <div className="text-sm">Xabarlar yo'q</div>
            </div>
          ) : (
            <ul>
              {filtered.map((item) => {
                const unread = !item.isRead && folder === 'inbox';
                const isActive = activeId === item.messageId;
                return (
                  <li key={item.id}>
                    <Link
                      to={`/messages/${item.messageId}`}
                      className={cn(
                        'block px-3 py-2.5 border-b border-slate-100 transition-colors relative',
                        isActive
                          ? 'bg-brand-50 border-l-4 border-l-brand-600 -ml-px'
                          : 'hover:bg-slate-50',
                        unread && !isActive && 'border-l-4 border-l-brand-500 -ml-px',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Avatar
                          fullName={item.message.fromUser?.fullName || '??'}
                          avatarPath={item.message.fromUser?.avatarPath}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-sm truncate flex-1',
                                unread ? 'font-bold text-slate-900' : 'text-slate-700',
                              )}
                            >
                              {folder === 'sent'
                                ? 'Men'
                                : item.message.fromUser?.fullName || 'Noma\'lum'}
                            </span>
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {formatDateShort(item.message.sentAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.message.importance === 'urgent' && (
                              <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
                            )}
                            {item.message.importance === 'important' && (
                              <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                'text-xs truncate flex-1',
                                unread ? 'font-semibold text-slate-800' : 'text-slate-600',
                              )}
                            >
                              {item.message.subject}
                            </span>
                            {item.message.attachments &&
                              item.message.attachments.length > 0 && (
                                <Paperclip size={12} className="text-slate-400 flex-shrink-0" />
                              )}
                            <button
                              onClick={(e) => toggleStar(e, item)}
                              className="flex-shrink-0 text-slate-300 hover:text-yellow-500"
                            >
                              <Star
                                size={12}
                                className={
                                  item.isStarred ? 'fill-yellow-400 text-yellow-400' : ''
                                }
                              />
                            </button>
                          </div>
                          <div className="text-xs text-slate-400 truncate mt-0.5">
                            {item.message.body?.slice(0, 80)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

    </>
  );
}
