import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Search, Plus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../../components/Avatar';
import { cn } from '../../lib/utils';
import {
  type ChatUser,
  type ChatMsg,
  type Conversation,
  ConversationView,
  Ticks,
  formatTime,
} from '../../components/chat/shared';

export function EdoChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newConvSearch, setNewConvSearch] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const [typingFrom, setTypingFrom] = useState<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onChatMsg = (data: { payload: ChatMsg }) => {
      const msg = data.payload;
      // Xabar kelsa — o'sha odam yozishni to'xtatgan hisoblanadi
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

    const onTyping = (data: { payload: { fromUserId: string; typing: boolean } }) => {
      const { fromUserId, typing } = data.payload;
      if (typing) {
        setTypingFrom(fromUserId);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        // Xavfsizlik uchun: "to'xtadi" signali yo'qolsa ham 4s dan keyin o'chadi
        typingTimerRef.current = setTimeout(() => setTypingFrom(null), 4000);
      } else {
        setTypingFrom((cur) => (cur === fromUserId ? null : cur));
      }
    };

    socket.on('chat_message', onChatMsg);
    socket.on('chat_read', onChatRead);
    socket.on('chat_typing', onTyping);
    return () => {
      socket.off('chat_message', onChatMsg);
      socket.off('chat_read', onChatRead);
      socket.off('chat_typing', onTyping);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [user, partnerId, qc]);

  // ── Ma'lumotlar ───────────────────────────────────────────────────────────
  const { data: conversations = [] } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () =>
      (await api.get<Conversation[]>('/chat/conversations')).data,
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['chat-contacts'],
    queryFn: async () => (await api.get<ChatUser[]>('/chat/contacts')).data,
    enabled: showContacts,
    staleTime: 60_000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', partnerId],
    queryFn: async () =>
      (await api.get<ChatMsg[]>(`/chat/messages/${partnerId}`)).data,
    enabled: !!partnerId,
    refetchInterval: partnerId ? 10_000 : false,
  });

  // Suhbat ochilganda o'qildi
  useEffect(() => {
    if (partnerId) {
      api.post(`/chat/read/${partnerId}`).then(() => {
        qc.invalidateQueries({ queryKey: ['chat-conversations'] });
        qc.invalidateQueries({ queryKey: ['chat-unread'] });
        qc.invalidateQueries({ queryKey: ['chat-messages', partnerId] });
      });
    }
  }, [partnerId, qc]);

  const openConversation = useCallback((id: string) => {
    setPartnerId(id);
    setShowContacts(false);
    setNewConvSearch('');
  }, []);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.partner.fullName.toLowerCase().includes(q));
  }, [conversations, search]);

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

  if (!user) return null;

  return (
    <div className="flex h-full">
      {/* ── Chap panel: suhbatlar ro'yxati ── */}
      <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <h2 className="font-semibold text-slate-800">{t('edo.nav.chat')}</h2>
          <button
            onClick={() => {
              setShowContacts((v) => !v);
              setNewConvSearch('');
            }}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              showContacts
                ? 'bg-asaka-100 text-asaka-700'
                : 'text-slate-500 hover:bg-slate-100',
            )}
            title={t('edo.chat.new_conversation')}
          >
            {showContacts ? <X size={18} /> : <Plus size={18} />}
          </button>
        </div>

        {/* Qidiruv */}
        <div className="px-3 py-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={showContacts ? newConvSearch : search}
              onChange={(e) =>
                showContacts ? setNewConvSearch(e.target.value) : setSearch(e.target.value)
              }
              placeholder={
                showContacts ? t('edo.chat.search_user') : t('edo.chat.search')
              }
              className="flex-1 text-sm bg-transparent outline-none"
            />
          </div>
        </div>

        {/* Ro'yxat */}
        <div className="flex-1 overflow-y-auto">
          {showContacts ? (
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
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-8 px-4">
              <MessageCircle size={36} className="opacity-40" />
              <p className="text-sm">{t('edo.chat.no_conversations')}</p>
              <button
                onClick={() => setShowContacts(true)}
                className="text-sm text-asaka-600 hover:underline"
              >
                {t('edo.chat.start_conversation')}
              </button>
            </div>
          ) : (
            filteredConversations.map((c) => (
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
            ))
          )}
        </div>
      </div>

      {/* ── O'ng panel: suhbat ── */}
      <div className="flex-1 flex flex-col bg-slate-50 min-w-0">
        {partnerId && activePartner ? (
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
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <MessageCircle size={56} className="opacity-30" />
            <p className="text-sm">{t('edo.chat.select_conversation')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
