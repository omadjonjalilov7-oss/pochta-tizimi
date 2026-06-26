import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCheck,
  ChevronLeft,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  X,
  FileText,
  Download,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import { cn } from '../lib/utils';

// ─── Turlar ───────────────────────────────────────────────────────────────────

interface ChatUser {
  id: string;
  fullName: string;
  login: string;
  avatarPath: string | null;
  position?: { name: string } | null;
  department?: { name: string } | null;
}

interface ChatAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

interface ChatMsg {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  attachments: ChatAttachment[];
}

interface Conversation {
  partner: ChatUser;
  lastMessage: ChatMsg;
  unread: number;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay)
    return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
}

// ─── Checkmark komponenti ─────────────────────────────────────────────────────
function Ticks({ readAt }: { readAt: string | null }) {
  if (readAt) {
    // 2 ta ko'k bayroqcha — o'qildi
    return <CheckCheck size={14} className="text-sky-500 shrink-0" />;
  }
  // 1 ta kulrang bayroqcha — yuborildi lekin o'qilmadi
  return <Check size={14} className="text-slate-400 shrink-0" />;
}

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

// ─── Suhbat ko'rinishi ────────────────────────────────────────────────────────
function ConversationView({
  myId,
  partner,
  messages,
  onBack,
  onSend,
}: {
  myId: string;
  partner: ChatUser;
  messages: ChatMsg[];
  onBack: () => void;
  onSend: (body: string, file?: File) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    setError(null);
    try {
      await onSend(text.trim(), file ?? undefined);
      setText('');
      setFile(null);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || e?.message || 'Xatolik');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) {
      setError("Fayl 50 MB dan katta bo'lmasligi kerak");
      return;
    }
    setFile(f);
    e.target.value = '';
  };

  // Xabarlarni kunlar bo'yicha guruhlash
  const grouped = useMemo(() => {
    const days: { date: string; msgs: ChatMsg[] }[] = [];
    for (const m of messages) {
      const d = new Date(m.sentAt).toLocaleDateString('uz-UZ', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      const last = days[days.length - 1];
      if (!last || last.date !== d) days.push({ date: d, msgs: [m] });
      else last.msgs.push(m);
    }
    return days;
  }, [messages]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-brand-600 text-white shrink-0">
        <button onClick={onBack} className="p-1 rounded hover:bg-brand-500">
          <ChevronLeft size={18} />
        </button>
        <Avatar fullName={partner.fullName} avatarPath={partner.avatarPath ?? undefined} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{partner.fullName}</div>
          {partner.position?.name && (
            <div className="text-[10px] text-brand-100 truncate">{partner.position.name}</div>
          )}
        </div>
      </div>

      {/* Xabarlar */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 bg-slate-50">
        {grouped.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">
            Xabarlar yo'q. Birinchi xabarni yuboring!
          </p>
        )}
        {grouped.map((group) => (
          <div key={group.date}>
            <div className="text-[10px] text-slate-400 text-center my-2">
              {group.date}
            </div>
            {group.msgs.map((m) => (
              <MessageBubble key={m.id} msg={m} myId={myId} />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Fayl preview */}
      {file && (
        <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border-t border-brand-100 shrink-0">
          <FileText size={14} className="text-brand-600 shrink-0" />
          <span className="text-xs text-slate-700 truncate flex-1">{file.name}</span>
          <span className="text-[11px] text-slate-400">{formatBytes(file.size)}</span>
          <button
            onClick={() => setFile(null)}
            className="p-0.5 text-slate-400 hover:text-red-500 rounded"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Xato */}
      {error && (
        <div className="px-3 py-1 bg-red-50 text-red-600 text-xs shrink-0">{error}</div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-2.5 border-t border-slate-200 bg-white shrink-0">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-brand-50"
          title="Fayl biriktirish (max 50 MB)"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Xabar yozing... (Enter — yuborish)"
          className="flex-1 text-sm resize-none outline-none bg-transparent py-1 max-h-24 overflow-y-auto"
          style={{ lineHeight: '1.4' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || (!text.trim() && !file)}
          className="p-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg"
        >
          <Send size={16} />
        </button>
      </div>
    </>
  );
}

// ─── Bitta xabar pufagi ───────────────────────────────────────────────────────
function MessageBubble({ msg, myId }: { msg: ChatMsg; myId: string }) {
  const isMine = msg.fromUserId === myId;

  return (
    <div className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          isMine
            ? 'bg-brand-600 text-white rounded-br-sm'
            : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200'
        }`}
      >
        {/* Biriktirilgan fayllar */}
        {msg.attachments.length > 0 && (
          <div className="mb-1 space-y-1">
            {msg.attachments.map((a) => (
              <a
                key={a.id}
                href={`/api/chat/attachments/${a.id}/download`}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-1.5 text-xs underline ${
                  isMine ? 'text-brand-100 hover:text-white' : 'text-brand-600 hover:text-brand-800'
                }`}
              >
                <Download size={11} />
                <span className="truncate max-w-[180px]">{a.filename}</span>
                <span className="opacity-70 shrink-0">({formatBytes(a.sizeBytes)})</span>
              </a>
            ))}
          </div>
        )}

        {msg.body && <p className="leading-snug whitespace-pre-wrap break-words">{msg.body}</p>}

        <div
          className={`flex items-center gap-1 mt-0.5 ${
            isMine ? 'justify-end' : 'justify-end'
          }`}
        >
          <span
            className={`text-[10px] ${isMine ? 'text-brand-200' : 'text-slate-400'}`}
          >
            {new Date(msg.sentAt).toLocaleTimeString('uz-UZ', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isMine && (
            <span className={isMine ? 'text-brand-200' : ''}>
              <Ticks readAt={msg.readAt} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
