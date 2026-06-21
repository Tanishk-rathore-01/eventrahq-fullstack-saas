import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getAdminClient } from '../lib/database.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { mapEvent } from '../lib/events.js';
import { requireAuth, requireMembership } from '../middleware/auth.js';

export const operationsRouter = Router();

operationsRouter.get('/organizations/:organizationId/events', requireAuth, asyncHandler(async (request, response) => {
  const organizationId = String(request.params.organizationId);
  requireMembership(request, organizationId, ['owner', 'manager', 'checkin_staff']);
  const result = await request.auth!.supabase.from('events')
    .select('*,registrations(status,checked_in_at)').eq('organization_id', organizationId).order('starts_at');
  if (result.error) throw new AppError(500, 'events_unavailable', result.error.message);
  response.json({ events: (result.data ?? []).map((row) => mapEvent(row)) });
}));

operationsRouter.get('/events/:eventId/attendees', requireAuth, asyncHandler(async (request, response) => {
  const event = await getAdminClient().from('events').select('organization_id').eq('id', request.params.eventId!).maybeSingle();
  if (event.error || !event.data) throw new AppError(404, 'event_not_found', 'Event not found.');
  requireMembership(request, event.data.organization_id as string, ['owner', 'manager', 'checkin_staff']);
  const result = await getAdminClient().from('registrations')
    .select('id,status,checked_in_at,created_at,profiles(name,email)').eq('event_id', request.params.eventId!).order('created_at');
  if (result.error) throw new AppError(500, 'attendees_unavailable', result.error.message);
  response.json({ attendees: result.data });
}));

operationsRouter.post('/uploads/event-cover-url', requireAuth, asyncHandler(async (request, response) => {
  const input = z.object({
    organizationId: z.uuid(), fileName: z.string().min(1).max(150),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']), size: z.number().int().max(5_000_000)
  }).parse(request.body);
  requireMembership(request, input.organizationId, ['owner', 'manager']);
  const extension = input.contentType === 'image/png' ? 'png' : input.contentType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${input.organizationId}/${randomUUID()}.${extension}`;
  const result = await getAdminClient().storage.from('event-covers').createSignedUploadUrl(path);
  if (result.error) throw new AppError(500, 'upload_unavailable', result.error.message);
  response.json({ path, signedUrl: result.data.signedUrl, token: result.data.token });
}));

operationsRouter.get('/organizations/:organizationId/analytics', requireAuth, asyncHandler(async (request, response) => {
  const organizationId = String(request.params.organizationId);
  requireMembership(request, organizationId, ['owner', 'manager']);
  const result = await getAdminClient().rpc('organization_analytics', { p_organization_id: organizationId });
  if (result.error) throw new AppError(500, 'analytics_unavailable', result.error.message);
  response.json({ analytics: result.data });
}));
