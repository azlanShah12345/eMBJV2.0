import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { ArrowRight, Lock, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useToast } from '../components/Toast';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
            <h1 className="mt-4 max-w-md text-5xl font-black leading-tight">Sistem eMBJ untuk pemantauan isu mesyuarat yang lebih tersusun.</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-200/85">
              Satu ruang kerja rasmi untuk merekod mesyuarat, menjejak isu, berkomunikasi dengan HQ, dan memastikan tindakan susulan sentiasa jelas.
            </p>
          </div>

          <div className="login-fade-up-delay relative z-10 mt-10 grid grid-cols-1 gap-4">
            {[
              {
                title: 'Rekod lebih teratur',
                description: 'Mesyuarat, isu, dan tindakan susulan disusun mengikut jabatan serta tahun rekod.',
              },
              {
                title: 'Status lebih jelas',
                description: 'Draf, laporan dihantar, dan komunikasi dengan HQ dapat dilihat dalam satu aliran kerja.',
              },
              {
                title: 'Tindakan lebih pantas',
                description: 'Notifikasi mesej dan permohonan membantu pegawai memberi perhatian pada perkara yang masih aktif.',
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
            <div className="mb-8 text-center lg:text-left">
              <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#16a34a_0%,#22c55e_100%)] text-white shadow-xl shadow-emerald-600/25 lg:mx-0">
                <ShieldCheck size={34} />
              </div>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">Log masuk ke eMBJ</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Masukkan maklumat akaun anda untuk mengakses sistem pemantauan mesyuarat dan isu rasmi.
              </p>
            </div>

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

            <div className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50/70 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Akses Rasmi</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Sistem ini digunakan untuk pengurusan rekod mesyuarat MBJ, tindakan isu, dan penyelarasan laporan dengan HQ.
              </p>
            </div>

            <div className="mt-8 text-center text-xs text-slate-400 lg:text-left">
              <p>© 2026 eMBJ, Sarawak Civil Service</p>
              <p>Sistem rasmi pemantauan mesyuarat dan tindakan susulan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
