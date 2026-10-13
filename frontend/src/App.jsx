import React, { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import api from './api';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import InventoryItems from './pages/InventoryItems';
import IndividualAssets from './pages/IndividualAssets';
import IssueItems from './pages/IssueItems';
import ReturnItems from './pages/ReturnItems';
import Login from './pages/Login';
import Locations from './pages/Locations';
import Stock from './pages/Stock';
import Reports from './pages/Reports';

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

function ProtectedLayout({ children, coordinatorOnly = false }) {
  const token = localStorage.getItem('token');
  const [user, setUser] = useState(getUser);
  const [checkingUser, setCheckingUser] = useState(Boolean(token) && !getUser());
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || user) return undefined;
    let active = true;
    api.get('/api/auth/me')
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingUser(false);
      });
    return () => { active = false; };
  }, [token, user]);

  if (!token) return <Navigate to="/login" replace />;
  if (checkingUser) return <div className="loading">Checking your account…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (coordinatorOnly && user?.role !== 'coordinator') return <Navigate to="/" replace />;

  const coordinatorLinks = [
    ['Dashboard', '/'],
    ['Students', '/students'],
    ['Inventory', '/inventory'],
    ['Assets', '/assets'],
    ['Locations', '/locations'],
    ['Issue items', '/issue'],
    ['Returns', '/returns'],
    ['Stock & policy', '/stock'],
    ['Reports', '/reports'],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">DI</span>
          <span>Dept. Inventory<small>Management system</small></span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav">
          {(user?.role === 'student' ? [['My dashboard', '/'], ['Issue items', '/issue']] : coordinatorLinks).map(([label, path]) => (
            <NavLink key={path} end={path === '/'} to={path} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-dot" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">{(user?.name || user?.username || 'U').slice(0, 1).toUpperCase()}</div>
          <div className="user-copy"><strong>{user?.name || user?.username || 'User'}</strong><small>{user?.role || 'Account'}</small></div>
          <button className="icon-button" title="Sign out" onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login', { replace: true });
          }}>↪</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>Department Inventory System</span>
          <span className="topbar-user">{user?.name || user?.username}</span>
        </header>
        <div className="page-wrap">{children}</div>
      </main>
    </div>
  );
}

function ProtectedPage({ children, coordinatorOnly = false }) {
  return <ProtectedLayout coordinatorOnly={coordinatorOnly}>{children}</ProtectedLayout>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
        <Route path="/students" element={<ProtectedPage coordinatorOnly><Students /></ProtectedPage>} />
        <Route path="/inventory" element={<ProtectedPage><InventoryItems /></ProtectedPage>} />
        <Route path="/assets" element={<ProtectedPage coordinatorOnly><IndividualAssets /></ProtectedPage>} />
        <Route path="/locations" element={<ProtectedPage coordinatorOnly><Locations /></ProtectedPage>} />
        <Route path="/issue" element={<ProtectedPage><IssueItems /></ProtectedPage>} />
        <Route path="/returns" element={<ProtectedPage coordinatorOnly><ReturnItems /></ProtectedPage>} />
        <Route path="/stock" element={<ProtectedPage coordinatorOnly><Stock /></ProtectedPage>} />
        <Route path="/reports" element={<ProtectedPage coordinatorOnly><Reports /></ProtectedPage>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
