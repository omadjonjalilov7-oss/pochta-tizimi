import {
  type ChangeEvent,
  type KeyboardEvent,
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
  Send,
  X,
  FileText,
  Download,
} from 'lucide-react';
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
}: {
  myId: string;
  partner: ChatUser;
  messages: ChatMsg[];
  onBack?: () => void;
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
export function MessageBubble({ msg, myId }: { msg: ChatMsg; myId: string }) {
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

        <div className="flex items-center gap-1 mt-0.5 justify-end">
          <span
            className={`text-[10px] ${isMine ? 'text-brand-200' : 'text-slate-400'}`}
          >
            {new Date(msg.sentAt).toLocaleTimeString('uz-UZ', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isMine && (
            <span className="text-brand-200">
              <Ticks readAt={msg.readAt} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
