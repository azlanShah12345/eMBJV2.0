import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Department } from '../types';
import { Users, Building2, Tag, Plus, Trash2, Shield, UserPlus } from 'lucide-react';
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
  const [newCat, setNewCat] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, d, c] = await Promise.all([
        api.getUsers(),
        api.getDepartments(),
        api.getCategories()
      ]);
      setUsers(u);
      setDepartments(d);
      setCategories(c);
    } catch (err) {
      console.error(err);
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
      showToast('User created successfully');
      fetchData();
    } catch (err) {
      showToast('Failed to create user', 'error');
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
      fetchData();
    } catch (err) {
      showToast('Gagal mewujudkan jabatan', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      await api.createCategory(newCat);
      setNewCat('');
      showToast('Kategori berjaya diwujudkan');
      fetchData();
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
          showToast('User deleted successfully');
          fetchData();
        } catch (err) {
          showToast('Failed to delete user', 'error');
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
          fetchData();
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
          fetchData();
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
          <p className="text-slate-500">Urus pengguna, jabatan, dan kategori isu.</p>
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
                  <Tag size={20} className="text-emerald-600" /> Tambah Kategori
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Kategori</label>
                  <input 
                    type="text"
                    required
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Kebajikan"
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
                    'Tambah Kategori'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
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
                  {activeTab === 'users' && users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{u.username}</div>
                        <div className="text-xs text-slate-500">{u.role}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{u.department_name || 'HQ / Pentadbir'}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
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

                  {activeTab === 'categories' && categories.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{c.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">ID: {c.id}</td>
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
