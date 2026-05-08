import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { formatDateTime } from '../lib/utils';
import { api } from '../lib/api';
import type { User } from '../lib/types';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be re-selected
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<User>('/users/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Yuklashda xatolik');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Profil rasmini o\'chirishni xohlaysizmi?')) return;
    setError(null);
    setUploading(true);
    try {
      const { data } = await api.delete<User>('/users/me/avatar');
      setUser(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'O\'chirishda xatolik');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-5 pb-6 border-b border-slate-100">
          <div className="relative group">
            <Avatar fullName={user.fullName} avatarPath={user.avatarPath} size="lg" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              title="Rasmni o'zgartirish"
            >
              <Camera size={22} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFilePick}
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{user.fullName}</h1>
            <p className="text-slate-500">
              {user.position?.name}
              {user.department?.name && ` • ${user.department.name}`}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-brand-700 hover:text-brand-800 font-medium disabled:opacity-50"
              >
                <Camera size={14} />
                {uploading ? 'Yuklanmoqda...' : 'Rasmni yuklash'}
              </button>
              {user.avatarPath && (
                <button
                  onClick={handleDelete}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  O'chirish
                </button>
              )}
            </div>
            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            <div className="mt-1 text-xs text-slate-400">
              JPG, PNG, WEBP yoki GIF, 5 MB gacha
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Login" value={user.login} />
          <Field label="Email" value={user.email || '—'} />
          <Field label="Telefon" value={user.phone || '—'} />
          <Field
            label="Tashqi pochta ruxsati"
            value={user.canSendExternal ? 'Ha' : 'Yo\'q'}
          />
          <Field
            label="Oxirgi kirgan vaqt"
            value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
          />
          <Field
            label="Akkaunt yaratilgan"
            value={formatDateTime(user.createdAt)}
          />
          {user.isAdmin && (
            <Field
              label="Huquq"
              value={
                <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-2 py-0.5 rounded">
                  Administrator
                </span>
              }
            />
          )}
        </dl>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  );
}
