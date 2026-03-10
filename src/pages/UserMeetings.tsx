import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, ChevronRight, Clock3, FileText, FolderArchive, Lock, Plus, Unlock, BarChart3 } from 'lucide-react';
import { api } from '../services/api';
import { Meeting, User } from '../types';
import { useToast } from '../components/Toast';

interface UserMeetingsProps {
  user: User;
}

export default function UserMeetings({ user }: UserMeetingsProps) {
  const { showToast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [bil, setBil] = useState('Bil 1');
  const [tarikh, setTarikh] = useState('');
  const [submissionMethod, setSubmissionMethod] = useState<'D' | 'E'>('E');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchMeetings();
  }, []);

  useEffect(() => {
    if (meetings.length === 0) return;
    const availableYears = Array.from<number>(
      new Set(
        meetings
          .map((meeting) => new Date(meeting.tarikh_mesyuarat).getFullYear())
          .filter((year) => !Number.isNaN(year))
      )
    ).sort((a, b) => b - a);

    if (!selectedYear && availableYears.length > 0) {
      setSelectedYear(String(availableYears[0]));
    }
  }, [meetings, selectedYear]);

  const fetchMeetings = async () => {
    try {
      const data = await api.getMeetings(user.department_id);
      setMeetings(data);
    } catch (error) {
      console.error(error);
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
    } catch (error) {
      showToast('Gagal mewujudkan rekod mesyuarat', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const availableYears = Array.from<number>(
    new Set(
      meetings
        .map((meeting) => new Date(meeting.tarikh_mesyuarat).getFullYear())
        .filter((year) => !Number.isNaN(year))
    )
  ).sort((a, b) => b - a);

  const filteredMeetings = meetings.filter((meeting) => {
    if (!selectedYear) return true;
    return String(new Date(meeting.tarikh_mesyuarat).getFullYear()) === selectedYear;
  });

  const submittedMeetings = filteredMeetings.filter((meeting) => meeting.is_locked === 1);
  const draftMeetings = filteredMeetings.filter((meeting) => meeting.is_locked !== 1);
  const totalIssues = filteredMeetings.reduce((sum, meeting) => sum + Number(meeting.total_issues || 0), 0);
  const completedIssues = filteredMeetings.reduce((sum, meeting) => sum + Number(meeting.completed_issues || 0), 0);
  const pendingIssues = Math.max(0, totalIssues - completedIssues);
  const completionRate = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;
  const yearSummary = availableYears.map((year) => {
    const yearlyMeetings = meetings.filter((meeting) => new Date(meeting.tarikh_mesyuarat).getFullYear() === year);
    const yearlySubmitted = yearlyMeetings.filter((meeting) => meeting.is_locked === 1);
    const yearlyIssues = yearlyMeetings.reduce((sum, meeting) => sum + Number(meeting.total_issues || 0), 0);
    return {
      year,
      reports: yearlyMeetings.length,
      submitted: yearlySubmitted.length,
      issues: yearlyIssues,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rekod Mesyuarat</h2>
          <p className="text-slate-500">Daftar mesyuarat baharu, urus rekod, dan semak status penghantaran ke HQ.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Tahun Rekod</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white shadow-lg shadow-emerald-600/10 transition-colors hover:bg-emerald-700 lg:mt-0"
          >
            <Plus size={20} />
            Mesyuarat Baharu
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Laporan Tahun {selectedYear}</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{filteredMeetings.length}</p>
              <p className="mt-2 text-sm text-slate-500">Termasuk draf dan laporan dihantar</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <FolderArchive size={22} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Dihantar Ke HQ</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{submittedMeetings.length}</p>
              <p className="mt-2 text-sm text-slate-500">Rekod rasmi untuk tahun dipilih</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Jumlah Isu</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{totalIssues}</p>
              <p className="mt-2 text-sm text-slate-500">{completedIssues} selesai, {pendingIssues} belum selesai</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <Clock3 size={22} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Kadar Penyelesaian</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{completionRate.toFixed(1)}%</p>
              <p className="mt-2 text-sm text-slate-500">Berdasarkan isu dalam tahun dipilih</p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <BarChart3 size={22} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Arkib Tahunan</h3>
            <p className="mt-1 text-sm text-slate-500">Ringkasan rekod jabatan untuk memudahkan semakan apabila penggunaan sistem melangkau tahun.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
            {availableYears.length} tahun
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {yearSummary.map((item) => (
            <button
              key={item.year}
              type="button"
              onClick={() => setSelectedYear(String(item.year))}
              className={`rounded-2xl border p-4 text-left transition-colors ${String(item.year) === selectedYear ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Tahun {item.year}</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{item.reports}</p>
              <p className="mt-2 text-sm text-slate-500">{item.submitted} dihantar ke HQ | {item.issues} isu</p>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">Sedang memuatkan mesyuarat...</div>
      ) : (
        <div className="space-y-8">
          {[
            { title: 'Laporan Dihantar Ke HQ', subtitle: 'Rekod yang telah diserahkan sebagai rujukan rasmi HQ.', data: submittedMeetings, tone: 'emerald' },
            { title: 'Draf Dan Dalam Tindakan', subtitle: 'Rekod yang masih aktif untuk dikemas kini oleh jabatan.', data: draftMeetings, tone: 'slate' },
          ].map((section) => (
            <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{section.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{section.subtitle}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                  {section.data.length} rekod
                </div>
              </div>
              {section.data.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-sm italic text-slate-400">
                  Tiada rekod untuk tahun {selectedYear} dalam seksyen ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {section.data.map((meeting) => (
                    <Link
                      key={meeting.id}
                      to={`/meeting/${meeting.id}`}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-emerald-200 hover:shadow-xl"
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className={`rounded-xl p-3 transition-colors ${section.tone === 'emerald' ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white'}`}>
                          <FileText size={24} />
                        </div>
                        {meeting.is_locked ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-amber-600">
                              <Lock size={12} /> Dalam Rekod HQ
                            </span>
                            {meeting.unlock_requested === 1 && (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                                Permohonan Buka Kunci
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600">
                            <Unlock size={12} /> Dalam Tindakan
                          </span>
                        )}
                      </div>
                      <h3 className="mb-1 text-xl font-bold text-slate-800">{meeting.bil_mesyuarat}</h3>
                      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                        <Calendar size={14} />
                        {new Date(meeting.tarikh_mesyuarat).toLocaleDateString('ms-MY')}
                      </div>
                      <div className="space-y-3">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${meeting.total_issues ? (meeting.completed_issues / meeting.total_issues) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-500">{meeting.total_issues} jumlah isu</span>
                          <span className="text-emerald-600">{meeting.completed_issues} selesai</span>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                        <div>
                          <p className="font-bold uppercase tracking-[0.18em] text-slate-400">Tahun</p>
                          <p className="mt-1 font-semibold text-slate-700">{new Date(meeting.tarikh_mesyuarat).getFullYear()}</p>
                        </div>
                        <div>
                          <p className="font-bold uppercase tracking-[0.18em] text-slate-400">Kaedah</p>
                          <p className="mt-1 font-semibold text-slate-700">{meeting.submission_method || '-'}</p>
                        </div>
                      </div>
                      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-emerald-600">
                        Lihat Butiran
                        <ChevronRight size={18} className="transform transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-slate-800 p-6 text-white">
              <h3 className="text-xl font-bold">Daftar Mesyuarat Baharu</h3>
              <p className="text-sm text-slate-400">Masukkan butiran mesyuarat MBJ.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Bilangan Mesyuarat</label>
                <select
                  value={bil}
                  onChange={(e) => setBil(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option>Bil 1</option>
                  <option>Bil 2</option>
                  <option>Bil 3</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Tarikh Mesyuarat</label>
                <input
                  type="date"
                  required
                  value={tarikh}
                  onChange={(e) => setTarikh(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Minit Mesyuarat (PDF)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Kaedah Hantar Minit</label>
                <select
                  value={submissionMethod}
                  onChange={(e) => setSubmissionMethod(e.target.value as 'D' | 'E')}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="E">E - Emel</option>
                  <option value="D">D - Salinan Keras / Pos</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white shadow-lg shadow-emerald-600/10 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
