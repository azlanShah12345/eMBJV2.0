import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { CategoryStats, Department, Meeting, PengelasanReport } from '../types';
import { Filter, Download, TrendingUp, Users, FileSpreadsheet, Lock, CheckCircle2, Trash2, FileText, Tag, Building2, Clock3, RefreshCw, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const { showToast } = useToast();
  const [stats, setStats] = useState<CategoryStats[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pendingUnlocks, setPendingUnlocks] = useState<Meeting[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Filters
  const [deptId, setDeptId] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [bil, setBil] = useState('');
  const [category, setCategory] = useState('');
  const [showExports, setShowExports] = useState(false);
  const [showOperationalQueue, setShowOperationalQueue] = useState(false);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const statsRequestRef = useRef(0);

  const normalizeCategoryLabel = (value: unknown) => {
    if (typeof value !== 'string') return '';
    const normalized = value.trim();
    if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
      return '';
    }
    return normalized;
  };

  const downloadPdf = (doc: any, filename: string) => {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const formatPengelasanTitles = (titles: string[]) => {
    if (!titles.length) return '-';
    return titles.map((title, index) => `${index + 1}. ${title}`).join('\n');
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const availableYears = Array.from<number>(
      new Set(
        meetings
          .filter((meeting) => meeting.is_locked === 1)
          .map((meeting) => new Date(meeting.tarikh_mesyuarat).getFullYear())
          .filter((year) => !Number.isNaN(year))
      )
    ).sort((a, b) => b - a);

    if (availableYears.length === 0) {
      if (selectedYear) {
        setSelectedYear('');
      }
      return;
    }

    if (!selectedYear || !availableYears.includes(Number(selectedYear))) {
      setSelectedYear(String(availableYears[0]));
    }
  }, [meetings, selectedYear]);

  useEffect(() => {
    const refreshDashboard = () => {
      fetchInitialData();
      fetchStats();
    };

    const intervalId = window.setInterval(refreshDashboard, 15000);
    window.addEventListener('focus', refreshDashboard);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshDashboard);
    };
  }, [deptId, selectedYear, bil, category]);

  useEffect(() => {
    if (category && !categories.some((item) => item.name === category)) {
      setCategory('');
    }
  }, [categories, category]);

  useEffect(() => {
    fetchStats();
  }, [deptId, selectedYear, bil, category]);

  const fetchInitialData = async () => {
    try {
      const [depts, allMeetings, allCategories] = await Promise.all([
        api.getDepartments(),
        api.getMeetings(),
        api.getCategories()
      ]);
      setDepartments(depts);
      setCategories(
        allCategories
          .map((item) => ({
            id: Number(item.id),
            name: typeof item.name === 'string' ? item.name.trim() : '',
          }))
          .filter((item) => item.name.length > 0)
      );
      setMeetings(allMeetings);
      setPendingUnlocks(allMeetings.filter(m => m.unlock_requested === 1));
      setPendingDeletes(allMeetings.filter(m => m.delete_requested === 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveUnlock = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Luluskan Buka Kunci',
      message: 'Luluskan permohonan buka kunci ini?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.approveUnlock(id);
          showToast('Permohonan buka kunci telah diluluskan');
          fetchInitialData();
          fetchStats();
        } catch (err) {
          showToast('Gagal meluluskan permohonan buka kunci', 'error');
        }
      }
    });
  };

  const handleRejectUnlock = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Tolak Permohonan Buka Kunci',
      message: 'Tolak permohonan buka kunci ini?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.rejectUnlock(id);
          showToast('Permohonan buka kunci telah ditolak');
          fetchInitialData();
          fetchStats();
        } catch (err) {
          showToast('Gagal menolak permohonan buka kunci', 'error');
        }
      }
    });
  };

  const handleApproveDelete = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Luluskan Hapus',
      message: 'Luluskan permohonan hapus ini? Rekod akan dihapuskan secara kekal.',
      isDanger: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.approveDeleteMeeting(id);
          showToast('Rekod mesyuarat telah dihapuskan');
          fetchInitialData();
          fetchStats();
        } catch (err) {
          showToast('Gagal meluluskan permohonan hapus', 'error');
        }
      }
    });
  };

  const handleRejectDelete = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Tolak Permohonan Hapus',
      message: 'Tolak permohonan hapus ini?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.rejectDeleteMeeting(id);
          showToast('Permohonan hapus telah ditolak');
          fetchInitialData();
          fetchStats();
        } catch (err) {
          showToast('Gagal menolak permohonan hapus', 'error');
        }
      }
    });
  };

  const fetchStats = async () => {
    const requestId = ++statsRequestRef.current;
    setLoading(true);
    try {
      const data = await api.getStats({ 
        department_id: deptId ? Number(deptId) : undefined, 
        year: selectedYear ? Number(selectedYear) : undefined,
        bil_mesyuarat: bil || undefined,
        category: category || undefined,
      });
      const statsMap = new Map<string, { category: string; total: number; selesai: number; belum_selesai: number }>();

      data.forEach((item) => {
        const categoryName = normalizeCategoryLabel(item.category);
        if (!categoryName) return;

        const current = statsMap.get(categoryName) || {
          category: categoryName,
          total: 0,
          selesai: 0,
          belum_selesai: 0,
        };

        current.total += Number(item.total) || 0;
        current.selesai += Number(item.selesai) || 0;
        current.belum_selesai += Number(item.belum_selesai) || 0;
        statsMap.set(categoryName, current);
      });

      const normalizedStats = Array.from(statsMap.values());

      if (requestId !== statsRequestRef.current) {
        return;
      }

      setStats(
        normalizedStats
      );
    } catch (err) {
      console.error(err);
    } finally {
      if (requestId === statsRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const submittedMeetings = meetings.filter((meeting) => {
    if (meeting.is_locked !== 1) return false;
    if (deptId && Number(meeting.department_id) !== Number(deptId)) return false;
    if (selectedYear && String(new Date(meeting.tarikh_mesyuarat).getFullYear()) !== selectedYear) return false;
    if (bil && meeting.bil_mesyuarat !== bil) return false;
    if (category) {
      const meetingCategories = (meeting.issue_categories || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (!meetingCategories.includes(category)) return false;
    }
    return true;
  });
  const totalIssues = submittedMeetings.reduce((acc, meeting) => acc + Number(meeting.total_issues || 0), 0);
  const totalSelesai = submittedMeetings.reduce((acc, meeting) => acc + Number(meeting.completed_issues || 0), 0);
  const completionRate = totalIssues > 0 ? (totalSelesai / totalIssues) * 100 : 0;
  const analyticsYears = Array.from<number>(
    new Set(
      meetings
        .filter((meeting) => meeting.is_locked === 1)
        .map((meeting) => new Date(meeting.tarikh_mesyuarat).getFullYear())
        .filter((year) => !Number.isNaN(year))
    )
  ).sort((a, b) => b - a);
  const activeDepartmentName = departments.find((item) => item.id === Number(deptId))?.name || 'Semua Jabatan';
  const activeYearLabel = selectedYear || 'Semua Tahun';
  const activeMeetingLabel = bil || 'Semua Mesyuarat';
  const activeCategoryLabel = category || 'Semua Kategori';
  const submittedMeetingsForLampiranA = meetings
    .filter((meeting) => meeting.is_locked === 1)
    .filter((meeting) => !deptId || Number(meeting.department_id) === Number(deptId))
    .filter((meeting) => !selectedYear || String(new Date(meeting.tarikh_mesyuarat).getFullYear()) === selectedYear)
    .sort((a, b) => a.department_name.localeCompare(b.department_name) || a.bil_mesyuarat.localeCompare(b.bil_mesyuarat));
  const reportYear = selectedYear
    ? Number(selectedYear)
    : submittedMeetingsForLampiranA[0]?.tarikh_mesyuarat
      ? new Date(submittedMeetingsForLampiranA[0].tarikh_mesyuarat).getFullYear()
      : new Date().getFullYear();
  const lampiranARows = departments
    .filter((department) => !deptId || department.id === Number(deptId))
    .map((department) => {
      const departmentMeetings = submittedMeetingsForLampiranA.filter((meeting) => meeting.department_id === department.id);
      const byBil = (meetingLabel: string) => {
        const meeting = departmentMeetings.find((item) => item.bil_mesyuarat === meetingLabel);
        if (!meeting) return '';
        const meetingDate = new Date(meeting.tarikh_mesyuarat).toLocaleDateString('ms-MY');
        return meeting.submission_method ? `${meetingDate} (${meeting.submission_method})` : meetingDate;
      };
      return {
        department: department.name,
        bil1: byBil('Bil 1'),
        bil2: byBil('Bil 2'),
        bil3: byBil('Bil 3'),
      };
    });
  const lampiranATotals = {
    bil1: lampiranARows.filter((row) => row.bil1).length,
    bil2: lampiranARows.filter((row) => row.bil2).length,
    bil3: lampiranARows.filter((row) => row.bil3).length,
    totalDepartments: lampiranARows.length || 1,
  };
  const hasLampiranAData = lampiranARows.some((row) => row.bil1 || row.bil2 || row.bil3);
  const lampiranBTotalRow = [
    'Jumlah Keseluruhan',
    totalIssues,
    totalSelesai,
    Math.max(0, totalIssues - totalSelesai),
    `${completionRate.toFixed(1)}%`
  ];
  const visibleStats = stats.filter((item) => item.total > 0 || item.selesai > 0 || item.belum_selesai > 0);
  const lampiranBRows = (() => {
    const categoryTotals = new Map<string, { total: number; selesai: number; belum_selesai: number }>();

    visibleStats
      .forEach((item) => {
        const key = normalizeCategoryLabel(item.category);
        if (!key) return;
        const existing = categoryTotals.get(key) || { total: 0, selesai: 0, belum_selesai: 0 };
        existing.total += item.total;
        existing.selesai += item.selesai;
        existing.belum_selesai += item.belum_selesai;
        categoryTotals.set(key, existing);
      });

    const baseRows = Array.from(categoryTotals.entries()).map(([categoryName, totals]) => ({
      category: categoryName,
      total: totals.total,
      selesai: totals.selesai,
      belum_selesai: totals.belum_selesai,
    }));

    if (baseRows.length > 0) {
      return baseRows;
    }

    if (submittedMeetings.length > 0 && category) {
      return [{
        category,
        total: totalIssues,
        selesai: totalSelesai,
        belum_selesai: Math.max(0, totalIssues - totalSelesai),
      }];
    }

    return [];
  })();
  const hasLampiranBData = lampiranBRows.length > 0;
  const totalPending = Math.max(0, totalIssues - totalSelesai);
  const activeDepartmentsCount = new Set(submittedMeetings.map((meeting) => meeting.department_id)).size;
  const latestSubmissionLabel = submittedMeetings.length > 0
    ? new Date(
        submittedMeetings
          .map((meeting) => meeting.created_at || meeting.tarikh_mesyuarat)
          .sort()
          .slice(-1)[0]
      ).toLocaleString('ms-MY')
    : 'Tiada laporan';
  const departmentPerformanceMap = submittedMeetings.reduce((map, meeting) => {
      const key = meeting.department_name;
      const current = map.get(key) || { department: key, reports: 0, issues: 0, selesai: 0 };
      current.reports += 1;
      current.issues += Number(meeting.total_issues || 0);
      current.selesai += Number(meeting.completed_issues || 0);
      map.set(key, current);
      return map;
    }, new Map<string, { department: string; reports: number; issues: number; selesai: number }>());
  const departmentPerformance = Array.from(
    departmentPerformanceMap.values() as Iterable<{ department: string; reports: number; issues: number; selesai: number }>
  )
    .map((item: { department: string; reports: number; issues: number; selesai: number }) => ({
      ...item,
      pending: Math.max(0, item.issues - item.selesai),
      completion: item.issues > 0 ? (item.selesai / item.issues) * 100 : 0,
    }))
    .sort((a, b) => b.issues - a.issues || b.reports - a.reports);
  const departmentTrendPeak = departmentPerformance.reduce((max, item) => Math.max(max, item.issues, item.reports, item.selesai), 1);
  const departmentMonthlyTrend = submittedMeetings.reduce((map, meeting) => {
    const monthIndex = new Date(meeting.tarikh_mesyuarat).getMonth();
    const key = meeting.department_name;
    const current = map.get(key) || Array.from({ length: 12 }, () => 0);
    if (monthIndex >= 0 && monthIndex < 12) {
      current[monthIndex] += Number(meeting.total_issues || 0);
    }
    map.set(key, current);
    return map;
  }, new Map<string, number[]>());
  const topDepartment = departmentPerformance[0];
  const attentionDepartment = [...departmentPerformance]
    .filter((item) => item.issues > 0)
    .sort((a, b) => a.completion - b.completion || b.pending - a.pending)[0];
  const topCategory = [...visibleStats].sort((a, b) => b.total - a.total || b.selesai - a.selesai)[0];
  const monthlyTrend = (() => {
    const monthFormatter = new Intl.DateTimeFormat('ms-MY', { month: 'short' });
    const monthMap = new Map<number, { monthIndex: number; label: string; reports: number; issues: number; selesai: number }>();

    submittedMeetings.forEach((meeting) => {
      const meetingDate = new Date(meeting.tarikh_mesyuarat);
      const monthIndex = Number.isNaN(meetingDate.getTime()) ? -1 : meetingDate.getMonth();
      if (monthIndex < 0) return;
      const existing = monthMap.get(monthIndex) || {
        monthIndex,
        label: monthFormatter.format(new Date(2026, monthIndex, 1)),
        reports: 0,
        issues: 0,
        selesai: 0,
      };
      existing.reports += 1;
      existing.issues += Number(meeting.total_issues || 0);
      existing.selesai += Number(meeting.completed_issues || 0);
      monthMap.set(monthIndex, existing);
    });

    return Array.from(monthMap.values())
      .sort((a, b) => a.monthIndex - b.monthIndex)
      .map((item) => ({
        ...item,
        completion: item.issues > 0 ? (item.selesai / item.issues) * 100 : 0,
      }));
  })();
  const monthlyTrendPeak = monthlyTrend.reduce((max, item) => Math.max(max, item.reports, item.issues), 1);
  const unresolvedCategories = [...visibleStats]
    .filter((item) => item.belum_selesai > 0)
    .sort((a, b) => b.belum_selesai - a.belum_selesai || b.total - a.total)
    .slice(0, 5);
  const selectedCategoryStats = category ? visibleStats.find((item) => item.category === category) : null;
  const relatedMeetings = submittedMeetings
    .filter((meeting) => {
      if (!category) return true;
      return (meeting.issue_categories || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .includes(category);
    })
    .slice(0, 5);
  const dashboardCards = [
    {
      label: 'Penyelesaian Keseluruhan',
      value: `${completionRate.toFixed(1)}%`,
      note: `${totalSelesai}/${totalIssues || 0} isu selesai`,
      icon: TrendingUp,
      accent: 'emerald',
    },
    {
      label: 'Laporan Dihantar',
      value: `${submittedMeetings.length}`,
      note: `${activeDepartmentsCount} jabatan terlibat`,
      icon: FileText,
      accent: 'blue',
    },
    {
      label: 'Penyelesaian Tertunggak',
      value: `${totalPending}`,
      note: totalPending > 0 ? 'Perlu tindakan susulan' : 'Tiada isu tertunggak',
      icon: Clock3,
      accent: 'amber',
    },
    {
      label: 'Kategori Tertinggi',
      value: topCategory?.category || 'Tiada data',
      note: topCategory ? `${topCategory.total} isu direkodkan` : 'Belum ada kategori aktif',
      icon: Activity,
      accent: 'slate',
    },
  ] as const;
  const totalPendingRequests = pendingUnlocks.length + pendingDeletes.length;

  const exportLampiranAPDF = () => {
    if (!hasLampiranAData) {
      showToast('Tiada data untuk dijana bagi Lampiran A', 'error');
      return;
    }
    try {
      const doc = new jsPDF() as any;
    doc.setFontSize(13);
    doc.text('LAMPIRAN A', 14, 18);
    doc.setFontSize(11);
    doc.text('LAPORAN PEMANTAUAN KEAKTIFAN MBJ JABATAN-JABATAN', 14, 26);
    doc.text('DI BAWAH KEMENTERIAN / PEJABAT SETIAUSAHA KERAJAAN NEGERI', 14, 32);
    doc.text(`TAHUN ${reportYear}`, 14, 38);
    doc.setFontSize(10);
    doc.text(`Skop: ${activeDepartmentName}`, 14, 46);
    doc.text('D = Minit diterima melalui pos / hardcopy', 14, 52);
    doc.text('E = Minit diterima melalui emel', 14, 58);

      autoTable(doc, {
      startY: 64,
      head: [['Bil.', 'Jabatan', 'Bil 1 (Jan-Apr)', 'Bil 2 (Mei-Ogos)', 'Bil 3 (Sep-Dis)']],
      body: lampiranARows.map((row, index) => [index + 1, row.department, row.bil1, row.bil2, row.bil3]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 68 },
        2: { cellWidth: 34 },
        3: { cellWidth: 34 },
        4: { cellWidth: 34 },
      }
    });

      autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Rumusan', 'Bil 1', 'Bil 2', 'Bil 3']],
      body: [
        [
          'Jumlah pelaksanaan mesyuarat MBJ',
          `${lampiranATotals.bil1}/${lampiranATotals.totalDepartments}`,
          `${lampiranATotals.bil2}/${lampiranATotals.totalDepartments}`,
          `${lampiranATotals.bil3}/${lampiranATotals.totalDepartments}`,
        ],
        [
          'Peratus pencapaian',
          `${((lampiranATotals.bil1 / lampiranATotals.totalDepartments) * 100).toFixed(0)} %`,
          `${((lampiranATotals.bil2 / lampiranATotals.totalDepartments) * 100).toFixed(0)} %`,
          `${((lampiranATotals.bil3 / lampiranATotals.totalDepartments) * 100).toFixed(0)} %`,
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 9 }
    });
      downloadPdf(doc, 'Lampiran-A.pdf');
      showToast('Lampiran A PDF berjaya dimuat turun');
    } catch (error) {
      console.error(error);
      showToast('Gagal menjana Lampiran A PDF', 'error');
    }
  };

  const exportLampiranAExcel = () => {
    if (!hasLampiranAData) {
      showToast('Tiada data untuk dijana bagi Lampiran A', 'error');
      return;
    }
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['LAMPIRAN A'],
      ['LAPORAN PEMANTAUAN KEAKTIFAN MBJ JABATAN'],
      [`TAHUN ${reportYear}`],
      [],
      ['Bil.', 'Jabatan', 'Bil 1 (Jan-Apr)', 'Bil 2 (Mei-Ogos)', 'Bil 3 (Sep-Dis)'],
      ...lampiranARows.map((row, index) => [index + 1, row.department, row.bil1, row.bil2, row.bil3]),
      [],
      ['Jumlah pelaksanaan mesyuarat MBJ', `${lampiranATotals.bil1}/${lampiranATotals.totalDepartments}`, `${lampiranATotals.bil2}/${lampiranATotals.totalDepartments}`, `${lampiranATotals.bil3}/${lampiranATotals.totalDepartments}`],
      ['Peratus pencapaian', `${((lampiranATotals.bil1 / lampiranATotals.totalDepartments) * 100).toFixed(0)} %`, `${((lampiranATotals.bil2 / lampiranATotals.totalDepartments) * 100).toFixed(0)} %`, `${((lampiranATotals.bil3 / lampiranATotals.totalDepartments) * 100).toFixed(0)} %`],
      [],
      ['Nota', 'D = Hardcopy / Pos', 'E = Emel']
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lampiran A');
    XLSX.writeFile(workbook, 'Lampiran-A.xlsx');
  };

  const exportLampiranBPDF = () => {
    if (!hasLampiranBData) {
      showToast('Tiada data untuk dijana bagi Lampiran B', 'error');
      return;
    }
    try {
      const doc = new jsPDF() as any;
    doc.setFontSize(13);
    doc.text('LAMPIRAN B', 14, 18);
    doc.setFontSize(11);
    doc.text('LAPORAN PENGELASAN DAN PENYELESAIAN ISU MBJ', 14, 26);
    doc.text('BAGI SUK SARAWAK DAN AGENSI-AGENSI DI BAWAH SELIAAN', 14, 32);
    doc.text(`TAHUN ${reportYear}`, 14, 38);
    doc.setFontSize(10);
    doc.text(`Skop Jabatan: ${activeDepartmentName}`, 14, 46);
    doc.text(`Skop Mesyuarat: ${activeMeetingLabel}`, 14, 52);
    doc.text(`Skop Kategori: ${activeCategoryLabel}`, 14, 58);

      autoTable(doc, {
      startY: 66,
      head: [['Kategori Isu', 'Bilangan Isu', 'Bilangan Isu Selesai', 'Bilangan Isu Belum Selesai', 'Peratus']],
      body: lampiranBRows.map((item) => [
        item.category,
        item.total,
        item.selesai,
        item.belum_selesai,
        `${item.total > 0 ? ((item.selesai / item.total) * 100).toFixed(1) : '0.0'}%`
      ]),
      foot: [lampiranBTotalRow],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      footStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 28 },
        2: { cellWidth: 32 },
        3: { cellWidth: 36 },
        4: { cellWidth: 22 },
      }
    });

      downloadPdf(doc, 'Lampiran-B-Analitik.pdf');
      showToast('Lampiran B PDF berjaya dimuat turun');
    } catch (error) {
      console.error(error);
      showToast('Gagal menjana Lampiran B PDF', 'error');
    }
  };

  const exportLampiranBExcel = () => {
    if (!hasLampiranBData) {
      showToast('Tiada data untuk dijana bagi Lampiran B', 'error');
      return;
    }
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['LAMPIRAN B'],
      ['LAPORAN PENGELASAN DAN PENYELESAIAN ISU MBJ'],
      [`TAHUN ${reportYear}`],
      [],
      ['Kategori Isu', 'Bilangan Isu', 'Bilangan Isu Selesai', 'Bilangan Isu Belum Selesai', 'Peratus'],
      ...lampiranBRows.map((item) => [
        item.category,
        item.total,
        item.selesai,
        item.belum_selesai,
        `${item.total > 0 ? ((item.selesai / item.total) * 100).toFixed(1) : '0.0'}%`
      ]),
      lampiranBTotalRow
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lampiran B');
    XLSX.writeFile(workbook, 'Lampiran-B-Analitik.xlsx');
  };

  const fetchPengelasanReport = async (): Promise<PengelasanReport | null> => {
    try {
      const report = await api.getPengelasanReport({
        department_id: deptId ? Number(deptId) : undefined,
        year: selectedYear ? Number(selectedYear) : undefined,
        bil_mesyuarat: bil || undefined,
        category: category || undefined,
      });
      if (!report.rows.some((row) =>
        row.previous_selesai_titles.length ||
        row.previous_belum_titles.length ||
        row.new_selesai_titles.length ||
        row.new_belum_titles.length
      )) {
        showToast('Tiada data isu untuk dijana bagi Jadual Pengelasan', 'error');
        return null;
      }
      return report;
    } catch (error) {
      console.error(error);
      showToast('Gagal mendapatkan data Jadual Pengelasan', 'error');
      return null;
    }
  };

  const exportPengelasanPDF = async () => {
    const report = await fetchPengelasanReport();
    if (!report) return;

    try {
      const doc = new jsPDF({ orientation: 'landscape' }) as any;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(12, 10, 273, 18, 4, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.text('JADUAL PENGELASAN DAN PENYELESAIAN ISU', 18, 21);
      doc.setTextColor(51, 65, 85);
      doc.setFillColor(240, 249, 255);
      doc.roundedRect(12, 32, 273, 16, 3, 3, 'F');
      doc.setFontSize(10);
      doc.text(`Jabatan: ${report.department_name}`, 18, 39);
      doc.text(`Minit Mesyuarat MBJ: ${report.meeting_label}`, 98, 39);
      doc.text(`Tahun: ${report.report_year}`, 228, 39);

      autoTable(doc, {
        startY: 54,
        head: [
          [
            { content: 'Bil.', rowSpan: 2 },
            { content: 'Kategori', rowSpan: 2 },
            { content: 'Perkara berbangkit dari minit MBJ yang lalu', colSpan: 3 },
            { content: 'Isu baharu yang dibincangkan dalam mesyuarat terkini', colSpan: 3 },
          ],
          [
            { content: 'Selesai' },
            { content: 'Belum selesai' },
            { content: 'Tajuk isu / Catatan' },
            { content: 'Selesai' },
            { content: 'Belum selesai' },
            { content: 'Tajuk isu / Catatan' },
          ],
        ],
        body: [
          ...report.rows.map((row, index) => ([
            index + 1,
            row.category,
            row.previous_selesai_titles.length,
            row.previous_belum_titles.length,
            formatPengelasanTitles([
              ...row.previous_selesai_titles.map((title) => `[Selesai] ${title}`),
              ...row.previous_belum_titles.map((title) => `[Belum selesai] ${title}`),
            ]),
            row.new_selesai_titles.length,
            row.new_belum_titles.length,
            formatPengelasanTitles([
              ...row.new_selesai_titles.map((title) => `[Selesai] ${title}`),
              ...row.new_belum_titles.map((title) => `[Belum selesai] ${title}`),
            ]),
          ])),
          [
            '',
            'Jumlah isu',
            report.totals.previous_selesai,
            report.totals.previous_belum,
            '',
            report.totals.new_selesai,
            report.totals.new_belum,
            `Jumlah keseluruhan: ${report.totals.overall}`,
          ],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: 'center', valign: 'middle', lineColor: [203, 213, 225], lineWidth: 0.2 },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'top', lineColor: [203, 213, 225], lineWidth: 0.1, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 34, fontStyle: 'bold' },
          2: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          4: { cellWidth: 48 },
          5: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          7: { cellWidth: 56 },
        },
        didParseCell: (hookData) => {
          if (hookData.section === 'head' && hookData.row.index === 1) {
            if (hookData.column.index >= 2 && hookData.column.index <= 4) {
              hookData.cell.styles.fillColor = [224, 242, 254];
              hookData.cell.styles.textColor = [12, 74, 110];
            }
            if (hookData.column.index >= 5 && hookData.column.index <= 7) {
              hookData.cell.styles.fillColor = [220, 252, 231];
              hookData.cell.styles.textColor = [20, 83, 45];
            }
          }

          if (hookData.section === 'body') {
            const isTotalRow = hookData.row.index === report.rows.length;
            if (isTotalRow) {
              hookData.cell.styles.fillColor = [254, 240, 138];
              hookData.cell.styles.textColor = [113, 63, 18];
              hookData.cell.styles.fontStyle = 'bold';
            } else {
              if (hookData.column.index >= 2 && hookData.column.index <= 4) {
                hookData.cell.styles.fillColor = hookData.row.index % 2 === 0 ? [239, 246, 255] : [248, 250, 252];
              }
              if (hookData.column.index >= 5 && hookData.column.index <= 7) {
                hookData.cell.styles.fillColor = hookData.row.index % 2 === 0 ? [240, 253, 244] : [248, 250, 252];
              }
            }
          }
        },
      });

      downloadPdf(doc, 'Jadual-Pengelasan.pdf');
      showToast('Jadual Pengelasan PDF berjaya dimuat turun');
    } catch (error) {
      console.error(error);
      showToast('Gagal menjana Jadual Pengelasan PDF', 'error');
    }
  };

  const exportPengelasanExcel = async () => {
    const report = await fetchPengelasanReport();
    if (!report) return;

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['JADUAL PENGELASAN DAN PENYELESAIAN ISU'],
      [`Jabatan: ${report.department_name}`],
      [`Minit Mesyuarat MBJ: ${report.meeting_label}`],
      [`Tahun: ${report.report_year}`],
      [],
      ['Bil.', 'Kategori', 'Perkara Berbangkit - Selesai', 'Perkara Berbangkit - Belum Selesai', 'Perkara Berbangkit - Tajuk Isu / Catatan', 'Isu Baharu - Selesai', 'Isu Baharu - Belum Selesai', 'Isu Baharu - Tajuk Isu / Catatan'],
      ...report.rows.map((row, index) => [
        index + 1,
        row.category,
        row.previous_selesai_titles.length,
        row.previous_belum_titles.length,
        [
          ...row.previous_selesai_titles.map((title) => `[Selesai] ${title}`),
          ...row.previous_belum_titles.map((title) => `[Belum selesai] ${title}`),
        ].join('\n'),
        row.new_selesai_titles.length,
        row.new_belum_titles.length,
        [
          ...row.new_selesai_titles.map((title) => `[Selesai] ${title}`),
          ...row.new_belum_titles.map((title) => `[Belum selesai] ${title}`),
        ].join('\n'),
      ]),
      ['', 'Jumlah isu', report.totals.previous_selesai, report.totals.previous_belum, '', report.totals.new_selesai, report.totals.new_belum, report.totals.overall],
    ]);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 24 },
      { wch: 18 },
      { wch: 24 },
      { wch: 48 },
      { wch: 18 },
      { wch: 24 },
      { wch: 52 },
    ];
    worksheet['!rows'] = [
      { hpt: 22 },
      { hpt: 18 },
      { hpt: 18 },
      { hpt: 18 },
      { hpt: 10 },
      { hpt: 32 },
    ];
    worksheet['!autofilter'] = { ref: 'A6:H6' };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jadual Pengelasan');
    XLSX.writeFile(workbook, 'Jadual-Pengelasan.xlsx');
    showToast('Jadual Pengelasan Excel berjaya dimuat turun');
  };

  return (
    <div className="space-y-8">
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDanger={confirmConfig.isDanger}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eefbf4_52%,#ffffff_100%)] p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
              <RefreshCw size={12} />
              analitik langsung HQ
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Papan Pemuka Pentadbir</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Semua angka di bawah disusun daripada laporan yang telah dihantar ke HQ. Penapis akan mengubah kad ringkasan,
                pecahan kategori, laporan PDF, dan senarai laporan secara serentak.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-900 px-3 py-1.5 font-semibold text-white">{activeDepartmentName}</span>
              <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 ring-1 ring-slate-200">{activeMeetingLabel}</span>
              <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 ring-1 ring-slate-200">{activeCategoryLabel}</span>
            </div>
          </div>
          <div className="grid min-w-[280px] grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Penyelarasan Terkini</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{latestSubmissionLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Jabatan Tertinggi</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{topDepartment?.department || 'Tiada data'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {topDepartment ? `${topDepartment.reports} laporan, ${topDepartment.completion.toFixed(1)}% selesai` : 'Belum ada laporan dihantar'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowExports((value) => !value)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            {showExports ? 'Sembunyikan Panel Muat Turun' : 'Buka Panel Muat Turun'}
          </button>
          <button
            type="button"
            onClick={() => setShowOperationalQueue((value) => !value)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            {showOperationalQueue ? 'Sembunyikan Permohonan' : `Lihat Permohonan (${totalPendingRequests})`}
          </button>
          <button
            type="button"
            onClick={() => setShowAdvancedAnalytics((value) => !value)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            {showAdvancedAnalytics ? 'Sembunyikan Analitik Lanjutan' : 'Buka Analitik Lanjutan'}
          </button>
        </div>
        {showExports && (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-3">
            <button 
              onClick={exportLampiranAExcel}
              disabled={!hasLampiranAData}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet size={18} />
              Excel Lampiran A
            </button>
            <button 
              onClick={exportLampiranAPDF}
              disabled={!hasLampiranAData}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={18} />
              PDF Lampiran A
            </button>
            <button 
              onClick={exportLampiranBExcel}
              disabled={!hasLampiranBData}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet size={18} />
              Excel Lampiran B
            </button>
            <button 
              onClick={exportLampiranBPDF}
              disabled={!hasLampiranBData}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={18} />
              PDF Lampiran B
            </button>
            <button
              onClick={exportPengelasanExcel}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-white"
            >
              <FileSpreadsheet size={18} />
              Excel Jadual Pengelasan
            </button>
            <button
              onClick={exportPengelasanPDF}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-800"
            >
              <Download size={18} />
              PDF Jadual Pengelasan
            </button>
          </div>
        )}
        </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Penapis Analitik</h3>
            <p className="text-sm text-slate-500">Gunakan penapis untuk semak prestasi mengikut jabatan, mesyuarat, atau kategori.</p>
          </div>
          <button 
            onClick={() => { setDeptId(''); setSelectedYear(analyticsYears[0] ? String(analyticsYears[0]) : ''); setBil(''); setCategory(''); }}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            Tetapkan Semula Penapis
          </button>
        </div>
        <div className="flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Building2 size={14} /> Tahun Laporan
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {analyticsYears.length === 0 && <option value="">Tiada Tahun</option>}
            {analyticsYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Users size={14} /> Jabatan
          </label>
          <select 
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Jabatan</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Filter size={14} /> Bilangan Mesyuarat
          </label>
          <select 
            value={bil}
            onChange={(e) => setBil(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Mesyuarat</option>
            <option>Bil 1</option>
            <option>Bil 2</option>
            <option>Bil 3</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Tag size={14} /> Kategori
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Kategori</option>
            {categories.filter((item) => item.name).map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
        </div>
        </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Skop Semasa</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{activeYearLabel} | {activeDepartmentName} | {activeMeetingLabel} | {activeCategoryLabel}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Laporan Sepadan</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{submittedMeetings.length} laporan dihantar ke HQ</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Kategori Sepadan</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{visibleStats.length} kategori mempunyai data</p>
          </div>
        </div>
        {(deptId || bil || category || (selectedYear && analyticsYears[0] && String(analyticsYears[0]) !== selectedYear)) && (
          <div className="mt-4 flex flex-wrap gap-3">
            {selectedYear && analyticsYears[0] && String(analyticsYears[0]) !== selectedYear && (
              <button
                type="button"
                onClick={() => setSelectedYear(analyticsYears[0] ? String(analyticsYears[0]) : '')}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
              >
                Buang penapis tahun
              </button>
            )}
            {deptId && (
              <button
                type="button"
                onClick={() => setDeptId('')}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
              >
                Buang penapis jabatan
              </button>
            )}
            {bil && (
              <button
                type="button"
                onClick={() => setBil('')}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
              >
                Buang penapis mesyuarat
              </button>
            )}
            {category && (
              <button
                type="button"
                onClick={() => setCategory('')}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
              >
                Buang penapis kategori
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {showOperationalQueue && (pendingUnlocks.length > 0 || pendingDeletes.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pendingUnlocks.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="text-indigo-600" size={20} />
                <h3 className="font-bold text-indigo-900 text-lg">Permohonan Buka Kunci</h3>
              </div>
              <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-2">
                {pendingUnlocks.map(m => (
                  <div key={m.id} className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm flex justify-between items-center">
                    <div>
                      <Link to={`/meeting/${m.id}`} className="font-bold text-slate-800 hover:text-indigo-600 transition-colors">
                        {m.bil_mesyuarat}
                      </Link>
                      <p className="text-xs text-slate-500">{m.department_name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRejectUnlock(m.id)}
                        className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                      >
                        Tolak
                      </button>
                      <button 
                        onClick={() => handleApproveUnlock(m.id)}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 size={14} /> Luluskan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingDeletes.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trash2 className="text-red-600" size={20} />
                <h3 className="font-bold text-red-900 text-lg">Permohonan Hapus</h3>
              </div>
              <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-2">
                {pendingDeletes.map(m => (
                  <div key={m.id} className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex justify-between items-center">
                    <div>
                      <Link to={`/meeting/${m.id}`} className="font-bold text-slate-800 hover:text-red-600 transition-colors">
                        {m.bil_mesyuarat}
                      </Link>
                      <p className="text-xs text-slate-500">{m.department_name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRejectDelete(m.id)}
                        className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                      >
                        Tolak
                      </button>
                      <button 
                        onClick={() => handleApproveDelete(m.id)}
                        className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 size={14} /> Luluskan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((card) => {
          const Icon = card.icon;
          const accentClasses = {
            emerald: 'bg-emerald-50 text-emerald-600',
            blue: 'bg-blue-50 text-blue-600',
            amber: 'bg-amber-50 text-amber-600',
            slate: 'bg-slate-100 text-slate-700',
          }[card.accent];

          return (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
                  <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-900">{card.value}</h3>
                  <p className="mt-2 text-sm text-slate-500">{card.note}</p>
                </div>
                <div className={`rounded-2xl p-3 ${accentClasses}`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAdvancedAnalytics && (
      <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_35%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Paparan Eksekutif</p>
            <h3 className="mt-2 text-2xl font-black text-slate-900">Ringkasan pengurusan untuk tindakan pantas</h3>
            <p className="mt-2 text-sm text-slate-600">
              Blok ini menonjolkan pencapaian terbaik, kawasan yang perlu perhatian segera, dan kategori yang paling memberi kesan
              dalam skop penapis semasa.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-300">Skor Pelaksanaan</p>
            <p className="mt-2 text-3xl font-black">{completionRate.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-slate-300">{submittedMeetings.length} laporan aktif dalam skop ini</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Jabatan Paling Cemerlang</p>
            <p className="mt-3 text-xl font-black text-slate-900">{topDepartment?.department || 'Tiada data'}</p>
            <p className="mt-2 text-sm text-slate-600">
              {topDepartment ? `${topDepartment.completion.toFixed(1)}% selesai dengan ${topDepartment.reports} laporan diterima.` : 'Belum ada jabatan untuk dibandingkan.'}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Jabatan Perlu Perhatian</p>
            <p className="mt-3 text-xl font-black text-slate-900">{attentionDepartment?.department || 'Tiada data'}</p>
            <p className="mt-2 text-sm text-slate-600">
              {attentionDepartment ? `${attentionDepartment.pending} isu tertunggak dengan kadar selesai ${attentionDepartment.completion.toFixed(1)}%.` : 'Tiada jabatan tertunggak dalam skop semasa.'}
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-700">Kategori Utama</p>
            <p className="mt-3 text-xl font-black text-slate-900">{topCategory?.category || 'Tiada data'}</p>
            <p className="mt-2 text-sm text-slate-600">
              {topCategory ? `${topCategory.total} isu direkodkan dengan ${topCategory.selesai} telah selesai.` : 'Belum ada kategori aktif dalam skop semasa.'}
            </p>
          </div>
        </div>
      </div>
      )}

      <div className={`grid grid-cols-1 gap-6 ${showAdvancedAnalytics ? 'xl:grid-cols-[1.35fr_0.95fr]' : ''}`}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Pecahan Mengikut Kategori</h3>
              <p className="mt-1 text-sm text-slate-500">Prestasi kategori berdasarkan laporan yang telah diserahkan ke HQ.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              {visibleStats.length} kategori aktif
            </div>
          </div>
          <div className="mt-5 max-h-[32rem] overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Jumlah</th>
                  <th className="px-6 py-4">Selesai</th>
                  <th className="px-6 py-4">Belum Selesai</th>
                  <th className="px-6 py-4">Kemajuan</th>
                  <th className="px-6 py-4 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Sedang memuatkan statistik...</td></tr>
                ) : visibleStats.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Tiada data kategori dilaporkan yang sepadan dengan penapis yang dipilih.</td></tr>
                ) : (
                  visibleStats.map((s, index) => {
                    const progress = s.total > 0 ? (s.selesai / s.total) * 100 : 0;
                    return (
                      <tr
                        key={`${s.category}-${index}`}
                        className="cursor-pointer hover:bg-slate-50/60 transition-colors"
                        onClick={() => setCategory(s.category)}
                      >
                        <td className="px-6 py-4 font-bold text-slate-700">
                          <button
                            type="button"
                            onClick={() => setCategory(s.category)}
                            className="text-left hover:text-emerald-600 transition-colors"
                          >
                            {s.category}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">{s.total}</td>
                        <td className="px-6 py-4 text-emerald-600 font-bold">{s.selesai}</td>
                        <td className="px-6 py-4 text-amber-600 font-bold">{s.belum_selesai}</td>
                        <td className="px-6 py-4 min-w-[170px]">
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">{progress.toFixed(1)}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showAdvancedAnalytics && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Building2 className="text-slate-700" size={18} />
            <h3 className="text-lg font-bold text-slate-900">Prestasi Jabatan</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">Ringkasan jabatan yang menyumbang laporan dalam skop semasa.</p>
          <div className="mt-5 max-h-[32rem] space-y-4 overflow-y-auto pr-2">
            {departmentPerformance.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm italic text-slate-400">
                Tiada data prestasi jabatan yang sepadan dengan penapis yang dipilih.
              </div>
            ) : (
              departmentPerformance.slice(0, 5).map((item) => (
                <div key={item.department} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">{item.department}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.reports} laporan | {item.issues} isu</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                      {item.completion.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${item.completion}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Selesai: {item.selesai}</span>
                    <span>Tertunggak: {item.pending}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </div>

      {showAdvancedAnalytics && (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Graf Trend Jabatan</h3>
            <p className="mt-1 text-sm text-slate-500">Perbandingan visual antara jumlah laporan, isu, dan isu selesai mengikut jabatan dalam skop semasa.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
            {departmentPerformance.length} jabatan aktif
          </div>
        </div>
        <div className="mt-6 max-h-[38rem] space-y-5 overflow-y-auto pr-2">
          {departmentPerformance.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm italic text-slate-400">
              Tiada data jabatan untuk dipaparkan dalam graf trend.
            </div>
          ) : (
            departmentPerformance
              .slice()
              .sort((a, b) => b.completion - a.completion || a.pending - b.pending)
              .map((item) => {
                const performanceTone =
                  item.completion >= 80 ? 'emerald' :
                  item.completion >= 50 ? 'amber' :
                  'rose';
                const toneClasses = {
                  emerald: 'border-emerald-100 bg-emerald-50/60',
                  amber: 'border-amber-100 bg-amber-50/60',
                  rose: 'border-rose-100 bg-rose-50/60',
                }[performanceTone];
                const badgeClasses = {
                  emerald: 'bg-emerald-100 text-emerald-700',
                  amber: 'bg-amber-100 text-amber-700',
                  rose: 'bg-rose-100 text-rose-700',
                }[performanceTone];
                const sparkValues = departmentMonthlyTrend.get(item.department) || Array.from({ length: 12 }, () => 0);
                const sparkMax = Math.max(...sparkValues, 1);

                return (
              <div key={`trend-${item.department}`} className={`rounded-2xl border p-5 ${toneClasses}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-base font-bold text-slate-900">{item.department}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.reports} laporan | {item.issues} isu | {item.pending} tertunggak</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-sm font-bold ${badgeClasses}`}>
                    {item.completion.toFixed(1)}% selesai
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <span>Laporan</span>
                      <span>{item.reports}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${(item.reports / departmentTrendPeak) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <span>Jumlah Isu</span>
                      <span>{item.issues}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${(item.issues / departmentTrendPeak) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <span>Isu Selesai</span>
                      <span>{item.selesai}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(item.selesai / departmentTrendPeak) * 100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <span>Trend Bulanan Isu</span>
                    <span>{sparkValues.reduce((sum, value) => sum + value, 0)} isu setahun</span>
                  </div>
                  <div className="flex h-14 items-end gap-1 rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-white/70">
                    {sparkValues.map((value, index) => (
                      <div key={`${item.department}-spark-${index}`} className="flex flex-1 flex-col items-center justify-end gap-1">
                        <div
                          className={`w-full rounded-full ${performanceTone === 'emerald' ? 'bg-emerald-500' : performanceTone === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ height: `${Math.max(10, (value / sparkMax) * 100)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
                );
              })
          )}
        </div>
      </div>
      )}

      {category && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Fokus Terperinci</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">{category}</h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Ringkasan ini memaparkan laporan yang berkaitan secara terus dengan kategori yang sedang dipilih.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCategory('')}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-50"
            >
              Kembali ke semua kategori
            </button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-emerald-100">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Jumlah Isu</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{selectedCategoryStats?.total ?? totalIssues}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-emerald-100">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Selesai</p>
              <p className="mt-2 text-2xl font-black text-emerald-700">{selectedCategoryStats?.selesai ?? totalSelesai}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-emerald-100">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Belum Selesai</p>
              <p className="mt-2 text-2xl font-black text-amber-600">{selectedCategoryStats?.belum_selesai ?? totalPending}</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-[0.24em] text-slate-500">Rekod Berkaitan</h4>
              <span className="text-xs font-semibold text-slate-500">{relatedMeetings.length} rekod dipaparkan</span>
            </div>
            {relatedMeetings.length === 0 ? (
              <div className="rounded-2xl bg-white p-5 text-sm italic text-slate-400 ring-1 ring-emerald-100">
                Tiada rekod berkaitan ditemui untuk kategori ini dalam skop semasa.
              </div>
            ) : (
              <div className="grid max-h-[28rem] grid-cols-1 gap-3 overflow-y-auto pr-2 lg:grid-cols-2">
                {relatedMeetings.map((meeting) => (
                  <Link
                    key={`drill-${meeting.id}`}
                    to={`/meeting/${meeting.id}`}
                    className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 transition-colors hover:bg-emerald-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-800">{meeting.department_name}</p>
                        <p className="mt-1 text-sm text-slate-500">{meeting.bil_mesyuarat} | {new Date(meeting.tarikh_mesyuarat).toLocaleDateString('ms-MY')}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {meeting.completed_issues}/{meeting.total_issues}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800">Laporan Dihantar</h3>
            <p className="text-sm text-slate-500 mt-1">Laporan yang diterima oleh HQ daripada pengguna jabatan.</p>
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {submittedMeetings.length} rekod
          </span>
        </div>
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                <th className="px-8 py-4">Jabatan</th>
                <th className="px-8 py-4">Mesyuarat</th>
                <th className="px-8 py-4">Tarikh</th>
                <th className="px-8 py-4">Isu</th>
                <th className="px-8 py-4">Selesai</th>
                <th className="px-8 py-4 text-right">Lihat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submittedMeetings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic">
                    Tiada laporan dihantar yang sepadan dengan penapis yang dipilih.
                  </td>
                </tr>
              ) : (
                submittedMeetings.map((meeting) => (
                  <tr key={meeting.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-700">{meeting.department_name}</td>
                    <td className="px-8 py-5 text-slate-600">{meeting.bil_mesyuarat}</td>
                    <td className="px-8 py-5 text-slate-600">
                      {new Date(meeting.tarikh_mesyuarat).toLocaleDateString('ms-MY')}
                    </td>
                    <td className="px-8 py-5 text-slate-600 font-medium">{meeting.total_issues}</td>
                    <td className="px-8 py-5 text-emerald-600 font-bold">{meeting.completed_issues}</td>
                    <td className="px-8 py-5 text-right">
                      <Link
                        to={`/meeting/${meeting.id}`}
                        className="inline-flex items-center gap-2 text-slate-700 hover:text-emerald-600 font-medium transition-colors"
                      >
                        <FileText size={16} />
                        Buka
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdvancedAnalytics && (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Trend Penghantaran Bulanan</h3>
              <p className="mt-1 text-sm text-slate-500">Jumlah laporan dan isu yang dihantar mengikut bulan mesyuarat.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              {monthlyTrend.length} bulan aktif
            </div>
          </div>
          <div className="mt-5 max-h-[32rem] space-y-4 overflow-y-auto pr-2">
            {monthlyTrend.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm italic text-slate-400">
                Tiada data trend bulanan yang sepadan dengan penapis yang dipilih.
              </div>
            ) : (
              monthlyTrend.map((item) => (
                <div key={item.monthIndex} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.reports} laporan | {item.issues} isu</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                      {item.completion.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <span>Laporan</span>
                        <span>{item.reports}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${(item.reports / monthlyTrendPeak) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <span>Isu</span>
                        <span>{item.issues}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(item.issues / monthlyTrendPeak) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock3 className="text-amber-600" size={18} />
            <h3 className="text-lg font-bold text-slate-900">Keutamaan Belum Selesai</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">Kategori dengan baki isu belum selesai paling tinggi dalam skop semasa.</p>
          <div className="mt-5 max-h-[32rem] space-y-4 overflow-y-auto pr-2">
            {unresolvedCategories.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-medium text-emerald-700">
                Semua kategori dalam skop semasa telah selesai.
              </div>
            ) : (
              unresolvedCategories.map((item) => {
                const unresolvedShare = item.total > 0 ? (item.belum_selesai / item.total) * 100 : 0;
                return (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() => setCategory(item.category)}
                    className="block w-full rounded-2xl border border-amber-100 bg-amber-50 p-4 text-left transition-colors hover:border-amber-200 hover:bg-amber-100/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-800">{item.category}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.belum_selesai} belum selesai daripada {item.total} isu</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-amber-700 ring-1 ring-amber-200">
                        {unresolvedShare.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${unresolvedShare}%` }} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
