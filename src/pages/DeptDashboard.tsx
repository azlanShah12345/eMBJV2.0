import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Meeting, User } from '../types';
import { Plus, FileText, Calendar, ChevronRight, Lock, Unlock, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

interface DeptDashboardProps {
  user: User;
}

export default function DeptDashboard({ user }: DeptDashboardProps) {
  const { showToast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [bil, setBil] = useState('Bil 1');
  const [tarikh, setTarikh] = useState('');
  const [submissionMethod, setSubmissionMethod] = useState<'D' | 'E'>('E');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const data = await api.getMeetings(user.role === 'ADMIN' ? undefined : user.department_id);
      setMeetings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('bil_mesyuarat', bil);
    formData.append('tarikh_mesyuarat', tarikh);
    formData.append('department_id', user.department_id.toString());
    formData.append('submission_method', submissionMethod);
    if (file) formData.append('minit', file);

    try {
      setIsSaving(true);
      await api.createMeeting(formData);
      setIsModalOpen(false);
      setBil('Bil 1');
      setTarikh('');
      setSubmissionMethod('E');
      setFile(null);
      showToast('Rekod mesyuarat berjaya diwujudkan');
      fetchMeetings();
    } catch (err) {
      showToast('Gagal mewujudkan rekod mesyuarat', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rekod Mesyuarat</h2>
          <p className="text-slate-500">Urus dan pantau mesyuarat MBJ jabatan anda.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/10"
        >
          <Plus size={20} />
          Mesyuarat Baharu
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Sedang memuatkan mesyuarat...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((meeting) => (
            <Link 
              key={meeting.id} 
              to={`/meeting/${meeting.id}`}
              className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:border-emerald-200 transition-all group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <FileText size={24} />
                </div>
                {meeting.is_locked ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase tracking-wider">
                      <Lock size={12} /> Dikunci
                    </span>
                    {meeting.unlock_requested === 1 && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Permohonan Buka Kunci
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wider">
                    <Unlock size={12} /> Aktif
                  </span>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 mb-1">{meeting.bil_mesyuarat}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <Calendar size={14} />
                {new Date(meeting.tarikh_mesyuarat).toLocaleDateString('ms-MY')}
              </div>

              <div className="space-y-3">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${meeting.total_issues ? (meeting.completed_issues / meeting.total_issues) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">{meeting.total_issues} Jumlah Isu</span>
                  <span className="text-emerald-600">{meeting.completed_issues} Selesai</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-emerald-600 font-semibold text-sm">
                Lihat Butiran
                <ChevronRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-800 p-6 text-white">
              <h3 className="text-xl font-bold">Daftar Mesyuarat Baharu</h3>
              <p className="text-slate-400 text-sm">Masukkan butiran mesyuarat MBJ.</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Bilangan Mesyuarat</label>
                <select 
                  value={bil}
                  onChange={(e) => setBil(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option>Bil 1</option>
                  <option>Bil 2</option>
                  <option>Bil 3</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tarikh Mesyuarat</label>
                <input 
                  type="date"
                  required
                  value={tarikh}
                  onChange={(e) => setTarikh(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Minit Mesyuarat (PDF)</label>
                <input 
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Kaedah Hantar Minit</label>
                <select
                  value={submissionMethod}
                  onChange={(e) => setSubmissionMethod(e.target.value as 'D' | 'E')}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="E">E - Emel</option>
                  <option value="D">D - Salinan Keras / Pos</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-600/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sedang menyimpan...
                    </>
                  ) : (
                    'Simpan Rekod'
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
