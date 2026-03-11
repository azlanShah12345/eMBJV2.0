import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Meeting, MeetingMessageUnreadSummary, User } from '../types';
import { LogOut, LayoutDashboard, Settings, User as UserIcon, Menu, X, KeyRound, Bell, Lock, Trash2, FileText } from 'lucide-react';
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
  const [messageUnreadSummary, setMessageUnreadSummary] = useState<MeetingMessageUnreadSummary>({ total_unread: 0, items: [] });

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  useEffect(() => {
    let isMounted = true;
    const fetchNotifications = async () => {
      try {
        if (isMounted) {
          const [messageSummary, meetings] = await Promise.all([
            api.getMeetingMessageUnreadSummary(),
            user.role === 'ADMIN' ? api.getMeetings() : Promise.resolve([]),
          ]);
          setMessageUnreadSummary(messageSummary);
          if (user.role === 'ADMIN') {
            setAdminMeetings(meetings as Meeting[]);
          }
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
  const totalUnreadBadge = unreadNotifications.length + messageUnreadSummary.total_unread;
  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all ${
      isActive
        ? 'border-emerald-200 bg-white text-slate-900 shadow-lg shadow-emerald-950/10'
        : 'border-transparent text-slate-200 hover:border-white/10 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-24'} m-4 flex flex-col rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#0f172a_0%,#16213a_52%,#1e293b_100%)] text-white shadow-2xl shadow-slate-950/15 transition-all duration-300`}>
        <div className="flex items-center justify-between px-6 pb-5 pt-6">
          {isSidebarOpen && (
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.34em] text-emerald-200/80">Sarawak Civil Service</span>
              <span className="mt-2 block text-2xl font-black tracking-tight text-white">eMBJ</span>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition-colors hover:bg-white/10 hover:text-white">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="px-4">
          {isSidebarOpen && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50 shadow-inner">
              <p className="font-semibold">Navigasi utama</p>
              <p className="mt-1 text-xs text-emerald-100/80">Tab aktif dipaparkan dengan latar putih supaya lebih jelas dilihat.</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-3 px-4 py-5">
          <NavLink to="/" end className={navLinkClassName}>
            {({ isActive }) => (
              <>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-white/10 text-slate-100 group-hover:bg-white/15'}`}>
                  <LayoutDashboard size={20} />
                </div>
                {isSidebarOpen && (
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">Papan Pemuka</span>
                    <span className={`block text-xs ${isActive ? 'text-slate-500' : 'text-slate-300/80'}`}>Ringkasan utama sistem</span>
                  </div>
                )}
              </>
            )}
          </NavLink>
          {user.role !== 'ADMIN' && (
            <NavLink to="/meetings" className={navLinkClassName}>
              {({ isActive }) => (
                <>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-white/10 text-slate-100 group-hover:bg-white/15'}`}>
                    <FileText size={20} />
                  </div>
                  {isSidebarOpen && (
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">Mesyuarat</span>
                      <span className={`block text-xs ${isActive ? 'text-slate-500' : 'text-slate-300/80'}`}>Draf, rekod dan tindakan</span>
                    </div>
                  )}
                </>
              )}
            </NavLink>
          )}
          <NavLink to="/account" className={navLinkClassName}>
            {({ isActive }) => (
              <>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-white/10 text-slate-100 group-hover:bg-white/15'}`}>
                  <KeyRound size={20} />
                </div>
                {isSidebarOpen && (
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">Akaun</span>
                    <span className={`block text-xs ${isActive ? 'text-slate-500' : 'text-slate-300/80'}`}>Profil dan kata laluan</span>
                  </div>
                )}
              </>
            )}
          </NavLink>
          {user.role === 'ADMIN' && (
            <NavLink to="/settings" className={navLinkClassName}>
              {({ isActive }) => (
                <>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-white/10 text-slate-100 group-hover:bg-white/15'}`}>
                    <Settings size={20} />
                  </div>
                  {isSidebarOpen && (
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">Tetapan</span>
                      <span className={`block text-xs ${isActive ? 'text-slate-500' : 'text-slate-300/80'}`}>Konfigurasi sistem</span>
                    </div>
                  )}
                </>
              )}
            </NavLink>
          )}
        </nav>

        <div className="mx-4 mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <UserIcon size={16} />
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-bold text-white">{user.username}</span>
                <span className="truncate text-xs text-slate-300">{user.department_name}</span>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl border border-red-300/15 bg-red-400/10 p-3 text-red-100 transition-colors hover:bg-red-400/20"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Log Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pr-4 pt-4">
        <header className="sticky top-4 z-10 mx-auto flex items-center justify-between rounded-[28px] border border-white/70 bg-white/85 px-8 py-4 shadow-lg shadow-slate-200/70 backdrop-blur">
          <h1 className="text-lg font-semibold text-slate-800">
            {user.role === 'ADMIN' ? 'Pentadbiran HQ' : `Jabatan: ${user.department_name}`}
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((current) => {
                    const nextOpen = !current;
                    if (nextOpen && user.role === 'ADMIN') {
                      setSeenNotificationKeys(requestNotifications.map((item) => item.key));
                    }
                    return nextOpen;
                  });
                }}
                className="relative rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <Bell size={18} />
                {totalUnreadBadge > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {totalUnreadBadge}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-14 z-20 w-[360px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">Notifikasi Sistem</p>
                    <p className="mt-1 text-xs text-slate-500">Semakan mesej belum dibaca dan tindakan yang memerlukan perhatian.</p>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto">
                    {messageUnreadSummary.items.length > 0 && (
                      <div className="border-b border-slate-100">
                        <div className="px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Mesej Belum Dibaca</p>
                        </div>
                        {messageUnreadSummary.items.map((item) => (
                          <button
                            key={`message-${item.meeting_id}`}
                            type="button"
                            onClick={() => {
                              setNotificationsOpen(false);
                              navigate(`/meeting/${item.meeting_id}`);
                            }}
                            className="flex w-full items-start gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                          >
                            <div className="mt-0.5 rounded-xl bg-emerald-50 p-2 text-emerald-600">
                              <FileText size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-800">{item.department_name} - {item.bil_mesyuarat}</p>
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                                  {item.unread_count}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.last_message_preview || 'Terdapat mesej baharu dalam rekod ini.'}</p>
                              <p className="mt-1 text-[11px] text-slate-400">
                                {new Date(item.last_message_at).toLocaleString('ms-MY', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {user.role === 'ADMIN' && (
                      <div>
                        <div className="px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Permohonan Pentadbir</p>
                        </div>
                        {requestNotifications.length === 0 ? (
                          <div className="px-4 pb-4 text-sm italic text-slate-400">
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
                              className="flex w-full items-start gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50"
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
                    )}

                    {messageUnreadSummary.items.length === 0 && requestNotifications.length === 0 && (
                      <div className="px-4 py-6 text-sm italic text-slate-400">
                        Tiada notifikasi baharu pada masa ini.
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigate(user.role === 'ADMIN' ? '/' : '/meetings');
                      }}
                      className="text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900"
                    >
                      {user.role === 'ADMIN' ? 'Buka papan pemuka pentadbir' : 'Buka menu mesyuarat'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <span className="text-sm text-slate-500">{new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </header>

        <div className="px-2 pb-8 pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
