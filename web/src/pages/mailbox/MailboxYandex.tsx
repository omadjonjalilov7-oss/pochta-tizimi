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

export function MailboxYandex({ folder, starredOnly }: Props) {
  const { t } = useTranslation();
  const { search, setSearch, isSearching, isLoading, filtered, groupedItems, toggleStar, title } = useMailboxData(
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
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-60 px-2 py-1 text-xs rounded border border-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-200 outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-slate-400 text-sm">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Inbox size={40} className="mx-auto mb-2 text-slate-200" />
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
              <div key={group.name}>
                {/* Group header */}
                <div className="sticky top-0 bg-slate-100/50 border-y border-slate-200 px-3 py-1.5 flex items-center gap-2">
                  {group.color && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
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

                {/* Group messages table */}
                <table className="w-full text-sm">
                  <tbody>
                    {group.items.map((item) => {
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
                                ? t('mailbox.me')
                                : senderDisplayName(item.message)}
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
                              <span
                                className={cn(
                                  'truncate text-slate-900',
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
                              <span
                                className={cn(
                                  'truncate flex-1',
                                  unread ? 'font-normal text-slate-600' : 'text-slate-400',
                                )}
                              >
                                — {stripHtmlForPreview(item.message.body, 60)}
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
              </div>
            ))}
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
                          ? t('mailbox.me')
                          : senderDisplayName(item.message)}
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
                        <span
                          className={cn(
                            'truncate text-slate-900',
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
                        <span
                          className={cn(
                            'truncate flex-1',
                            unread ? 'font-normal text-slate-600' : 'text-slate-400',
                          )}
                        >
                          — {stripHtmlForPreview(item.message.body, 60)}
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
