import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Issue, CATEGORIES, User } from '../types';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Circle, Lock, Download, FileText, XCircle, AlertTriangle, X } from 'lucide-react';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

interface MeetingDetailsProps {
  user: User;
}

export default function MeetingDetails({ user }: MeetingDetailsProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [meeting, setMeeting] = useState<any>(null);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAddingIssue, setIsAddingIssue] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

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

  // New Issue Form
  const [newIssue, setNewIssue] = useState({
    category: '',
    is_from_previous: false,
    title: '',
    status: 'Belum Selesai' as const,
    responsible_officer: ''
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [meetingData, issuesData, categoriesData] = await Promise.all([
        api.getMeeting(Number(id)),
        api.getIssues(Number(id)),
        api.getCategories()
      ]);
      setMeeting(meetingData);
      setIssues(issuesData);
      setCategories(categoriesData);
      if (categoriesData.length > 0 && !newIssue.category) {
        setNewIssue(prev => ({ ...prev, category: categoriesData[0].name }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsAddingIssue(true);
      await api.addIssue(Number(id), newIssue);
      setIsModalOpen(false);
      setNewIssue({
        category: categories[0]?.name || '',
        is_from_previous: false,
        title: '',
        status: 'Belum Selesai',
        responsible_officer: ''
      });
      showToast('Issue added successfully');
      fetchData();
    } catch (err) {
      showToast('Failed to add issue', 'error');
    } finally {
      setIsAddingIssue(false);
    }
  };

  const toggleStatus = async (issue: Issue) => {
    if (meeting.is_locked) return;
    const newStatus = issue.status === 'Selesai' ? 'Belum Selesai' : 'Selesai';
    try {
      await api.updateIssue(issue.id, { status: newStatus });
      showToast(`Status updated to ${newStatus}`);
      fetchData();
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = (issueId: number) => {
    if (meeting.is_locked) return;
    
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Isu',
      message: 'Are you sure you want to delete this issue?',
      isDanger: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteIssue(issueId);
          showToast('Issue deleted successfully');
          fetchData();
        } catch (err) {
          showToast('Failed to delete issue', 'error');
        }
      }
    });
  };

  const handleLock = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Kunci Rekod',
      message: 'Locking this meeting will prevent further edits. Proceed?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsLocking(true);
        try {
          await api.lockMeeting(Number(id));
          showToast('Rekod mesyuarat berjaya dikunci');
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Failed to lock meeting', 'error');
        } finally {
          setIsLocking(false);
        }
      }
    });
  };

  const handleSubmit = () => {
    console.log('Submit button clicked, id:', id);
    if (!id) {
      showToast('ID mesyuarat tidak sah', 'error');
      return;
    }
    
    setConfirmConfig({
      isOpen: true,
      title: 'Hantar ke HQ',
      message: 'Submit this report to HQ? You will not be able to edit it without permission.',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        try {
          console.log('Calling api.submitMeeting for id:', id);
          await api.submitMeeting(Number(id));
          console.log('Submit successful');
          showToast('Laporan berjaya dihantar ke HQ');
          fetchData();
        } catch (err: any) {
          console.error('Submit error:', err);
          showToast(err.message || 'Gagal menghantar mesyuarat', 'error');
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const handleRequestUnlock = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Mohon Buka Kunci',
      message: 'Mohon HQ membuka kunci rekod ini untuk disunting?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsRequesting(true);
        try {
          await api.requestUnlock(Number(id));
          showToast('Permohonan buka kunci telah dihantar ke HQ');
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Gagal menghantar permohonan buka kunci', 'error');
        } finally {
          setIsRequesting(false);
        }
      }
    });
  };

  const handleApproveUnlock = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Luluskan Buka Kunci',
      message: 'Luluskan permohonan buka kunci ini?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.approveUnlock(Number(id));
          showToast('Permohonan buka kunci telah diluluskan');
          fetchData();
        } catch (err) {
          showToast('Gagal meluluskan permohonan buka kunci', 'error');
        }
      }
    });
  };

  const handleRejectUnlock = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Tolak Permohonan Buka Kunci',
      message: 'Tolak permohonan buka kunci ini?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.rejectUnlock(Number(id));
          showToast('Permohonan buka kunci telah ditolak');
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Gagal menolak permohonan buka kunci', 'error');
        }
      }
    });
  };

  const handleDeleteMeeting = () => {
    if (!id) {
      showToast('ID mesyuarat tidak sah', 'error');
      return;
    }
    
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Rekod Mesyuarat',
      message: 'Adakah anda pasti mahu menghapuskan keseluruhan rekod mesyuarat ini? Tindakan ini tidak boleh dibatalkan.',
      isDanger: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsDeleting(true);
        try {
          console.log('Attempting to delete meeting:', id);
          await api.deleteMeeting(Number(id));
          showToast('Rekod mesyuarat berjaya dihapuskan');
          navigate('/', { replace: true });
        } catch (err: any) {
          console.error('Delete error:', err);
          showToast(err.message || 'Gagal menghapuskan mesyuarat', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const handleRequestDelete = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Mohon Hapus',
      message: 'Mohon kebenaran HQ untuk menghapuskan rekod yang telah dihantar ini?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsRequesting(true);
        try {
          await api.requestDeleteMeeting(Number(id));
          showToast('Permohonan hapus telah dihantar ke HQ');
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Gagal menghantar permohonan hapus', 'error');
        } finally {
          setIsRequesting(false);
        }
      }
    });
  };

  const handleApproveDelete = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Luluskan Hapus',
      message: 'Luluskan permohonan hapus ini? Rekod akan dihapuskan secara kekal.',
      isDanger: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.approveDeleteMeeting(Number(id));
          showToast('Rekod mesyuarat telah dihapuskan');
          navigate('/');
        } catch (err) {
          showToast('Gagal meluluskan permohonan hapus', 'error');
        }
      }
    });
  };

  const handleRejectDelete = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Tolak Permohonan Hapus',
      message: 'Tolak permohonan hapus ini?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.rejectDeleteMeeting(Number(id));
          showToast('Permohonan hapus telah ditolak');
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Gagal menolak permohonan hapus', 'error');
        }
      }
    });
  };

  if (loading) return <div className="text-center py-12">Sedang memuatkan butiran...</div>;
  if (!meeting) return <div className="text-center py-12">Mesyuarat tidak ditemui.</div>;

  const processSteps = [
    {
      title: 'Rekod Mesyuarat Wujud',
      description: `Mesyuarat ${meeting.bil_mesyuarat} direkodkan untuk ${meeting.department_name}.`,
      state: 'done',
    },
    {
      title: 'Minit Dimuat Naik',
      description: meeting.minit_path ? 'Fail minit tersedia untuk semakan.' : 'Fail minit belum dimuat naik.',
      state: meeting.minit_path ? 'done' : 'pending',
    },
    {
      title: 'Penghantaran ke HQ',
      description: meeting.is_locked ? 'Laporan telah dihantar dan dikunci untuk rekod HQ.' : 'Laporan masih di peringkat jabatan.',
      state: meeting.is_locked ? 'done' : 'current',
    },
    {
      title: 'Keputusan HQ',
      description: meeting.unlock_requested
        ? 'Permohonan buka kunci sedang menunggu keputusan HQ.'
        : meeting.delete_requested
          ? 'Permohonan hapus sedang menunggu keputusan HQ.'
          : meeting.unlock_rejected
            ? 'Permohonan buka kunci telah ditolak oleh HQ.'
            : meeting.delete_rejected
              ? 'Permohonan hapus telah ditolak oleh HQ.'
              : 'Tiada permohonan aktif kepada HQ.',
      state: (meeting.unlock_requested || meeting.delete_requested) ? 'current' : (meeting.unlock_rejected || meeting.delete_rejected ? 'alert' : 'done'),
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={20} />
          Kembali ke Papan Pemuka
        </button>
        <div className="flex gap-3">
          {user.role === 'ADMIN' && meeting.unlock_requested === 1 && (
            <div className="flex gap-3">
              <button 
                onClick={handleRejectUnlock}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors hover:bg-slate-50"
              >
                Tolak
              </button>
              <button 
                onClick={handleApproveUnlock}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <CheckCircle2 size={18} />
                Luluskan Buka Kunci
              </button>
            </div>
          )}

          {user.role === 'ADMIN' && meeting.delete_requested === 1 && (
            <div className="flex gap-3">
              <button 
                onClick={handleRejectDelete}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors hover:bg-slate-50"
              >
                Tolak
              </button>
              <button 
                onClick={handleApproveDelete}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Trash2 size={18} />
                Luluskan Hapus
              </button>
            </div>
          )}

          {user.role === 'ADMIN' && !meeting.is_locked && (
            <button 
              onClick={handleLock}
              disabled={isLocking}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Lock size={18} />
              {isLocking ? 'Sedang mengunci...' : 'Kunci Rekod'}
            </button>
          )}

          {!meeting.is_locked && (user.role === 'ADMIN' || Number(meeting.department_id) === Number(user.department_id)) && (
            <button 
              onClick={handleDeleteMeeting}
              disabled={isDeleting}
              className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 size={18} />
              {isDeleting ? 'Sedang menghapus...' : 'Hapus Rekod'}
            </button>
          )}

          {user.role !== 'ADMIN' && !meeting.is_locked && (
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <Download size={18} className="rotate-180" />
              {isSubmitting ? 'Sedang menghantar...' : 'Hantar ke HQ'}
            </button>
          )}

          {user.role !== 'ADMIN' && meeting.is_locked === 1 && meeting.unlock_requested === 0 && meeting.delete_requested === 0 && (
            <div className="flex gap-2">
              <button 
                onClick={handleRequestUnlock}
                disabled={isRequesting}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Lock size={18} />
                {isRequesting ? 'Sedang memohon...' : 'Mohon Buka Kunci'}
              </button>
              <button 
                onClick={handleRequestDelete}
                disabled={isRequesting}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 size={18} />
                {isRequesting ? 'Sedang memohon...' : 'Mohon Hapus'}
              </button>
            </div>
          )}
          
          {user.role !== 'ADMIN' && meeting.unlock_requested === 1 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-lg font-medium border border-amber-200">
              <Lock size={18} />
              Permohonan Buka Kunci
            </div>
          )}

          {user.role !== 'ADMIN' && meeting.unlock_rejected === 1 && (
            <div className="flex items-center gap-2 bg-rose-50 text-rose-700 px-4 py-2 rounded-lg font-medium border border-rose-200">
              <XCircle size={18} />
              Permohonan Buka Kunci Ditolak
            </div>
          )}

          {user.role !== 'ADMIN' && meeting.delete_requested === 1 && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg font-medium border border-red-200">
              <Trash2 size={18} />
              Permohonan Hapus
            </div>
          )}

          {user.role !== 'ADMIN' && meeting.delete_rejected === 1 && (
            <div className="flex items-center gap-2 bg-rose-50 text-rose-700 px-4 py-2 rounded-lg font-medium border border-rose-200">
              <XCircle size={18} />
              Permohonan Hapus Ditolak
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold text-slate-900">{meeting.bil_mesyuarat}</h2>
              {meeting.is_locked ? (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                  <Lock size={12} /> Dikunci
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">Aktif</span>
              )}
            </div>
            <p className="text-slate-500 font-medium">Tarikh: {new Date(meeting.tarikh_mesyuarat).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-slate-400 text-sm mt-1">Jabatan: {meeting.department_name}</p>
            {meeting.submission_method && (
              <p className="text-slate-400 text-sm mt-1">
                Kaedah Hantar Minit: {meeting.submission_method === 'E' ? 'E - Emel' : 'D - Salinan Keras / Pos'}
              </p>
            )}
            {meeting.minit_path && (
              <a 
                href={meeting.minit_path} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-2 mt-4 text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 transition-colors"
              >
                <FileText size={18} />
                Lihat Minit Mesyuarat (PDF)
              </a>
            )}
          </div>
          {!meeting.is_locked && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20"
            >
              <Plus size={20} />
              Tambah Isu Baharu
            </button>
          )}
        </div>

        <div className="mb-8 rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Penjejak Proses</p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">Status perjalanan rekod ini</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-600 ring-1 ring-slate-200">
              {meeting.is_locked ? 'Dalam Rekod HQ' : 'Dalam Tindakan Jabatan'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {processSteps.map((step) => (
              <div key={step.title} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                      step.state === 'done'
                        ? 'bg-emerald-50 text-emerald-600'
                        : step.state === 'alert'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {step.state === 'done' ? <CheckCircle2 size={20} /> : step.state === 'alert' ? <XCircle size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{step.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Butiran Isu</th>
                <th className="px-6 py-4">Pegawai Bertanggungjawab</th>
                <th className="px-6 py-4">Isu Terdahulu?</th>
                {!meeting.is_locked && <th className="px-6 py-4 text-right">Tindakan</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Tiada isu direkodkan setakat ini.</td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleStatus(issue)}
                        disabled={meeting.is_locked}
                        className={`flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${issue.status === 'Selesai' ? 'text-emerald-600' : 'text-amber-600'}`}
                      >
                        {issue.status === 'Selesai' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        {issue.status}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase">{issue.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-800 font-medium">{issue.title}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm">
                      {issue.responsible_officer || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {issue.is_from_previous ? (
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Ya</span>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">Tidak</span>
                      )}
                    </td>
                    {!meeting.is_locked && (
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDelete(issue.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Issue Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDanger={confirmConfig.isDanger}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="bg-slate-800 p-6 text-white">
              <h3 className="text-xl font-bold">Tambah Isu Mesyuarat</h3>
              <p className="text-slate-400 text-sm">Record a new issue discussed during the meeting.</p>
            </div>
            <form onSubmit={handleAddIssue} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Kategori</label>
                  <select 
                    value={newIssue.category}
                    onChange={(e) => setNewIssue({...newIssue, category: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Pegawai Bertanggungjawab</label>
                  <input 
                    type="text"
                    value={newIssue.responsible_officer}
                    onChange={(e) => setNewIssue({...newIssue, responsible_officer: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Ahmad bin Ali"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tajuk / Catatan Isu</label>
                <textarea 
                  required
                  rows={3}
                  value={newIssue.title}
                  onChange={(e) => setNewIssue({...newIssue, title: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Describe the issue or decision made..."
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={newIssue.is_from_previous}
                    onChange={(e) => setNewIssue({...newIssue, is_from_previous: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Isu daripada mesyuarat terdahulu?</span>
                </label>
                
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-slate-700">Status Permulaan:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio"
                      checked={newIssue.status === 'Belum Selesai'}
                      onChange={() => setNewIssue({...newIssue, status: 'Belum Selesai'})}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-sm text-slate-600">Belum Selesai</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio"
                      checked={newIssue.status === 'Selesai'}
                      onChange={() => setNewIssue({...newIssue, status: 'Selesai'})}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-sm text-slate-600">Selesai</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isAddingIssue}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAddingIssue ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sedang menambah...
                    </>
                  ) : (
                    'Tambah Isu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
