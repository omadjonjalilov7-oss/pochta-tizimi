import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Send, Paperclip, X, ChevronDown, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { RichEditor } from '../components/RichEditor';
import { formatBytes, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import type { User, Importance } from '../lib/types';

interface UploadedFile {
  id: string;
  filename: string;
  sizeBytes: number;
}

type RecipientField = 'to' | 'cc';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Imzo HTML (tahrirlab bo'lmaydigan, xabar tagida ko'rsatiladi) ──────────
function buildSignature(user: any): string {
  if (!user) return '';
  const email =
    user.externalMailEnabled && user.externalMailLogin
      ? user.externalMailLogin
      : `${user.login}@pochta`;
  const phone    = user.phone    || '';
  const position = user.position?.name   || '';
  const dept     = user.department?.name || '';
  return [
    `<strong style="color:#1e293b;font-size:13px;display:block">${user.fullName}</strong>`,
    `<span>${position}${dept ? ` &bull; ${dept}` : ''}</span>`,
    phone ? `<span>Tel: ${phone}</span>` : '',
    `<span>Email: <a href="mailto:${email}" style="color:#2563eb">${email}</a></span>`,
    `<br><strong style="letter-spacing:2px;color:#1e293b;font-size:11px">ASAKA MOTORS</strong>`,
  ]
    .filter(Boolean)
    .join('<br>');
}

// ── Kelgan xabarni sitat qilish ────────────────────────────────────────────
function buildQuote(m: any): string {
  const fromName = m.fromUser?.fullName || m.externalFromName || m.externalFromEmail || '';
  const date = new Date(m.sentAt).toLocaleString('uz-UZ');
  return `<br><br>
<blockquote style="border-left:3px solid #cbd5e1;margin:0;padding:8px 16px;color:#64748b;font-size:13px">
  <div style="margin-bottom:6px;font-size:12px;color:#94a3b8">${fromName} (${date}):</div>
  ${m.body}
</blockquote>`;
}

// ────────────────────────────────────────────────────────────────────────────
export function ComposePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: authUser } = useAuth();

  const replyTo   = searchParams.get('reply');
  const replyAll  = searchParams.get('replyAll');
  const forwardId = searchParams.get('forward');

  // ── State ──────────────────────────────────────────────────────────────
  const [recipients, setRecipients]             = useState<User[]>([]);
  const [ccRecipients, setCcRecipients]         = useState<User[]>([]);
  const [externalRecipients, setExternalRecipients]     = useState<string[]>([]);
  const [externalCcRecipients, setExternalCcRecipients] = useState<string[]>([]);
  const [showCc, setShowCc]   = useState(true); // CC har doim ko'rinadi
  const [activeField, setActiveField] = useState<RecipientField | null>(null);
  const [contactQuery, setContactQuery]   = useState('');
  const [subject, setSubject]     = useState('');
  const [body, setBody]           = useState('');
  const [importance, setImportance] = useState<Importance>('normal');
  const [files, setFiles]         = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [bodyReady, setBodyReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Ma'lumotlar ────────────────────────────────────────────────────────
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
  });

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/users/me')).data,
    staleTime: 60_000,
  });

  const { data: externalStatus } = useQuery({
    queryKey: ['external-mail-status'],
    queryFn: async () =>
      (await api.get<{ connected: boolean; email?: string }>('/external-mail/status')).data,
  });
  const externalConnected = !!externalStatus?.connected;

  // Guruh teglari (kontakt → guruh nomlari)
  const { data: groupTags = {} } = useQuery({
    queryKey: ['contact-group-tags'],
    queryFn: async () =>
      (await api.get<Record<string, string[]>>('/contact-groups/tags')).data,
    staleTime: 30_000,
  });

  // ── Imzo (tahrirlanmaydigan blok) ─────────────────────────────────────
  const signatureHtml = useMemo(
    () => buildSignature(profileData ?? authUser),
    [profileData, authUser],
  );

  // ── Body initsializatsiya (faqat tahrirlanadigani — imozo KIRMAYDI) ────
  useEffect(() => {
    if (bodyReady) return;

    if (replyTo || replyAll || forwardId) {
      const msgId = replyTo || replyAll || forwardId;
      if (!msgId) return;
      api.get(`/messages/${msgId}`).then((res) => {
        const item = res.data;
        const m = item.message ?? item;

        if (replyTo) {
          if (m.fromUserId) {
            const sender = contacts.find((c: User) => c.id === m.fromUserId);
            if (sender) setRecipients([sender]);
          } else if (m.externalFromEmail) {
            setExternalRecipients([m.externalFromEmail]);
          }
          setSubject(m.subject?.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`);
          setBody(buildQuote(m)); // imzosiz
        }

        if (replyAll) {
          const myId = authUser?.id;
          const toRecips: User[] = [];
          if (m.fromUserId && m.fromUserId !== myId) {
            const sender = contacts.find((c: User) => c.id === m.fromUserId);
            if (sender) toRecips.push(sender);
          }
          const allRecips: any[] = m.recipients || [];
          allRecips
            .filter((r: any) => r.kind !== 'cc' && r.userId !== myId)
            .forEach((r: any) => {
              const found = contacts.find((c: User) => c.id === r.userId);
              if (found && !toRecips.some((x) => x.id === found.id)) toRecips.push(found);
            });
          setRecipients(toRecips);
          const ccRecips: User[] = [];
          allRecips
            .filter((r: any) => r.kind === 'cc' && r.userId !== myId)
            .forEach((r: any) => {
              const found = contacts.find((c: User) => c.id === r.userId);
              if (found) ccRecips.push(found);
            });
          setCcRecipients(ccRecips);
          setSubject(m.subject?.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`);
          setBody(buildQuote(m)); // imzosiz
        }

        if (forwardId) {
          setSubject(m.subject?.startsWith('Fwd: ') ? m.subject : `Fwd: ${m.subject}`);
          setBody(buildQuote(m)); // imzosiz
        }
        setBodyReady(true);
      });
    } else {
      setBody(''); // yangi xabar — bo'sh (imzo pastda ko'rinadi)
      setBodyReady(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData, authUser, contacts.length > 0]);

  const isDirty = useMemo(
    () =>
      recipients.length > 0 ||
      ccRecipients.length > 0 ||
      subject.trim().length > 0 ||
      files.length > 0,
    [recipients, ccRecipients, subject, files],
  );

  // ── Qabul qiluvchilar filtri ───────────────────────────────────────────
  const filteredContacts = useMemo(() => {
    if (!activeField) return [];
    const currentList = activeField === 'to' ? recipients : ccRecipients;
    const otherList   = activeField === 'to' ? ccRecipients : recipients;
    return contacts.filter(
      (c: User) =>
        c.isActive &&
        !currentList.some((r) => r.id === c.id) &&
        !otherList.some((r) => r.id === c.id) &&
        (c.fullName.toLowerCase().includes(contactQuery.toLowerCase()) ||
          c.login.toLowerCase().includes(contactQuery.toLowerCase())),
    );
  }, [activeField, contacts, contactQuery, recipients, ccRecipients]);

  // Guruhlar bo'yicha guruhlangan kontaktlar
  const groupedContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    const candidates = q
      ? filteredContacts.filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.login.toLowerCase().includes(q),
        )
      : filteredContacts;

    if (!q) {
      // Guruhlar bo'yicha guruhlash
      const groups: Record<string, User[]> = {};
      const ungrouped: User[] = [];
      for (const c of candidates) {
        const tags = groupTags[c.id] ?? [];
        if (tags.length === 0) {
          ungrouped.push(c);
        } else {
          for (const tag of tags) {
            if (!groups[tag]) groups[tag] = [];
            groups[tag].push(c);
          }
        }
      }
      return { groups, ungrouped };
    }
    return { groups: {}, ungrouped: candidates };
  }, [filteredContacts, groupTags, contactQuery]);

  const MAX_RECIPIENTS = 15;

  const totalCount = (field: RecipientField) =>
    field === 'to'
      ? recipients.length + externalRecipients.length
      : ccRecipients.length + externalCcRecipients.length;

  const addRecipient = useCallback(
    (c: User) => {
      if (activeField === 'cc') {
        if (totalCount('cc') >= MAX_RECIPIENTS) return;
        setCcRecipients((prev) => [...prev, c]);
      } else {
        if (totalCount('to') >= MAX_RECIPIENTS) return;
        setRecipients((prev) => [...prev, c]);
      }
      setContactQuery('');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeField, recipients, ccRecipients, externalRecipients, externalCcRecipients],
  );

  const addExternalEmail = (email: string): boolean => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return false;
    if (!externalConnected) {
      setError(t('compose.error_external_not_connected'));
      return false;
    }
    const field = activeField ?? 'to';
    if (totalCount(field) >= MAX_RECIPIENTS) return false;
    if (field === 'cc') {
      if (externalCcRecipients.includes(e) || externalRecipients.includes(e)) return false;
      setExternalCcRecipients((prev) => [...prev, e]);
    } else {
      if (externalRecipients.includes(e) || externalCcRecipients.includes(e)) return false;
      setExternalRecipients((prev) => [...prev, e]);
    }
    setContactQuery('');
    setError(null);
    return true;
  };

  const commitCurrentQuery = () => {
    if (!activeField || !contactQuery.trim()) return false;
    const raw = contactQuery.trim();
    const q = raw.toLowerCase();
    if (EMAIL_RE.test(q)) return addExternalEmail(q);
    const currentList = activeField === 'to' ? recipients : ccRecipients;
    const otherList   = activeField === 'to' ? ccRecipients : recipients;
    const available = contacts.filter(
      (c: User) =>
        c.isActive &&
        !currentList.some((r) => r.id === c.id) &&
        !otherList.some((r) => r.id === c.id),
    );
    const match =
      available.find(
        (c: User) =>
          c.fullName.toLowerCase() === q || c.login.toLowerCase() === q,
      ) ||
      available.find(
        (c: User) =>
          c.fullName.toLowerCase().startsWith(q) ||
          c.login.toLowerCase().startsWith(q),
      ) ||
      available.find(
        (c: User) =>
          c.fullName.toLowerCase().includes(q) ||
          c.login.toLowerCase().includes(q),
      );
    if (match) {
      addRecipient(match);
      return true;
    }
    return false;
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === ';' || e.key === 'Enter') {
      e.preventDefault();
      commitCurrentQuery();
    } else if (e.key === 'Backspace' && !contactQuery) {
      const extList = activeField === 'to' ? externalRecipients : externalCcRecipients;
      if (extList.length > 0) {
        const setter =
          activeField === 'to' ? setExternalRecipients : setExternalCcRecipients;
        setter(extList.slice(0, -1));
        return;
      }
      const list = activeField === 'to' ? recipients : ccRecipients;
      if (list.length === 0) return;
      const setter = activeField === 'to' ? setRecipients : setCcRecipients;
      setter(list.slice(0, -1));
    }
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
      setError(err?.response?.data?.message || t('compose.error_upload'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (recipients.length === 0 && externalRecipients.length === 0) {
      setError(t('compose.error_no_to'));
      return;
    }
    if (!subject.trim()) {
      setError(t('compose.error_no_subject'));
      return;
    }
    // Body HTML dan text versiyasi bo'sh emasligini tekshiramiz
    const temp = document.createElement('div');
    temp.innerHTML = body;
    const bodyText = temp.textContent?.trim() ?? '';
    if (!bodyText) {
      setError(t('compose.error_no_body'));
      return;
    }
    // Imzoni alohida yuborish (backend SMTP'da birlashtiraradi)
    const signatureSep = signatureHtml
      ? `<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">${signatureHtml}`
      : '';

    setSubmitting(true);
    try {
      await api.post('/messages', {
        recipientIds: recipients.map((r) => r.id),
        ccRecipientIds: ccRecipients.map((r) => r.id),
        externalToEmails: externalRecipients,
        externalCcEmails: externalCcRecipients,
        subject: subject.trim(),
        body: body, // Plain text body - signature WITHOUT
        signature: signatureSep, // Signature alohida
        importance,
        attachmentIds: files.map((f) => f.id),
      });
      navigate('/sent');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('compose.error_send'));
    } finally {
      setSubmitting(false);
    }
  }

  const handleCancel = () => {
    if (isDirty && !confirm(t('common.discard_confirm'))) return;
    navigate(-1);
  };

  const trimmedQuery = contactQuery.trim().toLowerCase();
  const isQueryEmail = EMAIL_RE.test(trimmedQuery);
  const showSuggestions =
    activeField !== null &&
    (filteredContacts.length > 0 || isQueryEmail);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Yuqori panel ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white shrink-0">
        <h1 className="text-base font-semibold text-slate-900">
          {forwardId
            ? t('compose.title_forward')
            : replyAll
            ? t('compose.title_reply_all')
            : replyTo
            ? t('compose.title_reply')
            : t('compose.title')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title={t('compose.attach_file')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50 rounded-lg text-sm"
          >
            <Paperclip size={16} />
            <span className="hidden sm:inline">
              {uploading ? t('common.uploading') : t('compose.attach_file_short')}
            </span>
            {files.length > 0 && (
              <span className="bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
                {files.length}
              </span>
            )}
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
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold px-4 py-1.5 rounded-lg text-sm"
          >
            <Send size={15} />
            {submitting ? t('common.sending') : t('compose.send')}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            title={t('common.cancel')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg text-sm"
          >
            <X size={16} />
            <span className="hidden sm:inline">{t('common.cancel')}</span>
          </button>
        </div>
      </div>

      {/* ── Asosiy form ────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="shrink-0 px-4 pt-3 pb-2 space-y-2 border-b border-slate-100">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Kimga (To) */}
          <RecipientRow
            label={t('compose.to')}
            list={recipients}
            externalList={externalRecipients}
            onRemove={(id) => setRecipients(recipients.filter((x) => x.id !== id))}
            onRemoveExternal={(e) =>
              setExternalRecipients(externalRecipients.filter((x) => x !== e))
            }
            isActive={activeField === 'to'}
            placeholder={
              recipients.length === 0 && externalRecipients.length === 0
                ? t('compose.placeholder_recipient')
                : ''
            }
            value={contactQuery}
            onChange={setContactQuery}
            onFocus={() => setActiveField('to')}
            onBlur={() => setTimeout(() => setActiveField(null), 200)}
            onKeyDown={handleRecipientKeyDown}
            suggestions={activeField === 'to' ? filteredContacts : []}
            groupedContacts={activeField === 'to' ? groupedContacts : null}
            onPick={addRecipient}
            isQueryEmail={activeField === 'to' && isQueryEmail}
            queryValue={trimmedQuery}
            onPickEmail={addExternalEmail}
            externalConnected={externalConnected}
            showSuggestions={activeField === 'to' && showSuggestions}
          />

          {/* Nusxa (CC) — har doim ko'rinadi */}
          <RecipientRow
            label={t('compose.cc')}
            list={ccRecipients}
            externalList={externalCcRecipients}
            onRemove={(id) => setCcRecipients(ccRecipients.filter((x) => x.id !== id))}
            onRemoveExternal={(e) =>
              setExternalCcRecipients(externalCcRecipients.filter((x) => x !== e))
            }
            isActive={activeField === 'cc'}
            placeholder={
              ccRecipients.length === 0 && externalCcRecipients.length === 0
                ? t('compose.placeholder_recipient_cc')
                : ''
            }
            value={contactQuery}
            onChange={setContactQuery}
            onFocus={() => setActiveField('cc')}
            onBlur={() => setTimeout(() => setActiveField(null), 200)}
            onKeyDown={handleRecipientKeyDown}
            suggestions={activeField === 'cc' ? filteredContacts : []}
            groupedContacts={activeField === 'cc' ? groupedContacts : null}
            onPick={addRecipient}
            isQueryEmail={activeField === 'cc' && isQueryEmail}
            queryValue={trimmedQuery}
            onPickEmail={addExternalEmail}
            externalConnected={externalConnected}
            showSuggestions={activeField === 'cc' && showSuggestions}
          />

          {/* Mavzu + Muhimlik */}
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="flex items-center border border-slate-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 rounded-lg overflow-hidden">
                <span className="px-3 text-sm text-slate-500 whitespace-nowrap shrink-0 border-r border-slate-200">
                  {t('compose.subject')}
                </span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={512}
                  placeholder={t('compose.subject_placeholder') ?? ''}
                  className="flex-1 px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
            <div className="shrink-0 w-40">
              <div className="relative">
                <select
                  value={importance}
                  onChange={(e) => setImportance(e.target.value as Importance)}
                  className="w-full px-3 py-2 pr-8 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none appearance-none text-sm"
                >
                  <option value="normal">{t('importance.normal')}</option>
                  <option value="important">{t('importance.important')}</option>
                  <option value="urgent">{t('importance.urgent')}</option>
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* Biriktirilgan fayllar */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs"
                >
                  <Paperclip size={12} className="text-slate-400" />
                  <span className="text-slate-700 max-w-[180px] truncate">{f.filename}</span>
                  <span className="text-slate-400">{formatBytes(Number(f.sizeBytes))}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((x) => x.id !== f.id))}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Rich matn muharriri + imzo ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto flex flex-col px-4 py-3 gap-0">
          {/* Tahrirlanadigani */}
          {bodyReady && (
            <RichEditor
              value={body}
              onChange={setBody}
              className="flex-1 flex flex-col"
              minHeight={160}
              noBottomRadius={!!signatureHtml}
            />
          )}

          {/* Tahrirlanmaydigan imzo bloki */}
          {signatureHtml && (
            <div className="mt-0 border border-t-0 border-slate-200 rounded-b-lg bg-slate-50 select-none cursor-not-allowed">
              <div className="flex items-center gap-1.5 px-3 py-1 border-b border-slate-100 bg-slate-100/60">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Imzo (tahrirlab bo'lmaydi)
                </span>
                <div className="flex-1 h-px bg-slate-200" />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div
                className="px-4 py-3 text-sm leading-relaxed pointer-events-none"
                dangerouslySetInnerHTML={{ __html: signatureHtml }}
              />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// ── RecipientRow ────────────────────────────────────────────────────────────
interface RecipientRowProps {
  label: string;
  list: User[];
  externalList: string[];
  onRemove: (id: string) => void;
  onRemoveExternal: (email: string) => void;
  isActive: boolean;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  suggestions: User[];
  groupedContacts: { groups: Record<string, User[]>; ungrouped: User[] } | null;
  onPick: (c: User) => void;
  isQueryEmail: boolean;
  queryValue: string;
  onPickEmail: (email: string) => boolean;
  externalConnected: boolean;
  showSuggestions: boolean;
}

function RecipientRow({
  label,
  list,
  externalList,
  onRemove,
  onRemoveExternal,
  isActive,
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  suggestions,
  groupedContacts,
  onPick,
  isQueryEmail,
  queryValue,
  onPickEmail,
  externalConnected,
  showSuggestions,
}: RecipientRowProps) {
  const { t } = useTranslation();

  return (
    <div className="relative">
      <div
        className={cn(
          'flex items-center border rounded-lg transition-colors overflow-hidden',
          isActive
            ? 'border-brand-500 ring-2 ring-brand-100'
            : 'border-slate-300',
        )}
      >
        {/* Label */}
        <span className="px-3 py-2 text-sm text-slate-500 whitespace-nowrap shrink-0 border-r border-slate-200">
          {label}
        </span>

        {/* Chiplar + input */}
        <div className="flex flex-wrap gap-1 px-2 py-1 flex-1 items-center min-h-[36px]">
          {list.map((r) => (
            <span
              key={r.id}
              className="flex items-center gap-1 bg-brand-100 text-brand-800 text-xs px-2 py-0.5 rounded-full"
            >
              <Avatar fullName={r.fullName} avatarPath={r.avatarPath} size="sm" />
              {r.fullName}
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                className="hover:text-red-600"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {externalList.map((email) => (
            <span
              key={email}
              className="flex items-center gap-1 bg-sky-100 text-sky-800 text-xs px-2 py-0.5 rounded-full border border-sky-200"
            >
              <Mail size={11} />
              {email}
              <button
                type="button"
                onClick={() => onRemoveExternal(email)}
                className="hover:text-red-600"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="flex-1 min-w-[120px] outline-none text-sm py-1 bg-transparent"
          />
        </div>
      </div>

      {/* ── Qidiruv/taklif paneli ────────────────────────────────────── */}
      {showSuggestions && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white rounded-lg shadow-xl border border-slate-200">
          {/* Tashqi email taklifi */}
          {isQueryEmail && (
            <button
              type="button"
              onMouseDown={() => onPickEmail(queryValue)}
              disabled={!externalConnected}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left border-b border-slate-100',
                externalConnected ? 'hover:bg-sky-50' : 'opacity-60 cursor-not-allowed',
              )}
            >
              <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Mail size={14} />
              </div>
              <div>
                <div className="text-sm font-medium">{queryValue}</div>
                <div className="text-xs text-slate-400">
                  {externalConnected
                    ? t('compose.external_email_suggestion')
                    : t('compose.external_not_connected_suggestion')}
                </div>
              </div>
            </button>
          )}

          {/* Guruhlar bo'yicha ichki kontaktlar */}
          {groupedContacts && Object.keys(groupedContacts.groups).length > 0 ? (
            <>
              {Object.entries(groupedContacts.groups).map(([grpName, members]) => (
                <div key={grpName}>
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    {grpName}
                  </div>
                  {members.slice(0, 200).map((c) => (
                    <ContactOption key={c.id} c={c} onPick={onPick} />
                  ))}
                </div>
              ))}
              {groupedContacts.ungrouped.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    Boshqalar
                  </div>
                  {groupedContacts.ungrouped.slice(0, 200).map((c) => (
                    <ContactOption key={c.id} c={c} onPick={onPick} />
                  ))}
                </div>
              )}
            </>
          ) : (
            suggestions.slice(0, 200).map((c) => (
              <ContactOption key={c.id} c={c} onPick={onPick} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ContactOption({ c, onPick }: { c: User; onPick: (u: User) => void }) {
  return (
    <button
      type="button"
      onMouseDown={() => onPick(c)}
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-brand-50 text-left"
    >
      <Avatar fullName={c.fullName} avatarPath={c.avatarPath} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">{c.fullName}</div>
        <div className="text-xs text-slate-400 truncate">
          {c.position?.name}
          {c.department?.name && ` • ${c.department.name}`}
        </div>
      </div>
    </button>
  );
}
