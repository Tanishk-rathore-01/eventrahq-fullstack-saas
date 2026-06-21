import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase.js', () => ({
  getSupabase: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-session-token' } } }) }
  })
}));

import { api, ApiError } from './client.js';

afterEach(() => vi.unstubAllGlobals());

describe('API client', () => {
  it('adds the Supabase bearer token to authenticated requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api<{ status: string }>('/health/live')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:5050/api/health/live', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-session-token' })
    }));
  });

  it('preserves sanitized API error codes and HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'Capacity is full.', code: 'reservation_failed'
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })));
    const error = await api('/events/example/checkout', { method: 'POST' }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'Capacity is full.', code: 'reservation_failed', status: 409 });
  });
});
