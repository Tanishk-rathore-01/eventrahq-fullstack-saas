import express from 'express';
import { supabase, publicUser } from '../data/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';

export const adminRouter = express.Router();

adminRouter.get('/stats', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const [usersResult, eventsResult, registrationsResult, logsResult] = await Promise.all([
    supabase.from('app_users').select('*'),
    supabase.from('events').select('*'),
    supabase.from('registrations').select('*'),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8)
  ]);

  for (const result of [usersResult, eventsResult, registrationsResult, logsResult]) {
    if (result.error) throw new HttpError(500, result.error.message);
  }

  const users = usersResult.data || [];
  const events = eventsResult.data || [];
  const registrations = registrationsResult.data || [];
  const capacity = events.reduce((sum, event) => sum + Number(event.capacity || 0), 0);
  const checkIns = registrations.filter((registration) => registration.checked_in).length;
  const revenue = registrations.reduce((sum, registration) => {
    const event = events.find((candidate) => candidate.id === registration.event_id);
    return sum + Number(event?.price || 0);
  }, 0);

  const categoryMap = events.reduce((acc, event) => {
    acc[event.category] = (acc[event.category] || 0) + 1;
    return acc;
  }, {});

  res.json({
    status: 'success',
    stats: {
      users: users.length,
      events: events.length,
      publishedEvents: events.filter((event) => event.status === 'published').length,
      registrations: registrations.length,
      checkIns,
      occupancyRate: capacity ? Math.round((registrations.length / capacity) * 100) : 0,
      checkInRate: registrations.length ? Math.round((checkIns / registrations.length) * 100) : 0,
      revenue
    },
    categories: Object.entries(categoryMap).map(([name, count]) => ({ name, count })),
    recentAuditLogs: logsResult.data || [],
    users: users.map(publicUser)
  });
}));
