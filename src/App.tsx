import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DeptDashboard from './pages/DeptDashboard';
import UserMeetings from './pages/UserMeetings';
import MeetingDetails from './pages/MeetingDetails';
import Settings from './pages/Settings';
import Account from './pages/Account';
import AuditTrail from './pages/AuditTrail';
import Layout from './components/Layout';
import { User } from './types';

import { ToastProvider } from './components/Toast';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: User, token: string) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Sedang dimuatkan...</div>;

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
            <Route path="/account" element={<Account user={user!} />} />
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
