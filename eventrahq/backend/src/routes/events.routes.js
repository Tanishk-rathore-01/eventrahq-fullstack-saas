import express from 'express';
import { nanoid } from 'nanoid';
import { supabase, mapEvent, insertAudit } from '../data/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import { requireFields, safeString } from '../utils/validators.js';

export const eventsRouter = express.Router();

function canManage(user, event) {
  return user.role === 'admin' || event.organizer_id === user.id || event.organizerId === user.id;
}

function eventPayload(body, userId) {
  const title = safeString(body.title, 120);
  return {
    title,
    slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${nanoid(5)}`,
    category: safeString(body.category, 60),
    status: body.status === 'draft' ? 'draft' : 'published',
    location: safeString(body.location, 120),
    city: safeString(body.city, 80),
    event_date: safeString(body.date || body.event_date, 20),
    event_time: safeString(body.time || body.event_time, 10),
    capacity: Math.max(1, Number(body.capacity || 1)),
    price: Math.max(0, Number(body.price || 0)),
    cover: ['aurora', 'prism', 'matrix', 'onyx'].includes(body.cover) ? body.cover : 'aurora',
    organizer_id: userId,
    description: safeString(body.description, 900),
    tags: Array.isArray(body.tags) ? body.tags.map((tag) => safeString(tag, 24)).slice(0, 8) : [],
    agenda: Array.isArray(body.agenda) ? body.agenda.map((item) => safeString(item, 120)).slice(0, 8) : []
  };
}

eventsRouter.get('/', asyncHandler(async (req, res) => {
  const search = safeString(req.query.search || '', 120).toLowerCase();
  const category = safeString(req.query.category || '', 60);
  const city = safeString(req.query.city || '', 60);

  let query = supabase
    .from('events')
    .select('*, registrations(user_id, checked_in)')
    .eq('status', 'published')
    .order('event_date', { ascending: true });

  if (category) query = query.eq('category', category);
  if (city) query = query.ilike('city', `%${city}%`);

  const { data, error } = await query;
  if (error) throw new HttpError(500, error.message);

  const events = data
    .filter((event) => !search || [event.title, event.description, event.city, event.category, ...(event.tags || [])]
      .join(' ')
      .toLowerCase()
      .includes(search))
    .map(mapEvent);

  res.json({ status: 'success', count: events.length, events });
}));

eventsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { data: event, error } = await supabase
    .from('events')
    .select('*, registrations(user_id, checked_in)')
    .or(`id.eq.${req.params.id},slug.eq.${req.params.id}`)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!event) throw new HttpError(404, 'Event not found.');

  res.json({ status: 'success', event: mapEvent(event) });
}));

eventsRouter.post('/', requireAuth, requireRole('admin', 'organizer'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['title', 'category', 'location', 'city', 'date', 'time', 'capacity', 'description']);

  const payload = { id: `evt_${nanoid(14)}`, ...eventPayload(req.body, req.user.id) };
  const { data, error } = await supabase.from('events').insert(payload).select('*, registrations(user_id, checked_in)').single();
  if (error) throw new HttpError(500, error.message);

  await insertAudit(req.user.id, 'event.created', { eventId: data.id, title: data.title });
  res.status(201).json({ status: 'success', event: mapEvent(data) });
}));

eventsRouter.patch('/:id', requireAuth, requireRole('admin', 'organizer'), asyncHandler(async (req, res) => {
  const { data: existing, error: existingError } = await supabase.from('events').select('*').eq('id', req.params.id).maybeSingle();
  if (existingError) throw new HttpError(500, existingError.message);
  if (!existing) throw new HttpError(404, 'Event not found.');
  if (!canManage(req.user, existing)) throw new HttpError(403, 'You cannot manage this event.');

  const patch = {};
  const textFields = ['title', 'category', 'status', 'location', 'city', 'description', 'cover'];
  for (const field of textFields) {
    if (req.body[field] !== undefined) patch[field] = safeString(req.body[field], field === 'description' ? 900 : 140);
  }
  if (req.body.date !== undefined) patch.event_date = safeString(req.body.date, 20);
  if (req.body.time !== undefined) patch.event_time = safeString(req.body.time, 10);
  if (req.body.capacity !== undefined) patch.capacity = Math.max(1, Number(req.body.capacity));
  if (req.body.price !== undefined) patch.price = Math.max(0, Number(req.body.price));
  if (Array.isArray(req.body.tags)) patch.tags = req.body.tags.map((tag) => safeString(tag, 24)).slice(0, 8);
  if (Array.isArray(req.body.agenda)) patch.agenda = req.body.agenda.map((item) => safeString(item, 120)).slice(0, 8);

  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', req.params.id)
    .select('*, registrations(user_id, checked_in)')
    .single();

  if (error) throw new HttpError(500, error.message);
  await insertAudit(req.user.id, 'event.updated', { eventId: data.id });
  res.json({ status: 'success', event: mapEvent(data) });
}));

eventsRouter.post('/:id/register', requireAuth, asyncHandler(async (req, res) => {
  const { data: event, error } = await supabase
    .from('events')
    .select('*, registrations(user_id, checked_in)')
    .eq('id', req.params.id)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!event) throw new HttpError(404, 'Event not found.');
  if ((event.registrations || []).length >= event.capacity) throw new HttpError(409, 'Event capacity is full.');

  const { error: insertError } = await supabase.from('registrations').upsert({
    id: `reg_${nanoid(14)}`,
    event_id: event.id,
    user_id: req.user.id
  }, { onConflict: 'event_id,user_id', ignoreDuplicates: true });

  if (insertError) throw new HttpError(500, insertError.message);
  await insertAudit(req.user.id, 'event.registered', { eventId: event.id });

  const { data: updated, error: fetchError } = await supabase
    .from('events')
    .select('*, registrations(user_id, checked_in)')
    .eq('id', event.id)
    .single();

  if (fetchError) throw new HttpError(500, fetchError.message);
  res.json({ status: 'success', event: mapEvent(updated) });
}));

eventsRouter.post('/:id/checkin', requireAuth, requireRole('admin', 'organizer'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['userId']);

  const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', req.params.id).maybeSingle();
  if (eventError) throw new HttpError(500, eventError.message);
  if (!event) throw new HttpError(404, 'Event not found.');
  if (!canManage(req.user, event)) throw new HttpError(403, 'You cannot manage this event.');

  const userId = safeString(req.body.userId, 80);
  const { data, error } = await supabase
    .from('registrations')
    .update({ checked_in: true, checked_in_at: new Date().toISOString() })
    .eq('event_id', event.id)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(400, 'User is not registered for this event.');

  await insertAudit(req.user.id, 'event.checked_in', { eventId: event.id, userId });
  res.json({ status: 'success', registration: data });
}));
