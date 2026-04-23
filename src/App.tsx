import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DeptDashboard from './pages/DeptDashboard';
import DashboardIssueList from './pages/DashboardIssueList';
import MaintenancePage from './pages/MaintenancePage';
import UserMeetings from './pages/UserMeetings';
import MeetingDetails from './pages/MeetingDetails';
import Settings from './pages/Settings';
import Account from './pages/Account';
import AuditTrail from './pages/AuditTrail';
import ReportReminders from './pages/ReportReminders';
import Layout from './components/Layout';
import { api } from './services/api';
import { SystemStatus, User } from './types';

import { ToastProvider } from './components/Toast';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    status: 'ok',
    maintenance_mode: false,
    maintenance_title: 'Sistem Sedang Diselenggara',
    maintenance_message: 'Sistem eMBJ sedang melalui kerja penyelenggaraan sementara. Sila cuba semula sebentar lagi.',
    maintenance_started_at: null,
  });

  const refreshSystemStatus = async () => {
    try {
      const status = await api.getPublicSystemStatus();
      setSystemStatus(status);
    } catch (error) {
      console.error('Gagal mendapatkan status sistem:', error);
      setSystemStatus((current) => ({
        ...current,
        maintenance_mode: false,
      }));
    }
  };

  useEffect(() => {
    const bootstrapApp = async () => {
      await refreshSystemStatus();

      const storedUser = sessionStorage.getItem('user');
      const token = sessionStorage.getItem('token');

      // Bersihkan sesi lama yang masih menggunakan storan kekal.
      localStorage.removeItem('user');
      localStorage.removeItem('token');

      if (storedUser && token) {
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    };

    bootstrapApp();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshSystemStatus();
    }, 60000);

    window.addEventListener('focus', refreshSystemStatus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshSystemStatus);
    };
  }, []);

  const handleLogin = (userData: User, token: string) => {
    sessionStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Sedang dimuatkan...</div>;
  if (systemStatus.maintenance_mode) {
    return (
      <MaintenancePage
        title={systemStatus.maintenance_title}
        message={systemStatus.maintenance_message}
        startedAt={systemStatus.maintenance_started_at}
      />
    );
  }

  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} 
          />
          
          <Route element={user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}>
          <Route 
              path="/" 
              element={user?.role === 'ADMIN' ? <Dashboard /> : <DeptDashboard user={user!} />} 
            />
            <Route
              path="/meetings"
              element={user?.role === 'ADMIN' ? <Navigate to="/" /> : <UserMeetings user={user!} />}
            />
            <Route path="/dashboard/issues" element={<DashboardIssueList user={user!} />} />
            <Route path="/account" element={<Account user={user!} />} />
            <Route path="/report-reminders" element={user?.role === 'ADMIN' ? <ReportReminders /> : <Navigate to="/" />} />
            <Route path="/settings" element={user?.role === 'ADMIN' ? <Settings /> : <Navigate to="/" />} />
            <Route path="/audit-trail" element={user?.role === 'ADMIN' ? <AuditTrail /> : <Navigate to="/" />} />
            <Route path="/meeting/:id" element={<MeetingDetails user={user!} />} />
          </Route>
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
