import { Link, NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, LogOut, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="nav-wrap">
        <nav className="nav container">
          <Link to="/" className="brand" aria-label="EventraHQ home">
            <span className="brand-mark"><Sparkles size={18} /></span>
            <span>EventraHQ</span>
          </Link>

          <div className="nav-links">
            <NavLink to="/events"><CalendarDays size={16} /> Events</NavLink>
            {user && <NavLink to="/dashboard"><LayoutDashboard size={16} /> Dashboard</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin"><Shield size={16} /> Admin</NavLink>}
          </div>

          <div className="nav-actions">
            {user ? (
              <>
                <span className="role-pill">{user.role}</span>
                <button className="ghost-btn" onClick={logout}><LogOut size={16} /> Logout</button>
              </>
            ) : (
              <Link to="/login" className="primary-btn small">Login</Link>
            )}
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
