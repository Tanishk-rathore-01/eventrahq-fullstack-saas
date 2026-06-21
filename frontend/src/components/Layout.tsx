import { CalendarDays, LayoutDashboard, LogOut, Menu, ShieldCheck, TicketCheck, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export default function Layout() {
  const { session, me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <div className="app-shell">
    <header className="nav-wrap">
      <nav className="nav container" aria-label="Primary navigation">
        <NavLink className="brand" to="/" onClick={close}><span className="brand-mark"><CalendarDays size={19}/></span>EventraHQ</NavLink>
        <button className="nav-toggle" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
        <div className={`nav-links ${open ? 'open' : ''}`}>
          <NavLink to="/events" onClick={close}>Events</NavLink>
          {session && <NavLink to="/dashboard" onClick={close}><LayoutDashboard size={16}/>Workspace</NavLink>}
          {session && <NavLink to="/tickets" onClick={close}><TicketCheck size={16}/>Tickets</NavLink>}
          {me?.profile.platformRole === 'admin' && <NavLink to="/admin" onClick={close}><ShieldCheck size={16}/>Admin</NavLink>}
        </div>
        <div className="nav-actions">
          {me && <span className="role-pill">{me.profile.name}</span>}
          {session ? <button className="ghost-btn" onClick={() => void signOut()}><LogOut size={16}/>Sign out</button>
            : <NavLink className="primary-btn small" to="/auth">Sign in</NavLink>}
        </div>
      </nav>
    </header>
    <Outlet/>
    <footer className="footer container"><span>EventraHQ</span><span>Secure event operations, from brief to check-in.</span></footer>
  </div>;
}
