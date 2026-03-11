import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { Activity, CalendarRange, Search } from 'lucide-react';
import { useToast } from '../components/Toast';

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
      showToast('Gagal memuatkan audit trail', 'error');
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
          <h2 className="text-2xl font-bold text-slate-900">Audit Trail</h2>
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
            <input
              type="text"
              value={filters.action}
              onChange={(e) => setFilters((current) => ({ ...current, action: e.target.value }))}
              placeholder="Contoh: APPROVE_USER"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition-colors focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
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
                api.getAuditLogs({ limit: 200 }).then(setLogs).catch(() => showToast('Gagal memuatkan audit trail', 'error'));
              }, 0);
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Reset
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
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-700">{log.entity_type}</td>
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
