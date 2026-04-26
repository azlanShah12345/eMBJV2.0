import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarDays, CheckCircle2, ChevronRight, Clock3, FileText, FolderArchive, X } from 'lucide-react';
import { api } from '../services/api';
import DashboardIssueExplorer from '../components/DashboardIssueExplorer';
import { DashboardIssueFilters, Meeting, User } from '../types';
import { getMeetingSubmissionLabel } from '../utils/meetingSubmission';

interface DeptDashboardProps {
  user: User;
}

export default function DeptDashboard({ user }: DeptDashboardProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('');
  const [issueDrilldownState, setIssueDrilldownState] = useState<{
    title: string;
    filters: DashboardIssueFilters;
  } | null>(null);

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
  const latestSubmittedMeeting = submittedMeetings
    .slice()
    .sort((left, right) => {
      const leftTime = left.submitted_at ? new Date(left.submitted_at).getTime() : 0;
      const rightTime = right.submitted_at ? new Date(right.submitted_at).getTime() : 0;
      return rightTime - leftTime;
    })[0];
  const totalIssues = filteredMeetings.reduce((sum, meeting) => sum + Number(meeting.total_issues || 0), 0);
  const completedIssues = filteredMeetings.reduce((sum, meeting) => sum + Number(meeting.completed_issues || 0), 0);
  const pendingIssues = Math.max(0, totalIssues - completedIssues);
  const completionRate = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;
  const latestMeeting = filteredMeetings
    .slice()
    .sort((a, b) => new Date(b.tarikh_mesyuarat).getTime() - new Date(a.tarikh_mesyuarat).getTime())[0];
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
  const buildIssueFilters = (status?: 'Selesai' | 'Belum Selesai', year?: string): DashboardIssueFilters => ({
    year: year || undefined,
    status: status || undefined,
  });

  return (
    <div className="space-y-8">
      {issueDrilldownState && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="flex h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-white/20 bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Paparan Terapung</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{issueDrilldownState.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIssueDrilldownState(null)}
                className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:text-slate-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <DashboardIssueExplorer
                user={user}
                initialFilters={issueDrilldownState.filters}
                compact
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Papan Pemuka Jabatan</h2>
          <p className="text-slate-500">Pantau ringkasan prestasi MBJ jabatan anda tanpa bercampur dengan pengurusan rekod mesyuarat.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
          <Link
            to="/meetings"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white shadow-lg shadow-emerald-600/10 transition-colors hover:bg-emerald-700"
          >
            <FileText size={18} />
            Buka Menu Mesyuarat
          </Link>
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
              <p className="mt-2 text-sm text-slate-500">
                {latestSubmittedMeeting?.submitted_at
                  ? `Terakhir dihantar pada ${getMeetingSubmissionLabel(latestSubmittedMeeting.submitted_at)}`
                  : 'Rekod rasmi untuk tahun dipilih'}
              </p>
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Semakan Senarai Isu</h3>
            <p className="mt-1 text-sm text-slate-500">Buka paparan senarai isu untuk melihat status selesai atau belum selesai mengikut tahun semasa atau sepanjang masa.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
            Jabatan anda sahaja
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setIssueDrilldownState({
              title: `Isu Belum Selesai ${selectedYear || 'Sepanjang Masa'}`,
              filters: buildIssueFilters('Belum Selesai', selectedYear),
            })}
            className="rounded-2xl border border-amber-100 bg-amber-50 p-5 transition-colors hover:bg-amber-100/60"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Isu Belum Selesai</p>
            <p className="mt-3 text-2xl font-black text-slate-900">{pendingIssues}</p>
            <p className="mt-2 text-sm text-slate-600">Lihat semua isu belum selesai untuk tahun {selectedYear || 'dipilih'}.</p>
          </button>
          <button
            type="button"
            onClick={() => setIssueDrilldownState({
              title: `Isu Selesai ${selectedYear || 'Sepanjang Masa'}`,
              filters: buildIssueFilters('Selesai', selectedYear),
            })}
            className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 transition-colors hover:bg-emerald-100/60"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Isu Selesai</p>
            <p className="mt-3 text-2xl font-black text-slate-900">{completedIssues}</p>
            <p className="mt-2 text-sm text-slate-600">Lihat semua isu selesai untuk tahun {selectedYear || 'dipilih'}.</p>
          </button>
          <button
            type="button"
            onClick={() => setIssueDrilldownState({
              title: 'Semua Isu Jabatan',
              filters: buildIssueFilters(),
            })}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors hover:bg-white"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Sepanjang Masa</p>
            <p className="mt-3 text-2xl font-black text-slate-900">{meetings.reduce((sum, meeting) => sum + Number(meeting.total_issues || 0), 0)}</p>
            <p className="mt-2 text-sm text-slate-600">Buka semua isu jabatan merentasi semua tahun untuk semakan menyeluruh.</p>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Arkib Tahunan</h3>
            <p className="mt-1 text-sm text-slate-500">Semak corak laporan tahunan dan pilih tahun yang hendak dianalisis.</p>
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
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tindakan Pantas</h3>
                <p className="mt-1 text-sm text-slate-500">Buka modul pengurusan mesyuarat untuk daftar rekod baharu atau kemas kini mesyuarat sedia ada.</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <CalendarDays size={22} />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Link
                to="/meetings"
                className="group rounded-2xl border border-emerald-200 bg-emerald-50 p-5 transition-colors hover:bg-emerald-100"
              >
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Menu Mesyuarat</p>
                <p className="mt-3 text-xl font-black text-slate-900">Daftar Dan Urus Rekod</p>
                <p className="mt-2 text-sm text-slate-600">Semua fungsi `Mesyuarat Baharu`, draf, dan penghantaran HQ diletakkan di sini.</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  Buka modul
                  <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Status Tahun {selectedYear}</p>
                <p className="mt-3 text-xl font-black text-slate-900">{submittedMeetings.length}/{filteredMeetings.length} rekod dihantar</p>
                <p className="mt-2 text-sm text-slate-600">Hanya rekod yang dihantar ke HQ dianggap rasmi pada analitik pentadbir.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Mesyuarat Terkini</h3>
            <p className="mt-1 text-sm text-slate-500">Paparan ringkas rekod paling terkini untuk tahun dipilih.</p>
            {latestMeeting ? (
              <Link
                to={`/meeting/${latestMeeting.id}`}
                className="mt-5 block rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-emerald-200 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Rekod Terkini</p>
                    <p className="mt-3 text-2xl font-black text-slate-900">{latestMeeting.bil_mesyuarat}</p>
                    <p className="mt-2 text-sm text-slate-500">{new Date(latestMeeting.tarikh_mesyuarat).toLocaleDateString('ms-MY')}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-200 p-3 text-slate-700">
                    <FileText size={20} />
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Status</p>
                    <p className="mt-1 font-semibold text-slate-800">{latestMeeting.is_locked === 1 ? 'Dihantar ke HQ' : 'Dalam tindakan'}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Isu</p>
                    <p className="mt-1 font-semibold text-slate-800">{latestMeeting.completed_issues}/{latestMeeting.total_issues} selesai</p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm italic text-slate-400">
                Tiada rekod mesyuarat untuk tahun {selectedYear}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
