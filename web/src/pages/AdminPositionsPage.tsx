import { type FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Position } from '../lib/types';

export function AdminPositionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Position | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => (await api.get<Position[]>('/positions')).data,
  });

  if (user?.role !== 'admin') {
    return <div className="p-8 text-slate-400">{t('admin.admin_only')}</div>;
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.delete_position_confirm'))) return;
    try {
      await api.delete(`/positions/${id}`);
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    } catch (err: any) {
      alert(err?.response?.data?.message || t('admin.error_delete'));
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center">
          <h1 className="text-xl font-semibold text-slate-900">{t('admin.positions_title')}</h1>
          <button
            onClick={() => setCreating(true)}
            className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-3 py-2 rounded-lg"
          >
            <Plus size={16} />
            {t('admin.add_position')}
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">{t('common.loading')}</div>
        ) : positions.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t('admin.no_positions')}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {positions.map((p) => (
              <li
                key={p.id}
                className="px-6 py-3 flex items-center hover:bg-slate-50"
              >
                <span className="inline-block bg-slate-100 text-slate-600 text-xs font-mono px-2 py-0.5 rounded mr-3 w-12 text-center">
                  {p.rank}
                </span>
                <span className="text-sm text-slate-800">{p.name}</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setEditing(p)}
                    className="p-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="px-6 py-3 text-xs text-slate-400 border-t border-slate-100">
          {t('admin.rank_hint')}
        </div>
      </div>

      {(creating || editing) && (
        <PositionModal
          position={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['positions'] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PositionModal({
  position,
  onClose,
  onSaved,
}: {
  position: Position | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(position?.name || '');
  const [rank, setRank] = useState(position?.rank?.toString() || '100');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = { name: name.trim(), rank: parseInt(rank, 10) || 100 };
      if (position) {
        await api.patch(`/positions/${position.id}`, body);
      } else {
        await api.post('/positions', body);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('admin.error_save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {position ? t('admin.edit_position') : t('admin.add_position')}
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
              {t('admin.form_rank_full')}
            </label>
            <input
              type="number"
              min={1}
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
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
