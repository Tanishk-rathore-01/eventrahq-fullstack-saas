import type { AiJob, CheckoutResponse, EventInput, EventListResponse, EventPatch, MeResponse, Ticket } from '@eventrahq/contracts';
import { getSupabase } from './supabase.js';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5050/api';

export class ApiError extends Error {
  constructor(message: string, public readonly code = 'request_failed', public readonly status = 500) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = await getSupabase().auth.getSession();
  const token = session.data.session?.access_token;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(String(payload.message ?? 'Request failed.'), String(payload.code ?? 'request_failed'), response.status);
  return payload as T;
}

export const apiClient = {
  me: () => api<MeResponse>('/me'),
  events: (query = '') => api<EventListResponse>(`/events${query ? `?${query}` : ''}`),
  event: (id: string) => api<{ event: EventListResponse['events'][number] }>(`/events/${id}`),
  createEvent: (input: EventInput) => api<{ event: EventListResponse['events'][number] }>('/events', { method: 'POST', body: JSON.stringify(input) }),
  updateEvent: (id: string, input: EventPatch) => api<{ event: EventListResponse['events'][number] }>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  signedUpload: (input: { organizationId: string; fileName: string; contentType: string; size: number }) =>
    api<{ path: string; signedUrl: string; token: string }>('/uploads/event-cover-url', { method: 'POST', body: JSON.stringify(input) }),
  organizationEvents: (id: string) => api<{ events: EventListResponse['events'] }>(`/organizations/${id}/events`),
  createOrganization: (name: string, description: string) => api<{ organization: { id: string; name: string } }>('/organizations', { method: 'POST', body: JSON.stringify({ name, description }) }),
  invite: (organizationId: string, email: string, role: string) => api<{ invitationId: string }>(`/organizations/${organizationId}/invitations`, { method: 'POST', body: JSON.stringify({ email, role }) }),
  acceptInvite: (token: string) => api<{ organizationId: string }>(`/organizations/invitations/${token}/accept`, { method: 'POST' }),
  checkout: (eventId: string) => api<CheckoutResponse>(`/events/${eventId}/checkout`, { method: 'POST' }),
  verifyPayment: (input: Record<string, string>) => api<{ status: string; registrationId: string }>('/payments/verify', { method: 'POST', body: JSON.stringify(input) }),
  tickets: () => api<{ tickets: Ticket[] }>('/tickets'),
  checkIn: (token: string) => api<{ checkIn: { already_checked_in: boolean; checked_in_at: string } }>('/tickets/check-ins', { method: 'POST', body: JSON.stringify({ token }) }),
  createAiBrief: (eventId: string, audience: string, goal: string) => api<{ jobId: string; status: string }>('/ai/event-brief', { method: 'POST', body: JSON.stringify({ eventId, audience, goal }) }),
  aiJob: (jobId: string) => api<AiJob>(`/ai/jobs/${jobId}`),
  analytics: (organizationId: string) => api<{ analytics: Record<string, number> }>(`/organizations/${organizationId}/analytics`),
  admin: () => api<{ stats: Record<string, number>; recentAuditLogs: Array<Record<string, unknown>> }>('/admin/stats')
};
