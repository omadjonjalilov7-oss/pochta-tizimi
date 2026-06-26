import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, Paperclip, AlertCircle, AlertTriangle, Inbox as InboxIcon, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { formatDateShort, cn, senderDisplayName, stripHtmlForPreview } from '../../lib/utils';
import type { MessageFolder } from '../../lib/types';
import { useMailboxData } from './useMailboxData';

interface Props {
  folder: MessageFolder;
  starredOnly?: boolean;
  width?: number;
}

export function MailboxOutlook({ folder, starredOnly, width }: Props) {
  const { t } = useTranslation();
  const { search, isSearching, isLoading, filtered, groupedItems, toggleStar, title } = useMailboxData(
    folder,
    starredOnly,
  );
  const location = useLocation();
  const activeId = location.pathname.startsWith('/messages/')
    ? location.pathname.split('/').pop()
    : null;

  // Gruhlarda expanded state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroupExpanded = (groupName: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupName)) {
      newSet.delete(groupName);
    } else {
      newSet.add(groupName);
    }
    setExpandedGroups(newSet);
  };

  return (
    <>
      {/* Message list column */}
      <div
        style={width ? { width } : undefined}
        className={cn('flex flex-col border-r border-slate-200 bg-white flex-shrink-0', !width && 'w-96')}
      >
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-slate-400 text-sm">{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <InboxIcon size={36} className="mx-auto mb-2 text-slate-200" />
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
              {groupedItems.map((group) => {
                const isExpanded = expandedGroups.has(group.name);
                return (
                  <div key={group.name}>
                    {/* Group header - clickable */}
                    <button
                      onClick={() => toggleGroupExpanded(group.name)}
                      className="w-full sticky top-0 bg-slate-100/50 border-y border-slate-200 px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 transition-colors text-left"
                    >
                      <ChevronDown
                        size={16}
                        className={cn(
                          'flex-shrink-0 text-slate-500 transition-transform',
                          isExpanded ? 'rotate-180' : '',
                        )}
                      />
                      {group.color && (
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                      )}
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex-1">
                        {group.name}
                      </span>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {group.items.length}
                      </span>
                    </button>

                    {/* Group messages - conditional rendering */}
                    {isExpanded && (
                      <ul>
                        {group.items.map((item) => {
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
                                fullName={senderDisplayName(item.message) || '??'}
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
                                      ? t('mailbox.me')
                                      : senderDisplayName(item.message)}
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
                                  {stripHtmlForPreview(item.message.body, 80)}
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
                );
              })}
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
                          fullName={senderDisplayName(item.message) || '??'}
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
                                ? t('mailbox.me')
                                : senderDisplayName(item.message)}
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
