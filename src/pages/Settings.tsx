import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Department, OFFICIAL_ISSUE_CATEGORIES, CATEGORY_FAMILY_MAP } from '../types';
import { Users, Building2, Tag, Trash2, UserPlus, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function Settings() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'categories'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Form states
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'USER', department_id: '' });
  const [newDept, setNewDept] = useState('');
  const [newCat, setNewCat] = useState(OFFICIAL_ISSUE_CATEGORIES[0] || '');
  const pendingUsers = users.filter((user) => user.status === 'PENDING');
  const managedUsers = users.filter((user) => user.status !== 'PENDING');
  const normalizeCategoryName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  const missingOfficialCategories = OFFICIAL_ISSUE_CATEGORIES.filter(
    (officialCategory) => !categories.some((category) => normalizeCategoryName(category.name) === normalizeCategoryName(officialCategory))
  );
  const categoryFamilyEntries = OFFICIAL_ISSUE_CATEGORIES.map((officialCategory) => {
    const aliases = CATEGORY_FAMILY_MAP[officialCategory] || [];
    const relatedEntries = categories.filter((category) => {
      const normalizedName = normalizeCategoryName(category.name);
      return (
        normalizedName === normalizeCategoryName(officialCategory) ||
        aliases.some((alias) => normalizeCategoryName(alias) === normalizedName)
      );
    });

    return {
      officialCategory,
      aliases,
      relatedEntries,
    };
  });
  const otherCategories = categories.filter((category) => {
    const normalizedName = normalizeCategoryName(category.name);
    return !categoryFamilyEntries.some(
      (entry) =>
        normalizeCategoryName(entry.officialCategory) === normalizedName ||
        entry.aliases.some((alias) => normalizeCategoryName(alias) === normalizedName)
    );
  });

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'categories') return;

    if (missingOfficialCategories.length === 0) {
      if (newCat !== '') {
        setNewCat('');
      }
      return;
    }

    if (!missingOfficialCategories.includes(newCat as typeof missingOfficialCategories[number])) {
      setNewCat(missingOfficialCategories[0]);
    }
  }, [activeTab, missingOfficialCategories, newCat]);

  const fetchData = async (tab: 'users' | 'departments' | 'categories' = activeTab) => {
    setLoading(true);
    try {
      if (tab === 'users') {
        const [u, d] = await Promise.all([
          api.getUsers(),
          api.getDepartments(),
        ]);
        setUsers(u);
        setDepartments(d);
      }

      if (tab === 'departments') {
        const d = await api.getDepartments();
        setDepartments(d);
      }

      if (tab === 'categories') {
        const c = await api.getCategories();
        setCategories(c);
      }
    } catch (err) {
      console.error(err);
      showToast(`Gagal memuatkan data tab ${tab === 'users' ? 'pengguna' : tab === 'departments' ? 'jabatan' : 'kategori'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      await api.createUser({
        ...newUser,
        department_id: newUser.department_id ? Number(newUser.department_id) : null
      });
      setNewUser({ username: '', password: '', role: 'USER', department_id: '' });
      showToast('Pengguna berjaya diwujudkan');
      fetchData('users');
    } catch (err) {
      showToast('Gagal mewujudkan pengguna', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      await api.createDepartment(newDept);
      setNewDept('');
      showToast('Jabatan berjaya diwujudkan');
      fetchData('departments');
    } catch (err) {
      showToast('Gagal mewujudkan jabatan', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat) {
      showToast('Tiada kategori rasmi baharu untuk ditambah', 'error');
      return;
    }
    try {
      setIsCreating(true);
      await api.createCategory(newCat);
      setNewCat('');
      showToast('Kategori berjaya diwujudkan');
      fetchData('categories');
    } catch (err) {
      showToast('Gagal mewujudkan kategori', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Pengguna',
      message: 'Adakah anda pasti mahu menghapuskan pengguna ini?',
      isDanger: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteUser(id);
          showToast('Pengguna berjaya dihapuskan');
          fetchData('users');
        } catch (err) {
          showToast('Gagal menghapuskan pengguna', 'error');
        }
      }
    });
  };

  const handleApproveUser = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Luluskan Akaun',
      message: 'Luluskan akaun ini untuk akses sistem?',
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          await api.approveUser(id);
          showToast('Akaun berjaya diluluskan');
          fetchData('users');
        } catch (err) {
          showToast('Gagal meluluskan akaun', 'error');
        }
      }
    });
  };

  const handleRejectUser = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Tolak Permohonan Akaun',
      message: 'Tolak permohonan akaun ini?',
      isDanger: true,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          await api.rejectUser(id);
          showToast('Permohonan akaun telah ditolak');
          fetchData('users');
        } catch (err) {
          showToast('Gagal menolak permohonan akaun', 'error');
        }
      }
    });
  };

  const handleDeleteDept = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Jabatan',
      message: 'Adakah anda pasti mahu menghapuskan jabatan ini?',
      isDanger: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteDepartment(id);
          showToast('Jabatan berjaya dihapuskan');
          fetchData('departments');
        } catch (err) {
          showToast('Gagal menghapuskan jabatan', 'error');
        }
      }
    });
  };

  const handleDeleteCat = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Kategori',
      message: 'Adakah anda pasti mahu menghapuskan kategori ini?',
      isDanger: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteCategory(id);
          showToast('Kategori berjaya dihapuskan');
          fetchData('categories');
        } catch (err) {
          showToast('Gagal menghapuskan kategori', 'error');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDanger={confirmConfig.isDanger}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tetapan Sistem</h2>
          <p className="text-slate-500">Urus pengguna, permohonan akses, jabatan, dan kategori isu.</p>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'users' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={18} /> Pengguna
        </button>
        <button 
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'departments' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Building2 size={18} /> Jabatan
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'categories' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Tag size={18} /> Kategori
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-6">
            {activeTab === 'users' && (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus size={20} className="text-emerald-600" /> Tambah Pengguna Baharu
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Pengguna</label>
                  <input 
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Kata Laluan</label>
                  <input 
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Peranan</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="USER">Pengguna (Jabatan)</option>
                    <option value="ADMIN">Pentadbir (HQ)</option>
                  </select>
                </div>
                {newUser.role === 'USER' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Jabatan</label>
                    <select 
                      required
                      value={newUser.department_id}
                      onChange={(e) => setNewUser({...newUser, department_id: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Pilih Jabatan</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sedang mewujudkan...
                    </>
                  ) : (
                    'Wujudkan Pengguna'
                  )}
                </button>
              </form>
            )}

            {activeTab === 'departments' && (
              <form onSubmit={handleCreateDept} className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Building2 size={20} className="text-emerald-600" /> Tambah Jabatan
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Jabatan</label>
                  <input 
                    type="text"
                    required
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="contoh: Jabatan Teknologi Maklumat"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sedang menambah...
                    </>
                  ) : (
                    'Tambah Jabatan'
                  )}
                </button>
              </form>
            )}

            {activeTab === 'categories' && (
              <form onSubmit={handleCreateCat} className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Tag size={20} className="text-emerald-600" /> Selaras Kategori Rasmi
                </h3>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Padanan kategori database kini dikunci kepada pengelasan rasmi sistem. Kategori sejarah yang telah digunakan pada rekod lama dikekalkan untuk tujuan audit dan laporan.
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Kategori Rasmi Yang Belum Wujud</label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={missingOfficialCategories.length === 0}
                  >
                    {missingOfficialCategories.length === 0 ? (
                      <option value="">Semua kategori rasmi telah tersedia</option>
                    ) : (
                      missingOfficialCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Kategori bebas tidak lagi dibenarkan supaya nama kategori kekal seragam untuk matching database dan laporan.
                  </p>
                </div>
                <button 
                  type="submit" 
                  disabled={isCreating || missingOfficialCategories.length === 0}
                  className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sedang menambah...
                    </>
                  ) : (
                    missingOfficialCategories.length === 0 ? 'Tiada Kategori Baharu Diperlukan' : 'Tambah Kategori Rasmi'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
          {activeTab === 'users' && pendingUsers.length > 0 && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Clock3 size={20} className="text-amber-600" />
                    Permohonan Akaun Menunggu Kelulusan HQ
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">Semak dan luluskan permohonan akses pengguna jabatan baharu.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-700 ring-1 ring-amber-200">
                  {pendingUsers.length} permohonan
                </span>
              </div>
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div key={`pending-${user.id}`} className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-white p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{user.username}</p>
                      <p className="mt-1 text-sm text-slate-500">{user.department_name || 'Jabatan tidak ditetapkan'}</p>
                      {user.requested_at && (
                        <p className="mt-1 text-xs text-slate-400">
                          Dimohon pada {new Date(user.requested_at).toLocaleString('ms-MY', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleRejectUser(user.id)}
                        className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        <XCircle size={16} />
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveUser(user.id)}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={16} />
                        Luluskan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500">Sedang dimuatkan...</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-bottom border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Nama / Butiran</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Maklumat</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab === 'users' && managedUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{u.username}</div>
                        <div className="text-xs text-slate-500">{u.role} | {u.status === 'REJECTED' ? 'Ditolak' : 'Diluluskan'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{u.department_name || 'HQ / Pentadbir'}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.status === 'REJECTED' && (
                          <button
                            type="button"
                            onClick={() => handleApproveUser(u.id)}
                            className="mr-2 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            <CheckCircle2 size={16} />
                            Luluskan Semula
                          </button>
                        )}
                        {u.username !== 'admin' && (
                          <button onClick={() => handleDeleteUser(u.id)} className="text-slate-300 hover:text-red-500 p-2">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {activeTab === 'departments' && departments.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{d.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">ID: {d.id}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteDept(d.id)} className="text-slate-300 hover:text-red-500 p-2">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === 'categories' && categoryFamilyEntries.map((entry) => (
                    <tr key={`family-${entry.officialCategory}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{entry.officialCategory}</div>
                        {entry.aliases.length > 0 && (
                          <div className="mt-1 text-xs text-slate-500">
                            Termasuk kategori hampir sama: {entry.aliases.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {entry.relatedEntries.length > 0 ? (
                          <div className="space-y-1">
                            {entry.relatedEntries.map((category) => (
                              <div key={`related-${category.id}`}>
                                {category.name}
                                {normalizeCategoryName(category.name) === normalizeCategoryName(entry.officialCategory) ? ' | Kategori rasmi' : ' | Kategori sejarah berkaitan'}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span>Belum diwujudkan dalam database</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {entry.relatedEntries
                          .filter((category) => normalizeCategoryName(category.name) !== normalizeCategoryName(entry.officialCategory))
                          .map((category) => (
                            <button
                              key={`delete-${category.id}`}
                              onClick={() => handleDeleteCat(category.id)}
                              className="text-slate-300 hover:text-red-500 p-2"
                              title={`Hapus ${category.name}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          ))}
                      </td>
                    </tr>
                  ))}

                  {activeTab === 'categories' && otherCategories.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{c.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">Kategori tersendiri | ID: {c.id}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteCat(c.id)} className="text-slate-300 hover:text-red-500 p-2">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
