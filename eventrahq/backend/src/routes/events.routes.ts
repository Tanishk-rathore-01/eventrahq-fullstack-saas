import { eventInputSchema, eventPatchSchema } from '@eventrahq/contracts';
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { getAdminClient } from '../lib/database.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { mapEvent } from '../lib/events.js';
import { slugify } from '../lib/security.js';
import { requireAuth, requireMembership } from '../middleware/auth.js';

export const eventsRouter = Router();

eventsRouter.get('/', asyncHandler(async (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit) || 12, 1), 24);
  const search = String(request.query.search ?? '').trim();
  const category = String(request.query.category ?? '').trim();
  const city = String(request.query.city ?? '').trim();
  const cursor = String(request.query.cursor ?? '').trim();
  let query = getAdminClient().from('events')
    .select('*,registrations(status,checked_in_at)').eq('status', 'published')
    .order('starts_at', { ascending: true }).limit(limit + 1);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  if (category) query = query.eq('category', category);
  if (city) query = query.ilike('city', `%${city}%`);
  if (cursor) query = query.gt('starts_at', cursor);
  const result = await query;
  if (result.error) throw new AppError(500, 'events_unavailable', result.error.message);
  const rows = result.data ?? [];
  const hasNext = rows.length > limit;
  const visible = hasNext ? rows.slice(0, limit) : rows;
  response.json({
    events: visible.map((row) => mapEvent(row)),
    nextCursor: hasNext ? String(visible.at(-1)?.starts_at ?? '') : null
  });
}));

eventsRouter.get('/:eventId', asyncHandler(async (request, response) => {
  const id = request.params.eventId!;
  const result = await getAdminClient().from('events').select('*,registrations(status,checked_in_at)')
    .or(`id.eq.${id},slug.eq.${id}`).eq('status', 'published').maybeSingle();
  if (result.error || !result.data) throw new AppError(404, 'event_not_found', 'Event not found.');
  response.json({ event: mapEvent(result.data) });
}));

eventsRouter.post('/', requireAuth, asyncHandler(async (request, response) => {
  const input = eventInputSchema.parse(request.body);
  requireMembership(request, input.organizationId, ['owner', 'manager']);
  const row = {
    organization_id: input.organizationId,
    title: input.title,
    slug: `${slugify(input.title)}-${randomBytes(3).toString('hex')}`,
    category: input.category, status: input.status, venue: input.venue, city: input.city,
    starts_at: input.startsAt, ends_at: input.endsAt, capacity: input.capacity,
    price_paise: input.pricePaise, currency: input.currency, description: input.description,
    tags: input.tags, agenda: input.agenda, cover_path: input.coverPath, created_by: request.auth!.user.id
  };
  const result = await request.auth!.supabase.from('events')
    .insert(row).select('*,registrations(status,checked_in_at)').single();
  if (result.error) throw new AppError(400, 'event_create_failed', result.error.message);
  response.status(201).json({ event: mapEvent(result.data) });
}));

eventsRouter.patch('/:eventId', requireAuth, asyncHandler(async (request, response) => {
  const input = eventPatchSchema.parse(request.body);
  const admin = getAdminClient();
  const current = await admin.from('events').select('organization_id').eq('id', request.params.eventId!).maybeSingle();
  if (current.error || !current.data) throw new AppError(404, 'event_not_found', 'Event not found.');
  requireMembership(request, current.data.organization_id as string, ['owner', 'manager']);
  const patch = {
    ...(input.title !== undefined && { title: input.title }), ...(input.category !== undefined && { category: input.category }),
    ...(input.status !== undefined && { status: input.status }), ...(input.venue !== undefined && { venue: input.venue }),
    ...(input.city !== undefined && { city: input.city }), ...(input.startsAt !== undefined && { starts_at: input.startsAt }),
    ...(input.endsAt !== undefined && { ends_at: input.endsAt }), ...(input.capacity !== undefined && { capacity: input.capacity }),
    ...(input.pricePaise !== undefined && { price_paise: input.pricePaise }), ...(input.description !== undefined && { description: input.description }),
    ...(input.tags !== undefined && { tags: input.tags }), ...(input.agenda !== undefined && { agenda: input.agenda }),
    ...(input.coverPath !== undefined && { cover_path: input.coverPath })
  };
  const result = await request.auth!.supabase.from('events').update(patch).eq('id', request.params.eventId!)
    .select('*,registrations(status,checked_in_at)').single();
  if (result.error) throw new AppError(400, 'event_update_failed', result.error.message);
  response.json({ event: mapEvent(result.data) });
}));
