import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Save,
  X,
  Paperclip,
  Trash2,
  FileText,
  Download,
  MessageSquare,
  Plus,
  Languages,
  FilePlus2,
  Users,
  Link2,
  Files,
  Building2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn, trDyn, cyrName } from '../../lib/utils';
import type { Department, DocumentType, EdoDocument, Organization, Journal } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../../components/Avatar';
import { TemplatePickerModal } from '../../components/edo/TemplatePickerModal';
import { RichBodyEditor } from '../../components/edo/RichBodyEditor';

const FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.txt,.csv,image/*,video/*';

// Ichki hujjat turlari — combobox uchun. "service_letter" avtomatik zanjir bilan
// ishlaydi; qolganlari hozircha buyruq kabi (qo'lda tasdiqlovchi tanlash).
const INTERNAL_KINDS = [
  'service_letter',
  'order',
  'protocol',
  'directive',
  'decision',
  'conclusion',
  'joint_plan',
] as const;

// Kiruvchi hujjat turlari (Тип документа) — combobox
const INCOMING_DOC_KINDS = [
  'letter',
  'order',
  'request',
  'complaint',
  'act',
  'protocol',
  'appeal',
  'other',
] as const;

// Yetkazish turi (Доставка документа) — combobox
const DELIVERY_TYPES = ['post', 'email', 'courier', 'hand', 'telegram', 'other'] as const;

export function EdoComposePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('id');
  const { user } = useAuth();

  const initialType = (searchParams.get('type') as DocumentType) || 'internal';
  const [type, setType] = useState<DocumentType>(initialType);
  // Ichki hujjat turi: xizmat xati (avtomatik zanjir) | buyruq (qo'lda tasdiqlovchilar)
  const [internalKind, setInternalKind] = useState<string>('service_letter');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [numberDeptId, setNumberDeptId] = useState<string>('');
  const [targetDeptId, setTargetDeptId] = useState<string>('');
  const [senderOrgId, setSenderOrgId] = useState('');
  const [journalId, setJournalId] = useState('');
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentDocId, setCurrentDocId] = useState<string | null>(draftId);
  const [commentText, setCommentText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reference dizaynidagi qo'shimcha maydonlar (hozircha UI holati)
  const [issueGroup, setIssueGroup] = useState('');
  const [issues, setIssues] = useState('');

  // Kiruvchi korrespondensiyani ro'yxatga olish maydonlari
  const [deliveryType, setDeliveryType] = useState('');
  const [incomingDocKind, setIncomingDocKind] = useState('');
  const [docName, setDocName] = useState('');
  const [higherOrder, setHigherOrder] = useState('');
  const [predmet, setPredmet] = useState('');
  const [incomingNumber, setIncomingNumber] = useState('');
  const [outgoingNumber, setOutgoingNumber] = useState('');
  const [incomingDate, setIncomingDate] = useState('');
  const [outgoingDate, setOutgoingDate] = useState('');
  const [signatory, setSignatory] = useState('');
  const [executor, setExecutor] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [directRouting, setDirectRouting] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [xdfuDsp, setXdfuDsp] = useState(false);
  const [qrLess, setQrLess] = useState(false);
  const [asAppeal, setAsAppeal] = useState(false);
  const [replyRequired, setReplyRequired] = useState(false);
  const [formApproversAfterSign, setFormApproversAfterSign] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  // Qo'lda tanlangan shablon id'si. Bo'sh bo'lsa — yuborishda "ichki" shabloniga
  // avtomat solinadi (backend).
  const [pickedTemplateId, setPickedTemplateId] = useState<string | null>(null);
  const [showRelated, setShowRelated] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
    staleTime: 60_000,
  });


  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => (await api.get<Organization[]>('/organizations')).data,
    staleTime: 60_000,
  });

  const { data: journals = [] } = useQuery({
    queryKey: ['journals'],
    queryFn: async () => (await api.get<Journal[]>('/journals')).data,
    staleTime: 60_000,
  });

  // Faqat tanlangan hujjat turiga mos jurnallar ko'rsatilsin
  // (kiruvchi hujjatga — kiruvchi jurnallar, va h.k.; "general" — barchasiga).
  const filteredJournals = journals.filter((j) => j.kind === type || j.kind === 'general');

  const { data: doc } = useQuery({
    queryKey: ['edo-doc', currentDocId],
    queryFn: async () => (await api.get<EdoDocument>(`/documents/${currentDocId}`)).data,
    enabled: !!currentDocId,
  });

  // Bo'lim tanlanganda keyingi hujjat raqamini oldindan olib kelamiz (faqat qoralama/yangi uchun)
  const isDraftDoc = !doc || doc.status === 'draft';
  const { data: nextNumberData } = useQuery({
    queryKey: ['next-number', numberDeptId],
    queryFn: async () =>
      (
        await api.get<{ number: string | null }>('/documents/next-number', {
          params: { deptId: numberDeptId },
        })
      ).data,
    enabled: !!numberDeptId && isDraftDoc,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!doc) return;
    setType(doc.type);
    setInternalKind(doc.internalKind || 'service_letter');
    setSubject(doc.subject);
    setBody(doc.body || '');
    setNumberDeptId(doc.numberDeptId || '');
    setTargetDeptId(doc.targetDeptId || '');
    setSenderOrgId(doc.senderOrgId || '');
    setJournalId(doc.journalId || '');
    setDeadline(doc.deadline ? toLocalDatetimeInputValue(doc.deadline) : '');
    setIssueGroup(doc.issueGroup || '');
    setIssues(doc.issues || '');
    setDeliveryType(doc.deliveryType || '');
    setIncomingDocKind(doc.incomingDocKind || '');
    setDocName(doc.docName || '');
    setHigherOrder(doc.higherOrder || '');
    setPredmet(doc.predmet || '');
    setIncomingNumber(doc.incomingNumber || '');
    setOutgoingNumber(doc.outgoingNumber || '');
    setIncomingDate(doc.incomingDate ? toLocalDateInputValue(doc.incomingDate) : '');
    setOutgoingDate(doc.outgoingDate ? toLocalDateInputValue(doc.outgoingDate) : '');
    setSignatory(doc.signatory || '');
    setExecutor(doc.executor || '');
    setContactPhone(doc.contactPhone || '');
    setDirectRouting(!!doc.directRouting);
    setUrgent(!!doc.urgent);
    setTags(doc.tags || []);
    setXdfuDsp(!!doc.xdfuDsp);
    setQrLess(!!doc.qrLess);
    setAsAppeal(!!doc.deliverAsAppeal);
    setReplyRequired(!!doc.replyRequired);
    setFormApproversAfterSign(!!doc.formApproversAfterSign);
    setPickedTemplateId(doc.templateId ?? null);
  }, [doc]);

  // Yangi hujjatda (qoralama emas) — URL'dagi ?type bo'yicha turini o'rnatamiz
  useEffect(() => {
    if (draftId) return;
    const tp = searchParams.get('type');
    if (tp === 'internal' || tp === 'incoming' || tp === 'outgoing') setType(tp);
  }, [searchParams, draftId]);

  // Hujjat ochilmaganda — yaratuvchining bo'limini default qilamiz
  useEffect(() => {
    if (!currentDocId && user?.departmentId && !numberDeptId) {
      setNumberDeptId(user.departmentId);
    }
  }, [user, currentDocId, numberDeptId]);

  const numberDept = useMemo(
    () => departments.find((d) => d.id === numberDeptId) || null,
    [departments, numberDeptId],
  );

  const isDraft = !doc || doc.status === 'draft';

  // Chiquvchi hujjatda "qisqacha mazmuni" maydoni yo'q — sarlavhani hujjat
  // matnidan (HTML teglari va {{...}} o'zgaruvchilarsiz) ajratamiz, bo'sh bo'lsa
  // standart nom qo'yiladi. Boshqa turlarda oddiy subject ishlatiladi.
  function effectiveSubject(): string {
    const s = subject.trim();
    if (s) return s;
    if (type === 'outgoing') {
      const text = body
        .replace(/<[^>]*>/g, ' ')
        .replace(/\{\{[^}]*\}\}/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text ? text.slice(0, 200) : t('edo.compose.outgoing_default_subject');
    }
    return s;
  }

  const saveDraft = useMutation({
    mutationFn: async () => {
      const payload = {
        type,
        internalKind: type === 'internal' ? internalKind : undefined,
        subject: effectiveSubject(),
        // Reference'dagi "Qisqacha mazmuni" asosiy maydon; matn bo'sh bo'lsa uni matnga ham yozamiz
        body: body.trim() ? body : effectiveSubject(),
        numberDeptId: numberDeptId || undefined,
        targetDeptId: targetDeptId || undefined,
        templateId: pickedTemplateId || undefined,
        senderOrgId: type !== 'internal' ? senderOrgId || undefined : undefined,
        journalId: journalId || undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        // Yaratish formasidagi qo'shimcha maydonlar
        issueGroup: issueGroup.trim() || undefined,
        issues: issues.trim() || undefined,
        // Kiruvchi korrespondensiyani ro'yxatga olish maydonlari
        deliveryType: type === 'incoming' ? deliveryType || undefined : undefined,
        incomingDocKind: type === 'incoming' ? incomingDocKind || undefined : undefined,
        docName: type === 'incoming' ? docName.trim() || undefined : undefined,
        higherOrder: type === 'incoming' ? higherOrder.trim() || undefined : undefined,
        predmet: type === 'incoming' ? predmet.trim() || undefined : undefined,
        incomingNumber: type === 'incoming' ? incomingNumber.trim() || undefined : undefined,
        outgoingNumber: type === 'incoming' ? outgoingNumber.trim() || undefined : undefined,
        incomingDate:
          type === 'incoming' && incomingDate
            ? new Date(incomingDate).toISOString()
            : undefined,
        outgoingDate:
          type === 'incoming' && outgoingDate
            ? new Date(outgoingDate).toISOString()
            : undefined,
        signatory: type === 'incoming' ? signatory.trim() || undefined : undefined,
        executor: type === 'incoming' ? executor.trim() || undefined : undefined,
        contactPhone: type === 'incoming' ? contactPhone.trim() || undefined : undefined,
        directRouting: type === 'incoming' ? directRouting : undefined,
        urgent: type === 'incoming' ? urgent : undefined,
        tags,
        xdfuDsp,
        qrLess,
        deliverAsAppeal: type === 'outgoing' ? asAppeal : undefined,
        replyRequired: type === 'outgoing' ? replyRequired : undefined,
        formApproversAfterSign: type === 'internal' ? formApproversAfterSign : undefined,
      };
      if (currentDocId) {
        return (await api.patch<EdoDocument>(`/documents/${currentDocId}`, payload)).data;
      }
      return (await api.post<EdoDocument>('/documents', payload)).data;
    },
    onSuccess: (saved) => {
      setCurrentDocId(saved.id);
      queryClient.invalidateQueries({ queryKey: ['edo-doc', saved.id] });
      queryClient.invalidateQueries({ queryKey: ['edo-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['edo-mine'] });
    },
    onError: (e: any) => setError(extractError(e)),
  });

  const addComment = useMutation({
    mutationFn: async (text: string) =>
      (await api.post<EdoDocument>(`/documents/${currentDocId}/comment`, { text })).data,
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['edo-doc', currentDocId] });
    },
    onError: (e: any) => setError(extractError(e)),
  });

  const uploadFile = useMutation({
    mutationFn: async (vars: { docId: string; file: File }) => {
      const form = new FormData();
      form.append('file', vars.file);
      return (
        await api.post(`/documents/${vars.docId}/attachments`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data;
    },
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: ['edo-doc', vars.docId] }),
    onError: (e: any) => setError(extractError(e)),
  });

  const deleteFile = useMutation({
    mutationFn: async (attId: string) =>
      api.delete(`/documents/${currentDocId}/attachments/${attId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['edo-doc', currentDocId] }),
    onError: (e: any) => setError(extractError(e)),
  });

  async function handleSave(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (type !== 'outgoing' && (!subject.trim() || subject.trim().length < 2)) {
      setError(t('edo.compose.err_subject'));
      return;
    }
    try {
      const saved = await saveDraft.mutateAsync();
      // Saqlangach hujjat ko'rish sahifasiga — u yerda xodimlar tanlanib yuboriladi
      navigate(`/edo/documents/${saved.id}`);
    } catch {
      // saveDraft onError already handled
    }
  }

  // Fayl biriktirish — agar draft hali saqlanmagan bo'lsa, avval avto-saqlaymiz
  async function handleAttachClick() {
    setError(null);
    try {
      let docId = currentDocId;
      if (!docId) {
        if (type !== 'outgoing' && (!subject.trim() || subject.trim().length < 2)) {
          setError(t('edo.compose.err_subject_for_upload'));
          return;
        }
        const saved = await saveDraft.mutateAsync();
        docId = saved.id;
      }
      fileInputRef.current?.click();
    } catch {
      // saveDraft onError already handled
    }
  }

  function handleFilePicked(file: File) {
    if (!currentDocId) {
      setError(t('edo.compose.err_subject_for_upload'));
      return;
    }
    uploadFile.mutate({ docId: currentDocId, file });
  }

  function addTag(raw: string) {
    const v = raw.trim().replace(/^#+/, '').trim();
    if (!v) return;
    if (!tags.includes(v)) setTags((p) => [...p, v]);
    setTagInput('');
  }

  const showOutgoingWarning =
    type === 'outgoing' && !user?.canSignExternal && !user?.canSendExternal;

  const numberPreview =
    doc?.number && doc.status !== 'draft'
      ? doc.number
      : nextNumberData?.number
        ? nextNumberData.number
        : numberDept?.code
          ? `NN-${numberDept.code}`
          : null;

  const headerTitle =
    currentDocId && doc && doc.status !== 'draft'
      ? t('edo.compose.title_edit')
      : type === 'outgoing'
        ? t('edo.compose.title_new_outgoing')
        : type === 'incoming'
          ? t('edo.compose.incoming.title')
          : t('edo.compose.title_new_internal');

  const clearIncoming = () => {
    setDeliveryType('');
    setIncomingDocKind('');
    setDocName('');
    setHigherOrder('');
    setPredmet('');
    setIncomingNumber('');
    setOutgoingNumber('');
    setIncomingDate('');
    setOutgoingDate('');
    setSignatory('');
    setExecutor('');
    setContactPhone('');
    setDirectRouting(false);
    setUrgent(false);
    setSenderOrgId('');
    setJournalId('');
    setTargetDeptId('');
    setSubject('');
    setTags([]);
  };

  const attachments = doc?.attachments ?? [];

  const fieldCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none disabled:bg-slate-50';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
  const secondaryBtnCls =
    'inline-flex items-center gap-1.5 bg-asaka-50 hover:bg-asaka-100 text-asaka-700 font-medium text-xs md:text-sm px-2.5 md:px-3 py-1.5 rounded-lg disabled:opacity-50';

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-6 py-4 md:py-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {showOutgoingWarning && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          {t('edo.compose.warn_external')}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFilePicked(f);
          e.target.value = '';
        }}
      />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Sarlavha + amal tugmalari (tepada) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-slate-200">
          <h1 className="text-base md:text-lg font-semibold text-slate-900">
            {type === 'internal' || type === 'incoming' || (doc && doc.status !== 'draft')
              ? headerTitle
              : ''}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {type !== 'incoming' && (
              <>
                {type === 'internal' && (
                  <button
                    type="button"
                    onClick={handleAttachClick}
                    disabled={!isDraft || uploadFile.isPending || saveDraft.isPending}
                    className={secondaryBtnCls}
                  >
                    <Paperclip size={16} />
                    {t('edo.compose.btn_attach_file')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAttachClick}
                  disabled={!isDraft || uploadFile.isPending || saveDraft.isPending}
                  className={secondaryBtnCls}
                >
                  <FileText size={16} />
                  {t('edo.compose.btn_attachments')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRecipients((v) => !v)}
                  className={secondaryBtnCls}
                >
                  <Users size={16} />
                  {t('edo.compose.btn_recipients')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRelated((v) => !v)}
                  className={secondaryBtnCls}
                >
                  <Link2 size={16} />
                  {t('edo.compose.btn_related')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(true)}
                  className={secondaryBtnCls}
                >
                  <Files size={16} />
                  {t('edo.compose.pick_template')}
                </button>
                {pickedTemplateId && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-asaka-50 text-asaka-700 border border-asaka-200 rounded-lg px-2.5 py-1">
                    {t('edo.compose.template_selected')}
                    <button
                      type="button"
                      onClick={() => setPickedTemplateId(null)}
                      className="hover:text-asaka-900"
                      title={t('common.remove')}
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saveDraft.isPending || !isDraft}
              className="inline-flex items-center gap-1.5 bg-asaka-600 hover:bg-asaka-700 text-white font-semibold text-xs md:text-sm px-4 py-1.5 rounded-lg disabled:opacity-50"
            >
              <Save size={15} />
              {saveDraft.isPending ? t('common.saving') : t('edo.compose.save')}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              title={t('edo.compose.cancel')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {type === 'incoming' ? (
            <div className="space-y-5">
              {/* Hujjat heshteglari */}
              <div>
                <label className={`${labelCls} flex items-center gap-2`}>
                  {t('edo.compose.label_tags')}
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => addTag(tagInput)}
                      className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-asaka-300 text-asaka-600 hover:bg-asaka-50"
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </label>
                <div
                  className={`flex flex-wrap items-center gap-1.5 px-2.5 py-2 border border-slate-300 rounded-lg focus-within:border-asaka-500 focus-within:ring-2 focus-within:ring-asaka-100 ${
                    !isDraft ? 'bg-slate-50' : ''
                  }`}
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 bg-asaka-50 text-asaka-700 text-xs font-medium px-2 py-1 rounded-md"
                    >
                      #{tag}
                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => setTags((p) => p.filter((x) => x !== tag))}
                          className="hover:text-asaka-900"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    disabled={!isDraft}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTag(tagInput);
                      } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                        setTags((p) => p.slice(0, -1));
                      }
                    }}
                    placeholder={tags.length === 0 ? t('edo.compose.ph_tag') : ''}
                    className="flex-1 min-w-[120px] text-sm outline-none bg-transparent py-0.5"
                  />
                </div>
              </div>

              {/* Yuboruvchi tashkilot */}
              <div>
                <label className={labelCls}>{t('edo.compose.label_sender_org')}</label>
                <div className="flex items-stretch gap-2">
                  <select
                    value={senderOrgId}
                    onChange={(e) => setSenderOrgId(e.target.value)}
                    disabled={!isDraft}
                    className={fieldCls}
                  >
                    <option value="">{t('edo.compose.ph_sender_org')}</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} — {o.inn}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowOrgModal(true)}
                    disabled={!isDraft}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-asaka-600 hover:bg-asaka-700 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-50"
                  >
                    <Building2 size={16} />
                    {t('edo.compose.add_org')}
                  </button>
                </div>
              </div>

              {/* A qatori: Hujjat turi | Yetkazish | Jurnal */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>
                    {t('edo.compose.incoming.doc_kind')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={incomingDocKind}
                    onChange={(e) => setIncomingDocKind(e.target.value)}
                    disabled={!isDraft}
                    className={fieldCls}
                  >
                    <option value="">{t('edo.compose.incoming.ph_doc_kind')}</option>
                    {INCOMING_DOC_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`edo.compose.incoming.kind_${k}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('edo.compose.incoming.delivery')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    disabled={!isDraft}
                    className={fieldCls}
                  >
                    <option value="">{t('edo.compose.incoming.ph_delivery')}</option>
                    {DELIVERY_TYPES.map((d) => (
                      <option key={d} value={d}>
                        {t(`edo.compose.incoming.delivery_${d}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('edo.compose.label_journal')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={journalId}
                    onChange={(e) => setJournalId(e.target.value)}
                    disabled={!isDraft}
                    className={fieldCls}
                  >
                    <option value="">{t('edo.compose.ph_journal')}</option>
                    {filteredJournals.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.prefix ? `[${j.prefix}] ` : ''}
                        {trDyn(j.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* B qatori: Hujjat nomi | Yuqori organ topshirig'i | Predmet */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>{t('edo.compose.incoming.doc_name')}</label>
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    maxLength={500}
                    disabled={!isDraft}
                    placeholder={t('edo.compose.incoming.ph_doc_name')}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('edo.compose.incoming.higher_order')}</label>
                  <input
                    type="text"
                    value={higherOrder}
                    onChange={(e) => setHigherOrder(e.target.value)}
                    maxLength={500}
                    disabled={!isDraft}
                    placeholder={t('edo.compose.incoming.ph_higher_order')}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('edo.compose.incoming.predmet')}</label>
                  <input
                    type="text"
                    value={predmet}
                    onChange={(e) => setPredmet(e.target.value)}
                    maxLength={500}
                    disabled={!isDraft}
                    placeholder={t('edo.compose.incoming.ph_predmet')}
                    className={fieldCls}
                  />
                </div>
              </div>

              {/* C qatori: raqamlar + sanalar | Qisqacha mazmuni */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      {t('edo.compose.incoming.in_number')}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={incomingNumber}
                      onChange={(e) => setIncomingNumber(e.target.value)}
                      maxLength={64}
                      disabled={!isDraft}
                      placeholder={t('edo.compose.incoming.ph_in_number')}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t('edo.compose.incoming.out_number')}</label>
                    <input
                      type="text"
                      value={outgoingNumber}
                      onChange={(e) => setOutgoingNumber(e.target.value)}
                      maxLength={64}
                      disabled={!isDraft}
                      placeholder={t('edo.compose.incoming.ph_out_number')}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      {t('edo.compose.incoming.in_date')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={incomingDate}
                      onChange={(e) => setIncomingDate(e.target.value)}
                      disabled={!isDraft}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t('edo.compose.incoming.out_date')}</label>
                    <input
                      type="date"
                      value={outgoingDate}
                      onChange={(e) => setOutgoingDate(e.target.value)}
                      disabled={!isDraft}
                      className={fieldCls}
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className={labelCls}>
                    {t('edo.compose.label_summary')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t('edo.compose.ph_summary')}
                    maxLength={500}
                    required
                    disabled={!isDraft}
                    className={`${fieldCls} resize-none flex-1 min-h-[120px]`}
                  />
                </div>
              </div>

              {/* D qatori: Imzolagan shaxs | Ijrochi | Telefon */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>{t('edo.compose.incoming.signatory')}</label>
                  <input
                    type="text"
                    value={signatory}
                    onChange={(e) => setSignatory(e.target.value)}
                    maxLength={255}
                    disabled={!isDraft}
                    placeholder={t('edo.compose.incoming.ph_signatory')}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('edo.compose.incoming.executor')}</label>
                  <input
                    type="text"
                    value={executor}
                    onChange={(e) => setExecutor(e.target.value)}
                    maxLength={255}
                    disabled={!isDraft}
                    placeholder={t('edo.compose.incoming.ph_executor')}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('edo.compose.incoming.phone')}</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    maxLength={64}
                    disabled={!isDraft}
                    placeholder={t('edo.compose.incoming.ph_phone')}
                    className={fieldCls}
                  />
                </div>
              </div>

              {/* E qatori: Rezolyutsiya | To'g'ridan | Shoshilinch/DSP */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-end">
                <div>
                  <label className={labelCls}>
                    {t('edo.compose.incoming.resolution_to')}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={targetDeptId}
                    onChange={(e) => setTargetDeptId(e.target.value)}
                    disabled={!isDraft}
                    className={fieldCls}
                  >
                    <option value="">{t('edo.compose.incoming.ph_resolution_to')}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code ? `[${d.code}] ` : ''}
                        {trDyn(d.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:pb-2">
                  <OptToggle
                    checked={directRouting}
                    onChange={() => setDirectRouting((v) => !v)}
                    disabled={!isDraft}
                    label={t('edo.compose.incoming.direct_routing')}
                  />
                </div>
                <div className="flex items-center gap-6 md:pb-2">
                  <OptToggle
                    checked={urgent}
                    onChange={() => setUrgent((v) => !v)}
                    disabled={!isDraft}
                    label={t('edo.compose.incoming.urgent')}
                  />
                  <OptToggle
                    checked={xdfuDsp}
                    onChange={() => setXdfuDsp((v) => !v)}
                    disabled={!isDraft}
                    label={t('edo.compose.incoming.dsp')}
                  />
                </div>
              </div>

              {/* Biriktirilgan fayllar */}
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <FileText size={15} className="text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-slate-800 truncate block">
                          {a.filename}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatBytes(a.sizeBytes)}
                        </span>
                      </div>
                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t('common.delete'))) deleteFile.mutate(a.id);
                          }}
                          disabled={deleteFile.isPending}
                          className="p-1 text-slate-400 hover:text-red-600 rounded disabled:opacity-40"
                          title={t('common.delete')}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pastki amal havolalari */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-100 pt-4 text-sm">
                <button
                  type="button"
                  onClick={handleAttachClick}
                  disabled={!isDraft || uploadFile.isPending || saveDraft.isPending}
                  className="inline-flex items-center gap-2 text-asaka-700 hover:text-asaka-800 font-medium disabled:opacity-50"
                >
                  <FileText size={16} />
                  {t('edo.compose.incoming.main_file')}
                </button>
                <button
                  type="button"
                  onClick={handleAttachClick}
                  disabled={!isDraft || uploadFile.isPending || saveDraft.isPending}
                  className="inline-flex items-center gap-2 text-asaka-700 hover:text-asaka-800 font-medium disabled:opacity-50"
                >
                  <Paperclip size={16} />
                  {t('edo.compose.incoming.attachments')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRelated((v) => !v)}
                  className="inline-flex items-center gap-2 text-asaka-700 hover:text-asaka-800 font-medium"
                >
                  <Link2 size={16} />
                  {t('edo.compose.incoming.related')}
                </button>
              </div>

              <p className="text-xs text-slate-400">{t('edo.compose.incoming.pdf_note')}</p>

              {/* Tozalash / Saqlash */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={clearIncoming}
                  disabled={!isDraft}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                >
                  <X size={15} />
                  {t('edo.compose.incoming.clear')}
                </button>
                <button
                  type="submit"
                  disabled={saveDraft.isPending || !isDraft}
                  className="inline-flex items-center gap-2 bg-asaka-600 hover:bg-asaka-700 text-white font-semibold px-6 py-2 rounded-lg disabled:opacity-50"
                >
                  <Save size={16} />
                  {saveDraft.isPending ? t('common.saving') : t('edo.compose.save')}
                </button>
              </div>

              {/* Aloqador hujjatlar paneli */}
              {showRelated && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/60">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">
                      {t('edo.compose.related_panel_title')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowRelated(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-400">{t('edo.compose.related_empty')}</p>
                </div>
              )}
            </div>
          ) : (
          <>
          {/* Yuqori maydonlar qatori */}
          {type === 'outgoing' ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>
                  {t('edo.compose.label_journal')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={journalId}
                  onChange={(e) => setJournalId(e.target.value)}
                  disabled={!isDraft}
                  className={fieldCls}
                >
                  <option value="">{t('edo.compose.ph_journal')}</option>
                  {filteredJournals.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.prefix ? `[${j.prefix}] ` : ''}
                      {j.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {t('edo.compose.journal_category_hint')}
                </p>
              </div>
              <div>
                <label className={labelCls}>{t('edo.compose.label_doc_number')}</label>
                <input
                  type="text"
                  readOnly
                  value={numberPreview ?? ''}
                  placeholder={t('edo.compose.ph_doc_number')}
                  className={`${fieldCls} bg-slate-50 font-mono text-asaka-700`}
                />
              </div>
              <div>
                <label className={labelCls}>{t('edo.compose.label_issue_group')}</label>
                <input
                  type="text"
                  value={issueGroup}
                  onChange={(e) => setIssueGroup(e.target.value)}
                  disabled={!isDraft}
                  placeholder={t('edo.compose.ph_issue_group')}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('edo.compose.label_issues')}</label>
                <input
                  type="text"
                  value={issues}
                  onChange={(e) => setIssues(e.target.value)}
                  disabled={!isDraft}
                  placeholder={t('edo.compose.ph_issues')}
                  className={fieldCls}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>
                  {t('edo.compose.label_type')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as DocumentType)}
                  disabled={!isDraft}
                  className={fieldCls}
                >
                  <option value="internal">{t('edo.doc_type.internal')}</option>
                  <option value="incoming">{t('edo.doc_type.incoming')}</option>
                  <option value="outgoing">{t('edo.doc_type.outgoing')}</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  {t('edo.compose.label_journal')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={journalId}
                  onChange={(e) => setJournalId(e.target.value)}
                  disabled={!isDraft}
                  className={fieldCls}
                >
                  <option value="">{t('edo.compose.ph_journal')}</option>
                  {filteredJournals.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.prefix ? `[${j.prefix}] ` : ''}
                      {j.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {t('edo.compose.journal_category_hint')}
                </p>
              </div>
              <div>
                <label className={labelCls}>{t('edo.compose.label_doc_number')}</label>
                <input
                  type="text"
                  readOnly
                  value={numberPreview ?? ''}
                  placeholder={t('edo.compose.ph_doc_number')}
                  className={`${fieldCls} bg-slate-50 font-mono text-asaka-700`}
                />
              </div>
            </div>
          )}

          {/* Ichki hujjat turi: xizmat xati / buyruq */}
          {type === 'internal' && (
            <div>
              <label className={labelCls}>
                {t('edo.compose.label_internal_kind')} <span className="text-red-500">*</span>
              </label>
              <select
                value={internalKind}
                onChange={(e) => setInternalKind(e.target.value)}
                disabled={!isDraft}
                className={fieldCls}
              >
                {INTERNAL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`edo.internal_kind.${k}`)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">
                {internalKind === 'service_letter'
                  ? t('edo.compose.internal_kind_hint_service')
                  : t('edo.compose.internal_kind_hint_order')}
              </p>
            </div>
          )}

          {/* Yuboruvchi tashkilot (kiruvchi / chiquvchi) */}
          {type !== 'internal' && (
            <div>
              <label className={labelCls}>{t('edo.compose.label_sender_org')}</label>
              <div className="flex items-stretch gap-2">
                <select
                  value={senderOrgId}
                  onChange={(e) => setSenderOrgId(e.target.value)}
                  disabled={!isDraft}
                  className={fieldCls}
                >
                  <option value="">{t('edo.compose.ph_sender_org')}</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.inn}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowOrgModal(true)}
                  disabled={!isDraft}
                  className="shrink-0 inline-flex items-center gap-1.5 bg-asaka-600 hover:bg-asaka-700 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-50"
                >
                  <Building2 size={16} />
                  {t('edo.compose.add_org')}
                </button>
              </div>
            </div>
          )}

          {/* Qisqacha mazmuni — chiquvchi hujjatda kerak emas */}
          {type !== 'outgoing' && (
            <div>
              <label className={labelCls}>
                {t('edo.compose.label_summary')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Languages size={18} className="absolute left-3 top-3 text-slate-300 pointer-events-none" />
                <textarea
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('edo.compose.ph_summary')}
                  maxLength={500}
                  rows={4}
                  required
                  disabled={!isDraft}
                  className={`${fieldCls} resize-y pl-10`}
                />
              </div>
            </div>
          )}

          {/* Hujjat matni */}
          <div>
            <label className={labelCls}>{t('edo.compose.label_body')}</label>
            <RichBodyEditor
              value={body}
              onChange={setBody}
              disabled={!isDraft}
              placeholder={t('edo.compose.ph_body')}
            />
          </div>

          {/* Hujjat heshteglari */}
          <div>
            <label className={`${labelCls} flex items-center gap-2`}>
              {t('edo.compose.label_tags')}
              {isDraft && (
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-asaka-300 text-asaka-600 hover:bg-asaka-50"
                  title={t('edo.compose.label_tags')}
                >
                  <Plus size={13} />
                </button>
              )}
            </label>
            <div
              className={`flex flex-wrap items-center gap-1.5 px-2.5 py-2 border border-slate-300 rounded-lg focus-within:border-asaka-500 focus-within:ring-2 focus-within:ring-asaka-100 ${
                !isDraft ? 'bg-slate-50' : ''
              }`}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-asaka-50 text-asaka-700 text-xs font-medium px-2 py-1 rounded-md"
                >
                  #{tag}
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => setTags((p) => p.filter((x) => x !== tag))}
                      className="hover:text-asaka-900"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                disabled={!isDraft}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagInput);
                  } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                    setTags((p) => p.slice(0, -1));
                  }
                }}
                placeholder={tags.length === 0 ? t('edo.compose.ph_tag') : ''}
                className="flex-1 min-w-[120px] text-sm outline-none bg-transparent py-0.5"
              />
            </div>
          </div>

          {/* Biriktirilgan fayllar ro'yxati */}
          {attachments.length > 0 && (
            <div className="space-y-1">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <FileText size={15} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-slate-800 truncate block">
                      {a.filename}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatBytes(a.sizeBytes)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api.get(
                          `/documents/${currentDocId}/attachments/${a.id}/download`,
                          { responseType: 'blob' },
                        );
                        const url = URL.createObjectURL(res.data);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = a.filename;
                        link.click();
                        URL.revokeObjectURL(url);
                      } catch (err: any) {
                        setError(extractError(err));
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-asaka-700 rounded"
                    title={t('common.download', { defaultValue: 'Yuklab olish' })}
                  >
                    <Download size={13} />
                  </button>
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('common.delete'))) deleteFile.mutate(a.id);
                      }}
                      disabled={deleteFile.isPending}
                      className="p-1 text-slate-400 hover:text-red-600 rounded disabled:opacity-40"
                      title={t('common.delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Asosiy faylni yuklash (chiquvchi) */}
          {type === 'outgoing' && isDraft && (
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={uploadFile.isPending || saveDraft.isPending}
              className="w-full flex flex-col items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-asaka-400 hover:bg-asaka-50/40 rounded-xl py-10 text-slate-500 hover:text-asaka-700 transition-colors disabled:opacity-50"
            >
              <FilePlus2 size={26} className="text-slate-400" />
              <span className="text-sm font-medium">
                {uploadFile.isPending || saveDraft.isPending
                  ? t('common.saving')
                  : t('edo.compose.main_file_upload')}
              </span>
            </button>
          )}

          {/* Variantlar qatori */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-100 pt-4">
            <OptToggle
              checked={xdfuDsp}
              onChange={() => setXdfuDsp((v) => !v)}
              disabled={!isDraft}
              label="XDFU / DSP"
            />
            <OptCheck
              checked={qrLess}
              onChange={() => setQrLess((v) => !v)}
              disabled={!isDraft}
              label={t('edo.compose.opt_qr_less')}
            />
            {type === 'outgoing' ? (
              <>
                <OptCheck
                  checked={asAppeal}
                  onChange={() => setAsAppeal((v) => !v)}
                  disabled={!isDraft}
                  label={t('edo.compose.opt_as_appeal')}
                />
                <OptCheck
                  checked={replyRequired}
                  onChange={() => setReplyRequired((v) => !v)}
                  disabled={!isDraft}
                  label={t('edo.compose.opt_reply_required')}
                />
              </>
            ) : (
              <OptCheck
                checked={formApproversAfterSign}
                onChange={() => setFormApproversAfterSign((v) => !v)}
                disabled={!isDraft}
                label={t('edo.compose.opt_form_approvers_after_sign')}
              />
            )}
          </div>

          {/* Qabul qiluvchilar / kelishuvchilar paneli */}
          {showRecipients && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-slate-50/60">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  {t('edo.compose.recipients_panel_title')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRecipients(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('edo.compose.label_target_dept')}</label>
                  <select
                    value={targetDeptId}
                    onChange={(e) => setTargetDeptId(e.target.value)}
                    disabled={!isDraft}
                    className={fieldCls}
                  >
                    <option value="">{t('edo.compose.placeholder_select_dept')}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code ? `[${d.code}] ` : ''}
                        {trDyn(d.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('edo.compose.label_deadline')}</label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    disabled={!isDraft}
                    className={fieldCls}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">{t('edo.compose.approvers_moved_hint')}</p>
            </div>
          )}

          {/* Aloqador hujjatlar paneli */}
          {showRelated && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/60">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  {t('edo.compose.related_panel_title')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRelated(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-slate-400">{t('edo.compose.related_empty')}</p>
            </div>
          )}
          </>
          )}
        </form>
      </div>

      {/* Izohlar */}
      <div className="mt-4">
        <CommentsBox
          docId={currentDocId}
          comments={doc?.comments ?? []}
          lang={lang}
          text={commentText}
          setText={setCommentText}
          onSubmit={() => {
            if (commentText.trim() && currentDocId) addComment.mutate(commentText.trim());
          }}
          sending={addComment.isPending}
        />
      </div>

      {showTemplatePicker && (
        <TemplatePickerModal
          onClose={() => setShowTemplatePicker(false)}
          onPick={(templateBody) => {
            // Shablon endi "ramka" emas — to'g'ridan-to'g'ri tahrirlanadigan
            // matnga "yoyiladi" (flatten). Foydalanuvchi hujjatning to'liq
            // ko'rinishini Word kabi ko'radi va ichidagi hamma narsani
            // (shrift turi, hajmi, rangi, interval) o'zgartira oladi.
            // {{matn}} → hozirgi matn; {{xujjat_n}}/{{sana_soat}} render paytida
            // avtomat to'ladi (data-fulldoc belgisi ichki avto-shablonni o'chiradi).
            const flattened = templateBody.replace(/\{\{\s*matn\s*\}\}/g, body || '');
            setBody(`<div data-fulldoc="1">${flattened}</div>`);
            setPickedTemplateId(null);
          }}
        />
      )}

      {showOrgModal && (
        <OrgAddModal
          onClose={() => setShowOrgModal(false)}
          onCreated={(org) => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            setSenderOrgId(org.id);
            setShowOrgModal(false);
          }}
        />
      )}
    </div>
  );
}

function OrgAddModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (org: Organization) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [inn, setInn] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post<Organization>('/organizations', {
          name: name.trim(),
          inn: inn.trim(),
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          note: note.trim() || undefined,
        })
      ).data,
    onSuccess: (org) => onCreated(org),
    onError: (e: any) => setErr(extractError(e)),
  });

  const fieldCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2 || !inn.trim()) {
      setErr(t('edo.compose.org_err_required'));
      return;
    }
    create.mutate();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full my-8"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Building2 size={16} className="text-asaka-600" />
            {t('edo.compose.org_modal_title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <div>
            <label className={labelCls}>
              {t('edo.compose.org_name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              autoFocus
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              {t('edo.compose.org_inn')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={inn}
              onChange={(e) => setInn(e.target.value)}
              maxLength={32}
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t('edo.compose.org_address')}</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={500}
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t('edo.compose.org_phone')}</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={64}
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t('edo.compose.org_note')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              className={`${fieldCls} resize-y`}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {t('edo.compose.cancel')}
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex items-center gap-2 bg-asaka-600 hover:bg-asaka-700 text-white font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            <Save size={15} />
            {create.isPending ? t('common.saving') : t('edo.compose.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function CommentsBox({
  docId,
  comments,
  lang,
  text,
  setText,
  onSubmit,
  sending,
}: {
  docId: string | null;
  comments: EdoDocument['comments'];
  lang: string;
  text: string;
  setText: (v: string) => void;
  onSubmit: () => void;
  sending: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <MessageSquare size={14} />
        {t('edo.view.comments')} ({comments.length})
      </h2>

      <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-400">{t('edo.view.no_comments')}</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar
                fullName={c.author.fullName}
                avatarPath={c.author.avatarPath ?? undefined}
                size="sm"
              />
              <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-900">{cyrName(c.author.fullName)}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(c.createdAt).toLocaleString(lang)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {!docId ? (
        <p className="text-xs text-slate-400 italic">
          {t('edo.compose.comments_disabled_until_save')}
        </p>
      ) : (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={t('edo.view.comment_ph')}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!text.trim() || sending}
            className="bg-asaka-600 hover:bg-asaka-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
          >
            {sending ? t('common.sending') : t('edo.view.add_comment')}
          </button>
        </div>
      )}
    </section>
  );
}

function OptToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="inline-flex items-center gap-2 text-sm text-slate-600 disabled:opacity-60"
    >
      <span
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          checked ? 'bg-asaka-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

function OptCheck({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 rounded border-slate-300 text-asaka-600 focus:ring-asaka-500"
      />
      {label}
    </label>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function extractError(e: any): string {
  const msg = e?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : msg || e?.message || 'Xatolik';
}

function toLocalDatetimeInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
