import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { Activity, CalendarRange, Search } from 'lucide-react';
import { useToast } from '../components/Toast';

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Log Masuk',
  REGISTER_ACCOUNT: 'Daftar Akaun',
  CHANGE_PASSWORD: 'Tukar Kata Laluan',
  CREATE_USER: 'Cipta Pengguna',
  DELETE_USER: 'Padam Pengguna',
  APPROVE_USER: 'Luluskan Pengguna',
  REJECT_USER: 'Tolak Pengguna',
  CREATE_DEPARTMENT: 'Cipta Jabatan',
  DELETE_DEPARTMENT: 'Padam Jabatan',
  CREATE_CATEGORY: 'Cipta Kategori',
  DELETE_CATEGORY: 'Padam Kategori',
  CREATE_ANNOUNCEMENT: 'Cipta Announcement',
  DELETE_ANNOUNCEMENT: 'Nyahaktif Announcement',
  SEND_REPORT_SUBMISSION_REMINDER: 'Hantar Peringatan Laporan',
  CREATE_MEETING: 'Cipta Mesyuarat',
  DELETE_MEETING: 'Padam Mesyuarat',
  REQUEST_DELETE_MEETING: 'Mohon Padam Mesyuarat',
  APPROVE_DELETE_MEETING: 'Luluskan Padam Mesyuarat',
  REJECT_DELETE_MEETING: 'Tolak Padam Mesyuarat',
  CREATE_ISSUE: 'Cipta Isu',
  UPDATE_ISSUE: 'Kemaskini Isu',
  DELETE_ISSUE: 'Padam Isu',
  SEND_MEETING_MESSAGE: 'Hantar Mesej Mesyuarat',
  LOCK_MEETING: 'Kunci Mesyuarat',
  SUBMIT_MEETING_TO_HQ: 'Hantar Mesyuarat ke HQ',
  REQUEST_UNLOCK_MEETING: 'Mohon Buka Kunci Mesyuarat',
  APPROVE_UNLOCK_MEETING: 'Luluskan Buka Kunci Mesyuarat',
  REJECT_UNLOCK_MEETING: 'Tolak Buka Kunci Mesyuarat',
};

const MODULE_LABELS: Record<string, string> = {
  AUTH: 'Pengesahan',
  USER: 'Pengguna',
  DEPARTMENT: 'Jabatan',
  CATEGORY: 'Kategori',
  ANNOUNCEMENT: 'Announcement',
  REPORT_REMINDER: 'Peringatan Laporan',
  MEETING: 'Mesyuarat',
  ISSUE: 'Isu',
  MEETING_MESSAGE: 'Mesej Mesyuarat',
};

const formatAuditCode = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');

const getAuditActionLabel = (action: string) => ACTION_LABELS[action] || formatAuditCode(action);

const getAuditModuleLabel = (module: string) => MODULE_LABELS[module] || formatAuditCode(module);

export default function AuditTrail() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    actor: '',
    action: '',
    date_from: '',
    date_to: '',
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs({
        ...filters,
        limit: 200,
      });
      setLogs(data);
    } catch (error) {
      console.error(error);
      showToast('Gagal memuatkan jejak audit', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Jejak Audit</h2>
          <p className="text-slate-500">Semakan tindakan pengguna dan pentadbir untuk rekod sistem eMBJ.</p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
        >
          <Activity size={16} />
          Muat Semula Log
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Pengguna / Sasaran</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={filters.actor}
                onChange={(e) => setFilters((current) => ({ ...current, actor: e.target.value }))}
                placeholder="Contoh: admin, HR, Bil 1"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 outline-none transition-colors focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Tindakan</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters((current) => ({ ...current, action: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition-colors focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua tindakan</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Dari Tarikh</label>
            <div className="relative">
              <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters((current) => ({ ...current, date_from: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 outline-none transition-colors focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Hingga Tarikh</label>
            <div className="relative">
              <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters((current) => ({ ...current, date_to: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 outline-none transition-colors focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={fetchLogs}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700"
          >
            Tapis Log
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters({ actor: '', action: '', date_from: '', date_to: '' });
              setTimeout(() => {
                api.getAuditLogs({ limit: 200 }).then(setLogs).catch(() => showToast('Gagal memuatkan jejak audit', 'error'));
              }, 0);
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Tetapkan Semula
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Sedang memuatkan log audit...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Tiada log ditemui untuk penapis semasa.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Masa</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Pelaku</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tindakan</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Modul</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Sasaran</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Butiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {new Date(log.created_at).toLocaleString('ms-MY', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{log.actor_username || 'Sistem'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.actor_role || '-'}{log.actor_department_name ? ` | ${log.actor_department_name}` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold tracking-[0.08em] text-emerald-700">
                        {getAuditActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-700">{getAuditModuleLabel(log.entity_type)}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {log.target_label || '-'}
                      {log.entity_id ? <p className="mt-1 text-xs text-slate-400">ID: {log.entity_id}</p> : null}
                    </td>
                    <td className="px-5 py-4 text-xs leading-6 text-slate-500">
                      {log.details ? (
                        <pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 font-mono text-[11px] text-slate-600">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
