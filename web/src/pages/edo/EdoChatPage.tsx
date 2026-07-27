import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Search, Plus, X, Users, LogOut, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../../components/Avatar';
import { cn } from '../../lib/utils';
import {
  type ChatUser,
  type ChatMsg,
  type Conversation,
  type GroupSummaryItem,
  type GroupMsg,
  type GroupInfo,
  ConversationView,
  GroupConversationView,
  GroupCreatePanel,
  GroupAvatar,
  Ticks,
  formatTime,
} from '../../components/chat/shared';

export function EdoChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newConvSearch, setNewConvSearch] = useState('');
  // 'list' | 'newDm' | 'newGroup'
  const [mode, setMode] = useState<'list' | 'newDm' | 'newGroup'>('list');
  const [showInfo, setShowInfo] = useState(false);
  const [typingFrom, setTypingFrom] = useState<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onChatMsg = (data: { payload: ChatMsg }) => {
      const msg = data.payload;
      setTypingFrom((cur) => (cur === msg.fromUserId ? null : cur));
      if (partnerId === msg.fromUserId) {
        api.post(`/chat/read/${msg.fromUserId}`).catch(() => {});
        socket.emit('chat_read', { readByUserId: user.id, toUserId: msg.fromUserId });
      }
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-messages', msg.fromUserId] });
      qc.invalidateQueries({ queryKey: ['chat-unread'] });
    };

    const onChatRead = (data: { payload: { readByUserId: string } }) => {
      qc.invalidateQueries({ queryKey: ['chat-messages', data.payload.readByUserId] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
    };

    const onChatEdited = (data: { payload: ChatMsg }) => {
      const msg = data.payload;
      qc.setQueryData<ChatMsg[]>(['chat-messages', msg.fromUserId], (old) =>
        old?.map((m) => (m.id === msg.id ? msg : m)),
      );
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
    };

    const onChatDeleted = (data: { payload: { messageId: string; peerId: string } }) => {
      const { messageId, peerId } = data.payload;
      qc.setQueryData<ChatMsg[]>(['chat-messages', peerId], (old) =>
        old?.map((m) =>
          m.id === messageId ? { ...m, deleted: true, body: '', attachments: [] } : m,
        ),
      );
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
    };

    // ── Guruh eventlari ──
    const onGroupCreated = () => {
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
      qc.invalidateQueries({ queryKey: ['chat-unread'] });
    };
    const onGroupMsg = (data: { payload: GroupMsg }) => {
      const msg = data.payload;
      if (groupId === msg.groupId) {
        api.post(`/chat/groups/${msg.groupId}/read`).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
      qc.invalidateQueries({ queryKey: ['chat-group-messages', msg.groupId] });
      qc.invalidateQueries({ queryKey: ['chat-unread'] });
    };
    const onGroupEdited = (data: { payload: GroupMsg }) => {
      const msg = data.payload;
      qc.setQueryData<GroupMsg[]>(['chat-group-messages', msg.groupId], (old) =>
        old?.map((m) => (m.id === msg.id ? msg : m)),
      );
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    };
    const onGroupDeleted = (data: { payload: { groupId: string; messageId: string } }) => {
      const { groupId: gid, messageId } = data.payload;
      qc.setQueryData<GroupMsg[]>(['chat-group-messages', gid], (old) =>
        old?.map((m) =>
          m.id === messageId ? { ...m, deleted: true, body: '', attachments: [] } : m,
        ),
      );
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    };
    const onGroupUpdated = (data: { payload: { groupId: string } }) => {
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
      qc.invalidateQueries({ queryKey: ['chat-group-info', data.payload.groupId] });
    };

    const onTyping = (data: { payload: { fromUserId: string; typing: boolean } }) => {
      const { fromUserId, typing } = data.payload;
      if (typing) {
        setTypingFrom(fromUserId);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingFrom(null), 4000);
      } else {
        setTypingFrom((cur) => (cur === fromUserId ? null : cur));
      }
    };

    socket.on('chat_message', onChatMsg);
    socket.on('chat_read', onChatRead);
    socket.on('chat_typing', onTyping);
    socket.on('chat_message_edited', onChatEdited);
    socket.on('chat_message_deleted', onChatDeleted);
    socket.on('chat_group_created', onGroupCreated);
    socket.on('chat_group_message', onGroupMsg);
    socket.on('chat_group_message_edited', onGroupEdited);
    socket.on('chat_group_message_deleted', onGroupDeleted);
    socket.on('chat_group_updated', onGroupUpdated);
    return () => {
      socket.off('chat_message', onChatMsg);
      socket.off('chat_read', onChatRead);
      socket.off('chat_typing', onTyping);
      socket.off('chat_message_edited', onChatEdited);
      socket.off('chat_message_deleted', onChatDeleted);
      socket.off('chat_group_created', onGroupCreated);
      socket.off('chat_group_message', onGroupMsg);
      socket.off('chat_group_message_edited', onGroupEdited);
      socket.off('chat_group_message_deleted', onGroupDeleted);
      socket.off('chat_group_updated', onGroupUpdated);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [user, partnerId, groupId, qc]);

  // ── Ma'lumotlar ───────────────────────────────────────────────────────────
  const { data: conversations = [] } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () =>
      (await api.get<Conversation[]>('/chat/conversations')).data,
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['chat-groups'],
    queryFn: async () => (await api.get<GroupSummaryItem[]>('/chat/groups')).data,
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['chat-contacts'],
    queryFn: async () => (await api.get<ChatUser[]>('/chat/contacts')).data,
    enabled: mode === 'newDm' || mode === 'newGroup',
    staleTime: 60_000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', partnerId],
    queryFn: async () =>
      (await api.get<ChatMsg[]>(`/chat/messages/${partnerId}`)).data,
    enabled: !!partnerId,
    refetchInterval: partnerId ? 10_000 : false,
  });

  const { data: groupMessages = [] } = useQuery({
    queryKey: ['chat-group-messages', groupId],
    queryFn: async () =>
      (await api.get<GroupMsg[]>(`/chat/groups/${groupId}/messages`)).data,
    enabled: !!groupId,
    refetchInterval: groupId ? 10_000 : false,
  });

  const { data: groupInfo } = useQuery({
    queryKey: ['chat-group-info', groupId],
    queryFn: async () =>
      (await api.get<GroupInfo>(`/chat/groups/${groupId}/info`)).data,
    enabled: !!groupId && showInfo,
  });

  // Suhbat/guruh ochilganda o'qildi
  useEffect(() => {
    if (partnerId) {
      api.post(`/chat/read/${partnerId}`).then(() => {
        qc.invalidateQueries({ queryKey: ['chat-conversations'] });
        qc.invalidateQueries({ queryKey: ['chat-unread'] });
        qc.invalidateQueries({ queryKey: ['chat-messages', partnerId] });
      });
    }
  }, [partnerId, qc]);

  useEffect(() => {
    if (groupId) {
      api.post(`/chat/groups/${groupId}/read`).then(() => {
        qc.invalidateQueries({ queryKey: ['chat-groups'] });
        qc.invalidateQueries({ queryKey: ['chat-unread'] });
      });
    }
  }, [groupId, groupMessages.length, qc]);

  const openConversation = useCallback((id: string) => {
    setPartnerId(id);
    setGroupId(null);
    setShowInfo(false);
    setMode('list');
    setNewConvSearch('');
  }, []);

  const openGroup = useCallback((id: string) => {
    setGroupId(id);
    setPartnerId(null);
    setShowInfo(false);
    setMode('list');
  }, []);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.partner.fullName.toLowerCase().includes(q));
  }, [conversations, search]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.group.name.toLowerCase().includes(q));
  }, [groups, search]);

  const filteredContacts = useMemo(() => {
    const q = newConvSearch.trim().toLowerCase();
    const existing = new Set(conversations.map((c) => c.partner.id));
    const base = contacts.filter((c) => !existing.has(c.id));
    if (!q) return base.slice(0, 30);
    return base.filter((c) => c.fullName.toLowerCase().includes(q)).slice(0, 30);
  }, [contacts, newConvSearch, conversations]);

  const activePartner = useMemo(
    () =>
      partnerId
        ? (conversations.find((c) => c.partner.id === partnerId)?.partner ??
            contacts.find((c) => c.id === partnerId) ??
            null)
        : null,
    [partnerId, conversations, contacts],
  );

  const activeGroup = useMemo(
    () => (groupId ? groups.find((g) => g.group.id === groupId)?.group ?? null : null),
    [groupId, groups],
  );

  const createGroup = async (name: string, memberIds: string[]) => {
    const res = (await api.post<{ groupId: string }>('/chat/groups', { name, memberIds })).data;
    await qc.invalidateQueries({ queryKey: ['chat-groups'] });
    setMode('list');
    openGroup(res.groupId);
  };

  const leaveGroup = async () => {
    if (!groupId) return;
    if (!window.confirm(t('edo.chat.leave_confirm'))) return;
    await api.post(`/chat/groups/${groupId}/leave`);
    setGroupId(null);
    setShowInfo(false);
    qc.invalidateQueries({ queryKey: ['chat-groups'] });
  };

  if (!user) return null;

  const headerTitle =
    mode === 'newGroup'
      ? t('edo.chat.create_group')
      : mode === 'newDm'
        ? t('edo.chat.new_conversation')
        : t('edo.nav.chat');

  return (
    <div className="flex h-full">
      {/* ── Chap panel ── */}
      <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <h2 className="font-semibold text-slate-800">{headerTitle}</h2>
          <div className="flex items-center gap-1">
            {mode === 'list' ? (
              <>
                <button
                  onClick={() => setMode('newGroup')}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                  title={t('edo.chat.create_group')}
                >
                  <Users size={18} />
                </button>
                <button
                  onClick={() => {
                    setMode('newDm');
                    setNewConvSearch('');
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                  title={t('edo.chat.new_conversation')}
                >
                  <Plus size={18} />
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMode('list');
                  setNewConvSearch('');
                }}
                className="p-1.5 rounded-lg bg-asaka-100 text-asaka-700 transition-colors"
                title={t('common.cancel')}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Guruh yaratish rejimi */}
        {mode === 'newGroup' ? (
          <GroupCreatePanel
            contacts={contacts}
            onCreate={createGroup}
            onCancel={() => setMode('list')}
          />
        ) : (
          <>
            {/* Qidiruv */}
            <div className="px-3 py-2 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={mode === 'newDm' ? newConvSearch : search}
                  onChange={(e) =>
                    mode === 'newDm' ? setNewConvSearch(e.target.value) : setSearch(e.target.value)
                  }
                  placeholder={
                    mode === 'newDm' ? t('edo.chat.search_user') : t('edo.chat.search')
                  }
                  className="flex-1 text-sm bg-transparent outline-none"
                />
              </div>
            </div>

            {/* Ro'yxat */}
            <div className="flex-1 overflow-y-auto">
              {mode === 'newDm' ? (
                filteredContacts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    {t('edo.chat.no_users')}
                  </p>
                ) : (
                  filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openConversation(c.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left"
                    >
                      <Avatar fullName={c.fullName} avatarPath={c.avatarPath ?? undefined} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{c.fullName}</div>
                        {c.position?.name && (
                          <div className="text-xs text-slate-500 truncate">{c.position.name}</div>
                        )}
                      </div>
                    </button>
                  ))
                )
              ) : filteredConversations.length === 0 && filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-8 px-4">
                  <MessageCircle size={36} className="opacity-40" />
                  <p className="text-sm">{t('edo.chat.no_conversations')}</p>
                  <button
                    onClick={() => setMode('newDm')}
                    className="text-sm text-asaka-600 hover:underline"
                  >
                    {t('edo.chat.start_conversation')}
                  </button>
                </div>
              ) : (
                <>
                  {/* Guruhlar */}
                  {filteredGroups.map((g) => (
                    <button
                      key={g.group.id}
                      onClick={() => openGroup(g.group.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-50 transition-colors',
                        groupId === g.group.id ? 'bg-asaka-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <div className="relative shrink-0">
                        <GroupAvatar size="sm" />
                        {g.unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-asaka-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {g.unread > 9 ? '9+' : g.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {g.group.name}
                          </span>
                          {g.lastMessage && (
                            <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                              {formatTime(g.lastMessage.sentAt)}
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            'text-xs truncate block',
                            g.unread > 0 ? 'font-semibold text-slate-800' : 'text-slate-500',
                          )}
                        >
                          {g.lastMessage
                            ? g.lastMessage.deleted
                              ? t('edo.chat.deleted_msg')
                              : `${g.lastMessage.fromUserId === user.id ? t('edo.chat.you') : g.lastMessage.fromName}: ${
                                  g.lastMessage.attachments.length > 0 && !g.lastMessage.body
                                    ? `📎 ${g.lastMessage.attachments[0].filename}`
                                    : g.lastMessage.body || '—'
                                }`
                            : t('edo.chat.members_count', { count: g.group.memberCount })}
                        </span>
                      </div>
                    </button>
                  ))}

                  {/* Shaxsiy suhbatlar */}
                  {filteredConversations.map((c) => (
                    <button
                      key={c.partner.id}
                      onClick={() => openConversation(c.partner.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-50 transition-colors',
                        partnerId === c.partner.id ? 'bg-asaka-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          fullName={c.partner.fullName}
                          avatarPath={c.partner.avatarPath ?? undefined}
                          size="sm"
                        />
                        {c.unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-asaka-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {c.unread > 9 ? '9+' : c.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {c.partner.fullName}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                            {formatTime(c.lastMessage.sentAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {c.lastMessage.fromUserId !== c.partner.id && (
                            <Ticks readAt={c.lastMessage.readAt} />
                          )}
                          <span
                            className={cn(
                              'text-xs truncate',
                              c.unread > 0 ? 'font-semibold text-slate-800' : 'text-slate-500',
                            )}
                          >
                            {c.lastMessage.attachments.length > 0 && !c.lastMessage.body
                              ? `📎 ${c.lastMessage.attachments[0].filename}`
                              : c.lastMessage.body || '—'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── O'ng panel ── */}
      <div className="flex-1 flex flex-col bg-slate-50 min-w-0">
        {groupId && activeGroup ? (
          <GroupConversationView
            key={groupId}
            myId={user.id}
            group={{
              id: activeGroup.id,
              name: activeGroup.name,
              memberCount: activeGroup.memberCount,
            }}
            messages={groupMessages}
            onOpenInfo={() => setShowInfo(true)}
            onSend={async (body, file) => {
              const form = new FormData();
              form.append('body', body);
              if (file) form.append('file', file);
              const msg = (await api.post<GroupMsg>(`/chat/groups/${groupId}/messages`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
              })).data;
              qc.setQueryData<GroupMsg[]>(
                ['chat-group-messages', groupId],
                (old) => [...(old ?? []), msg],
              );
              qc.invalidateQueries({ queryKey: ['chat-groups'] });
            }}
            onEdit={async (id, body) => {
              const updated = (await api.patch<GroupMsg>(`/chat/groups/messages/${id}`, { body })).data;
              qc.setQueryData<GroupMsg[]>(['chat-group-messages', groupId], (old) =>
                old?.map((m) => (m.id === id ? updated : m)),
              );
              qc.invalidateQueries({ queryKey: ['chat-groups'] });
            }}
            onDelete={async (id) => {
              await api.delete(`/chat/groups/messages/${id}`);
              qc.setQueryData<GroupMsg[]>(['chat-group-messages', groupId], (old) =>
                old?.map((m) =>
                  m.id === id ? { ...m, deleted: true, body: '', attachments: [] } : m,
                ),
              );
              qc.invalidateQueries({ queryKey: ['chat-groups'] });
            }}
          />
        ) : partnerId && activePartner ? (
          <ConversationView
            key={partnerId}
            myId={user.id}
            partner={activePartner}
            messages={messages}
            partnerTyping={typingFrom === partnerId}
            onTyping={(typing) =>
              getSocket().emit('chat_typing', { toUserId: partnerId, typing })
            }
            onSend={async (body, file) => {
              const form = new FormData();
              form.append('toUserId', partnerId);
              form.append('body', body);
              if (file) form.append('file', file);
              const msg = (await api.post<ChatMsg>('/chat/messages', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
              })).data;
              qc.setQueryData<ChatMsg[]>(
                ['chat-messages', partnerId],
                (old) => [...(old ?? []), msg],
              );
              qc.invalidateQueries({ queryKey: ['chat-conversations'] });
            }}
            onEdit={async (id, body) => {
              const updated = (await api.patch<ChatMsg>(`/chat/messages/${id}`, { body })).data;
              qc.setQueryData<ChatMsg[]>(['chat-messages', partnerId], (old) =>
                old?.map((m) => (m.id === id ? updated : m)),
              );
              qc.invalidateQueries({ queryKey: ['chat-conversations'] });
            }}
            onDelete={async (id, scope) => {
              await api.delete(`/chat/messages/${id}`, { params: { scope } });
              qc.setQueryData<ChatMsg[]>(['chat-messages', partnerId], (old) =>
                scope === 'me'
                  ? old?.filter((m) => m.id !== id)
                  : old?.map((m) =>
                      m.id === id ? { ...m, deleted: true, body: '', attachments: [] } : m,
                    ),
              );
              qc.invalidateQueries({ queryKey: ['chat-conversations'] });
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <MessageCircle size={56} className="opacity-30" />
            <p className="text-sm">{t('edo.chat.select_conversation')}</p>
          </div>
        )}
      </div>

      {/* ── Guruh ma'lumoti paneli ── */}
      {showInfo && groupId && (
        <div className="w-72 shrink-0 border-l border-slate-200 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
            <h3 className="font-semibold text-slate-800 text-sm">{t('edo.chat.group_info')}</h3>
            <button
              onClick={() => setShowInfo(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col items-center gap-2 py-5 border-b border-slate-100">
            <GroupAvatar size="md" />
            <div className="text-sm font-semibold text-slate-800 text-center px-4">
              {groupInfo?.name ?? activeGroup?.name}
            </div>
            <div className="text-xs text-slate-400">
              {t('edo.chat.members_count', { count: groupInfo?.members.length ?? activeGroup?.memberCount ?? 0 })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {groupInfo?.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar fullName={m.fullName} avatarPath={m.avatarPath ?? undefined} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {m.fullName}
                    {m.id === user.id && ` (${t('edo.chat.you')})`}
                  </div>
                  {m.position?.name && (
                    <div className="text-xs text-slate-500 truncate">{m.position.name}</div>
                  )}
                </div>
                {m.isAdmin && (
                  <span className="text-[10px] text-asaka-600 font-semibold shrink-0">
                    {t('edo.chat.admin')}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-slate-100 shrink-0">
            <button
              onClick={leaveGroup}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50"
            >
              {groupInfo && groupInfo.ownerId === user.id ? (
                <>
                  <Trash2 size={15} /> {t('edo.chat.delete_group')}
                </>
              ) : (
                <>
                  <LogOut size={15} /> {t('edo.chat.leave_group')}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
