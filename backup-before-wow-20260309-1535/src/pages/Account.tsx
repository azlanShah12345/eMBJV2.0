import { FormEvent, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { User } from '../types';

interface AccountProps {
  user: User;
}

export default function Account({ user }: AccountProps) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Kata laluan baharu dan pengesahan tidak sepadan', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Kata laluan baharu mestilah sekurang-kurangnya 6 aksara', 'error');
      return;
    }

    try {
      setIsSaving(true);
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Kata laluan berjaya dikemas kini');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengemas kini kata laluan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Keselamatan Akaun</h2>
        <p className="text-slate-500">Kemaskini kata laluan log masuk bagi akaun ini.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="font-bold text-slate-800">{user.username}</p>
            <p className="text-sm text-slate-500">{user.role === 'ADMIN' ? 'Pentadbir HQ' : user.department_name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Kata Laluan Semasa</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Kata Laluan Baharu</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Sahkan Kata Laluan Baharu</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <KeyRound size={18} />
            {isSaving ? 'Sedang mengemas kini...' : 'Tukar Kata Laluan'}
          </button>
        </form>
      </div>
    </div>
  );
}
