import { Link } from 'react-router-dom';
import { Star, Paperclip, Search, AlertCircle, AlertTriangle } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { formatDateShort, cn } from '../../lib/utils';
import type { MessageFolder } from '../../lib/types';
import { useMailboxData } from './useMailboxData';

interface Props {
  folder: MessageFolder;
  starredOnly?: boolean;
}

export function MailboxClassic({ folder, starredOnly }: Props) {
  const { search, setSearch, isLoading, filtered, toggleStar, title } = useMailboxData(
    folder,
    starredOnly,
  );

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <span className="text-sm text-slate-400">{filtered.length} ta xabar</span>
        <div className="ml-auto relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Mavzu, matn yoki yuboruvchi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Xabarlar yo'q</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/messages/${item.messageId}`}
                  className={cn(
                    'flex items-center gap-3 px-6 py-3 hover:bg-brand-50 transition-colors',
                    !item.isRead && folder === 'inbox' && 'bg-blue-50/40 font-medium',
                  )}
                >
                  <button
                    onClick={(e) => toggleStar(e, item)}
                    className="flex-shrink-0 text-slate-300 hover:text-yellow-500"
                  >
                    <Star
                      size={18}
                      className={item.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}
                    />
                  </button>

                  <Avatar fullName={item.message.fromUser?.fullName || '??'} avatarPath={item.message.fromUser?.avatarPath} size="sm" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {folder === 'sent'
                          ? 'Men'
                          : item.message.fromUser?.fullName || 'Noma\'lum'}
                      </span>
                      {item.message.fromUser?.position?.name && folder !== 'sent' && (
                        <span className="text-xs text-slate-400 truncate">
                          • {item.message.fromUser.position.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.message.importance === 'urgent' && (
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                      )}
                      {item.message.importance === 'important' && (
                        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                      )}
                      <span className="text-sm text-slate-700 truncate">
                        {item.message.subject}
                      </span>
                    </div>
                  </div>

                  {item.message.attachments && item.message.attachments.length > 0 && (
                    <Paperclip size={16} className="text-slate-400 flex-shrink-0" />
                  )}

                  <span className="text-xs text-slate-400 flex-shrink-0 w-20 text-right">
                    {formatDateShort(item.message.sentAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
