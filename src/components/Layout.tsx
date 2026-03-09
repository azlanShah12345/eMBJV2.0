import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Meeting, User } from '../types';
import { LogOut, LayoutDashboard, Settings, User as UserIcon, Menu, X, KeyRound, Bell, Lock, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

interface LayoutProps {
  user: User;
  onLogout: () => void;
}

export default function Layout({ user, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [adminMeetings, setAdminMeetings] = useState<Meeting[]>([]);
  const [seenNotificationKeys, setSeenNotificationKeys] = useState<string[]>([]);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  useEffect(() => {
    if (user.role !== 'ADMIN') return;

    let isMounted = true;
    const fetchNotifications = async () => {
      try {
        const meetings = await api.getMeetings();
        if (isMounted) {
          setAdminMeetings(meetings);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 15000);
    window.addEventListener('focus', fetchNotifications);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', fetchNotifications);
    };
  }, [user.role]);

  const requestNotifications = useMemo(() => {
    if (user.role !== 'ADMIN') return [];
    return adminMeetings
      .filter((meeting) => meeting.unlock_requested === 1 || meeting.delete_requested === 1)
      .map((meeting) => ({
        key: `${meeting.id}-${meeting.unlock_requested === 1 ? 'unlock' : 'delete'}`,
        id: meeting.id,
        title: `${meeting.department_name} - ${meeting.bil_mesyuarat}`,
        subtitle: meeting.unlock_requested === 1 ? 'Permohonan buka kunci baharu' : 'Permohonan hapus baharu',
        type: meeting.unlock_requested === 1 ? 'unlock' : 'delete',
      }));
  }, [adminMeetings, user.role]);

  useEffect(() => {
    const activeKeys = new Set(requestNotifications.map((item) => item.key));
    setSeenNotificationKeys((current) => current.filter((key) => activeKeys.has(key)));
  }, [requestNotifications]);

  const unreadNotifications = requestNotifications.filter((item) => !seenNotificationKeys.includes(item.key));

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight">SISTEM eMBJ</span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-800 rounded">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <Link to="/" className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg transition-colors">
            <LayoutDashboard size={20} />
            {isSidebarOpen && <span>Papan Pemuka</span>}
          </Link>
          <Link to="/account" className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg transition-colors">
            <KeyRound size={20} />
            {isSidebarOpen && <span>Akaun</span>}
          </Link>
          {user.role === 'ADMIN' && (
            <>
              <Link to="/settings" className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg transition-colors">
                <Settings size={20} />
                {isSidebarOpen && <span>Tetapan</span>}
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-3 mb-4">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              <UserIcon size={16} />
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">{user.username}</span>
                <span className="text-xs text-slate-400 truncate">{user.department_name}</span>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Log Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-slate-800">
            {user.role === 'ADMIN' ? 'Pentadbiran HQ' : `Jabatan: ${user.department_name}`}
          </h1>
          <div className="flex items-center gap-4">
            {user.role === 'ADMIN' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen((current) => {
                      const nextOpen = !current;
                      if (nextOpen) {
                        setSeenNotificationKeys(requestNotifications.map((item) => item.key));
                      }
                      return nextOpen;
                    });
                  }}
                  className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <Bell size={18} />
                  {unreadNotifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {unreadNotifications.length}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-14 z-20 w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-bold text-slate-900">Notifikasi Permohonan</p>
                      <p className="mt-1 text-xs text-slate-500">Permohonan yang memerlukan tindakan pentadbir.</p>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto">
                      {requestNotifications.length === 0 ? (
                        <div className="px-4 py-6 text-sm italic text-slate-400">
                          Tiada notifikasi permohonan baharu.
                        </div>
                      ) : (
                        requestNotifications.map((item) => (
                          <button
                            key={`notif-${item.type}-${item.id}`}
                            type="button"
                            onClick={() => {
                              setNotificationsOpen(false);
                              navigate(`/meeting/${item.id}`);
                            }}
                            className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                          >
                            <div className={`mt-0.5 rounded-xl p-2 ${item.type === 'unlock' ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'}`}>
                              {item.type === 'unlock' ? <Lock size={16} /> : <Trash2 size={16} />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="bg-slate-50 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate('/');
                        }}
                        className="text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900"
                      >
                        Buka papan pemuka pentadbir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <span className="text-sm text-slate-500">{new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </header>

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
