import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('health endpoints', () => {
  it('reports liveness without external dependencies', async () => {
    const response = await request(createApp()).get('/api/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'eventrahq-api' });
  });

  it('returns a structured 404', async () => {
    const response = await request(createApp()).get('/api/not-a-route');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('route_not_found');
  });
});
