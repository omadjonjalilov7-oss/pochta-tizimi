import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Paperclip, Trash2, Archive, Reply, Download, Undo2, Eye, X, Check, Clock, Mail, Forward, Users } from 'lucide-react';
import DOMPurify from 'dompurify';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { formatDateTime, formatBytes, senderDisplayName, senderSubLine } from '../lib/utils';

const IMPORTANCE_BADGE: Record<string, { i18nKey: string; className: string }> = {
  normal: { i18nKey: 'importance.normal', className: 'bg-slate-100 text-slate-600' },
  important: { i18nKey: 'importance.important', className: 'bg-amber-100 text-amber-700' },
  urgent: { i18nKey: 'importance.urgent', className: 'bg-red-100 text-red-700' },
};

export function MessageViewPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showReadStatus, setShowReadStatus] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ['message', id],
    queryFn: async () => (await api.get(`/messages/${id}`)).data,
    enabled: !!id,
  });

  // O'qildi deb belgilash
  useEffect(() => {
    if (!item || item.isRead || item.folder !== 'inbox') return;
    api
      .patch(`/messages/${item.messageId}/read`)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['messages'] });
      })
      .catch(() => {});
  }, [item, queryClient]);

  const moveTo = async (folder: 'trash' | 'archive') => {
    await api.patch(`/messages/${item.messageId}/move/${folder}`);
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    navigate('/inbox');
  };

  const recall = async () => {
    const ok = window.confirm(t('message.recall_long_confirm'));
    if (!ok) return;
    try {
      const { data } = await api.delete(`/messages/${item.messageId}/recall`);
      const recalledCount = data.recalledFrom?.length || 0;
      const keptCount = data.keptFor?.length || 0;
      let msg = t('message.recall_success');
      if (recalledCount > 0) msg += '\n' + t('message.recall_recalled_from', { count: recalledCount });
      if (keptCount > 0) msg += '\n' + t('message.recall_kept_for', { count: keptCount });
      window.alert(msg);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['message', id] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    } catch (e: any) {
      window.alert(e?.response?.data?.message || t('message.recall_error'));
    }
  };

  if (isLoading) {
    return <div className="p-8 text-slate-400">{t('common.loading')}</div>;
  }
  if (!item) {
    return <div className="p-8 text-slate-400">{t('message.not_found')}</div>;
  }

  const m = item.message;
  const importance = IMPORTANCE_BADGE[m.importance] || IMPORTANCE_BADGE.normal;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 px-4 py-2 rounded-full bg-gradient-to-b from-white to-slate-50 border border-slate-200 shadow-sm hover:shadow-md hover:from-white hover:to-white hover:border-slate-300 active:shadow-inner active:translate-y-px transition-all duration-200"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>
        <div className="flex-1" />
        {item.folder !== 'sent' && (
          <>
            <Link
              to={`/compose?reply=${m.id}`}
              className="flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 px-4 py-2 rounded-full bg-gradient-to-b from-white to-brand-50 border border-brand-200 shadow-sm hover:shadow-md hover:from-white hover:to-brand-100 hover:border-brand-300 active:shadow-inner active:translate-y-px transition-all duration-200"
            >
              <Reply size={16} />
              {t('message.reply')}
            </Link>
            {/* Barchaga javob (reply all) */}
            <Link
              to={`/compose?replyAll=${m.id}`}
              className="flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 px-4 py-2 rounded-full bg-gradient-to-b from-white to-brand-50 border border-brand-200 shadow-sm hover:shadow-md hover:from-white hover:to-brand-100 hover:border-brand-300 active:shadow-inner active:translate-y-px transition-all duration-200"
              title={t('message.reply_all')}
            >
              <Users size={14} />
              <Reply size={16} />
              {t('message.reply_all')}
            </Link>
            {/* Peresylka (forward) */}
            <Link
              to={`/compose?forward=${m.id}`}
              className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 px-4 py-2 rounded-full bg-gradient-to-b from-white to-slate-50 border border-slate-200 shadow-sm hover:shadow-md hover:from-white hover:to-white hover:border-slate-300 active:shadow-inner active:translate-y-px transition-all duration-200"
            >
              <Forward size={16} />
              {t('message.forward')}
            </Link>
          </>
        )}
        {item.folder === 'sent' && (
          <button
            onClick={() => setShowReadStatus(true)}
            className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 px-4 py-2 rounded-full bg-gradient-to-b from-white to-emerald-50 border border-emerald-200 shadow-sm hover:shadow-md hover:from-white hover:to-emerald-100 hover:border-emerald-300 active:shadow-inner active:translate-y-px transition-all duration-200"
          >
            <Eye size={16} />
            {t('message.show_readers')}
          </button>
        )}
        {item.folder === 'sent' && !m.recalledAt && (
          <button
            onClick={recall}
            className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-800 px-4 py-2 rounded-full bg-gradient-to-b from-white to-amber-50 border border-amber-200 shadow-sm hover:shadow-md hover:from-white hover:to-amber-100 hover:border-amber-300 active:shadow-inner active:translate-y-px transition-all duration-200"
          >
            <Undo2 size={16} />
            {t('message.recall')}
          </button>
        )}
        <button
          onClick={() => moveTo('archive')}
          className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 px-4 py-2 rounded-full bg-gradient-to-b from-white to-slate-50 border border-slate-200 shadow-sm hover:shadow-md hover:from-white hover:to-white hover:border-slate-300 active:shadow-inner active:translate-y-px transition-all duration-200"
        >
          <Archive size={16} />
          {t('message.to_archive')}
        </button>
        <button
          onClick={() => moveTo('trash')}
          className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 px-4 py-2 rounded-full bg-gradient-to-b from-white to-red-50 border border-red-200 shadow-sm hover:shadow-md hover:from-white hover:to-red-100 hover:border-red-300 active:shadow-inner active:translate-y-px transition-all duration-200"
        >
          <Trash2 size={16} />
          {t('common.delete')}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {m.recalledAt && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <Undo2 size={16} />
            <span className="font-semibold">{t('message.recalled_message_label')}</span>
            <span className="text-amber-600">— {formatDateTime(m.recalledAt)}</span>
          </div>
        )}
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{m.subject}</h1>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${importance.className}`}
          >
            {t(importance.i18nKey)}
          </span>
          {m.recalledAt && item.folder === 'sent' && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
              {t('message.recalled_badge')}
            </span>
          )}
        </div>

        <div className="mt-6 pb-6 border-b border-slate-100 flex items-start gap-4">
          <Avatar
            fullName={senderDisplayName(m) || '??'}
            avatarPath={m.fromUser?.avatarPath}
            size="lg"
          />
          <div className="flex-1">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              {senderDisplayName(m)}
              {m.isExternal && (
                <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 uppercase tracking-wide">
                  {t('message.external_badge')}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-500">{senderSubLine(m)}</div>
            <div className="text-xs text-slate-400 mt-1">
              {formatDateTime(m.sentAt)}
            </div>
            {(() => {
              const toList = (m.recipients || []).filter((r: any) => r.kind !== 'cc');
              const ccList = (m.recipients || []).filter((r: any) => r.kind === 'cc');
              const externalToList = m.externalToEmails || [];
              const externalCcList = m.externalCcEmails || [];
              return (
                <>
                  {(toList.length > 0 || externalToList.length > 0) && (
                    <div className="text-xs text-slate-500 mt-2">
                      <span className="font-medium">{t('message.to')}:</span>{' '}
                      {[
                        ...toList.map((r: any) => r.user.fullName),
                        ...externalToList
                      ].join(', ')}
                    </div>
                  )}
                  {(ccList.length > 0 || externalCcList.length > 0) && (
                    <div className="text-xs text-slate-500 mt-1">
                      <span className="font-medium">{t('message.cc')}:</span>{' '}
                      {[
                        ...ccList.map((r: any) => r.user.fullName),
                        ...externalCcList
                      ].join(', ')}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <ExternalSafeBody body={m.body} isExternal={m.isExternal} />

        {m.attachments && m.attachments.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Paperclip size={16} />
              {t('compose.attachments', { count: m.attachments.length })}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {m.attachments.map((a: any) => (
                <a
                  key={a.id}
                  href={`/api/attachments/${a.id}/download`}
                  onClick={async (e) => {
                    e.preventDefault();
                    const res = await api.get(`/attachments/${a.id}/download`, {
                      responseType: 'blob',
                    });
                    const url = URL.createObjectURL(res.data);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = a.filename;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition group"
                >
                  <Paperclip size={20} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">
                      {a.filename}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatBytes(Number(a.sizeBytes))}
                    </div>
                  </div>
                  <Download size={16} className="text-slate-400 group-hover:text-brand-600" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {showReadStatus && (
        <ReadStatusModal messageId={item.messageId} onClose={() => setShowReadStatus(false)} />
      )}
    </div>
  );
}

/** HTML matn ekanligini tekshirish (oddiy matndan farqlash uchun) */
function looksLikeHtml(s: string) {
  return /<[a-zA-Z][\s\S]*?>/.test(s);
}

/**
 * Xabar matnini xavfsiz ko'rsatish:
 * - Tashqi xabarlar: DOMPurify (style attribyuti taqiqlangan)
 * - Ichki HTML xabarlar (rich editor): DOMPurify (style ruxsat berilgan — o'z foydalanuvchilarimiz)
 * - Ichki oddiy matn (eski xabarlar): whitespace-pre-wrap + linkify
 */
function ExternalSafeBody({ body, isExternal }: { body: string; isExternal: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isHtmlBody = useMemo(() => looksLikeHtml(body), [body]);

  const cleanHtml = useMemo(() => {
    if (!isExternal && !isHtmlBody) return '';
    if (isExternal) {
      // Tashqi xabar — style taqiqlangan (CSS injection xavfi bor)
      return DOMPurify.sanitize(body, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'style'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|cid):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      });
    }
    // Ichki HTML xabar — style ruxsat berilgan (shrift, rang, hizalama uchun)
    return DOMPurify.sanitize(body, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
    });
  }, [body, isExternal, isHtmlBody]);

  // Body ichidagi har qanday <a> tagiga bosishni qo'lda boshqaramiz:
  //  - shu origin (masalan /edo/...) → react-router orqali SPA navigatsiya, sahifa qayta yuklanmaydi
  //  - boshqa origin → yangi tab'da ochiladi (app state buzilmaydi)
  //  - <Link> komponenti allaqachon preventDefault qilgan bo'lsa, biz hech narsa qilmaymiz
  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let el: HTMLElement | null = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      if (el.tagName === 'A') {
        const href = (el as HTMLAnchorElement).getAttribute('href');
        if (!href) return;
        // mailto:, tel:, cid: va ?-fragment linklarni brauzerga qoldiramiz
        if (/^(mailto:|tel:|cid:|#)/i.test(href)) return;
        try {
          const u = new URL(href, window.location.href);
          if (u.origin === window.location.origin) {
            e.preventDefault();
            navigate(u.pathname + u.search + u.hash);
          } else {
            e.preventDefault();
            window.open(href, '_blank', 'noopener,noreferrer');
          }
        } catch {
          // noto'g'ri URL — brauzer tabiiy holatda ishlasin
        }
        return;
      }
      el = el.parentElement;
    }
  };

  // HTML ko'rinishida render qilish kerakmi? (tashqi YOKI ichki HTML)
  if (isExternal || isHtmlBody) {
    return (
      <div className="mt-6">
        {isExternal && (
          <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400" />
            {t('message.external_html_note')}
          </div>
        )}
        <div
          className="prose prose-slate max-w-none rounded-xl border border-slate-200 bg-slate-50/50 p-5 [&_a]:cursor-pointer [&_a]:text-brand-700 [&_a]:underline"
          style={{ wordBreak: 'break-word' }}
          onClick={handleBodyClick}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      </div>
    );
  }

  // Oddiy matn (eski, HTML bo'lmagan xabarlar)
  return (
    <div
      className="mt-6 prose prose-slate max-w-none whitespace-pre-wrap"
      style={{ wordBreak: 'break-word' }}
      onClick={handleBodyClick}
    >
      {linkifyBody(body)}
    </div>
  );
}

// URL'larni avtomatik link'ga aylantirish.
// Aniqlanadigan formatlar:
//   - http://... / https://...
//   - www.example.com/...      (avtomatik http:// qo'shamiz)
//   - localhost:5173/...       (avtomatik http:// qo'shamiz)
//   - /edo/documents/... yoki /inbox kabi nisbatan-yo'l (joriy origin sifatida)
// Yo'l oxiridagi tinish belgilarini (.,;:!?) URL'dan chiqarib tashlaymiz.
function linkifyBody(text: string): React.ReactNode[] {
  const urlRegex =
    /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|localhost:\d+\/[^\s<>"']*|\/(?:edo|inbox|sent|drafts|archive|trash|starred|admin|profile|messages|tasks|documents)(?:\/[^\s<>"']*)?)/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = urlRegex.exec(text)) !== null) {
    let rawUrl = match[0];
    const start = match.index;

    // Oxiridagi tinish belgilarni (.,;:!?) va yopiluvchi qavslarni URL'dan ajratib olamiz
    let trailing = '';
    while (rawUrl.length > 0 && /[.,;:!?)\]}'"`]$/.test(rawUrl)) {
      trailing = rawUrl[rawUrl.length - 1] + trailing;
      rawUrl = rawUrl.slice(0, -1);
    }
    if (!rawUrl) {
      parts.push(text.slice(start, start + match[0].length));
      lastIndex = start + match[0].length;
      continue;
    }

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    // Brauzer uchun to'liq URL tayyorlaymiz (www. / localhost: / / kabi formatlarga prefiks)
    let href = rawUrl;
    if (/^www\./i.test(rawUrl)) href = `http://${rawUrl}`;
    else if (/^localhost:/i.test(rawUrl)) href = `http://${rawUrl}`;

    try {
      const u = new URL(href, window.location.origin);
      if (u.origin === window.location.origin) {
        const path = u.pathname + u.search + u.hash;
        parts.push(
          <Link
            key={`l-${key++}`}
            to={path}
            className="text-brand-700 hover:text-brand-800 underline decoration-brand-300 hover:decoration-brand-500 break-all"
          >
            {rawUrl}
          </Link>,
        );
      } else {
        parts.push(
          <a
            key={`l-${key++}`}
            href={u.toString()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 hover:text-brand-800 underline decoration-brand-300 hover:decoration-brand-500 break-all"
          >
            {rawUrl}
          </a>,
        );
      }
    } catch {
      parts.push(rawUrl);
    }

    if (trailing) parts.push(trailing);
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function ReadStatusModal({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['read-status', messageId],
    queryFn: async () => (await api.get(`/messages/${messageId}/read-status`)).data,
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('read_status.title')}</h2>
            {data && (
              <div className="text-xs text-slate-500 mt-0.5">
                {t('read_status.summary', { read: data.readCount, total: data.total })}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {isLoading ? (
            <div className="p-6 text-center text-slate-400">{t('common.loading')}</div>
          ) : !data || (data.recipients.length === 0 && (!data.externalRecipients || data.externalRecipients.length === 0)) ? (
            <div className="p-6 text-center text-slate-400">{t('read_status.empty')}</div>
          ) : (
            <>
              {data.recipients.length > 0 && (
                <ul className="space-y-1">
                  {data.recipients.map((r: any) => (
                    <li
                      key={r.user.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50"
                    >
                      <Avatar fullName={r.user.fullName} avatarPath={r.user.avatarPath} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                          {r.user.fullName}
                          {r.kind === 'cc' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              {t('read_status.cc_label')}
                            </span>
                          )}
                        </div>
                        {r.user.position?.name && (
                          <div className="text-xs text-slate-500 truncate">{r.user.position.name}</div>
                        )}
                      </div>
                      {r.isRead ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
                          <Check size={14} />
                          <span>{r.readAt ? formatDateTime(r.readAt) : t('read_status.read')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                          <Clock size={14} />
                          <span>{t('read_status.unread')}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {data.externalRecipients && data.externalRecipients.length > 0 && (
                <>
                  <div className="px-3 py-2 mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wide border-t border-slate-100">
                    {t('read_status.external_section')}
                  </div>
                  <ul className="space-y-1">
                    {data.externalRecipients.map((r: any) => (
                      <li
                        key={r.email}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                          <Mail size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                            {r.email}
                            {r.kind === 'cc' && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                {t('read_status.cc_label')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {t('read_status.external_label')}
                          </div>
                        </div>
                        {r.isRead ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
                              <Check size={14} />
                              <span>{r.readAt ? formatDateTime(r.readAt) : t('read_status.read')}</span>
                            </div>
                            {r.readMethod && (
                              <div className="text-[10px] text-emerald-600 italic">
                                {r.readMethod === 'pixel' && '📍 tracking pixel'}
                                {r.readMethod === 'link' && '🔗 confirmation link'}
                                {r.readMethod === 'imap' && '📧 mailbox sync'}
                                {r.readMethod === 'header' && '📬 read receipt'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <Clock size={14} />
                            <span>{t('read_status.unread')}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
