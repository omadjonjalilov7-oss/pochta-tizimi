import { type FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Department } from '../lib/types';

export function AdminDepartmentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
  });

  if (user?.role !== 'admin') {
    return <div className="p-8 text-slate-400">{t('admin.admin_only')}</div>;
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.delete_department_confirm'))) return;
    try {
      await api.delete(`/departments/${id}`);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    } catch (err: any) {
      alert(err?.response?.data?.message || t('admin.error_delete'));
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center">
          <h1 className="text-xl font-semibold text-slate-900">{t('admin.departments_title')}</h1>
          <button
            onClick={() => setCreating(true)}
            className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-3 py-2 rounded-lg"
          >
            <Plus size={16} />
            {t('admin.add_department')}
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">{t('common.loading')}</div>
        ) : departments.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t('admin.no_departments')}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {departments.map((d) => (
              <li
                key={d.id}
                className="px-6 py-3 flex items-center hover:bg-slate-50"
              >
                <span
                  className={
                    'inline-block min-w-[64px] mr-3 px-2 py-0.5 text-xs font-mono font-semibold rounded ' +
                    (d.code
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200')
                  }
                  title={t('admin.dept_code_hint')}
                >
                  {d.code || '—'}
                </span>
                <span className="text-sm text-slate-800">{d.name}</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setEditing(d)}
                    className="p-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(creating || editing) && (
        <DepartmentModal
          department={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function DepartmentModal({
  department,
  onClose,
  onSaved,
}: {
  department: Department | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(department?.name || '');
  const [code, setCode] = useState(department?.code || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase() || null,
      };
      if (department) {
        await api.patch(`/departments/${department.id}`, payload);
      } else {
        await api.post('/departments', payload);
      }
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || t('admin.error_save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {department ? t('admin.edit_department') : t('admin.add_department')}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('admin.form_name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={255}
              autoFocus
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('admin.dept_code')}
              <span className="ml-2 text-xs text-slate-400">
                {t('admin.dept_code_hint')}
              </span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="001"
              pattern="[A-Z0-9-]{0,16}"
              maxLength={16}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold px-4 py-2 rounded-lg"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
