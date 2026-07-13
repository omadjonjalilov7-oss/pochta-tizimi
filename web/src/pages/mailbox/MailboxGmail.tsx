import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, Paperclip, AlertCircle, AlertTriangle, Inbox } from 'lucide-react';
import { formatDateShort, cn, senderDisplayName, stripHtmlForPreview } from '../../lib/utils';
import type { MessageFolder } from '../../lib/types';
import { useMailboxData } from './useMailboxData';

interface Props {
  folder: MessageFolder;
  starredOnly?: boolean;
}

export function MailboxGmail({ folder, starredOnly }: Props) {
  const { t } = useTranslation();
  const { search, isSearching, isLoading, filtered, groupedItems, toggleStar, title } = useMailboxData(
    folder,
    starredOnly,
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 flex items-center gap-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700 px-2">{title}</h2>
        <span className="text-xs text-slate-400">{filtered.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Inbox size={48} className="mx-auto mb-3 text-slate-200" />
            {isSearching ? (
              <>
                <div className="text-sm text-slate-600 mb-1">{t('mailbox.empty_search')}</div>
                <div className="text-xs">{t('mailbox.empty_search_hint', { query: search })}</div>
              </>
            ) : (
              <div className="text-sm">{t('mailbox.empty_generic')}</div>
            )}
          </div>
        ) : groupedItems ? (
          <div>
            {groupedItems.map((group) => (
              <div key={group.key}>
                {/* Group header */}
                <div className="sticky top-0 bg-slate-100/50 border-y border-slate-200 px-4 py-1.5 flex items-center gap-2">
                  {group.color && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                  )}
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {group.name}
                  </span>
                  <span
                    className={`ml-auto text-xs font-semibold ${
                      group.unreadCount > 0 ? 'text-green-600' : 'text-slate-400'
                    }`}
                  >
                    {group.items.length}
                  </span>
                </div>

                {/* Group messages */}
                <ul>
                  {group.items.map((item) => {
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
                              ? t('mailbox.me')
                              : senderDisplayName(item.message)}
                          </span>

                          <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                            {item.message.importance === 'urgent' && (
                              <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                            )}
                            {item.message.importance === 'important' && (
                              <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                'truncate',
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
                                ↶
                              </span>
                            )}
                            <span className={cn('truncate', unread ? 'font-normal text-slate-500' : 'text-slate-400')}>
                              — {stripHtmlForPreview(item.message.body, 80)}
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
              </div>
            ))}
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
                        ? t('mailbox.me')
                        : senderDisplayName(item.message)}
                    </span>

                    <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                      {item.message.importance === 'urgent' && (
                        <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                      )}
                      {item.message.importance === 'important' && (
                        <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                      )}
                      <span
                        className={cn(
                          'truncate',
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
                          ↶
                        </span>
                      )}
                      <span className={cn('truncate', unread ? 'font-normal text-slate-500' : 'text-slate-400')}>
                        — {stripHtmlForPreview(item.message.body, 80)}
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
