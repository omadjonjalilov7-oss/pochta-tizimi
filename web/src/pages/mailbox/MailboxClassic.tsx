import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, Paperclip, Search, AlertCircle, AlertTriangle } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { formatDateShort, cn, senderDisplayName } from '../../lib/utils';
import type { MessageFolder } from '../../lib/types';
import { useMailboxData } from './useMailboxData';

interface Props {
  folder: MessageFolder;
  starredOnly?: boolean;
}

export function MailboxClassic({ folder, starredOnly }: Props) {
  const { t } = useTranslation();
  const { search, setSearch, isSearching, isLoading, filtered, groupedItems, toggleStar, title } = useMailboxData(
    folder,
    starredOnly,
  );

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <span className="text-sm text-slate-400">{t('mailbox.message_count', { count: filtered.length })}</span>
        <div className="ml-auto relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder={t('mailbox.search_short')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            {isSearching ? (
              <>
                <div className="text-base text-slate-600 mb-1">{t('mailbox.empty_search')}</div>
                <div className="text-sm">{t('mailbox.empty_search_hint', { query: search })}</div>
              </>
            ) : (
              t('mailbox.empty_generic')
            )}
          </div>
        ) : groupedItems ? (
          <div>
            {groupedItems.map((group) => (
              <div key={group.name}>
                {/* Group header */}
                <div className="sticky top-0 bg-slate-50 border-y border-slate-200 px-6 py-2 flex items-center gap-2">
                  {group.color && (
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                  )}
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {group.name}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">
                    {group.items.length}
                  </span>
                </div>

                {/* Group messages */}
                <ul className="divide-y divide-slate-100">
                  {group.items.map((item) => (
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

                        <Avatar fullName={senderDisplayName(item.message) || '??'} avatarPath={item.message.fromUser?.avatarPath} size="sm" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {folder === 'sent'
                                ? t('mailbox.me')
                                : senderDisplayName(item.message)}
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
                            <span
                              className={cn(
                                'text-sm text-slate-700 truncate',
                                folder === 'sent' && item.message.recalledAt && 'line-through text-slate-400',
                              )}
                            >
                              {item.message.subject}
                            </span>
                            {folder === 'sent' && item.message.recalledAt && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0"
                                title={t('message.recalled_badge')}
                              >
                                {t('mailbox.recalled_short')}
                              </span>
                            )}
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
              </div>
            ))}
          </div>
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

                  <Avatar fullName={senderDisplayName(item.message) || '??'} avatarPath={item.message.fromUser?.avatarPath} size="sm" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {folder === 'sent'
                          ? t('mailbox.me')
                          : senderDisplayName(item.message)}
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
                      <span
                        className={cn(
                          'text-sm text-slate-700 truncate',
                          folder === 'sent' && item.message.recalledAt && 'line-through text-slate-400',
                        )}
                      >
                        {item.message.subject}
                      </span>
                      {folder === 'sent' && item.message.recalledAt && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0"
                          title={t('message.recalled_badge')}
                        >
                          {t('mailbox.recalled_short')}
                        </span>
                      )}
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
