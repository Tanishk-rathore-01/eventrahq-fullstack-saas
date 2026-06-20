const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

export async function api(path, options = {}) {
  const token = localStorage.getItem('eventrahq_token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed.');
  }
  return payload;
}

export const authApi = {
  login: (email, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name, email, password) => api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  me: () => api('/auth/me')
};

export const eventApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api(`/events${query ? `?${query}` : ''}`);
  },
  detail: (id) => api(`/events/${id}`),
  register: (id) => api(`/events/${id}/register`, { method: 'POST' }),
  create: (event) => api('/events', { method: 'POST', body: JSON.stringify(event) })
};

export const dashboardApi = {
  get: () => api('/dashboard'),
  admin: () => api('/admin/stats')
};

export const aiApi = {
  eventBrief: (payload) => api('/ai/event-brief', { method: 'POST', body: JSON.stringify(payload) })
};
