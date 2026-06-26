import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Forward,
  Clock,
  FileText,
  Send,
  Pencil,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  ClipboardList,
  UserPlus,
  Trash2,
  KeyRound,
  Download,
  Paperclip,
} from 'lucide-react';
import { EimzoSignModal } from '../../components/edo/EimzoSignModal';
import { api } from '../../lib/api';
import type { DocumentStatus, EdoDocument, User } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { cn, formatBytes } from '../../lib/utils';
import { SecretInput } from '../../components/SecretInput';
import { ApproverChainPicker } from '../../components/edo/ApproverChainPicker';

export function EdoDocumentViewPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ['edo-doc', id],
    queryFn: async () => (await api.get<EdoDocument>(`/documents/${id}`)).data,
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['edo-doc', id] });
    queryClient.invalidateQueries({ queryKey: ['edo-mine'] });
    queryClient.invalidateQueries({ queryKey: ['edo-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['edo-drafts'] });
    queryClient.invalidateQueries({ queryKey: ['edo-executions'] });
    queryClient.invalidateQueries({ queryKey: ['edo-incoming'] });
    queryClient.invalidateQueries({ queryKey: ['edo-outgoing'] });
    queryClient.invalidateQueries({ queryKey: ['edo-archive'] });
  };

  const send = useMutation({
    mutationFn: async () => (await api.post<EdoDocument>(`/documents/${id}/send`)).data,
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: async (vars: { pin: string; addApproverIds?: string[] }) =>
      (await api.post<EdoDocument>(`/documents/${id}/approve`, vars)).data,
    onSuccess: invalidate,
  });
  const comment = useMutation({
    mutationFn: async (text: string) =>
      (await api.post<EdoDocument>(`/documents/${id}/comment`, { text })).data,
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: async (vars: { reason: string; pin: string }) =>
      (await api.post<EdoDocument>(`/documents/${id}/reject`, vars)).data,
    onSuccess: invalidate,
  });
  const forward = useMutation({
    mutationFn: async (vars: {
      toUserId: string;
      note?: string;
      pin: string;
      additionalApproverIds?: string[];
    }) => (await api.post<EdoDocument>(`/documents/${id}/forward`, vars)).data,
    onSuccess: invalidate,
  });
  const addResolution = useMutation({
    mutationFn: async (vars: { text: string; targets: { userId: string; deadline?: string }[] }) =>
      (await api.post<EdoDocument>(`/documents/${id}/resolution`, vars)).data,
    onSuccess: invalidate,
  });
  const completeTarget = useMutation({
    mutationFn: async (vars: { targetId: string; note?: string }) =>
      (
        await api.post<EdoDocument>(
          `/documents/resolution-target/${vars.targetId}/complete`,
          { note: vars.note },
        )
      ).data,
    onSuccess: invalidate,
  });

  // ⚠️ Hook'lar har doim bir xil tartibda chaqilishi kerak — shu sabab erta return'lardan oldin
  const [showSignModal, setShowSignModal] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-slate-400">{t('common.loading')}</div>;
  }
  if (error || !doc) {
    return (
      <div className="p-8 text-center text-slate-500">
        {t('edo.view.not_found')}
      </div>
    );
  }

  const isCreator = doc.createdById === user?.id;
  const isCurrentApprover = doc.currentHolderId === user?.id && doc.status === 'in_review';
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';

  // PDF generatsiya mumkin: creator bo'lsa, rais imzolagan bo'lsin
  // Rais (oxirgi tasdiqlovchi) imzoladi = last participant 'approved' yoki 'done'
  const isFinallyApproved =
    doc.participants.length > 0 &&
    doc.participants[doc.participants.length - 1].status === 'approved';

  // Creator PDF'ni olishi mumkin faqat rais imzolasa, boshqalar doimo olishlari mumkin
  const canCreatePdf = !isCreator || isFinallyApproved;

  // E-IMZO bilan imzolash mumkin: tashqi hujjat + foydalanuvchida ruxsat + hozir uning navbatida
  const canSignWithEimzo =
    isCurrentApprover && doc.type === 'outgoing' && (user?.canSignExternal ?? false);

  // Rezolyutsiya yozish huquqi: yaratuvchi yoki tasdiqlovchi (allaqachon imzolagan), status in_review/in_progress/done
  const canResolve =
    !!user &&
    (isCreator ||
      doc.participants.some(
        (p) => p.userId === user.id && p.role === 'approver' && p.status === 'approved',
      )) &&
    (doc.status === 'in_review' || doc.status === 'in_progress' || doc.status === 'done');

  // Mening pending ijro vazifalarim
  const myPendingTargets = (doc.resolutions ?? [])
    .flatMap((r) => r.targets.map((t) => ({ ...t, resolution: r })))
    .filter((t) => t.userId === user?.id && t.status !== 'done');

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Shapka — hujjat ma'lumotlari */}
      <header className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="bg-brand-50 text-brand-600 rounded-xl p-3">
            <FileText size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {doc.number}
              </span>
              <StatusBadge status={doc.status} />
              <span className="text-xs text-slate-400">{t(`edo.doc_type.${doc.type}`)}</span>
            </div>
            <div className="flex items-start gap-2">
              <h1 className="text-xl font-semibold text-slate-900 flex-1">{doc.subject}</h1>
              {doc.status !== 'draft' && (
                <PdfDownloadButton
                  docId={doc.id}
                  docNumber={doc.number}
                  disabled={!canCreatePdf}
                  isCreator={isCreator}
                />
              )}
            </div>
            {doc.shortInfo && (
              <p className="text-sm text-slate-600 mt-1">{doc.shortInfo}</p>
            )}
            <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Avatar fullName={doc.createdBy.fullName} avatarPath={doc.createdBy.avatarPath} size="sm" />
                <span>
                  <span className="text-slate-700 font-medium">{doc.createdBy.fullName}</span>
                  {doc.createdBy.position?.name && <span className="text-slate-400"> — {doc.createdBy.position.name}</span>}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {new Date(doc.createdAt).toLocaleString(lang)}
              </span>
              {doc.deadline && (
                <DeadlineBadge deadline={doc.deadline} status={doc.status} lang={lang} />
              )}
              {doc.currentHolder && doc.status === 'in_review' && (
                <span className="flex items-center gap-1 text-brand-700">
                  <ChevronRight size={12} />
                  {t('edo.view.holder')}: <span className="font-medium">{doc.currentHolder.fullName}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Asosiy maydon: matn + yon panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Asosiy ustun */}
        <div className="space-y-4 min-w-0">
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {t('edo.view.body')}
            </h2>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-800">
              {doc.body}
            </div>

            {(doc.attachments?.length ?? 0) > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  <Paperclip size={14} />
                  {t('edo.view.attachments', { count: doc.attachments!.length })}
                </div>
                <ul className="space-y-1.5">
                  {doc.attachments!.map((a) => (
                    <li key={a.id}>
                      <a
                        href={`/api/documents/${doc.id}/attachments/${a.id}/download`}
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            const res = await api.get(
                              `/documents/${doc.id}/attachments/${a.id}/download`,
                              { responseType: 'blob' },
                            );
                            const url = URL.createObjectURL(res.data);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = a.filename;
                            link.click();
                            URL.revokeObjectURL(url);
                          } catch {}
                        }}
                        className="group flex items-center gap-2 text-sm text-slate-700 hover:text-brand-700 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <Paperclip size={14} className="text-slate-400 group-hover:text-brand-600 shrink-0" />
                        <span className="truncate flex-1">{a.filename}</span>
                        <span className="text-xs text-slate-400 shrink-0">{formatBytes(a.sizeBytes)}</span>
                        <Download size={14} className="text-slate-400 group-hover:text-brand-600 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Amallar */}
          {isCreator && doc.status === 'draft' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-2">
              <button
                onClick={() => navigate(`/edo/compose?id=${doc.id}`)}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg"
              >
                <Pencil size={16} />
                {t('edo.view.edit')}
              </button>
              <button
                onClick={() => send.mutate()}
                disabled={send.isPending}
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg"
              >
                <Send size={16} />
                {send.isPending ? t('common.sending') : t('edo.view.send_for_approval')}
              </button>
              {send.error && (
                <div className="basis-full text-sm text-red-600 mt-1">
                  {extractError(send.error)}
                </div>
              )}
            </div>
          )}

          {isCurrentApprover && (
            <ApproverActions
              docCreatorId={doc.createdById}
              onApprove={(pin, addApproverIds) =>
                approve.mutate({ pin, addApproverIds })
              }
              onReject={(reason, pin) => reject.mutate({ reason, pin })}
              onForward={(toUserId, note, pin, additionalApproverIds) =>
                forward.mutate({ toUserId, note, pin, additionalApproverIds })
              }
              loadingAction={
                approve.isPending ? 'approve' : reject.isPending ? 'reject' : forward.isPending ? 'forward' : null
              }
              error={extractError(approve.error || reject.error || forward.error)}
              canSignWithEimzo={canSignWithEimzo}
              onSignWithEimzo={() => setShowSignModal(true)}
            />
          )}

          {/* Imzolar paneli — tashqi hujjat uchun */}
          {doc.type === 'outgoing' && <SignaturesPanel doc={doc} />}

          {/* Mening ijro vazifalarim — agar pending bo'lsa */}
          {myPendingTargets.length > 0 && (
            <MyTasksBox
              targets={myPendingTargets}
              onComplete={(targetId, note) => completeTarget.mutate({ targetId, note })}
              loading={completeTarget.isPending}
              error={extractError(completeTarget.error)}
            />
          )}

          {/* Rezolyutsiyalar bo'limi */}
          <ResolutionSection
            doc={doc}
            canResolve={canResolve}
            onAdd={(text, targets) => addResolution.mutate({ text, targets })}
            adding={addResolution.isPending}
            addError={extractError(addResolution.error)}
          />

          {/* Izohlar va Audit */}
          <CommentsSection doc={doc} onComment={(t) => comment.mutate(t)} sending={comment.isPending} />
        </div>

        {/* Yon panel — ishtirokchilar zanjiri */}
        <aside className="space-y-4">
          <ParticipantsPanel doc={doc} currentUserId={user?.id} />
          <AuditPanel doc={doc} />
        </aside>
      </div>

      {showSignModal && (
        <EimzoSignModal
          documentId={doc.id}
          documentNumber={doc.number}
          documentSubject={doc.subject}
          onClose={() => setShowSignModal(false)}
          onSigned={() => {
            setShowSignModal(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function PdfDownloadButton({
  docId,
  docNumber,
  disabled,
  isCreator,
}: {
  docId: string;
  docNumber: string;
  disabled?: boolean;
  isCreator?: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const res = await api.get(`/documents/${docId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const isDisabled = disabled && isCreator;
  const title = isDisabled ? t('edo.view.pdf_disabled_creator') : t('edo.view.download_pdf');

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled || busy}
      title={title}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800 hover:bg-brand-50 px-2 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
    >
      <Download size={14} />
      <span>PDF</span>
    </button>
  );
}

function SignaturesPanel({ doc }: { doc: EdoDocument }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const sigs = doc.signatures ?? [];
  if (sigs.length === 0) return null;
  return (
    <section className="bg-white border border-emerald-200 rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-2">
        <ShieldCheck size={14} />
        {t('edo.view.signatures')} ({sigs.length})
      </h2>
      <ul className="space-y-3">
        {sigs.map((s) => (
          <li key={s.id} className="border border-slate-200 rounded-lg p-3 bg-emerald-50/40">
            <div className="flex items-start gap-3">
              <Avatar fullName={s.signer.fullName} avatarPath={s.signer.avatarPath} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{s.signer.fullName}</div>
                <div className="text-xs text-slate-500 truncate">{s.certSubject}</div>
                {s.certIssuer && (
                  <div className="text-xs text-slate-400 truncate">{s.certIssuer}</div>
                )}
                <div className="text-xs text-slate-400 mt-1">
                  {t('edo.view.signed_at')}: {new Date(s.signedAt).toLocaleString(lang)}
                </div>
                <div className="text-xs text-slate-400">
                  {t('edo.sign.serial')}: <span className="font-mono">{s.certSerial.slice(0, 24)}…</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                {s.verified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    <CheckCircle2 size={12} />
                    {t('edo.view.verified')}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    {t('edo.view.unverified')}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Yordamchi UI komponentlar ───────────────────────────────────────

function DeadlineBadge({
  deadline,
  status,
  lang,
}: {
  deadline: string;
  status: DocumentStatus;
  lang: string;
}) {
  const { t } = useTranslation();
  const dl = new Date(deadline);
  const now = new Date();
  const msLeft = dl.getTime() - now.getTime();
  const isPast = msLeft < 0 && status !== 'done';
  const isSoon = msLeft >= 0 && msLeft < 24 * 60 * 60 * 1000;
  const cls = isPast
    ? 'text-red-700 bg-red-50 border-red-200'
    : isSoon
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-slate-600 bg-slate-50 border-slate-200';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border',
        cls,
      )}
      title={t('edo.view.deadline')}
    >
      <Clock size={11} />
      {t('edo.view.deadline')}: {dl.toLocaleString(lang)}
    </span>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation();
  const map: Record<DocumentStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    in_review: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-sky-100 text-sky-800',
    done: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-700',
    overdue: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded', map[status])}>
      {t(`edo.status.${status}`)}
    </span>
  );
}

function ApproverActions({
  docCreatorId,
  onApprove,
  onReject,
  onForward,
  loadingAction,
  error,
  canSignWithEimzo,
  onSignWithEimzo,
}: {
  docCreatorId: string;
  onApprove: (pin: string, addApproverIds?: string[]) => void;
  onReject: (reason: string, pin: string) => void;
  onForward: (
    toUserId: string,
    note: string | undefined,
    pin: string,
    additionalApproverIds?: string[],
  ) => void;
  loadingAction: 'approve' | 'reject' | 'forward' | null;
  error: string | null;
  canSignWithEimzo?: boolean;
  onSignWithEimzo?: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [mode, setMode] = useState<'idle' | 'reject' | 'forward'>('idle');
  const [reason, setReason] = useState('');
  const [rejectPin, setRejectPin] = useState('');
  const [approvePinModalOpen, setApprovePinModalOpen] = useState(false);
  const [approvePin, setApprovePin] = useState('');
  const [pinLocalErr, setPinLocalErr] = useState<string | null>(null);
  const [approveAddIds, setApproveAddIds] = useState<string[]>([]);
  const [showAddApprovers, setShowAddApprovers] = useState(false);
  const [forwardUserId, setForwardUserId] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [forwardPin, setForwardPin] = useState('');
  const [forwardExtraIds, setForwardExtraIds] = useState<string[]>([]);

  const hasPin = !!user?.hasApprovalPin;
  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  const startApprove = () => {
    setPinLocalErr(null);
    setApprovePin('');
    setApproveAddIds([]);
    setShowAddApprovers(false);
    if (!hasPin) {
      setPinLocalErr(t('edo.view.pin_not_set'));
      setApprovePinModalOpen(true);
      return;
    }
    setApprovePinModalOpen(true);
  };

  const submitApprove = (e: FormEvent) => {
    e.preventDefault();
    setPinLocalErr(null);
    if (!/^\d{4}$/.test(approvePin)) {
      setPinLocalErr(t('edo.view.pin_err_format'));
      return;
    }
    onApprove(approvePin, approveAddIds.length > 0 ? approveAddIds : undefined);
    setApprovePinModalOpen(false);
    setApprovePin('');
    setApproveAddIds([]);
    setShowAddApprovers(false);
  };

  const { data: users = [] } = useQuery({
    queryKey: ['users-short'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
    enabled: mode === 'forward' || approvePinModalOpen,
    staleTime: 60_000,
  });

  // Tasdiqlovchi tomonidan qo'shimcha tasdiqlovchi sifatida kiritilmaydigan UUID'lar:
  // - yaratuvchi
  // - joriy foydalanuvchi
  const baseExcludeIds = useMemo(
    () => [docCreatorId, ...(user?.id ? [user.id] : [])],
    [docCreatorId, user?.id],
  );

  return (
    <div className="bg-white border-2 border-brand-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm text-brand-700 font-semibold">
        <AlertTriangle size={16} />
        {t('edo.view.your_turn')}
      </div>

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {canSignWithEimzo && onSignWithEimzo ? (
            <button
              onClick={onSignWithEimzo}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg"
            >
              <KeyRound size={16} />
              {t('edo.view.sign_with_eimzo')}
            </button>
          ) : (
            <button
              onClick={startApprove}
              disabled={loadingAction === 'approve'}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg"
            >
              <CheckCircle2 size={16} />
              {loadingAction === 'approve' ? t('common.saving') : t('edo.view.approve')}
            </button>
          )}
          <button
            onClick={() => setMode('reject')}
            className="inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium px-4 py-2 rounded-lg"
          >
            <XCircle size={16} />
            {t('edo.view.reject')}
          </button>
          <button
            onClick={() => setMode('forward')}
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg"
          >
            <Forward size={16} />
            {t('edo.view.forward')}
          </button>
        </div>
      )}

      {mode === 'reject' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPinLocalErr(null);
            if (reason.trim().length < 2) return;
            if (!hasPin) {
              setPinLocalErr(t('edo.view.pin_not_set'));
              return;
            }
            if (!/^\d{4}$/.test(rejectPin)) {
              setPinLocalErr(t('edo.view.pin_err_format'));
              return;
            }
            onReject(reason.trim(), rejectPin);
          }}
          className="space-y-2"
        >
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder={t('edo.view.reject_reason_ph')}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"
          />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('edo.view.pin_label')}
            </label>
            <SecretInput
              inputMode="numeric"
              name="reject-pin"
              value={rejectPin}
              onChange={(e) => setRejectPin(onlyDigits(e.target.value))}
              placeholder="••••"
              maxLength={4}
              wrapperClassName="w-40"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-base font-mono tracking-[0.6em] text-center"
            />
            {!hasPin && (
              <p className="text-[11px] text-red-600 mt-1">{t('edo.view.pin_not_set')}</p>
            )}
          </div>
          {pinLocalErr && (
            <p className="text-xs text-red-600">{pinLocalErr}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loadingAction === 'reject'}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              {t('edo.view.confirm_reject')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setReason('');
                setRejectPin('');
                setPinLocalErr(null);
              }}
              className="text-slate-600 hover:bg-slate-100 font-medium px-4 py-2 rounded-lg text-sm"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {approvePinModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setApprovePinModalOpen(false)}
        >
          <form
            onSubmit={submitApprove}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {t('edo.view.pin_modal_title')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('edo.view.pin_modal_subtitle')}
                </p>
              </div>
            </div>
            {hasPin ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {t('edo.view.pin_label')}
                  </label>
                  <SecretInput
                    autoFocus
                    inputMode="numeric"
                    name="approve-pin"
                    value={approvePin}
                    onChange={(e) => setApprovePin(onlyDigits(e.target.value))}
                    placeholder="••••"
                    maxLength={4}
                    className="w-full px-3 py-3 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-2xl font-mono tracking-[0.8em] text-center"
                  />
                </div>

                {/* Qo'shimcha tasdiqlovchi qo'shish — ixtiyoriy */}
                <div className="border-t border-slate-100 pt-3">
                  {!showAddApprovers ? (
                    <button
                      type="button"
                      onClick={() => setShowAddApprovers(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
                    >
                      <UserPlus size={14} />
                      {t('edo.view.add_approver_btn')}
                    </button>
                  ) : (
                    <ApproverChainPicker
                      users={users}
                      value={approveAddIds}
                      onChange={setApproveAddIds}
                      excludeUserIds={baseExcludeIds}
                      label={t('edo.view.add_approvers_label')}
                      hint={t('edo.view.add_approvers_hint')}
                    />
                  )}
                </div>

                {pinLocalErr && (
                  <p className="text-xs text-red-600">{pinLocalErr}</p>
                )}
                {error && (
                  <p className="text-xs text-red-600">{error}</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setApprovePinModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-medium"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction === 'approve'}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                  >
                    <CheckCircle2 size={16} />
                    {t('edo.view.approve')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-700">
                  {t('edo.view.pin_not_set_long')}
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setApprovePinModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-medium"
                  >
                    {t('common.close')}
                  </button>
                  <a
                    href="/profile"
                    className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                  >
                    <ShieldCheck size={16} />
                    {t('edo.view.pin_go_to_profile')}
                  </a>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {mode === 'forward' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPinLocalErr(null);
            if (!forwardUserId) return;
            if (!hasPin) {
              setPinLocalErr(t('edo.view.pin_not_set'));
              return;
            }
            if (!/^\d{4}$/.test(forwardPin)) {
              setPinLocalErr(t('edo.view.pin_err_format'));
              return;
            }
            onForward(
              forwardUserId,
              forwardNote.trim() || undefined,
              forwardPin,
              forwardExtraIds.length > 0 ? forwardExtraIds : undefined,
            );
          }}
          className="space-y-2"
        >
          <p className="text-xs text-slate-500">{t('edo.view.forward_hint')}</p>
          <select
            value={forwardUserId}
            onChange={(e) => setForwardUserId(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 outline-none"
          >
            <option value="">{t('edo.view.forward_select')}</option>
            {users
              .filter((u) => u.isActive && u.id !== user?.id && u.id !== docCreatorId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                  {u.position?.name ? ` — ${u.position.name}` : ''}
                </option>
              ))}
          </select>
          <input
            type="text"
            value={forwardNote}
            onChange={(e) => setForwardNote(e.target.value)}
            placeholder={t('edo.view.forward_note_ph')}
            maxLength={2000}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 outline-none"
          />
          {/* Qo'shimcha tasdiqlovchilar — toUserId'dan keyin zanjirga ulanadi */}
          <ApproverChainPicker
            users={users}
            value={forwardExtraIds}
            onChange={setForwardExtraIds}
            excludeUserIds={[...baseExcludeIds, ...(forwardUserId ? [forwardUserId] : [])]}
            label={t('edo.view.forward_extra_approvers_label')}
            hint={t('edo.view.forward_extra_approvers_hint')}
          />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('edo.view.pin_label')}
            </label>
            <SecretInput
              inputMode="numeric"
              name="forward-pin"
              value={forwardPin}
              onChange={(e) => setForwardPin(onlyDigits(e.target.value))}
              placeholder="••••"
              maxLength={4}
              wrapperClassName="w-40"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-base font-mono tracking-[0.6em] text-center"
            />
            {!hasPin && (
              <p className="text-[11px] text-red-600 mt-1">{t('edo.view.pin_not_set')}</p>
            )}
          </div>
          {pinLocalErr && <p className="text-xs text-red-600">{pinLocalErr}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loadingAction === 'forward' || !forwardUserId}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              {t('edo.view.confirm_forward')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setForwardUserId('');
                setForwardNote('');
                setForwardPin('');
                setForwardExtraIds([]);
                setPinLocalErr(null);
              }}
              className="text-slate-600 hover:bg-slate-100 font-medium px-4 py-2 rounded-lg text-sm"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}

function CommentsSection({
  doc,
  onComment,
  sending,
}: {
  doc: EdoDocument;
  onComment: (text: string) => void;
  sending: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onComment(text.trim());
    setText('');
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <MessageSquare size={14} />
        {t('edo.view.comments')} ({doc.comments.length})
      </h2>
      <div className="space-y-3 mb-4">
        {doc.comments.length === 0 && (
          <p className="text-sm text-slate-400">{t('edo.view.no_comments')}</p>
        )}
        {doc.comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar fullName={c.author.fullName} avatarPath={c.author.avatarPath} size="sm" />
            <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-medium text-slate-900">{c.author.fullName}</span>
                <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString(lang)}</span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.text}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-100 pt-3 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={t('edo.view.comment_ph')}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
        >
          {sending ? t('common.sending') : t('edo.view.add_comment')}
        </button>
      </form>
    </section>
  );
}

function ParticipantsPanel({
  doc,
  currentUserId,
}: {
  doc: EdoDocument;
  currentUserId?: string;
}) {
  const { t } = useTranslation();
  const sorted = useMemo(
    () => [...doc.participants].sort((a, b) => a.order - b.order),
    [doc.participants],
  );

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <ShieldCheck size={14} />
        {t('edo.view.chain')}
      </h2>
      <ol className="space-y-2">
        {sorted.map((p) => {
          const isMe = p.userId === currentUserId;
          const isActive = doc.currentHolderId === p.userId && doc.status === 'in_review';
          return (
            <li
              key={p.id}
              className={cn(
                'flex items-start gap-2 p-2 rounded-lg',
                isActive ? 'bg-amber-50 border border-amber-200' : '',
              )}
            >
              <Avatar fullName={p.user.fullName} avatarPath={p.user.avatarPath} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {p.user.fullName}
                  {isMe && <span className="ml-1 text-xs text-brand-600">({t('edo.view.you')})</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {t(`edo.role.${p.role}`)}
                  {p.user.position?.name && ` — ${p.user.position.name}`}
                </div>
                <ParticipantStatusBadge status={p.status} />
                {p.rejectReason && (
                  <p className="text-xs text-red-700 mt-1 italic">"{p.rejectReason}"</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ParticipantStatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' | 'done' }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    pending: 'text-amber-700',
    approved: 'text-emerald-700',
    rejected: 'text-red-700',
    done: 'text-emerald-700',
  };
  return (
    <span className={cn('text-xs font-medium', map[status])}>{t(`edo.p_status.${status}`)}</span>
  );
}

const AUDIT_STYLE: Record<
  string,
  { icon: typeof FileText; bg: string; ring: string; text: string }
> = {
  created: { icon: FileText, bg: 'bg-slate-100', ring: 'ring-slate-200', text: 'text-slate-600' },
  sent: { icon: Send, bg: 'bg-sky-100', ring: 'ring-sky-200', text: 'text-sky-700' },
  approved: { icon: CheckCircle2, bg: 'bg-emerald-100', ring: 'ring-emerald-200', text: 'text-emerald-700' },
  rejected: { icon: XCircle, bg: 'bg-red-100', ring: 'ring-red-200', text: 'text-red-700' },
  forwarded: { icon: Forward, bg: 'bg-violet-100', ring: 'ring-violet-200', text: 'text-violet-700' },
  commented: { icon: MessageSquare, bg: 'bg-slate-100', ring: 'ring-slate-200', text: 'text-slate-600' },
  completed: { icon: ShieldCheck, bg: 'bg-emerald-100', ring: 'ring-emerald-200', text: 'text-emerald-700' },
  signed: { icon: KeyRound, bg: 'bg-indigo-100', ring: 'ring-indigo-200', text: 'text-indigo-700' },
  overdue: { icon: AlertTriangle, bg: 'bg-rose-100', ring: 'ring-rose-200', text: 'text-rose-700' },
  resolution_added: { icon: ClipboardList, bg: 'bg-amber-100', ring: 'ring-amber-200', text: 'text-amber-700' },
  task_completed: { icon: CheckCircle2, bg: 'bg-emerald-100', ring: 'ring-emerald-200', text: 'text-emerald-700' },
  all_tasks_done: { icon: ShieldCheck, bg: 'bg-emerald-100', ring: 'ring-emerald-200', text: 'text-emerald-700' },
};

const DEFAULT_STYLE = AUDIT_STYLE.created;

function AuditPayload({
  action,
  payload,
  participants,
}: {
  action: string;
  payload: any;
  participants: EdoDocument['participants'];
}) {
  const { t } = useTranslation();
  if (!payload || typeof payload !== 'object') return null;

  if (action === 'rejected' && payload.reason) {
    return (
      <div className="mt-1 text-xs text-slate-600 italic">
        “{payload.reason}”
      </div>
    );
  }
  if (action === 'forwarded' && payload.toUserId) {
    const target = participants.find((p) => p.userId === payload.toUserId);
    return (
      <div className="mt-1 text-xs text-slate-600">
        → <span className="font-medium text-slate-800">{target?.user.fullName || payload.toUserId}</span>
        {payload.note && <span className="ml-1 italic">“{payload.note}”</span>}
      </div>
    );
  }
  if (action === 'signed' && payload.certSubject) {
    return (
      <div className="mt-1 text-[11px] text-slate-500 font-mono break-all">
        {payload.certSubject}
        {payload.certSerial && <span> · #{payload.certSerial}</span>}
      </div>
    );
  }
  if (action === 'resolution_added' && Array.isArray(payload.targets)) {
    const names = payload.targets
      .map((tg: any) => {
        const p = participants.find((p) => p.userId === tg.userId);
        return p?.user.fullName || tg.userId;
      })
      .join(', ');
    return (
      <div className="mt-1 text-xs text-slate-600">
        {t('edo.view.executors')}: <span className="font-medium text-slate-800">{names}</span>
      </div>
    );
  }
  if (action === 'task_completed' && payload.note) {
    return (
      <div className="mt-1 text-xs text-slate-600 italic">
        “{payload.note}”
      </div>
    );
  }
  if (action === 'sent' && payload.number) {
    return (
      <div className="mt-1 text-[11px] text-slate-500 font-mono">
        {payload.number}
      </div>
    );
  }
  return null;
}

function AuditPanel({ doc }: { doc: EdoDocument }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Clock size={14} />
        {t('edo.view.history')}
      </h2>
      <ol className="space-y-3">
        {doc.audit.map((a, i) => {
          const style = AUDIT_STYLE[a.action] || DEFAULT_STYLE;
          const Icon = style.icon;
          const isLast = i === doc.audit.length - 1;
          return (
            <li key={a.id} className="flex gap-3 relative">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center ring-2',
                    style.bg,
                    style.ring,
                    style.text,
                  )}
                >
                  <Icon size={14} />
                </div>
                {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1" />}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="text-xs text-slate-500">
                  {new Date(a.createdAt).toLocaleString(lang)}
                </div>
                <div className="text-sm">
                  <span className="font-medium text-slate-800">
                    {a.actor?.fullName || t('edo.view.system_actor')}
                  </span>
                  <span className={cn('ml-1', style.text)}>
                    {t(`edo.action.${a.action}`, a.action)}
                  </span>
                </div>
                <AuditPayload action={a.action} payload={a.payload} participants={doc.participants} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MyTasksBox({
  targets,
  onComplete,
  loading,
  error,
}: {
  targets: Array<{
    id: string;
    deadline?: string | null;
    resolution: { text: string; author: { fullName: string } };
  }>;
  onComplete: (targetId: string, note?: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const { t, i18n } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';

  return (
    <div className="bg-white border-2 border-sky-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm text-sky-700 font-semibold">
        <ClipboardList size={16} />
        {t('edo.view.my_tasks')}
      </div>
      <ul className="space-y-3">
        {targets.map((tg) => (
          <li key={tg.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div className="text-xs text-slate-500 mb-1">
              {t('edo.view.assigned_by')}: <span className="font-medium text-slate-700">{tg.resolution.author.fullName}</span>
              {tg.deadline && (
                <span className="ml-2">
                  · {t('edo.view.deadline')}: {new Date(tg.deadline).toLocaleString(lang)}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{tg.resolution.text}</p>
            {openId === tg.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onComplete(tg.id, note.trim() || undefined);
                  setOpenId(null);
                  setNote('');
                }}
                className="space-y-2"
              >
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={t('edo.view.done_note_ph')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg text-sm"
                  >
                    {t('edo.view.confirm_done')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(null);
                      setNote('');
                    }}
                    className="text-slate-600 hover:bg-slate-100 font-medium px-3 py-1.5 rounded-lg text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setOpenId(tg.id)}
                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg text-sm"
              >
                <CheckCircle2 size={14} />
                {t('edo.view.mark_done')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}

function ResolutionSection({
  doc,
  canResolve,
  onAdd,
  adding,
  addError,
}: {
  doc: EdoDocument;
  canResolve: boolean;
  onAdd: (text: string, targets: { userId: string; deadline?: string }[]) => void;
  adding: boolean;
  addError: string | null;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [adding_open, setAddingOpen] = useState(false);
  const [text, setText] = useState('');
  const [targets, setTargets] = useState<{ userId: string; deadline?: string }[]>([{ userId: '' }]);

  const { data: users = [] } = useQuery({
    queryKey: ['users-short'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
    enabled: adding_open,
    staleTime: 60_000,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const cleanTargets = targets
      .filter((t) => t.userId)
      .map((t) => ({ userId: t.userId, deadline: t.deadline || undefined }));
    if (text.trim().length < 2 || cleanTargets.length === 0) return;
    onAdd(text.trim(), cleanTargets);
    setText('');
    setTargets([{ userId: '' }]);
    setAddingOpen(false);
  }

  const resolutions = doc.resolutions ?? [];

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <ClipboardList size={14} />
          {t('edo.view.resolutions')} ({resolutions.length})
        </h2>
        {canResolve && !adding_open && (
          <button
            onClick={() => setAddingOpen(true)}
            className="inline-flex items-center gap-1 text-sm bg-brand-50 hover:bg-brand-100 text-brand-700 font-medium px-3 py-1.5 rounded-lg"
          >
            <UserPlus size={14} />
            {t('edo.view.add_resolution')}
          </button>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {resolutions.length === 0 && !adding_open && (
          <p className="text-sm text-slate-400">{t('edo.view.no_resolutions')}</p>
        )}
        {resolutions.map((r) => (
          <article key={r.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <Avatar fullName={r.author.fullName} avatarPath={r.author.avatarPath} size="sm" />
              <div>
                <div className="text-sm font-medium text-slate-900">{r.author.fullName}</div>
                <div className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString(lang)}</div>
              </div>
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap mb-3">{r.text}</p>
            <ul className="space-y-1.5">
              {r.targets.map((tg) => (
                <li
                  key={tg.id}
                  className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded px-2 py-1.5"
                >
                  <Avatar fullName={tg.user.fullName} avatarPath={tg.user.avatarPath} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800">{tg.user.fullName}</span>
                    {tg.deadline && (
                      <span className="text-xs text-slate-500 ml-2">
                        ⏰ {new Date(tg.deadline).toLocaleString(lang)}
                      </span>
                    )}
                  </span>
                  {tg.status === 'done' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <CheckCircle2 size={12} />
                      {t('edo.task_status.done')}
                      {tg.doneAt && (
                        <span className="text-slate-400 ml-1">
                          {new Date(tg.doneAt).toLocaleDateString(lang)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      {t('edo.task_status.pending')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {adding_open && (
        <form onSubmit={submit} className="border-t border-slate-100 pt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('edo.view.resolution_text')}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              required
              placeholder={t('edo.view.resolution_ph')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('edo.view.executors')}
            </label>
            <div className="space-y-2">
              {targets.map((tg, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    value={tg.userId}
                    onChange={(e) => {
                      const v = [...targets];
                      v[idx] = { ...v[idx], userId: e.target.value };
                      setTargets(v);
                    }}
                    required
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 outline-none"
                  >
                    <option value="">{t('edo.view.select_executor')}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                        {u.position?.name ? ` — ${u.position.name}` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    value={tg.deadline ?? ''}
                    onChange={(e) => {
                      const v = [...targets];
                      v[idx] = { ...v[idx], deadline: e.target.value || undefined };
                      setTargets(v);
                    }}
                    className="px-2 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 outline-none"
                  />
                  {targets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTargets(targets.filter((_, i) => i !== idx))}
                      className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                      title={t('common.remove')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTargets([...targets, { userId: '' }])}
                className="text-sm text-brand-700 hover:bg-brand-50 font-medium px-3 py-1.5 rounded-lg"
              >
                + {t('edo.view.add_executor')}
              </button>
            </div>
          </div>

          {addError && <div className="text-sm text-red-600">{addError}</div>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              {adding ? t('common.saving') : t('edo.view.save_resolution')}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingOpen(false);
                setText('');
                setTargets([{ userId: '' }]);
              }}
              className="text-slate-600 hover:bg-slate-100 font-medium px-4 py-2 rounded-lg text-sm"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function extractError(e: any): string | null {
  if (!e) return null;
  const msg = e?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : msg || e?.message || null;
}
