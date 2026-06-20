import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Admin from './pages/Admin.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Events from './pages/Events.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import CreateEvent from './pages/CreateEvent.jsx';
import { useAuth } from './context/AuthContext.jsx';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="screen-center">Loading secure workspace...</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<Events />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/create" element={<Protected roles={['admin', 'organizer']}><CreateEvent /></Protected>} />
        <Route path="/admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
