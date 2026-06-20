import express from 'express';
import { supabase, mapEvent } from '../data/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';

export const dashboardRouter = express.Router();

dashboardRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { data: managedRows, error: managedError } = await supabase
    .from('events')
    .select('*, registrations(user_id, checked_in)')
    .eq('organizer_id', req.user.id);
  if (managedError) throw new HttpError(500, managedError.message);

  const { data: registrationRows, error: registrationError } = await supabase
    .from('registrations')
    .select('checked_in, events(*, registrations(user_id, checked_in))')
    .eq('user_id', req.user.id);
  if (registrationError) throw new HttpError(500, registrationError.message);

  const { data: recommendedRows, error: recommendedError } = await supabase
    .from('events')
    .select('*, registrations(user_id, checked_in)')
    .eq('status', 'published')
    .order('event_date', { ascending: true })
    .limit(6);
  if (recommendedError) throw new HttpError(500, recommendedError.message);

  const attending = registrationRows.map((row) => ({ ...mapEvent(row.events), checkedIn: row.checked_in }));
  const attendingIds = new Set(attending.map((event) => event.id));
  const recommended = recommendedRows.map(mapEvent).filter((event) => !attendingIds.has(event.id)).slice(0, 3);
  const managed = managedRows.map(mapEvent);

  res.json({
    status: 'success',
    summary: {
      role: req.user.role,
      organizedEvents: managed.length,
      attendingEvents: attending.length,
      checkedInEvents: attending.filter((event) => event.checkedIn).length,
      recommendedEvents: recommended.length
    },
    attending,
    managed,
    recommended
  });
}));
