import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Search, X, Users, Plus, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { playChatDing } from '../lib/chatSound';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import { cn } from '../lib/utils';
import {
  type ChatUser,
  type ChatMsg,
  type Conversation,
  type GroupSummaryItem,
  type GroupMsg,
  ConversationView,
  GroupConversationView,
  GroupCreatePanel,
  GroupAvatar,
  Ticks,
  formatTime,
} from './chat/shared';

// ─── Asosiy widget ────────────────────────────────────────────────────────────
export function FloatingChatWidget() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newConvSearch, setNewConvSearch] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [typingFrom, setTypingFrom] = useState<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onChatMsg = (data: { payload: ChatMsg }) => {
      const msg = data.payload;
      if (msg.fromUserId !== user.id) playChatDing();
      setTypingFrom((cur) => (cur === msg.fromUserId ? null : cur));
      // Aktiv suhbatga kelsa — o'qildi deb belgilaymiz
      if (partnerId === msg.fromUserId && open) {
        api.post(`/chat/read/${msg.fromUserId}`).catch(() => {});
        socket.emit('chat_read', { readByUserId: user.id, toUserId: msg.fromUserId });
      }
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-messages', msg.fromUserId] });
      qc.invalidateQueries({ queryKey: ['chat-unread'] });
    };

    const onChatRead = (data: { payload: { readByUserId: string } }) => {
      // Boshqa odam o'qidi — xabarlarni yangilaymiz (checkmark 2 ta bo'lsin)
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
      if (msg.fromUserId !== user.id) playChatDing();
      if (groupId === msg.groupId && open) {
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
    const onGroupUpdated = () => {
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
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
  }, [user, partnerId, groupId, open, qc]);

  // ── Ma'lumotlar ───────────────────────────────────────────────────────────
  const { data: unreadData } = useQuery({
    queryKey: ['chat-unread'],
    queryFn: async () => (await api.get<{ count: number }>('/chat/unread')).data,
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () =>
      (await api.get<Conversation[]>('/chat/conversations')).data,
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['chat-groups'],
    queryFn: async () => (await api.get<GroupSummaryItem[]>('/chat/groups')).data,
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['chat-contacts'],
    queryFn: async () => (await api.get<ChatUser[]>('/chat/contacts')).data,
    enabled: showContacts || showCreateGroup,
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

  // Suhbat ochilganda o'qildi
  useEffect(() => {
    if (partnerId && open) {
      api.post(`/chat/read/${partnerId}`).then(() => {
        qc.invalidateQueries({ queryKey: ['chat-conversations'] });
        qc.invalidateQueries({ queryKey: ['chat-unread'] });
        qc.invalidateQueries({ queryKey: ['chat-messages', partnerId] });
      });
    }
  }, [partnerId, open, qc]);

  useEffect(() => {
    if (groupId && open) {
      api.post(`/chat/groups/${groupId}/read`).then(() => {
        qc.invalidateQueries({ queryKey: ['chat-groups'] });
        qc.invalidateQueries({ queryKey: ['chat-unread'] });
      });
    }
  }, [groupId, open, groupMessages.length, qc]);

  const openConversation = useCallback((id: string) => {
    setPartnerId(id);
    setGroupId(null);
    setShowContacts(false);
    setShowCreateGroup(false);
    setNewConvSearch('');
  }, []);

  const openGroup = useCallback((id: string) => {
    setGroupId(id);
    setPartnerId(null);
    setShowContacts(false);
    setShowCreateGroup(false);
  }, []);

  const createGroup = useCallback(
    async (name: string, memberIds: string[]) => {
      const res = (await api.post<{ groupId: string }>('/chat/groups', { name, memberIds })).data;
      await qc.invalidateQueries({ queryKey: ['chat-groups'] });
      setShowCreateGroup(false);
      openGroup(res.groupId);
    },
    [qc, openGroup],
  );

  const totalUnread = unreadData?.count ?? 0;

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      c.partner.fullName.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.group.name.toLowerCase().includes(q));
  }, [groups, search]);

  const activeGroup = useMemo(
    () => (groupId ? groups.find((g) => g.group.id === groupId)?.group ?? null : null),
    [groupId, groups],
  );

  const filteredContacts = useMemo(() => {
    const q = newConvSearch.trim().toLowerCase();
    const existing = new Set(conversations.map((c) => c.partner.id));
    const base = contacts.filter((c) => !existing.has(c.id));
    if (!q) return base.slice(0, 20);
    return base.filter((c) => c.fullName.toLowerCase().includes(q)).slice(0, 20);
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

  if (!user) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {/* Chat paneli */}
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ height: '520px' }}>
          {showCreateGroup ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 bg-brand-600 text-white shrink-0">
                <button
                  onClick={() => setShowCreateGroup(false)}
                  className="p-1 rounded hover:bg-brand-500"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="font-semibold text-sm">{t('edo.chat.create_group')}</span>
                <span className="w-6" />
              </div>
              <div className="flex-1 min-h-0">
                <GroupCreatePanel
                  contacts={contacts}
                  onCreate={createGroup}
                  onCancel={() => setShowCreateGroup(false)}
                />
              </div>
            </>
          ) : groupId && activeGroup ? (
            <GroupConversationView
              key={groupId}
              myId={user.id}
              group={{
                id: activeGroup.id,
                name: activeGroup.name,
                memberCount: activeGroup.memberCount,
              }}
              messages={groupMessages}
              onBack={() => setGroupId(null)}
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
              myId={user.id}
              partner={activePartner}
              messages={messages}
              partnerTyping={typingFrom === partnerId}
              onTyping={(typing) =>
                getSocket().emit('chat_typing', { toUserId: partnerId, typing })
              }
              onBack={() => setPartnerId(null)}
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
            <ConversationList
              conversations={filteredConversations}
              groups={filteredGroups}
              myId={user.id}
              typingFrom={typingFrom}
              search={search}
              onSearch={setSearch}
              onOpen={openConversation}
              onOpenGroup={openGroup}
              showContacts={showContacts}
              onToggleContacts={() => {
                setShowContacts((v) => !v);
                setNewConvSearch('');
              }}
              onCreateGroup={() => {
                setShowCreateGroup(true);
                setShowContacts(false);
              }}
              contacts={filteredContacts}
              newConvSearch={newConvSearch}
              onNewConvSearch={setNewConvSearch}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      )}

      {/* Custom animatsiyalar */}
      <style>{`
        @keyframes chat-wiggle {
          0%,100% { transform: rotate(0deg) scale(1); }
          15%      { transform: rotate(-18deg) scale(1.13); }
          35%      { transform: rotate(15deg)  scale(1.15); }
          55%      { transform: rotate(-11deg) scale(1.12); }
          75%      { transform: rotate(8deg)   scale(1.1); }
          90%      { transform: rotate(-4deg)  scale(1.05); }
        }
        @keyframes chat-color-cycle {
          0%,100% { background-color: #ea580c; box-shadow: 0 0 18px 4px #fb923c88; } /* orange-600 */
          33%     { background-color: #dc2626; box-shadow: 0 0 20px 6px #f8717188; } /* red-600    */
          66%     { background-color: #d97706; box-shadow: 0 0 18px 4px #fbbf2488; } /* amber-600  */
        }
        .chat-alert-btn {
          animation: chat-wiggle 1.4s ease-in-out infinite,
                     chat-color-cycle 2.4s ease-in-out infinite;
        }
      `}</style>

      {/* Yumaloq tugma */}
      <div className="relative">
        {/* Tashqi ping halqasi — diqqat tortish uchun */}
        {!open && totalUnread > 0 && (
          <span className="absolute inset-0 rounded-full animate-ping bg-orange-400 opacity-60 pointer-events-none" />
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          title="Chat"
          className={cn(
            'rounded-full text-white flex items-center justify-center relative transition-[width,height,background-color] duration-300',
            !open && totalUnread > 0
              ? 'w-16 h-16 chat-alert-btn'
              : 'w-14 h-14 bg-brand-600 hover:bg-brand-700 shadow-lg hover:scale-105',
          )}
        >
          {open
            ? <X size={22} />
            : <MessageCircle size={totalUnread > 0 ? 28 : 22} />
          }
          {!open && totalUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] bg-red-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 shadow-md ring-2 ring-white pointer-events-none">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Suhbatlar ro'yxati ───────────────────────────────────────────────────────
function ConversationList({
  conversations,
  groups,
  myId,
  typingFrom,
  search,
  onSearch,
  onOpen,
  onOpenGroup,
  showContacts,
  onToggleContacts,
  onCreateGroup,
  contacts,
  newConvSearch,
  onNewConvSearch,
  onClose,
}: {
  conversations: Conversation[];
  groups: GroupSummaryItem[];
  myId: string;
  typingFrom: string | null;
  search: string;
  onSearch: (v: string) => void;
  onOpen: (id: string) => void;
  onOpenGroup: (id: string) => void;
  showContacts: boolean;
  onToggleContacts: () => void;
  onCreateGroup: () => void;
  contacts: ChatUser[];
  newConvSearch: string;
  onNewConvSearch: (v: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-brand-600 text-white shrink-0">
        <span className="font-semibold text-sm">Chat</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateGroup}
            className="p-1 rounded hover:bg-brand-500"
            title={t('edo.chat.create_group')}
          >
            <Users size={16} />
          </button>
          <button
            onClick={onToggleContacts}
            className="p-1 rounded hover:bg-brand-500"
            title={t('edo.chat.new_conversation')}
          >
            <Plus size={16} />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-brand-500">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Qidiruv */}
      <div className="px-3 py-2 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
          <Search size={13} className="text-slate-400" />
          <input
            type="text"
            value={showContacts ? newConvSearch : search}
            onChange={(e) =>
              showContacts ? onNewConvSearch(e.target.value) : onSearch(e.target.value)
            }
            placeholder={showContacts ? 'Foydalanuvchi qidirish...' : 'Qidirish...'}
            className="flex-1 text-xs bg-transparent outline-none"
          />
        </div>
      </div>

      {/* Ro'yxat */}
      <div className="flex-1 overflow-y-auto">
        {showContacts ? (
          <>
            {contacts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                Foydalanuvchi topilmadi
              </p>
            ) : (
              contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onOpen(c.id)}
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
            )}
          </>
        ) : conversations.length === 0 && groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-8">
            <MessageCircle size={32} className="opacity-40" />
            <p className="text-xs">{t('edo.chat.no_conversations')}</p>
            <button
              onClick={onToggleContacts}
              className="text-xs text-brand-600 hover:underline"
            >
              {t('edo.chat.start_conversation')}
            </button>
          </div>
        ) : (
          <>
          {/* Guruhlar */}
          {groups.map((g) => (
            <button
              key={g.group.id}
              onClick={() => onOpenGroup(g.group.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-50"
            >
              <div className="relative shrink-0">
                <GroupAvatar size="sm" />
                {g.unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
                  className={`text-xs truncate block ${g.unread > 0 ? 'font-semibold text-slate-800' : 'text-slate-500'}`}
                >
                  {g.lastMessage
                    ? g.lastMessage.deleted
                      ? t('edo.chat.deleted_msg')
                      : `${g.lastMessage.fromUserId === myId ? t('edo.chat.you') : g.lastMessage.fromName}: ${
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
          {conversations.map((c) => (
            <button
              key={c.partner.id}
              onClick={() => onOpen(c.partner.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-50"
            >
              <div className="relative shrink-0">
                <Avatar
                  fullName={c.partner.fullName}
                  avatarPath={c.partner.avatarPath ?? undefined}
                  size="sm"
                />
                {c.unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
                  {typingFrom === c.partner.id ? (
                    <span className="text-xs truncate font-medium text-brand-600 animate-pulse">
                      {t('edo.chat.typing')}
                    </span>
                  ) : (
                    <>
                      {c.lastMessage.fromUserId !== c.partner.id && (
                        <Ticks readAt={c.lastMessage.readAt} />
                      )}
                      <span
                        className={`text-xs truncate ${c.unread > 0 ? 'font-semibold text-slate-800' : 'text-slate-500'}`}
                      >
                        {c.lastMessage.attachments.length > 0 && !c.lastMessage.body
                          ? `📎 ${c.lastMessage.attachments[0].filename}`
                          : c.lastMessage.body || '—'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
          </>
        )}
      </div>
    </>
  );
}
