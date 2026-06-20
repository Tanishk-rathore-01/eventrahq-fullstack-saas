import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const demos = [
  ['Admin', 'admin@eventrahq.com', 'Admin@12345'],
  ['Organizer', 'organizer@eventrahq.com', 'Organizer@12345'],
  ['Attendee', 'user@eventrahq.com', 'User@12345']
];

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: 'admin@eventrahq.com', password: 'Admin@12345' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page container">
      <section className="auth-panel">
        <div className="section-head compact">
          <span>Secure workspace</span>
          <h1>{mode === 'login' ? 'Login to EventraHQ' : 'Create account'}</h1>
        </div>

        <form onSubmit={submit} className="form-card">
          {mode === 'register' && (
            <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          )}
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn full" disabled={loading}>{loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Register'}</button>
          <button type="button" className="ghost-btn full" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Need an account?' : 'Already registered?'}
          </button>
        </form>
      </section>

      <aside className="demo-card">
        <h2>Demo accounts</h2>
        <p>Seed Supabase first, then use these credentials.</p>
        {demos.map(([role, email, password]) => (
          <button key={email} className="demo-account" onClick={() => setForm({ name: '', email, password })}>
            <strong>{role}</strong>
            <span>{email}</span>
          </button>
        ))}
      </aside>
    </main>
  );
}
