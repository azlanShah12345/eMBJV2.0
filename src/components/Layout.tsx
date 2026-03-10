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
    `flex items-center gap-3 rounded-lg p-3 transition-colors ${isActive ? 'bg-slate-800 text-white' : 'text-slate-100 hover:bg-slate-800'}`;

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
          <NavLink to="/" end className={navLinkClassName}>
            <LayoutDashboard size={20} />
            {isSidebarOpen && <span>Papan Pemuka</span>}
          </NavLink>
          {user.role !== 'ADMIN' && (
            <NavLink to="/meetings" className={navLinkClassName}>
              <FileText size={20} />
              {isSidebarOpen && <span>Mesyuarat</span>}
            </NavLink>
          )}
          <NavLink to="/account" className={navLinkClassName}>
            <KeyRound size={20} />
            {isSidebarOpen && <span>Akaun</span>}
          </NavLink>
          {user.role === 'ADMIN' && (
            <>
              <NavLink to="/settings" className={navLinkClassName}>
                <Settings size={20} />
                {isSidebarOpen && <span>Tetapan</span>}
              </NavLink>
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
                className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <Bell size={18} />
                {totalUnreadBadge > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {totalUnreadBadge}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-14 z-20 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
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

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
