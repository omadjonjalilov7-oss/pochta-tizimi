import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BookText, Plus, Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { Journal } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';

const JOURNAL_KINDS = ['general', 'incoming', 'outgoing', 'internal'] as const;

interface JournalForm {
  name: string;
  prefix: string;
  kind: string;
  seq: string;
}

const EMPTY: JournalForm = { name: '', prefix: '', kind: 'general', seq: '0' };

export function EdoJurnalPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [form, setForm] = useState<JournalForm>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: journals = [], isLoading } = useQuery({
    queryKey: ['journals'],
    queryFn: async () => (await api.get<Journal[]>('/journals')).data,
  });

  const reset = () => {
    setForm(EMPTY);
    setEditId(null);
    setError(null);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['journals'] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        prefix: form.prefix.trim() || undefined,
        kind: form.kind,
        seq: Number(form.seq) || 0,
      };
      if (editId) return (await api.patch(`/journals/${editId}`, payload)).data;
      return (await api.post('/journals', payload)).data;
    },
    onSuccess: () => {
      invalidate();
      reset();
    },
    onError: (e: any) => setError(extractError(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/journals/${id}`),
    onSuccess: invalidate,
    onError: (e: any) => setError(extractError(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) {
      setError(t('edo.jurnal.err_name'));
      return;
    }
    save.mutate();
  };

  const startEdit = (j: Journal) => {
    setEditId(j.id);
    setForm({ name: j.name, prefix: j.prefix ?? '', kind: j.kind, seq: String(j.seq) });
    setError(null);
  };

  const fieldCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-asaka-50 text-asaka-600 flex items-center justify-center">
          <BookText size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('edo.jurnal.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('edo.jurnal.subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Yaratish / tahrirlash formasi (faqat admin) */}
      {isAdmin && (
        <form
          onSubmit={submit}
          className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div>
            <label className={labelCls}>{t('edo.jurnal.col_name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={255}
              className={fieldCls}
              placeholder={t('edo.jurnal.ph_name')}
            />
          </div>
          <div>
            <label className={labelCls}>{t('edo.jurnal.col_prefix')}</label>
            <input
              type="text"
              value={form.prefix}
              onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
              maxLength={32}
              className={fieldCls}
              placeholder={t('edo.jurnal.ph_prefix')}
            />
          </div>
          <div>
            <label className={labelCls}>{t('edo.jurnal.col_kind')}</label>
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              className={fieldCls}
            >
              {JOURNAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`edo.jurnal.kind_${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('edo.jurnal.col_seq')}</label>
            <input
              type="number"
              min={0}
              value={form.seq}
              onChange={(e) => setForm((f) => ({ ...f, seq: e.target.value }))}
              className={fieldCls}
            />
          </div>
          <div className="md:col-span-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-2 bg-asaka-600 hover:bg-asaka-700 text-white font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {save.isPending ? <Loader2 size={15} className="animate-spin" /> : editId ? <Save size={15} /> : <Plus size={15} />}
              {editId ? t('edo.jurnal.btn_update') : t('edo.jurnal.btn_add')}
            </button>
            {editId && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X size={15} />
                {t('edo.jurnal.btn_cancel')}
              </button>
            )}
          </div>
        </form>
      )}

      {/* Jurnallar ro'yxati */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">{t('edo.jurnal.list_title')}</span>
          <span className="text-xs text-slate-500">{t('edo.jurnal.total', { count: journals.length })}</span>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">{t('common.loading')}</div>
        ) : journals.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">{t('edo.jurnal.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2 w-12">{t('edo.jurnal.col_seq')}</th>
                  <th className="px-4 py-2">{t('edo.jurnal.col_name')}</th>
                  <th className="px-4 py-2">{t('edo.jurnal.col_prefix')}</th>
                  <th className="px-4 py-2">{t('edo.jurnal.col_kind')}</th>
                  {isAdmin && <th className="px-4 py-2 text-right">{t('edo.jurnal.col_actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {journals.map((j) => (
                  <tr key={j.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2 text-slate-400">{j.seq}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{j.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{j.prefix || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{t(`edo.jurnal.kind_${j.kind}`, j.kind)}</td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => startEdit(j)}
                          title={t('edo.jurnal.btn_update')}
                          className="inline-flex items-center p-1.5 text-slate-400 hover:text-asaka-700 rounded-md hover:bg-slate-100"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('edo.jurnal.confirm_delete'))) del.mutate(j.id);
                          }}
                          disabled={del.isPending}
                          title={t('edo.jurnal.btn_delete')}
                          className="inline-flex items-center p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function extractError(e: any): string {
  const msg = e?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : msg || e?.message || 'Xatolik';
}
