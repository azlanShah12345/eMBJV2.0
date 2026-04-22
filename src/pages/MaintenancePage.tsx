interface MaintenancePageProps {
  title: string;
  message: string;
  startedAt?: string | null;
}

const formatStartedAt = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('ms-MY');
};

export default function MaintenancePage({ title, message, startedAt }: MaintenancePageProps) {
  const startedAtLabel = formatStartedAt(startedAt);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#f59e0b_0%,#9a3412_28%,#111827_78%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-orange-300/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-white/8 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
      </div>

      <div className="relative w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/10 bg-white/10 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
        <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="border-b border-white/10 px-8 py-10 text-white lg:border-b-0 lg:border-r lg:px-10">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.3em] text-amber-100/90">
              Sarawak Civil Service
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.28em] text-amber-100/80">Status Sistem eMBJ</p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-white">{title}</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-200/85">
              {message}
            </p>
            <div className="mt-8 rounded-[28px] border border-white/10 bg-slate-950/20 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-100/80">Makluman Operasi</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-200/85">
                <p>Sistem sedang dihadkan sementara bagi kerja penyelenggaraan, semakan teknikal, atau kemas kini yang memerlukan kawalan akses sementara.</p>
                <p>Sepanjang tempoh ini, log masuk, semakan rekod, penghantaran ke HQ, dan kemas kini data tidak tersedia kepada pengguna.</p>
              </div>
            </div>
          </div>

          <div className="bg-white/96 px-8 py-10 lg:px-10">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Penyelenggaraan Sedang Berjalan</p>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">Akses akan dibuka semula selepas kerja selesai.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Sila cuba semula sebentar lagi. Jika perlu semakan segera, pengguna boleh berhubung dengan pentadbir sistem atau pihak HQ yang berkaitan.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Status</p>
                  <p className="mt-2 text-base font-bold text-slate-900">Penyelenggaraan Aktif</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Masa Mula</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{startedAtLabel || 'Tidak dinyatakan'}</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Tindakan Disyorkan</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Simpan maklumat kerja yang belum dihantar dan akses semula sistem selepas mod penyelenggaraan dimatikan oleh pentadbir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
