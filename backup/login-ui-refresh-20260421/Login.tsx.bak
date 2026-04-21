import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { ArrowRight, Lock, ShieldCheck, User as UserIcon, UserPlus, Building2 } from 'lucide-react';
import { useToast } from '../components/Toast';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [departmentsError, setDepartmentsError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    department_id: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'register') return;
    const fetchDepartments = async () => {
      try {
        const data = await api.getPublicDepartments();
        setDepartments(data.filter((item) => item.name !== 'HQ'));
        setDepartmentsError('');
      } catch (error) {
        console.error(error);
        setDepartments([]);
        setDepartmentsError('Senarai jabatan tidak dapat dimuatkan buat masa ini. Sila cuba semula sebentar lagi.');
        showToast('Gagal memuatkan senarai jabatan untuk pendaftaran akaun', 'error');
      }
    };
    fetchDepartments();
  }, [mode, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.login(username, password);
      showToast(`Selamat kembali, ${data.user.username}!`);
      onLogin(data.user, data.token);
    } catch (err: any) {
      showToast(err.message || 'Nama pengguna atau kata laluan tidak sah', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (departmentsError || departments.length === 0) {
      showToast('Pendaftaran tidak boleh diteruskan kerana senarai jabatan belum tersedia', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.register({
        username: registerForm.username,
        password: registerForm.password,
        department_id: Number(registerForm.department_id),
      });
      showToast('Permohonan akaun berjaya dihantar dan sedang menunggu kelulusan HQ');
      setRegisterForm({ username: '', password: '', department_id: '' });
      setMode('login');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghantar permohonan akaun', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#1f9d55_0%,#0f172a_42%,#08111f_100%)] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="login-orb absolute -left-16 top-8 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="login-orb-delay absolute right-0 top-20 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="login-orb-slow absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
      </div>

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[36px] border border-white/10 bg-white/8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden border-r border-white/10 px-10 py-12 text-white lg:block">
          <div className="login-fade-up relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-emerald-200/80">Sarawak Civil Service</p>
            <h1 className="mt-4 max-w-xl text-5xl font-black leading-tight">eMBJ memperkukuh penyelarasan rekod mesyuarat, tindakan isu, dan semakan rasmi HQ secara lebih teratur dan meyakinkan.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-200/85">
              Platform rasmi ini dibangunkan untuk menyatukan pengurusan rekod mesyuarat MBJ, pemantauan isu berbangkit, komunikasi jabatan dengan HQ, serta penyediaan laporan yang lebih kemas, telus, dan bersedia untuk rujukan pengurusan.
            </p>
            <div className="mt-6 max-w-xl rounded-3xl border border-emerald-300/15 bg-white/8 p-5 shadow-lg shadow-slate-950/10">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-200/80">Nilai Strategik eMBJ</p>
              <p className="mt-3 text-base font-semibold leading-7 text-white">
                Daripada pendaftaran rekod hingga penghantaran ke HQ, setiap tindakan dipusatkan dalam satu sistem yang membantu memastikan maklumat sentiasa konsisten, mudah disemak, dan lebih cepat diterjemahkan kepada tindakan susulan.
              </p>
            </div>
          </div>

          <div className="login-fade-up-delay relative z-10 mt-10 grid grid-cols-1 gap-4">
            {[
              {
                title: 'Rekod lebih teratur',
                description: 'Mesyuarat, isu, dan tindakan susulan disusun mengikut jabatan, tahun rekod, dan status semasa untuk semakan yang lebih terarah.',
              },
              {
                title: 'Kelulusan HQ terjamin',
                description: 'Pendaftaran pengguna baharu dikawal melalui semakan dan kelulusan pentadbir HQ sebelum akses rasmi diberikan.',
              },
              {
                title: 'Tindakan lebih pantas',
                description: 'Notifikasi mesej, permohonan, dan status rekod membantu pegawai memberi perhatian segera kepada perkara yang masih aktif.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-lg shadow-slate-950/10">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
                  <ShieldCheck size={20} />
                </div>
                <p className="text-base font-bold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200/80">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative bg-white/96 px-6 py-8 sm:px-10 sm:py-12">
          <div className="login-card-enter mx-auto w-full max-w-md">
            <div className="mb-6 text-center lg:text-left">
              <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#16a34a_0%,#22c55e_100%)] text-white shadow-xl shadow-emerald-600/25 lg:mx-0">
                {mode === 'login' ? <ShieldCheck size={34} /> : <UserPlus size={34} />}
              </div>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">
                {mode === 'login' ? 'Log masuk ke eMBJ' : 'Daftar Akaun Jabatan'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === 'login'
                  ? 'Masukkan maklumat akaun anda untuk mengakses sistem pemantauan mesyuarat dan isu rasmi.'
                  : 'Hantar permohonan akaun baharu. Akses hanya akan diaktifkan selepas diluluskan oleh HQ.'}
              </p>
            </div>

            <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${mode === 'login' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Log Masuk
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${mode === 'register' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Daftar Akaun
              </button>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Nama Pengguna</label>
                  <div className="group relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-600" size={18} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3.5 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      placeholder="Masukkan nama pengguna"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Kata Laluan</label>
                  <div className="group relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-600" size={18} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3.5 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      placeholder="Masukkan kata laluan"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#15803d_0%,#16a34a_55%,#22c55e_100%)] px-4 py-3.5 font-bold text-white shadow-xl shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-emerald-600/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Sedang log masuk...
                    </>
                  ) : (
                    <>
                      Teruskan ke Sistem
                      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Nama Pengguna</label>
                  <div className="group relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-600" size={18} />
                    <input
                      type="text"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm((current) => ({ ...current, username: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3.5 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      placeholder="Cipta nama pengguna"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Kata Laluan</label>
                  <div className="group relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-600" size={18} />
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((current) => ({ ...current, password: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3.5 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      placeholder="Sekurang-kurangnya 6 aksara"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Jabatan</label>
                  <div className="group relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-600" size={18} />
                    <select
                      value={registerForm.department_id}
                      onChange={(e) => setRegisterForm((current) => ({ ...current, department_id: e.target.value }))}
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3.5 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      required
                    >
                      <option value="">Pilih jabatan</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {departmentsError && (
                    <p className="mt-2 text-sm font-medium text-rose-600">{departmentsError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !!departmentsError || departments.length === 0}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#15803d_0%,#16a34a_55%,#22c55e_100%)] px-4 py-3.5 font-bold text-white shadow-xl shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-emerald-600/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Sedang menghantar...
                    </>
                  ) : (
                    <>
                      Hantar Permohonan Akaun
                      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50/70 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Akses Rasmi</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {mode === 'login'
                  ? 'Akses ini membolehkan anda mengurus rekod mesyuarat MBJ, menyelaras tindakan isu, dan memastikan maklumat yang dihantar ke HQ berada dalam aliran rasmi yang tersusun.'
                  : 'Permohonan pendaftaran akan disemak oleh HQ. Akaun hanya boleh digunakan selepas status diluluskan bagi memastikan akses sistem kekal terkawal dan sah.'}
              </p>
            </div>

            <div className="mt-8 text-center text-xs text-slate-400 lg:text-left">
              <p>Hak Cipta 2026 eMBJ, Sarawak Civil Service</p>
              <p>Sistem rasmi pemantauan mesyuarat dan tindakan susulan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
