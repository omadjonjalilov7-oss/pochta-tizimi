import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Paperclip, Trash2, Archive, Reply, Download } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { formatDateTime, formatBytes } from '../lib/utils';

const IMPORTANCE_BADGE: Record<string, { label: string; className: string }> = {
  normal: { label: 'Oddiy', className: 'bg-slate-100 text-slate-600' },
  important: { label: 'Muhim', className: 'bg-amber-100 text-amber-700' },
  urgent: { label: 'Juda muhim', className: 'bg-red-100 text-red-700' },
};

export function MessageViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  if (isLoading) {
    return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;
  }
  if (!item) {
    return <div className="p-8 text-slate-400">Xabar topilmadi</div>;
  }

  const m = item.message;
  const importance = IMPORTANCE_BADGE[m.importance] || IMPORTANCE_BADGE.normal;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft size={16} />
          Orqaga
        </button>
        <div className="flex-1" />
        <Link
          to={`/compose?reply=${m.id}`}
          className="flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 px-3 py-1.5 rounded-lg hover:bg-brand-50"
        >
          <Reply size={16} />
          Javob yozish
        </Link>
        <button
          onClick={() => moveTo('archive')}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100"
        >
          <Archive size={16} />
          Arxivga
        </button>
        <button
          onClick={() => moveTo('trash')}
          className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          <Trash2 size={16} />
          O'chirish
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{m.subject}</h1>
        <span
          className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${importance.className}`}
        >
          {importance.label}
        </span>

        <div className="mt-6 pb-6 border-b border-slate-100 flex items-start gap-4">
          <Avatar fullName={m.fromUser?.fullName || '??'} avatarPath={m.fromUser?.avatarPath} size="lg" />
          <div className="flex-1">
            <div className="font-semibold text-slate-900">
              {m.fromUser?.fullName}
            </div>
            <div className="text-sm text-slate-500">
              {m.fromUser?.position?.name}
              {m.fromUser?.department?.name && (
                <> • {m.fromUser.department.name}</>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {formatDateTime(m.sentAt)}
            </div>
            {(() => {
              const toList = (m.recipients || []).filter((r: any) => r.kind !== 'cc');
              const ccList = (m.recipients || []).filter((r: any) => r.kind === 'cc');
              return (
                <>
                  {toList.length > 0 && (
                    <div className="text-xs text-slate-500 mt-2">
                      <span className="font-medium">Kimga:</span>{' '}
                      {toList.map((r: any) => r.user.fullName).join(', ')}
                    </div>
                  )}
                  {ccList.length > 0 && (
                    <div className="text-xs text-slate-500 mt-1">
                      <span className="font-medium">Nusxa:</span>{' '}
                      {ccList.map((r: any) => r.user.fullName).join(', ')}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <div
          className="mt-6 prose prose-slate max-w-none whitespace-pre-wrap"
          style={{ wordBreak: 'break-word' }}
        >
          {m.body}
        </div>

        {m.attachments && m.attachments.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Paperclip size={16} />
              Biriktirilgan fayllar ({m.attachments.length})
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
    </div>
  );
}
