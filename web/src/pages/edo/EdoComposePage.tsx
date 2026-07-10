import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Save,
  X,
  Paperclip,
  Trash2,
  FileText,
  Download,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { Department, DocumentType, EdoDocument, User } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../../components/Avatar';
import { TemplatePickerModal } from '../../components/edo/TemplatePickerModal';
import { ApproverChainPicker } from '../../components/edo/ApproverChainPicker';

const FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.txt,.csv,image/*,video/*';

export function EdoComposePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('id');
  const { user } = useAuth();

  const [type, setType] = useState<DocumentType>('internal');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [numberDeptId, setNumberDeptId] = useState<string>('');
  const [targetDeptId, setTargetDeptId] = useState<string>('');
  const [externalRecipient, setExternalRecipient] = useState('');
  const [deadline, setDeadline] = useState('');
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentDocId, setCurrentDocId] = useState<string | null>(draftId);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
    staleTime: 60_000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-short'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
    staleTime: 60_000,
  });

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
    setSubject(doc.subject);
    setBody(doc.body || '');
    setNumberDeptId(doc.numberDeptId || '');
    setTargetDeptId(doc.targetDeptId || '');
    setExternalRecipient(doc.externalRecipient || '');
    setDeadline(doc.deadline ? toLocalDatetimeInputValue(doc.deadline) : '');
    // Qoralamada saqlangan tasdiqlovchilar zanjirini yuklaymiz
    const persistedApprovers = (doc.participants || [])
      .filter((p) => p.role === 'approver')
      .sort((a, b) => a.order - b.order)
      .map((p) => p.userId);
    setApproverIds(persistedApprovers);
  }, [doc]);

  // Hujjat ochilmaganda — yaratuvchining bo'limini default qilamiz
  useEffect(() => {
    if (!currentDocId && user?.departmentId && !numberDeptId) {
      setNumberDeptId(user.departmentId);
    }
  }, [user, currentDocId, numberDeptId]);

  const findHead = useMemo(() => {
    return (deptId: string | null | undefined, excludeUserId?: string | null) => {
      if (!deptId) return null;
      const candidates = allUsers
        .filter(
          (u) =>
            u.departmentId === deptId &&
            u.isActive &&
            (!excludeUserId || u.id !== excludeUserId),
        )
        .sort((a, b) => (a.position?.rank ?? 99999) - (b.position?.rank ?? 99999));
      return candidates[0] ?? null;
    };
  }, [allUsers]);

  const numberDept = useMemo(
    () => departments.find((d) => d.id === numberDeptId) || null,
    [departments, numberDeptId],
  );
  const creatorDeptHead = useMemo(
    () => findHead(numberDeptId, user?.id),
    [findHead, numberDeptId, user?.id],
  );
  const targetDeptHead = useMemo(
    () => findHead(targetDeptId, user?.id),
    [findHead, targetDeptId, user?.id],
  );

  const isDraft = !doc || doc.status === 'draft';

  const saveDraft = useMutation({
    mutationFn: async () => {
      const payload = {
        type,
        subject: subject.trim(),
        body,
        numberDeptId: numberDeptId || undefined,
        targetDeptId: targetDeptId || undefined,
        externalRecipient:
          type === 'outgoing' ? externalRecipient.trim() || undefined : undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        // Tasdiqlovchilar zanjiri: yaratuvchi tanlagan ketma-ketlik
        approverIds,
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

  const sendDoc = useMutation({
    mutationFn: async (id: string) => {
      return (await api.post<EdoDocument>(`/documents/${id}/send`, {})).data;
    },
    onSuccess: (doc) => {
      // View page'da eski draft kesh bo'lmasligi uchun yangi ma'lumotni cache'ga yozamiz
      queryClient.setQueryData(['edo-doc', doc.id], doc);
      queryClient.invalidateQueries({ queryKey: ['edo-doc', doc.id] });
      queryClient.invalidateQueries({ queryKey: ['edo-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['edo-mine'] });
      navigate(`/edo/documents/${doc.id}`);
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

  function handleSave(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!subject.trim() || subject.trim().length < 2) {
      setError(t('edo.compose.err_subject'));
      return;
    }
    saveDraft.mutate();
  }

  // Fayl biriktirish — agar draft hali saqlanmagan bo'lsa, avval avto-saqlaymiz
  async function handleAttachClick() {
    setError(null);
    try {
      let docId = currentDocId;
      if (!docId) {
        if (!subject.trim() || subject.trim().length < 2) {
          setError(t('edo.compose.err_subject_for_upload'));
          return;
        }
        const saved = await saveDraft.mutateAsync();
        docId = saved.id;
      }
      // currentDocId bo'lgandan keyin file pickerni ochamiz
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

  function openSendConfirm() {
    setError(null);
    if (!subject.trim() || subject.trim().length < 2 || !body.trim()) {
      setError(t('edo.compose.err_required'));
      return;
    }
    setShowSendConfirm(true);
  }

  async function confirmSend() {
    setShowSendConfirm(false);
    try {
      const saved = await saveDraft.mutateAsync();
      sendDoc.mutate(saved.id);
    } catch {
      // saveDraft onError already handled
    }
  }

  async function declineSend() {
    setShowSendConfirm(false);
    try {
      await saveDraft.mutateAsync();
      navigate('/edo/drafts');
    } catch {
      // saveDraft onError already handled
    }
  }

  const showOutgoingWarning =
    type === 'outgoing' && !user?.canSignExternal && !user?.canSendExternal;

  const numberPreview =
    doc?.number && doc.status !== 'draft'
      ? doc.number
      : nextNumberData?.number
        ? nextNumberData.number
        : numberDept?.code
          ? `${numberDept.code}-NN`
          : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
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

      {/* Yuqori panel: sarlavha + Saqlash / Bekor qilish */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">
          {currentDocId ? t('edo.compose.title_edit') : t('edo.compose.title_new')}
        </h1>
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
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg"
          >
            <X size={16} />
            {t('edo.compose.cancel')}
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saveDraft.isPending || !isDraft}
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
          >
            <Save size={16} />
            {saveDraft.isPending ? t('common.saving') : t('edo.compose.save_draft')}
          </button>
          <button
            type="button"
            onClick={openSendConfirm}
            disabled={sendDoc.isPending || saveDraft.isPending || !isDraft}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
          >
            <Send size={16} />
            {sendDoc.isPending ? t('common.sending') : t('edo.compose.send')}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CHAP USTUN */}
          <div className="space-y-4">
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              {/* Bo'lim tanlash + raqam */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('edo.compose.label_number_dept')}
                </label>
                <select
                  value={numberDeptId}
                  onChange={(e) => setNumberDeptId(e.target.value)}
                  disabled={!isDraft}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none disabled:bg-slate-50"
                >
                  <option value="">{t('edo.compose.placeholder_select_dept')}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code ? `[${d.code}] ` : ''}
                      {d.name}
                    </option>
                  ))}
                </select>
                {numberPreview ? (
                  <div className="mt-1.5 text-xs text-brand-700 font-mono">
                    {t('edo.compose.number_preview', { value: numberPreview })}
                  </div>
                ) : (
                  <div className="mt-1.5 text-xs text-slate-400">
                    {t('edo.compose.number_preview_pending')}
                  </div>
                )}
              </div>

              {/* Tasdiqlash zanjiri — yaratuvchi tartibli ro'yxatni o'zi tuzadi */}
              <div>
                <ApproverChainPicker
                  users={allUsers}
                  value={approverIds}
                  onChange={setApproverIds}
                  excludeUserIds={user ? [user.id] : []}
                  disabled={!isDraft}
                  label={t('edo.compose.approvers_label')}
                  hint={t('edo.compose.approvers_hint')}
                />
                {/* Tezkor qo'shish — bo'lim rahbarlarini bir bosishda zanjirga ulash */}
                {isDraft && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {creatorDeptHead && !approverIds.includes(creatorDeptHead.id) && (
                      <button
                        type="button"
                        onClick={() =>
                          setApproverIds((prev) => [...prev, creatorDeptHead.id])
                        }
                        className="inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 px-2 py-1 rounded-md"
                      >
                        + {t('edo.compose.quick_add_creator_head')}: {creatorDeptHead.fullName}
                      </button>
                    )}
                    {targetDeptHead && !approverIds.includes(targetDeptHead.id) && (
                      <button
                        type="button"
                        onClick={() =>
                          setApproverIds((prev) => [...prev, targetDeptHead.id])
                        }
                        className="inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 px-2 py-1 rounded-md"
                      >
                        + {t('edo.compose.quick_add_target_head')}: {targetDeptHead.fullName}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Mavzu + fayl biriktirish tugmasi bir qatorda */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    {t('edo.compose.label_subject')}
                  </label>
                  <button
                    type="button"
                    onClick={handleAttachClick}
                    disabled={!isDraft || uploadFile.isPending || saveDraft.isPending}
                    className="inline-flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 font-medium disabled:opacity-40"
                  >
                    <Paperclip size={13} />
                    {uploadFile.isPending || saveDraft.isPending
                      ? t('common.saving')
                      : t('edo.compose.add_file')}
                    {(doc?.attachments?.length ?? 0) > 0 && (
                      <span className="ml-0.5 bg-brand-100 text-brand-700 text-[11px] font-semibold px-1.5 py-0.5 rounded">
                        {doc!.attachments!.length}
                      </span>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('edo.compose.ph_subject')}
                  maxLength={500}
                  required
                  disabled={!isDraft}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none disabled:bg-slate-50"
                />
              </div>

              {/* Biriktirilgan fayllar — mavzu va matn orasida */}
              {((doc?.attachments?.length ?? 0) > 0 || !currentDocId) && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 space-y-1.5">
                  {!currentDocId && (
                    <p className="text-xs text-slate-400 italic">
                      {t('edo.compose.files_disabled_until_save')}
                    </p>
                  )}
                  {(doc?.attachments?.length ?? 0) > 0 && (
                    <ul className="space-y-1">
                      {doc!.attachments!.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md"
                        >
                          <FileText size={14} className="text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-slate-800 truncate block">
                              {a.filename}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {formatBytes(a.sizeBytes)}
                            </span>
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
                            className="p-1 text-slate-400 hover:text-brand-700 rounded"
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
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Hujjat turi */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('edo.compose.label_type')}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as DocumentType)}
                  disabled={!isDraft}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none disabled:bg-slate-50"
                >
                  <option value="internal">{t('edo.doc_type.internal')}</option>
                  <option value="incoming">{t('edo.doc_type.incoming')}</option>
                  <option value="outgoing">{t('edo.doc_type.outgoing')}</option>
                </select>
              </div>

              {type === 'outgoing' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('edo.compose.label_external_recipient')}
                  </label>
                  <input
                    type="text"
                    value={externalRecipient}
                    onChange={(e) => setExternalRecipient(e.target.value)}
                    placeholder={t('edo.compose.ph_external_recipient')}
                    maxLength={255}
                    disabled={!isDraft}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none disabled:bg-slate-50"
                  />
                </div>
              )}
            </section>

            {/* Hujjat matni */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  {t('edo.compose.label_body')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(true)}
                  disabled={!isDraft}
                  className="inline-flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 font-medium disabled:opacity-40"
                >
                  <FileText size={14} />
                  {t('edo.compose.pick_template')}
                </button>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                disabled={!isDraft}
                placeholder={t('edo.compose.ph_body')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none font-sans disabled:bg-slate-50"
              />
            </section>
          </div>

          {/* O'NG USTUN */}
          <div className="space-y-4">
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              {/* Hujjat sanasi */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('edo.compose.label_doc_date')}
                </label>
                <div className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  {doc?.createdAt
                    ? new Date(doc.createdAt).toLocaleString(lang)
                    : new Date().toLocaleString(lang)}
                </div>
              </div>

              {/* Ijro sanasi — hujjat sanasidan pastda */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('edo.compose.label_deadline')}
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={!isDraft}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none disabled:bg-slate-50"
                />
              </div>

              {/* Qabul qiluvchi bo'lim */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('edo.compose.label_target_dept')}
                </label>
                <select
                  value={targetDeptId}
                  onChange={(e) => setTargetDeptId(e.target.value)}
                  disabled={!isDraft}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none disabled:bg-slate-50"
                >
                  <option value="">{t('edo.compose.placeholder_select_dept')}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code ? `[${d.code}] ` : ''}
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

            </section>

            {/* Izohlar */}
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
        </div>
      </form>

      {showTemplatePicker && (
        <TemplatePickerModal
          onClose={() => setShowTemplatePicker(false)}
          onPick={(newBody) => setBody(newBody)}
        />
      )}

      {showSendConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-brand-50 text-brand-700 rounded-lg p-2 shrink-0">
                <Send size={20} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                  {t('edo.compose.confirm_send_title')}
                </h2>
                <p className="text-sm text-slate-600">
                  {t('edo.compose.confirm_send_text')}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={declineSend}
                disabled={saveDraft.isPending || sendDoc.isPending}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                {t('edo.compose.confirm_send_no')}
              </button>
              <button
                type="button"
                onClick={confirmSend}
                disabled={saveDraft.isPending || sendDoc.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50"
              >
                <Send size={14} />
                {t('edo.compose.confirm_send_yes')}
              </button>
            </div>
          </div>
        </div>
      )}
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
                  <span className="text-sm font-medium text-slate-900">
                    {c.author.fullName}
                  </span>
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
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!text.trim() || sending}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
          >
            {sending ? t('common.sending') : t('edo.view.add_comment')}
          </button>
        </div>
      )}
    </section>
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
