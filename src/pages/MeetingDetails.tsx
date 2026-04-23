import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Issue, IssueCategorySuggestion, MeetingMessage, OFFICIAL_ISSUE_CATEGORIES, SimilarIssue, User } from '../types';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Circle, Lock, Download, FileText, XCircle, AlertTriangle, Send, MessageSquare, Sparkles } from 'lucide-react';
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
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [meeting, setMeeting] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAddingIssue, setIsAddingIssue] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [similarIssues, setSimilarIssues] = useState<SimilarIssue[]>([]);
  const [isCheckingSimilarIssues, setIsCheckingSimilarIssues] = useState(false);
  const [issueCategorySuggestion, setIssueCategorySuggestion] = useState<IssueCategorySuggestion | null>(null);
  const [isLoadingIssueCategorySuggestion, setIsLoadingIssueCategorySuggestion] = useState(false);
  const clampPercentage = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

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
    category: OFFICIAL_ISSUE_CATEGORIES[0] || '',
    is_from_previous: false,
    title: '',
    status: 'Belum Selesai' as const
  });
  const issueEntryCategories = OFFICIAL_ISSUE_CATEGORIES.map((name, index) => ({ id: index + 1, name }));

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;

    const intervalId = window.setInterval(() => {
      fetchMessages();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [id]);

  useEffect(() => {
    if (!isModalOpen || !id) {
      setSimilarIssues([]);
      setIsCheckingSimilarIssues(false);
      return undefined;
    }

    const trimmedTitle = newIssue.title.trim();
    if (trimmedTitle.length < 4) {
      setSimilarIssues([]);
      setIsCheckingSimilarIssues(false);
      return undefined;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsCheckingSimilarIssues(true);
        const data = await api.getSimilarIssues(Number(id), trimmedTitle);
        if (!isCancelled) {
          setSimilarIssues(data);
        }
      } catch (error) {
        if (!isCancelled) {
          setSimilarIssues([]);
        }
        console.error(error);
      } finally {
        if (!isCancelled) {
          setIsCheckingSimilarIssues(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [id, isModalOpen, newIssue.title]);

  useEffect(() => {
    if (!isModalOpen || !id) {
      setIssueCategorySuggestion(null);
      setIsLoadingIssueCategorySuggestion(false);
      return undefined;
    }

    const trimmedTitle = newIssue.title.trim();
    if (!trimmedTitle) {
      setIssueCategorySuggestion(null);
      setIsLoadingIssueCategorySuggestion(false);
      return undefined;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoadingIssueCategorySuggestion(true);
        const suggestion = await api.getIssueCategorySuggestion(Number(id), trimmedTitle);
        if (!isCancelled) {
          setIssueCategorySuggestion(suggestion);
        }
      } catch (error) {
        if (!isCancelled) {
          setIssueCategorySuggestion(null);
        }
        console.error(error);
      } finally {
        if (!isCancelled) {
          setIsLoadingIssueCategorySuggestion(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [id, isModalOpen, newIssue.title]);

  const fetchData = async () => {
    try {
      const [meetingData, issuesData, messagesData] = await Promise.all([
        api.getMeeting(Number(id)),
        api.getIssues(Number(id)),
        api.getMeetingMessages(Number(id)),
      ]);
      setMeeting(meetingData);
      setIssues(issuesData);
      setMessages(messagesData);
      await api.markMeetingMessagesRead(Number(id));
      if (!newIssue.category) {
        setNewIssue(prev => ({ ...prev, category: OFFICIAL_ISSUE_CATEGORIES[0] || prev.category }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!id) return;
    try {
      const data = await api.getMeetingMessages(Number(id));
      setMessages(data);
      await api.markMeetingMessagesRead(Number(id));
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsAddingIssue(true);
      await api.addIssue(Number(id), newIssue);
      setIsModalOpen(false);
      setNewIssue({
        category: OFFICIAL_ISSUE_CATEGORIES[0] || '',
        is_from_previous: false,
        title: '',
        status: 'Belum Selesai'
      });
      setSimilarIssues([]);
      setIssueCategorySuggestion(null);
      showToast('Isu berjaya ditambah');
      fetchData();
    } catch (err) {
      showToast('Gagal menambah isu', 'error');
    } finally {
      setIsAddingIssue(false);
    }
  };

  const toggleStatus = async (issue: Issue) => {
    if (meeting.is_locked) return;
    const newStatus = issue.status === 'Selesai' ? 'Belum Selesai' : 'Selesai';
    try {
      await api.updateIssue(issue.id, { status: newStatus });
      showToast(`Status isu dikemas kini kepada ${newStatus}`);
      fetchData();
    } catch (err) {
      showToast('Gagal mengemas kini status', 'error');
    }
  };

  const handleDelete = (issueId: number) => {
    if (meeting.is_locked) return;
    
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Isu',
      message: 'Adakah anda pasti mahu menghapuskan isu ini?',
      isDanger: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteIssue(issueId);
          showToast('Isu berjaya dihapuskan');
          fetchData();
        } catch (err) {
          showToast('Gagal menghapuskan isu', 'error');
        }
      }
    });
  };

  const handleLock = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Kunci Rekod',
      message: 'Mengunci rekod ini akan menghalang sebarang suntingan lanjut. Teruskan?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsLocking(true);
        try {
          await api.lockMeeting(Number(id));
          showToast('Rekod mesyuarat berjaya dikunci');
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Gagal mengunci mesyuarat', 'error');
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
      message: 'Hantar laporan ini ke HQ? Anda tidak boleh menyuntingnya semula tanpa kebenaran.',
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) {
      showToast('Mesej tidak boleh kosong', 'error');
      return;
    }

    try {
      setIsSendingMessage(true);
      await api.addMeetingMessage(Number(id), trimmedMessage);
      setNewMessage('');
      await fetchMessages();
      showToast('Mesej berjaya dihantar');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghantar mesej', 'error');
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (loading) return <div className="text-center py-12">Sedang memuatkan butiran...</div>;
  if (!meeting) return <div className="text-center py-12">Mesyuarat tidak ditemui.</div>;

  const hasIssueTitle = newIssue.title.trim().length > 0;
  const isSuggestionApplied = issueCategorySuggestion?.category === newIssue.category;
  const hasSimilarIssueMatches = similarIssues.length > 0;
  const similarIssueScopeLabel = user.role === 'ADMIN' ? 'semua jabatan' : 'rekod jabatan';

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
              : meeting.is_locked
                ? 'Tiada permohonan aktif kepada HQ.'
                : 'Belum ada tindakan HQ kerana rekod masih di peringkat jabatan.',
      state: (meeting.unlock_requested || meeting.delete_requested)
        ? 'current'
        : (meeting.unlock_rejected || meeting.delete_rejected)
          ? 'alert'
          : meeting.is_locked
            ? 'done'
            : 'pending',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(user.role === 'ADMIN' ? '/' : '/meetings')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={20} />
          {user.role === 'ADMIN' ? 'Kembali ke Papan Pemuka' : 'Kembali ke Menu Mesyuarat'}
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

        <div className="mb-8 rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Perbualan Mesyuarat</p>
              <h3 className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900">
                <MessageSquare size={20} className="text-emerald-600" />
                Ruang komunikasi jabatan dan HQ
              </h3>
              <p className="mt-1 text-sm text-slate-500">Gunakan ruang ini untuk penjelasan, arahan susulan, atau maklum balas berkaitan rekod mesyuarat ini.</p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-600 ring-1 ring-slate-200">
              {messages.length} mesej
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="max-h-[360px] space-y-4 overflow-y-auto p-5">
              {messages.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm italic text-slate-400">
                  Belum ada mesej. Mulakan perbualan berkaitan rekod mesyuarat ini.
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = Number(message.user_id) === Number(user.id);
                  const isAdminMessage = message.user_role === 'ADMIN';

                  return (
                    <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-3xl rounded-2xl px-4 py-3 shadow-sm ${isOwnMessage ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-800 ring-1 ring-slate-200'}`}>
                        <div className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] ${isOwnMessage ? 'text-emerald-100' : isAdminMessage ? 'text-indigo-600' : 'text-slate-500'}`}>
                          <span>{message.username}</span>
                          <span>{isAdminMessage ? 'HQ' : (message.department_name || 'Jabatan')}</span>
                          <span className={isOwnMessage ? 'text-emerald-100/80' : 'text-slate-400'}>
                            {new Date(message.created_at).toLocaleString('ms-MY', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className={`whitespace-pre-wrap text-sm leading-6 ${isOwnMessage ? 'text-white' : 'text-slate-700'}`}>{message.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-slate-200 p-5">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Mesej Baharu</label>
              <div className="flex flex-col gap-3 lg:flex-row">
                <textarea
                  rows={3}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[88px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition-colors focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  placeholder="Tulis maklum balas atau arahan berkaitan mesyuarat ini..."
                />
                <button
                  type="submit"
                  disabled={isSendingMessage}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 lg:self-end"
                >
                  <Send size={18} />
                  {isSendingMessage ? 'Sedang hantar...' : 'Hantar Mesej'}
                </button>
              </div>
            </form>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="shrink-0 bg-slate-800 p-6 text-white">
              <h3 className="text-xl font-bold">Tambah Isu Mesyuarat</h3>
              <p className="text-slate-400 text-sm">Rekod isu baharu yang dibincangkan dalam mesyuarat ini.</p>
              <p className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold leading-6 text-emerald-50 shadow-inner">
                <Sparkles size={14} />
                Sistem ini berupaya mencadangkan kategori yang paling bersesuaian serta mengenal pasti isu yang hampir serupa bagi mengelakkan pertindihan rekod.
              </p>
            </div>
            <form onSubmit={handleAddIssue} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto p-6 sm:p-8">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Kategori</label>
                  <select 
                    value={newIssue.category}
                    onChange={(e) => setNewIssue({...newIssue, category: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {issueEntryCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Isu baharu menggunakan pengelasan rasmi semasa. Rekod isu sejarah kekal pada kategori asal yang telah dilaporkan.
                  </p>
                  {isLoadingIssueCategorySuggestion ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Sedang menyemak cadangan kategori berasaskan rekod isu terdahulu...
                    </div>
                  ) : issueCategorySuggestion ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-bold">Cadangan kategori pintar: {issueCategorySuggestion.category}</p>
                          {issueCategorySuggestion.source === 'data' ? (
                            <p className="mt-1 text-emerald-800">
                              Berdasarkan pola {issueCategorySuggestion.support_count} rekod isu terdahulu
                              {issueCategorySuggestion.department_support_count > 1
                                ? ` merentasi ${issueCategorySuggestion.department_support_count} jabatan`
                                : ''}
                              . Cadangan akan semakin tepat apabila pembetulan kategori disimpan pada rekod baharu.
                            </p>
                          ) : (
                            <p className="mt-1 text-emerald-800">
                              Berdasarkan padanan kata kunci: {issueCategorySuggestion.matched_keywords.join(', ')}.
                            </p>
                          )}
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Tahap keyakinan: {issueCategorySuggestion.confidence}
                          </p>
                        </div>
                        {!isSuggestionApplied && (
                          <button
                            type="button"
                            onClick={() => setNewIssue((current) => ({ ...current, category: issueCategorySuggestion.category }))}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white transition-colors hover:bg-emerald-700"
                          >
                            <Sparkles size={16} />
                            Gunakan Cadangan
                          </button>
                        )}
                      </div>
                      {isSuggestionApplied && (
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          Cadangan ini sedang digunakan pada kategori semasa.
                        </p>
                      )}
                    </div>
                  ) : hasIssueTitle ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Tiada cadangan kategori automatik ditemui untuk teks semasa. Anda masih boleh pilih kategori secara manual.
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Tajuk / Catatan Isu</label>
                  <textarea 
                    required
                    rows={3}
                    value={newIssue.title}
                    onChange={(e) => setNewIssue({...newIssue, title: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Nyatakan isu atau keputusan yang dibincangkan..."
                  />
                  {isCheckingSimilarIssues ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Sedang menyemak isu berulang dalam {similarIssueScopeLabel}...
                    </div>
                  ) : hasSimilarIssueMatches ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                          <AlertTriangle size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-amber-900">Semakan isu berulang menemui rekod yang hampir sama</p>
                          <p className="mt-1 text-sm text-amber-800">
                            Sila semak dahulu sebelum simpan, untuk elakkan isu yang sama direkodkan berulang dalam {similarIssueScopeLabel}.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                        {similarIssues.map((issue) => (
                          <div key={`${issue.id}-${issue.meeting_id}`} className="rounded-xl border border-amber-100 bg-white p-4 text-sm text-slate-700">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-bold text-slate-900">{issue.title}</p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                                  Padanan {clampPercentage(issue.similarity_score)}% {issue.is_same_meeting ? '| Mesyuarat semasa' : `| ${issue.meeting_label}`}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs font-bold">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{issue.category}</span>
                                <span className={`rounded-full px-2.5 py-1 ${issue.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {issue.status}
                                </span>
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {issue.department_name} | {issue.meeting_label} | {new Date(issue.meeting_date).toLocaleDateString('ms-MY')}
                              {issue.is_from_previous ? ' | Isu terdahulu' : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : hasIssueTitle && newIssue.title.trim().length >= 4 ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      Tiada isu berulang yang hampir sama ditemui dalam {similarIssueScopeLabel} setakat semakan semasa.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={newIssue.is_from_previous}
                      onChange={(e) => setNewIssue({...newIssue, is_from_previous: e.target.checked})}
                      className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Isu daripada mesyuarat terdahulu?</span>
                  </label>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-semibold text-slate-700">Status Permulaan:</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio"
                        checked={newIssue.status === 'Belum Selesai'}
                        onChange={() => setNewIssue({...newIssue, status: 'Belum Selesai'})}
                        className="h-4 w-4 text-emerald-600"
                      />
                      <span className="text-sm text-slate-600">Belum Selesai</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio"
                        checked={newIssue.status === 'Selesai'}
                        onChange={() => setNewIssue({...newIssue, status: 'Selesai'})}
                        className="h-4 w-4 text-emerald-600"
                      />
                      <span className="text-sm text-slate-600">Selesai</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-4 border-t border-slate-200 bg-white p-6 sm:px-8">
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
