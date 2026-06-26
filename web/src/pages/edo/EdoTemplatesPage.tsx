import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Pencil, Trash2, X, Globe, User as UserIcon, Search } from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoTemplate } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface FormState {
  id?: string;
  name: string;
  category: string;
  bodyTemplate: string;
  isShared: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  bodyTemplate: '',
  isShared: true,
};

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function extractPlaceholders(body: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(body)) !== null) {
    set.add(m[1]);
  }
  return Array.from(set);
}

export function EdoTemplatesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['edo-templates'],
    queryFn: async () => (await api.get<EdoTemplate[]>('/templates')).data,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const grouped = useMemo(() => {
    const m = new Map<string, EdoTemplate[]>();
    for (const tpl of filtered) {
      const key = tpl.category || '—';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(tpl);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const save = useMutation({
    mutationFn: async (form: FormState) => {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        bodyTemplate: form.bodyTemplate,
        isShared: form.isShared,
      };
      if (form.id) {
        return (await api.patch<EdoTemplate>(`/templates/${form.id}`, payload)).data;
      }
      return (await api.post<EdoTemplate>('/templates', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edo-templates'] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['edo-templates'] }),
  });

  const canEdit = (tpl: EdoTemplate) =>
    !!user && (user.isAdmin || tpl.createdById === user.id);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-xl font-semibold text-slate-900">{t('edo.templates.title')}</h1>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('edo.templates.search_ph')}
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-64 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
          />
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY_FORM })}
          className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-medium px-3 py-1.5 rounded-lg text-sm"
        >
          <Plus size={16} />
          {t('edo.templates.add')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 p-6">{t('common.loading')}</div>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <FileText size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">{t('edo.templates.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {category}
              </div>
              <div className="space-y-2">
                {items.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-brand-300 transition flex items-start gap-3"
                  >
                    <div className="bg-brand-50 text-brand-600 rounded-lg p-2 mt-0.5">
                      <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900 truncate">{tpl.name}</span>
                        <span
                          className={cn(
                            'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded inline-flex items-center gap-1',
                            tpl.isShared
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {tpl.isShared ? <Globe size={10} /> : <UserIcon size={10} />}
                          {tpl.isShared ? t('edo.templates.shared') : t('edo.templates.personal')}
                        </span>
                        {tpl.placeholders.length > 0 && (
                          <span className="text-xs text-slate-500">
                            {t('edo.templates.placeholder_count', { count: tpl.placeholders.length })}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t('edo.templates.author')}: {tpl.createdBy.fullName}
                      </div>
                      {tpl.placeholders.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tpl.placeholders.map((p) => (
                            <span
                              key={p}
                              className="font-mono text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded"
                            >
                              {`{{${p}}}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {canEdit(tpl) && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() =>
                            setEditing({
                              id: tpl.id,
                              name: tpl.name,
                              category: tpl.category,
                              bodyTemplate: tpl.bodyTemplate,
                              isShared: tpl.isShared,
                            })
                          }
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                          title={t('common.edit')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('edo.templates.delete_confirm'))) remove.mutate(tpl.id);
                          }}
                          className="p-1.5 rounded hover:bg-red-50 text-red-600"
                          title={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateFormModal
          form={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => save.mutate(editing)}
          saving={save.isPending}
          error={save.error ? extractErr(save.error) : null}
        />
      )}
    </div>
  );
}

function TemplateFormModal({
  form,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  form: FormState;
  onChange: (f: FormState) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const placeholders = extractPlaceholders(form.bodyTemplate);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {form.id ? t('edo.templates.edit_title') : t('edo.templates.new_title')}
          </h2>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('edo.templates.f_name')}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              maxLength={255}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('edo.templates.f_category')}
            </label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value })}
              maxLength={64}
              placeholder={t('edo.templates.category_ph')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('edo.templates.f_body')}
              <span className="ml-2 text-xs text-slate-400">{t('edo.templates.body_hint')}</span>
            </label>
            <textarea
              value={form.bodyTemplate}
              onChange={(e) => onChange({ ...form, bodyTemplate: e.target.value })}
              rows={12}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none font-sans"
            />
            {placeholders.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {placeholders.map((p) => (
                  <span
                    key={p}
                    className="font-mono text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded"
                  >
                    {`{{${p}}}`}
                  </span>
                ))}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={form.isShared}
              onChange={(e) => onChange({ ...form, isShared: e.target.checked })}
              className="h-4 w-4 accent-brand-600"
            />
            {t('edo.templates.is_shared')}
          </label>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim() || !form.category.trim() || !form.bodyTemplate.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function extractErr(e: any): string {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || e?.message || 'Xatolik';
}
