import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('eventrahq_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then((payload) => setUser(payload.user))
      .catch(() => localStorage.removeItem('eventrahq_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const payload = await authApi.login(email, password);
    localStorage.setItem('eventrahq_token', payload.token);
    setUser(payload.user);
    return payload.user;
  }

  async function register(name, email, password) {
    const payload = await authApi.register(name, email, password);
    localStorage.setItem('eventrahq_token', payload.token);
    setUser(payload.user);
    return payload.user;
  }

  function logout() {
    localStorage.removeItem('eventrahq_token');
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
