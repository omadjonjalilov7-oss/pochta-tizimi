/**
 * ContactGroupsPage — foydalanuvchi kontaktlarini guruhlarga ajratish sahifasi.
 * Kiruvchi/chiquvchi xabarlarda guruh bo'yicha filtrlash va compose'da guruhlangan ko'rish uchun.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2, X, Edit2, Check, Tag } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import type { User } from '../lib/types';

// Guruh ranglari
const COLORS = [
  { label: 'Ko\'k', value: 'blue', cls: 'bg-blue-500' },
  { label: 'Yashil', value: 'green', cls: 'bg-green-500' },
  { label: 'Qizil', value: 'red', cls: 'bg-red-500' },
  { label: 'To\'q sariq', value: 'amber', cls: 'bg-amber-500' },
  { label: 'Binafsha', value: 'purple', cls: 'bg-purple-500' },
  { label: 'Moviy', value: 'sky', cls: 'bg-sky-500' },
  { label: 'Pushti', value: 'pink', cls: 'bg-pink-500' },
  { label: 'Kulrang', value: 'slate', cls: 'bg-slate-500' },
];

const colorClass = (color?: string | null) => {
  if (!color) return 'bg-brand-500';
  const found = COLORS.find((c) => c.value === color);
  return found?.cls ?? 'bg-brand-500';
};

interface ContactGroup {
  id: string;
  name: string;
  color?: string | null;
  members: Array<{ memberId: string; member: User }>;
}

export function ContactGroupsPage() {
  const qc = useQueryClient();
  const [newName, setNewName]       = useState('');
  const [newColor, setNewColor]     = useState('blue');
  const [editId, setEditId]         = useState<string | null>(null);
  const [editName, setEditName]     = useState('');
  const [editColor, setEditColor]   = useState('blue');
  const [addTarget, setAddTarget]   = useState<string | null>(null); // groupId
  const [memberSearch, setMemberSearch] = useState('');

  const { data: groups = [] } = useQuery<ContactGroup[]>({
    queryKey: ['contact-groups'],
    queryFn: async () => (await api.get('/contact-groups')).data,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['contacts'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const createGroup = useMutation({
    mutationFn: (d: { name: string; color: string }) =>
      api.post('/contact-groups', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-groups'] });
      qc.invalidateQueries({ queryKey: ['contact-group-tags'] });
      setNewName('');
    },
  });

  const updateGroup = useMutation({
    mutationFn: (d: { id: string; name: string; color: string }) =>
      api.patch(`/contact-groups/${d.id}`, { name: d.name, color: d.color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-groups'] });
      setEditId(null);
    },
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.delete(`/contact-groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-groups'] });
      qc.invalidateQueries({ queryKey: ['contact-group-tags'] });
    },
  });

  const addMember = useMutation({
    mutationFn: (d: { groupId: string; memberId: string }) =>
      api.post(`/contact-groups/${d.groupId}/members`, { memberId: d.memberId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-groups'] });
      qc.invalidateQueries({ queryKey: ['contact-group-tags'] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (d: { groupId: string; memberId: string }) =>
      api.delete(`/contact-groups/${d.groupId}/members/${d.memberId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-groups'] });
      qc.invalidateQueries({ queryKey: ['contact-group-tags'] });
    },
  });

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createGroup.mutate({ name, color: newColor });
  };

  const handleUpdate = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    updateGroup.mutate({ id, name, color: editColor });
  };

  // A'zo qo'shish uchun filtrlangan foydalanuvchilar
  const targetGroup = groups.find((g) => g.id === addTarget);
  const existingIds = new Set(targetGroup?.members.map((m) => m.memberId) ?? []);
  const candidates = allUsers
    .filter(
      (u) =>
        u.isActive &&
        !existingIds.has(u.id) &&
        (memberSearch
          ? u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
            u.login.toLowerCase().includes(memberSearch.toLowerCase())
          : true),
    )
    .slice(0, 30);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Tag size={24} className="text-brand-600" />
        <h1 className="text-xl font-bold text-slate-900">Kontakt guruhlari</h1>
      </div>

      {/* ── Yangi guruh yaratish ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="text-sm font-semibold text-slate-700 mb-3">Yangi guruh</div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Guruh nomi (masalan: Rahbarlar)"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
          />
          {/* Rang tanlash */}
          <div className="flex gap-1">
            {COLORS.slice(0, 5).map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setNewColor(c.value)}
                title={c.label}
                className={`w-6 h-6 rounded-full ${c.cls} transition-transform ${newColor === c.value ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || createGroup.isPending}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            Yaratish
          </button>
        </div>
      </div>

      {/* ── Guruhlar ro'yxati ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {groups.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Users size={48} className="mx-auto mb-3 text-slate-200" />
            <div className="text-sm">Guruhlar hali yaratilmagan</div>
          </div>
        )}
        {groups.map((group) => (
          <div
            key={group.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            {/* Guruh sarlavhasi */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <div className={`w-3 h-3 rounded-full ${colorClass(group.color)} shrink-0`} />
              {editId === group.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-brand-400"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    {COLORS.slice(0, 5).map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setEditColor(c.value)}
                        title={c.label}
                        className={`w-5 h-5 rounded-full ${c.cls} ${editColor === c.value ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdate(group.id)}
                    className="p-1 rounded hover:bg-green-50 text-green-600"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-slate-800 flex-1">{group.name}</span>
                  <span className="text-xs text-slate-400">{group.members.length} a'zo</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(group.id);
                      setEditName(group.name);
                      setEditColor(group.color ?? 'blue');
                    }}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                    title="Tahrirlash"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`"${group.name}" guruhini o'chirasizmi?`)) {
                        deleteGroup.mutate(group.id);
                      }
                    }}
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                    title="O'chirish"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>

            {/* A'zolar */}
            <div className="px-4 py-3">
              {group.members.length === 0 && (
                <div className="text-xs text-slate-400 mb-2">Guruhda hozircha hech kim yo'q</div>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {group.members.map((m) => (
                  <div
                    key={m.memberId}
                    className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2 py-1 text-xs text-slate-700"
                  >
                    <Avatar
                      fullName={m.member.fullName}
                      avatarPath={m.member.avatarPath}
                      size="sm"
                    />
                    {m.member.fullName}
                    <button
                      type="button"
                      onClick={() =>
                        removeMember.mutate({ groupId: group.id, memberId: m.memberId })
                      }
                      className="hover:text-red-600 ml-0.5"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>

              {/* A'zo qo'shish */}
              {addTarget === group.id ? (
                <div className="mt-2">
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Ism yoki login bo'yicha qidirish..."
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-brand-400 mb-2"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {candidates.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          addMember.mutate({ groupId: group.id, memberId: u.id });
                          setMemberSearch('');
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand-50 text-left text-sm"
                      >
                        <Avatar fullName={u.fullName} avatarPath={u.avatarPath} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 truncate">{u.fullName}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {u.position?.name}
                            {u.department?.name && ` • ${u.department.name}`}
                          </div>
                        </div>
                        <Plus size={14} className="text-brand-500 shrink-0" />
                      </button>
                    ))}
                    {candidates.length === 0 && (
                      <div className="text-xs text-slate-400 py-2 text-center">
                        Topilmadi yoki hammasi qo'shilgan
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAddTarget(null);
                      setMemberSearch('');
                    }}
                    className="mt-2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    Yopish
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAddTarget(group.id);
                    setMemberSearch('');
                  }}
                  className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  <Plus size={13} />
                  A'zo qo'shish
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
