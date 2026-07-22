import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import { cn } from '../lib/utils';
import {
  type ChatUser,
  type ChatMsg,
  type Conversation,
  ConversationView,
  Ticks,
  formatTime,
} from './chat/shared';

// ─── Asosiy widget ────────────────────────────────────────────────────────────
export function FloatingChatWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newConvSearch, setNewConvSearch] = useState('');
  const [showContacts, setShowContacts] = useState(false);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onChatMsg = (data: { payload: ChatMsg }) => {
      const msg = data.payload;
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

    socket.on('chat_message', onChatMsg);
    socket.on('chat_read', onChatRead);
    return () => {
      socket.off('chat_message', onChatMsg);
      socket.off('chat_read', onChatRead);
    };
  }, [user, partnerId, open, qc]);

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
    if (partnerId && open) {
      api.post(`/chat/read/${partnerId}`).then(() => {
        qc.invalidateQueries({ queryKey: ['chat-conversations'] });
        qc.invalidateQueries({ queryKey: ['chat-unread'] });
        qc.invalidateQueries({ queryKey: ['chat-messages', partnerId] });
      });
    }
  }, [partnerId, open, qc]);

  const openConversation = useCallback(
    (id: string) => {
      setPartnerId(id);
      setShowContacts(false);
      setNewConvSearch('');
    },
    [],
  );

  const totalUnread = unreadData?.count ?? 0;

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      c.partner.fullName.toLowerCase().includes(q),
    );
  }, [conversations, search]);

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
          {partnerId && activePartner ? (
            <ConversationView
              myId={user.id}
              partner={activePartner}
              messages={messages}
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
            />
          ) : (
            <ConversationList
              conversations={filteredConversations}
              search={search}
              onSearch={setSearch}
              onOpen={openConversation}
              showContacts={showContacts}
              onToggleContacts={() => {
                setShowContacts((v) => !v);
                setNewConvSearch('');
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
  search,
  onSearch,
  onOpen,
  showContacts,
  onToggleContacts,
  contacts,
  newConvSearch,
  onNewConvSearch,
  onClose,
}: {
  conversations: Conversation[];
  search: string;
  onSearch: (v: string) => void;
  onOpen: (id: string) => void;
  showContacts: boolean;
  onToggleContacts: () => void;
  contacts: ChatUser[];
  newConvSearch: string;
  onNewConvSearch: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-brand-600 text-white shrink-0">
        <span className="font-semibold text-sm">Chat</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleContacts}
            className="p-1 rounded hover:bg-brand-500"
            title="Yangi suhbat"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
              viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
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
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-8">
            <MessageCircle size={32} className="opacity-40" />
            <p className="text-xs">Suhbatlar yo'q</p>
            <button
              onClick={onToggleContacts}
              className="text-xs text-brand-600 hover:underline"
            >
              Yangi suhbat boshlash
            </button>
          </div>
        ) : (
          conversations.map((c) => (
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
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}
