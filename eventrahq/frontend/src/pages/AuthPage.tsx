import { LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSupabase } from '../api/supabase.js';
import { useAuth } from '../context/AuthContext.js';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>(location.pathname.endsWith('/reset') ? 'reset' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      if (mode === 'login') { await signIn(form.email, form.password); navigate('/dashboard'); }
      if (mode === 'signup') {
        const active = await signUp(form.name, form.email, form.password);
        if (active) navigate('/dashboard'); else setMessage('Check your inbox to verify your email before signing in.');
      }
      if (mode === 'forgot') { await resetPassword(form.email); setMessage('Password reset link sent.'); }
      if (mode === 'reset') {
        const result = await getSupabase().auth.updateUser({ password: form.password });
        if (result.error) throw result.error;
        setMessage('Password updated. You can continue to your workspace.');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Authentication failed.'); }
    finally { setLoading(false); }
  }

  const titles = { login: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', reset: 'Choose a new password' };
  return <main className="auth-page container">
    <section className="auth-panel"><div className="section-head compact"><span>Secure access</span><h1>{titles[mode]}</h1></div>
      <form className="form-card" onSubmit={(event) => void submit(event)}>
        {mode === 'signup' && <label>Name<div className="input-icon"><UserRound/><input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} required minLength={2}/></div></label>}
        {mode !== 'reset' && <label>Email<div className="input-icon"><Mail/><input type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})} required autoComplete="email"/></div></label>}
        {mode !== 'forgot' && <label>Password<div className="input-icon"><LockKeyhole/><input type="password" value={form.password} onChange={(e) => setForm({...form, password:e.target.value})} required minLength={8} autoComplete={mode==='login'?'current-password':'new-password'}/></div></label>}
        {error && <div className="error-box" role="alert">{error}</div>}{message && <div className="notice-box" role="status">{message}</div>}
        <button className="primary-btn full" disabled={loading}>{loading ? 'Please wait…' : titles[mode]}</button>
      </form>
      <div className="auth-switches">{mode !== 'login' && <button className="text-button" onClick={() => setMode('login')}>Back to sign in</button>}
        {mode === 'login' && <><button className="text-button" onClick={() => setMode('signup')}>Create account</button><button className="text-button" onClick={() => setMode('forgot')}>Forgot password?</button></>}</div>
    </section>
    <aside className="auth-benefits"><span className="eyebrow">One secure identity</span><h2>Operate every event with explicit access.</h2><p>Sessions refresh automatically. Workspace roles and database policies independently enforce authorization.</p></aside>
  </main>;
}
