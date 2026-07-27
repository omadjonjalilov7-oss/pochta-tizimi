import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Check,
  CheckCheck,
  ChevronLeft,
  Paperclip,
  Pencil,
  Send,
  X,
  FileText,
  Download,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../Avatar';

// ─── Turlar ───────────────────────────────────────────────────────────────────
export interface ChatUser {
  id: string;
  fullName: string;
  login: string;
  avatarPath: string | null;
  position?: { name: string } | null;
  department?: { name: string } | null;
}

export interface ChatAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ChatMsg {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  editedAt?: string | null;
  deleted?: boolean;
  attachments: ChatAttachment[];
}

export interface Conversation {
  partner: ChatUser;
  lastMessage: ChatMsg;
  unread: number;
}

// ─── Yordamchilar ───────────────────────────────────────────────────────────────
export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function formatTime(iso: string) {
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

// ─── Checkmark ────────────────────────────────────────────────────────────────
export function Ticks({ readAt }: { readAt: string | null }) {
  if (readAt) {
    return <CheckCheck size={14} className="text-sky-500 shrink-0" />;
  }
  return <Check size={14} className="text-slate-400 shrink-0" />;
}

// ─── Suhbat ko'rinishi ────────────────────────────────────────────────────────
export function ConversationView({
  myId,
  partner,
  messages,
  onBack,
  onSend,
  onEdit,
  onDelete,
  partnerTyping = false,
  onTyping,
}: {
  myId: string;
  partner: ChatUser;
  messages: ChatMsg[];
  onBack?: () => void;
  onSend: (body: string, file?: File) => Promise<void>;
  onEdit?: (id: string, body: string) => Promise<void>;
  onDelete?: (id: string, scope: 'me' | 'all') => Promise<void>;
  partnerTyping?: boolean;
  onTyping?: (typing: boolean) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = (m: ChatMsg) => {
    setEditingId(m.id);
    setText(m.body);
    setFile(null);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setText('');
  };

  // "yozmoqda..." holatini suhbatdoshga bildirish (throttled + avto-to'xtash).
  const typingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (typingRef.current) {
      typingRef.current = false;
      onTyping?.(false);
    }
  };

  const signalTyping = () => {
    if (!onTyping) return;
    if (!typingRef.current) {
      typingRef.current = true;
      onTyping(true);
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      typingRef.current = false;
      onTyping(false);
      stopTimerRef.current = null;
    }, 2500);
  };

  // Suhbat almashsa yoki komponent yo'qolsa — "yozmoqda"ni to'xtatamiz.
  useEffect(() => {
    return () => stopTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  const handleSend = async () => {
    if (editingId) {
      if (!text.trim()) return;
      stopTyping();
      setSending(true);
      setError(null);
      try {
        await onEdit?.(editingId, text.trim());
        setEditingId(null);
        setText('');
      } catch (e: any) {
        const msg = e?.response?.data?.message;
        setError(Array.isArray(msg) ? msg.join(', ') : msg || e?.message || 'Xatolik');
      } finally {
        setSending(false);
      }
      return;
    }
    if (!text.trim() && !file) return;
    stopTyping();
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
        {onBack && (
          <button onClick={onBack} className="p-1 rounded hover:bg-brand-500">
            <ChevronLeft size={18} />
          </button>
        )}
        <Avatar fullName={partner.fullName} avatarPath={partner.avatarPath ?? undefined} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{partner.fullName}</div>
          {partnerTyping ? (
            <div className="flex items-center gap-1 text-[11px] text-brand-50 truncate">
              <Pencil size={11} className="animate-pulse shrink-0" />
              <span className="truncate">{t('edo.chat.typing')}</span>
            </div>
          ) : (
            partner.position?.name && (
              <div className="text-[10px] text-brand-100 truncate">{partner.position.name}</div>
            )
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
              <MessageBubble
                key={m.id}
                msg={m}
                myId={myId}
                onStartEdit={onEdit ? startEdit : undefined}
                onDelete={onDelete}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Tahrirlash rejimi */}
      {editingId && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-t border-amber-100 shrink-0">
          <Pencil size={14} className="text-amber-600 shrink-0" />
          <span className="text-xs text-slate-700 truncate flex-1">
            {t('edo.chat.editing')}
          </span>
          <button
            onClick={cancelEdit}
            className="p-0.5 text-slate-400 hover:text-red-500 rounded"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Fayl preview */}
      {file && !editingId && (
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
        {!editingId && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-brand-50"
            title="Fayl biriktirish (max 50 MB)"
          >
            <Paperclip size={18} />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) signalTyping();
            else stopTyping();
          }}
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
export function MessageBubble({
  msg,
  myId,
  onStartEdit,
  onDelete,
}: {
  msg: ChatMsg;
  myId: string;
  onStartEdit?: (m: ChatMsg) => void;
  onDelete?: (id: string, scope: 'me' | 'all') => Promise<void>;
}) {
  const { t } = useTranslation();
  const isMine = msg.fromUserId === myId;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const hasActions = !msg.deleted && (onStartEdit || onDelete);

  const doDelete = async (scope: 'me' | 'all') => {
    setMenuOpen(false);
    if (scope === 'all' && !window.confirm(t('edo.chat.delete_all_confirm'))) return;
    await onDelete?.(msg.id, scope);
  };

  return (
    <div className={`group flex mb-1 items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {/* Menyu tugmasi (chapda — o'z xabarlar uchun) */}
      {isMine && hasActions && (
        <MessageMenu
          open={menuOpen}
          setOpen={setMenuOpen}
          menuRef={menuRef}
          side="right"
        >
          {onStartEdit && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onStartEdit(msg);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 text-left"
            >
              <Pencil size={13} /> {t('edo.chat.edit')}
            </button>
          )}
          <button
            onClick={() => doDelete('me')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 text-left"
          >
            <Trash2 size={13} /> {t('edo.chat.delete_me')}
          </button>
          <button
            onClick={() => doDelete('all')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 text-left"
          >
            <Trash2 size={13} /> {t('edo.chat.delete_all')}
          </button>
        </MessageMenu>
      )}

      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          msg.deleted
            ? isMine
              ? 'bg-brand-500/60 text-brand-50 rounded-br-sm italic'
              : 'bg-slate-100 text-slate-400 rounded-bl-sm border border-slate-200 italic'
            : isMine
              ? 'bg-brand-600 text-white rounded-br-sm'
              : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200'
        }`}
      >
        {msg.deleted ? (
          <p className="leading-snug flex items-center gap-1.5">
            <Trash2 size={12} className="opacity-70 shrink-0" />
            {t('edo.chat.deleted_msg')}
          </p>
        ) : (
          <>
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
          </>
        )}

        <div className="flex items-center gap-1 mt-0.5 justify-end">
          {msg.editedAt && !msg.deleted && (
            <span className={`text-[10px] italic ${isMine ? 'text-brand-200' : 'text-slate-400'}`}>
              {t('edo.chat.edited')}
            </span>
          )}
          <span
            className={`text-[10px] ${isMine ? 'text-brand-200' : 'text-slate-400'}`}
          >
            {new Date(msg.sentAt).toLocaleTimeString('uz-UZ', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isMine && !msg.deleted && (
            <span className="text-brand-200">
              <Ticks readAt={msg.readAt} />
            </span>
          )}
        </div>
      </div>

      {/* Menyu tugmasi (o'ngda — qabul qilingan xabarlar uchun) */}
      {!isMine && hasActions && onDelete && (
        <MessageMenu
          open={menuOpen}
          setOpen={setMenuOpen}
          menuRef={menuRef}
          side="left"
        >
          <button
            onClick={() => doDelete('me')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 text-left"
          >
            <Trash2 size={13} /> {t('edo.chat.delete_me')}
          </button>
        </MessageMenu>
      )}
    </div>
  );
}

// ─── Xabar menyusi (uch nuqta) ────────────────────────────────────────────────
function MessageMenu({
  open,
  setOpen,
  menuRef,
  side,
  children,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  menuRef: RefObject<HTMLDivElement | null>;
  side: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          className={`absolute z-20 bottom-full mb-1 min-w-[160px] bg-white rounded-lg shadow-lg border border-slate-200 py-1 overflow-hidden ${
            side === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
