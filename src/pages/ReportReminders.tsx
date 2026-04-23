import { useEffect, useMemo, useState } from 'react';
import { Bell, Building2, RefreshCw, Search } from 'lucide-react';
import { api } from '../services/api';
import { LastYearIncompleteReportItem } from '../types';
import { useToast } from '../components/Toast';

export default function ReportReminders() {
  const { showToast } = useToast();
  const currentYear = new Date().getFullYear();
  const [items, setItems] = useState<LastYearIncompleteReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminderDepartmentId, setSendingReminderDepartmentId] = useState<number | null>(null);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedYear, setSelectedYear] = useState(currentYear - 1);
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const availableYears = useMemo(() => {
    const earliestYear = Math.max(2000, currentYear - 9);
    return Array.from({ length: currentYear - earliestYear + 1 }, (_, index) => currentYear - index);
  }, [currentYear]);

  const fetchData = async (reportYear = selectedYear) => {
    try {
      setLoading(true);
      const data = await api.getLastYearIncompleteReports(reportYear);
      setItems(data);
    } catch (error) {
      console.error(error);
      showToast('Gagal memuatkan senarai peringatan pelaporan', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    const availableIds = new Set(items.map((item) => item.department_id));
    setSelectedDepartmentIds((current) => current.filter((id) => availableIds.has(id)));
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return items;
    }

    return items.filter((item) => {
      const searchableText = [
        item.department_name,
        item.report_year,
        item.submitted_labels.join(' '),
        item.missing_labels.join(' '),
      ].join(' ').toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [items, searchKeyword]);

  const selectableItems = filteredItems.filter((item) => item.active_user_count > 0);
  const selectedEligibleItems = filteredItems.filter(
    (item) => item.active_user_count > 0 && selectedDepartmentIds.includes(item.department_id)
  );
  const allSelectableIds = selectableItems.map((item) => item.department_id);
  const areAllSelectableSelected =
    allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedDepartmentIds.includes(id));

  const handleSendReminder = async (item: LastYearIncompleteReportItem) => {
    try {
      setSendingReminderDepartmentId(item.department_id);
      const response = await api.sendLastYearReportReminder(item.department_id, selectedYear);
      showToast(response.message || 'Peringatan berjaya dihantar');
      await fetchData();
    } catch (error: any) {
      console.error(error);
      showToast(error?.message || 'Gagal menghantar peringatan laporan', 'error');
    } finally {
      setSendingReminderDepartmentId(null);
    }
  };

  const toggleDepartmentSelection = (departmentId: number) => {
    setSelectedDepartmentIds((current) =>
      current.includes(departmentId)
        ? current.filter((id) => id !== departmentId)
        : [...current, departmentId]
    );
  };

  const handleSelectAllVisible = () => {
    setSelectedDepartmentIds((current) => {
      if (areAllSelectableSelected) {
        return current.filter((id) => !allSelectableIds.includes(id));
      }

      return Array.from(new Set([...current, ...allSelectableIds]));
    });
  };

  const handleBulkSend = async (targetItems: LastYearIncompleteReportItem[]) => {
    if (targetItems.length === 0) {
      showToast('Tiada jabatan yang layak dipilih untuk peringatan', 'error');
      return;
    }

    try {
      setIsSendingBulk(true);
      setBulkProgress({ current: 0, total: targetItems.length });

      const failures: string[] = [];
      for (let index = 0; index < targetItems.length; index += 1) {
        const item = targetItems[index];
        setBulkProgress({ current: index + 1, total: targetItems.length });

        try {
          await api.sendLastYearReportReminder(item.department_id, selectedYear);
        } catch (error: any) {
          failures.push(`${item.department_name}: ${error?.message || 'Gagal dihantar'}`);
        }
      }

      await fetchData();

      if (failures.length === 0) {
        showToast(`Peringatan berjaya dihantar kepada ${targetItems.length} jabatan.`);
      } else {
        showToast(`Selesai dengan ${failures.length} kegagalan. Semak semula jabatan terlibat.`, 'error');
        console.error('Kegagalan hantar peringatan pukal:', failures);
      }
    } finally {
      setIsSendingBulk(false);
      setBulkProgress(null);
    }
  };

  const reportYear = items[0]?.report_year || selectedYear;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Peringatan Pelaporan</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Semakan penghantaran tahun {reportYear}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Halaman ini memaparkan jabatan yang masih belum melengkapkan Bil 1, Bil 2, dan Bil 3 bagi tahun yang dipilih.
            Pentadbir HQ boleh menghantar peringatan terus kepada pengguna aktif jabatan berkaitan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px]">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Tahun Laporan</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {availableYears.map((year) => (
                <option key={`report-reminder-year-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Jabatan Belum Lengkap</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{items.length}</p>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Muat Semula
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Sedang memuatkan semakan pelaporan...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-medium text-emerald-800">
            Semua jabatan yang mempunyai pengguna aktif telah melengkapkan penghantaran Bil 1, Bil 2, dan Bil 3 bagi tahun {reportYear}.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Carian Jabatan</label>
                  <div className="relative">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="Cari nama jabatan atau bil yang belum lengkap"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 xl:items-end">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      disabled={selectableItems.length === 0 || isSendingBulk}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {areAllSelectableSelected ? 'Nyahpilih Semua Yang Layak' : 'Pilih Semua Yang Layak'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSend(selectedEligibleItems)}
                      disabled={selectedEligibleItems.length === 0 || isSendingBulk}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Bell size={16} />
                      Hantar Peringatan Dipilih
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSend(selectableItems)}
                      disabled={selectableItems.length === 0 || isSendingBulk}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Hantar Semua Yang Layak
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedEligibleItems.length} dipilih daripada {selectableItems.length} jabatan yang layak
                    {bulkProgress ? ` | Sedang dihantar ${bulkProgress.current}/${bulkProgress.total}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {filteredItems.map((item) => (
              <div key={`report-reminder-${item.department_id}`} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedDepartmentIds.includes(item.department_id)}
                          onChange={() => toggleDepartmentSelection(item.department_id)}
                          disabled={item.active_user_count <= 0 || isSendingBulk}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </label>
                      <div className="rounded-2xl bg-white p-3 text-slate-700 ring-1 ring-slate-200">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900">{item.department_name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Laporan tahun {item.report_year} belum lengkap. Bil yang belum dihantar: {item.missing_labels.join(', ')}.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em]">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                        Lengkap dihantar: {item.submitted_labels.length > 0 ? item.submitted_labels.join(', ') : 'Tiada'}
                      </span>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                        Belum lengkap: {item.missing_labels.join(', ')}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                        Pengguna aktif: {item.active_user_count}
                      </span>
                    </div>
                    {item.latest_reminder_at && (
                      <p className="mt-3 text-xs text-slate-500">
                        Peringatan terakhir dihantar pada {new Date(item.latest_reminder_at).toLocaleString('ms-MY', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 xl:items-end">
                    <button
                      type="button"
                      onClick={() => handleSendReminder(item)}
                      disabled={sendingReminderDepartmentId === item.department_id || item.active_user_count === 0 || isSendingBulk}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Bell size={16} />
                      {sendingReminderDepartmentId === item.department_id ? 'Sedang menghantar...' : 'Hantar Peringatan'}
                    </button>
                    {item.active_user_count === 0 && (
                      <p className="text-xs text-rose-600">Tiada pengguna aktif untuk menerima peringatan.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm italic text-slate-500">
                Tiada jabatan ditemui bagi carian semasa.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
