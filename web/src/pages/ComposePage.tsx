import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Send, Paperclip, X, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { formatBytes, cn } from '../lib/utils';
import type { User, Importance } from '../lib/types';

interface UploadedFile {
  id: string;
  filename: string;
  sizeBytes: number;
}

type RecipientField = 'to' | 'cc';

export function ComposePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const replyTo = searchParams.get('reply');

  const [recipients, setRecipients] = useState<User[]>([]);
  const [ccRecipients, setCcRecipients] = useState<User[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [activeField, setActiveField] = useState<RecipientField | null>(null);
  const [contactQuery, setContactQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [importance, setImportance] = useState<Importance>('normal');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
  });

  useEffect(() => {
    if (!replyTo) return;
    api.get(`/messages/${replyTo}`).then((res) => {
      const m = res.data.message;
      const sender = contacts.find((c) => c.id === m.fromUserId);
      if (sender) setRecipients([sender]);
      setSubject(m.subject.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`);
      setBody(`\n\n--- ${m.fromUser?.fullName} (${new Date(m.sentAt).toLocaleString()}):\n${m.body}`);
    });
  }, [replyTo, contacts]);

  // "Iflos" (dirty) holatni hisoblash — bekor qilishda tasdiqlash kerak yoki yo'qligini bilish uchun
  const isDirty = useMemo(() => {
    return (
      recipients.length > 0 ||
      ccRecipients.length > 0 ||
      subject.trim().length > 0 ||
      body.trim().length > 0 ||
      files.length > 0
    );
  }, [recipients, ccRecipients, subject, body, files]);

  const filteredContacts = activeField
    ? contacts.filter((c) => {
        const otherList = activeField === 'to' ? recipients : ccRecipients;
        const sameList = activeField === 'to' ? recipients : ccRecipients;
        return (
          c.isActive &&
          !sameList.some((r) => r.id === c.id) &&
          !otherList.some((r) => r.id === c.id) &&
          (c.fullName.toLowerCase().includes(contactQuery.toLowerCase()) ||
            c.login.toLowerCase().includes(contactQuery.toLowerCase()))
        );
      })
    : [];

  const addRecipient = (c: User) => {
    if (activeField === 'cc') {
      setCcRecipients([...ccRecipients, c]);
    } else {
      setRecipients([...recipients, c]);
    }
    setContactQuery('');
  };

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < selected.length; i++) {
        const f = selected[i];
        const fd = new FormData();
        fd.append('file', f);
        const res = await api.post<UploadedFile>('/attachments/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setFiles((prev) => [...prev, res.data]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Faylni yuklashda xatolik');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);

    if (recipients.length === 0) {
      setError('Kamida bitta qabul qiluvchi tanlang');
      return;
    }
    if (!subject.trim()) {
      setError('Mavzuni kiriting');
      return;
    }
    if (!body.trim()) {
      setError('Xabar matnini kiriting');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/messages', {
        recipientIds: recipients.map((r) => r.id),
        ccRecipientIds: ccRecipients.map((r) => r.id),
        subject: subject.trim(),
        body: body.trim(),
        importance,
        attachmentIds: files.map((f) => f.id),
      });
      navigate('/sent');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Xabarni yuborishda xatolik');
    } finally {
      setSubmitting(false);
    }
  }

  const handleCancel = () => {
    if (isDirty && !confirm('Yozilgan ma\'lumotlar yo\'qoladi. Bekor qilasizmi?')) {
      return;
    }
    navigate(-1);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Yuqori panel: tugmalar */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900 mr-auto">Yangi xabar</h1>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Fayl biriktirish (50 MB gacha)"
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            <Paperclip size={18} />
            <span className="hidden sm:inline">{uploading ? 'Yuklanmoqda...' : 'Fayl'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting || uploading}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold px-4 py-2 rounded-lg text-sm"
          >
            <Send size={16} />
            {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            title="Bekor qilish"
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg text-sm font-medium"
          >
            <X size={18} />
            <span className="hidden sm:inline">Bekor qilish</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Kimga */}
          <RecipientRow
            label="Kimga"
            list={recipients}
            onRemove={(id) => setRecipients(recipients.filter((x) => x.id !== id))}
            isActive={activeField === 'to'}
            placeholder={recipients.length === 0 ? "Xodim ismini yozing..." : ''}
            value={activeField === 'to' ? contactQuery : ''}
            onChange={(v) => setContactQuery(v)}
            onFocus={() => {
              setActiveField('to');
              setContactQuery('');
            }}
            onBlur={() => setTimeout(() => setActiveField(null), 200)}
            rightSlot={
              !showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2"
                >
                  + Nusxa (CC)
                </button>
              )
            }
            suggestions={activeField === 'to' ? filteredContacts : []}
            onPick={addRecipient}
          />

          {/* Nusxa (CC) */}
          {showCc && (
            <RecipientRow
              label="Nusxa (CC)"
              list={ccRecipients}
              onRemove={(id) => setCcRecipients(ccRecipients.filter((x) => x.id !== id))}
              isActive={activeField === 'cc'}
              placeholder={ccRecipients.length === 0 ? "Qo'shimcha qabul qiluvchilar..." : ''}
              value={activeField === 'cc' ? contactQuery : ''}
              onChange={(v) => setContactQuery(v)}
              onFocus={() => {
                setActiveField('cc');
                setContactQuery('');
              }}
              onBlur={() => setTimeout(() => setActiveField(null), 200)}
              rightSlot={
                <button
                  type="button"
                  onClick={() => {
                    setShowCc(false);
                    setCcRecipients([]);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2"
                >
                  yashirish
                </button>
              }
              suggestions={activeField === 'cc' ? filteredContacts : []}
              onPick={addRecipient}
            />
          )}

          {/* Mavzu */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mavzu
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={512}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
            />
          </div>

          {/* Muhimlik */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Muhimlik
            </label>
            <div className="relative">
              <select
                value={importance}
                onChange={(e) => setImportance(e.target.value as Importance)}
                className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none appearance-none"
              >
                <option value="normal">Oddiy</option>
                <option value="important">Muhim</option>
                <option value="urgent">Juda muhim</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Matn */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Xabar matni
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none resize-y"
            />
          </div>

          {/* Biriktirilgan fayllar ro'yxati */}
          {files.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Biriktirilgan fayllar ({files.length})
              </label>
              <div className="space-y-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <Paperclip size={16} className="text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-700 truncate">{f.filename}</div>
                      <div className="text-xs text-slate-400">
                        {formatBytes(Number(f.sizeBytes))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((x) => x.id !== f.id))}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

interface RecipientRowProps {
  label: string;
  list: User[];
  onRemove: (id: string) => void;
  isActive: boolean;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  rightSlot?: React.ReactNode;
  suggestions: User[];
  onPick: (c: User) => void;
}

function RecipientRow({
  label,
  list,
  onRemove,
  isActive,
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  rightSlot,
  suggestions,
  onPick,
}: RecipientRowProps) {
  return (
    <div className="relative">
      <div className="flex items-center mb-1.5">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        <div className="ml-auto">{rightSlot}</div>
      </div>
      <div
        className={cn(
          'flex flex-wrap gap-1.5 p-2 border rounded-lg transition',
          isActive
            ? 'border-brand-500 ring-2 ring-brand-100'
            : 'border-slate-300',
        )}
      >
        {list.map((r) => (
          <span
            key={r.id}
            className="flex items-center gap-1.5 bg-brand-100 text-brand-800 text-sm px-2 py-1 rounded"
          >
            <Avatar fullName={r.fullName} avatarPath={r.avatarPath} size="sm" />
            {r.fullName}
            <button
              type="button"
              onClick={() => onRemove(r.id)}
              className="hover:text-red-600"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          className="flex-1 min-w-[200px] outline-none text-sm py-1 bg-transparent"
        />
      </div>
      {isActive && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto bg-white rounded-lg shadow-lg border border-slate-200">
          {suggestions.slice(0, 50).map((c) => (
            <button
              type="button"
              key={c.id}
              onMouseDown={() => onPick(c)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-brand-50 text-left"
            >
              <Avatar fullName={c.fullName} avatarPath={c.avatarPath} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {c.fullName}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {c.position?.name}
                  {c.department?.name && ` • ${c.department.name}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
