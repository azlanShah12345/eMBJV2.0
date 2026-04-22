import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, Clock3, FileText, ListFilter } from 'lucide-react';
import { api } from '../services/api';
import { DashboardIssue, Department, Meeting, User } from '../types';

interface DashboardIssueListProps {
  user: User;
}

const normalizeStatus = (value: string | null) =>
  value === 'Selesai' || value === 'Belum Selesai' ? value : '';

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('ms-MY');
};

export default function DashboardIssueList({ user }: DashboardIssueListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState<DashboardIssue[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSupport, setLoadingSupport] = useState(true);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(() =>
    user.role === 'ADMIN' ? searchParams.get('department_id') || '' : String(user.department_id)
  );
  const [selectedYear, setSelectedYear] = useState(() => searchParams.get('year') || '');
  const [selectedMeeting, setSelectedMeeting] = useState(() => searchParams.get('bil_mesyuarat') || '');
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get('category') || '');
  const [selectedStatus, setSelectedStatus] = useState<'Selesai' | 'Belum Selesai' | ''>(() => normalizeStatus(searchParams.get('status')) as 'Selesai' | 'Belum Selesai' | '');

  useEffect(() => {
    const fetchSupportData = async () => {
      setLoadingSupport(true);
      try {
        const meetingPromise = api.getMeetings(user.role === 'ADMIN' ? undefined : user.department_id);
        const categoryPromise = api.getCategories();

        if (user.role === 'ADMIN') {
          const [departmentData, meetingData, categoryData] = await Promise.all([
            api.getDepartments(),
            meetingPromise,
            categoryPromise,
          ]);
          setDepartments(departmentData);
          setMeetings(meetingData);
          setCategories(categoryData);
        } else {
          const [meetingData, categoryData] = await Promise.all([meetingPromise, categoryPromise]);
          setDepartments([{ id: user.department_id, name: user.department_name }]);
          setMeetings(meetingData);
          setCategories(categoryData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingSupport(false);
      }
    };

    fetchSupportData();
  }, [user.department_id, user.department_name, user.role]);

  useEffect(() => {
    if (user.role !== 'ADMIN' && selectedDepartmentId !== String(user.department_id)) {
      setSelectedDepartmentId(String(user.department_id));
    }
  }, [selectedDepartmentId, user.department_id, user.role]);

  const meetingsForFilter = meetings.filter((meeting) => {
    if (user.role === 'ADMIN' && meeting.is_locked !== 1) return false;
    if (selectedDepartmentId && Number(meeting.department_id) !== Number(selectedDepartmentId)) return false;
    return true;
  });

  const availableYears = Array.from<number>(
    new Set(
      meetingsForFilter
        .map((meeting) => new Date(meeting.tarikh_mesyuarat).getFullYear())
        .filter((year) => !Number.isNaN(year))
    )
  ).sort((a, b) => b - a);

  const meetingOptions = meetingsForFilter
    .filter((meeting) => {
      if (!selectedYear) return true;
      return String(new Date(meeting.tarikh_mesyuarat).getFullYear()) === selectedYear;
    })
    .sort((a, b) => new Date(b.tarikh_mesyuarat).getTime() - new Date(a.tarikh_mesyuarat).getTime());

  useEffect(() => {
    if (selectedYear && !availableYears.includes(Number(selectedYear))) {
      setSelectedYear('');
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    if (selectedMeeting && !meetingOptions.some((meeting) => meeting.bil_mesyuarat === selectedMeeting)) {
      setSelectedMeeting('');
    }
  }, [meetingOptions, selectedMeeting]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (user.role === 'ADMIN' && selectedDepartmentId) nextParams.set('department_id', selectedDepartmentId);
    if (selectedYear) nextParams.set('year', selectedYear);
    if (selectedMeeting) nextParams.set('bil_mesyuarat', selectedMeeting);
    if (selectedCategory) nextParams.set('category', selectedCategory);
    if (selectedStatus) nextParams.set('status', selectedStatus);
    setSearchParams(nextParams, { replace: true });
  }, [selectedCategory, selectedDepartmentId, selectedMeeting, selectedStatus, selectedYear, setSearchParams, user.role]);

  useEffect(() => {
    const fetchIssues = async () => {
      setLoading(true);
      try {
        const data = await api.getDashboardIssues({
          department_id: selectedDepartmentId ? Number(selectedDepartmentId) : undefined,
          year: selectedYear ? Number(selectedYear) : undefined,
          bil_mesyuarat: selectedMeeting || undefined,
          category: selectedCategory || undefined,
          status: selectedStatus || undefined,
          official_only: user.role === 'ADMIN',
        });
        setIssues(data);
      } catch (error) {
        console.error(error);
        setIssues([]);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, [selectedCategory, selectedDepartmentId, selectedMeeting, selectedStatus, selectedYear, user.role]);

  const totalIssues = issues.length;
  const completedIssues = issues.filter((issue) => issue.status === 'Selesai').length;
  const pendingIssues = issues.filter((issue) => issue.status !== 'Selesai').length;
  const meetingCount = new Set(issues.map((issue) => issue.meeting_id)).size;
  const scopeDepartmentName =
    user.role === 'ADMIN'
      ? departments.find((department) => department.id === Number(selectedDepartmentId))?.name || 'Semua Jabatan'
      : user.department_name;

  const handleResetFilters = () => {
    if (user.role === 'ADMIN') {
      setSelectedDepartmentId('');
    }
    setSelectedYear('');
    setSelectedMeeting('');
    setSelectedCategory('');
    setSelectedStatus('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-emerald-600"
          >
            <ArrowLeft size={16} />
            Kembali ke papan pemuka
          </Link>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Senarai Isu Dashboard</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {user.role === 'ADMIN'
              ? 'Paparan ini memaparkan isu rasmi yang telah dihantar ke HQ mengikut skop penapis semasa.'
              : 'Paparan ini memaparkan semua isu jabatan anda untuk semakan status, tahun, dan rekod mesyuarat.'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Skop Semasa</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{scopeDepartmentName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {selectedYear || 'Sepanjang Masa'} | {selectedStatus || 'Semua Status'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <ListFilter className="text-slate-700" size={18} />
          <h3 className="text-lg font-bold text-slate-900">Penapis Senarai Isu</h3>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {user.role === 'ADMIN' && (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Jabatan</label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Semua Jabatan</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Tahun Rekod</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Sepanjang Masa</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Status Isu</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(normalizeStatus(e.target.value) as 'Selesai' | 'Belum Selesai' | '')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Status</option>
              <option value="Belum Selesai">Belum Selesai</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Bilangan Mesyuarat</label>
            <select
              value={selectedMeeting}
              onChange={(e) => setSelectedMeeting(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Mesyuarat</option>
              {meetingOptions.map((meeting) => (
                <option key={`meeting-option-${meeting.id}`} value={meeting.bil_mesyuarat}>
                  {meeting.bil_mesyuarat} | {formatDate(meeting.tarikh_mesyuarat)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Kategori</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Reset penapis
          </button>
          {user.role === 'ADMIN' ? (
            <p className="text-xs text-slate-500">Hanya rekod yang telah dihantar ke HQ dimasukkan dalam paparan pentadbir ini.</p>
          ) : (
            <p className="text-xs text-slate-500">Pilih `Sepanjang Masa` untuk melihat semua isu jabatan tanpa had tahun.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Jumlah Isu</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{totalIssues}</p>
              <p className="mt-2 text-sm text-slate-500">{meetingCount} rekod mesyuarat terlibat</p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <FileText size={22} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Isu Selesai</p>
              <p className="mt-3 text-3xl font-black text-emerald-700">{completedIssues}</p>
              <p className="mt-2 text-sm text-slate-500">Rekod tindakan yang telah ditutup</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Belum Selesai</p>
              <p className="mt-3 text-3xl font-black text-amber-600">{pendingIssues}</p>
              <p className="mt-2 text-sm text-slate-500">Perlu tindakan susulan lanjut</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <Clock3 size={22} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Skop Jabatan</p>
              <p className="mt-3 text-xl font-black text-slate-900">{scopeDepartmentName}</p>
              <p className="mt-2 text-sm text-slate-500">{selectedYear || 'Sepanjang Masa'}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Building2 size={22} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Senarai Isu Terperinci</h3>
            <p className="mt-1 text-sm text-slate-500">Semak status isu, kategori, rekod mesyuarat, dan pautan terus ke butiran rekod.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            {loading || loadingSupport ? 'Memuatkan...' : `${issues.length} isu`}
          </div>
        </div>
        <div className="max-h-[40rem] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-6 py-4">Tajuk Isu</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Status</th>
                {user.role === 'ADMIN' && <th className="px-6 py-4">Jabatan</th>}
                <th className="px-6 py-4">Mesyuarat</th>
                <th className="px-6 py-4">Tarikh</th>
                <th className="px-6 py-4">Status Rekod</th>
                <th className="px-6 py-4 text-right">Buka</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading || loadingSupport ? (
                <tr>
                  <td colSpan={user.role === 'ADMIN' ? 8 : 7} className="px-6 py-12 text-center text-slate-400">
                    Sedang memuatkan senarai isu...
                  </td>
                </tr>
              ) : issues.length === 0 ? (
                <tr>
                  <td colSpan={user.role === 'ADMIN' ? 8 : 7} className="px-6 py-12 text-center text-slate-400 italic">
                    Tiada isu ditemui bagi penapis yang dipilih.
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">{issue.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {issue.is_from_previous === 1 ? 'Perkara berbangkit' : 'Isu baharu'}
                        {issue.responsible_officer ? ` | ${issue.responsible_officer}` : ''}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{issue.category}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${issue.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {issue.status}
                      </span>
                    </td>
                    {user.role === 'ADMIN' && (
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">{issue.department_name}</td>
                    )}
                    <td className="px-6 py-4 text-sm text-slate-600">{issue.meeting_label}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(issue.meeting_date)}</td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                        <CalendarDays size={12} />
                        {issue.meeting_is_locked === 1 ? 'Dihantar ke HQ' : 'Draf Jabatan'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/meeting/${issue.meeting_id}`}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition-colors hover:text-emerald-600"
                      >
                        <FileText size={16} />
                        Buka rekod
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
