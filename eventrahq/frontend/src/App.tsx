import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.js';
import { useAuth } from './context/AuthContext.js';
import Admin from './pages/Admin.js';
import AuthPage from './pages/AuthPage.js';
import CheckIn from './pages/CheckIn.js';
import Dashboard from './pages/Dashboard.js';
import EventDetail from './pages/EventDetail.js';
import EventEditor from './pages/EventEditor.js';
import Events from './pages/Events.js';
import Home from './pages/Home.js';
import Invitation from './pages/Invitation.js';
import Tickets from './pages/Tickets.js';

function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { session, me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="screen-center">Loading secure workspace…</main>;
  if (!session) return <Navigate to="/auth" state={{ from: location.pathname }} replace/>;
  if (admin && me?.profile.platformRole !== 'admin') return <Navigate to="/dashboard" replace/>;
  return children;
}

export default function App() {
  return <Routes><Route element={<Layout/>}>
    <Route path="/" element={<Home/>}/>
    <Route path="/events" element={<Events/>}/>
    <Route path="/events/new" element={<Protected><EventEditor/></Protected>}/>
    <Route path="/events/:eventId" element={<EventDetail/>}/>
    <Route path="/auth" element={<AuthPage/>}/>
    <Route path="/auth/reset" element={<AuthPage/>}/>
    <Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/>
    <Route path="/tickets" element={<Protected><Tickets/></Protected>}/>
    <Route path="/check-in" element={<Protected><CheckIn/></Protected>}/>
    <Route path="/invitations/:token" element={<Protected><Invitation/></Protected>}/>
    <Route path="/admin" element={<Protected admin><Admin/></Protected>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route></Routes>;
}
