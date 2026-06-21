import { checkInSchema } from '@eventrahq/contracts';
import { Router } from 'express';
import QRCode from 'qrcode';
import { env, requireConfiguration } from '../config/env.js';
import { getAdminClient } from '../lib/database.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { createTicketToken, sha256, verifyTicketToken } from '../lib/security.js';
import { requireAuth, requireMembership } from '../middleware/auth.js';

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

ticketsRouter.get('/', asyncHandler(async (request, response) => {
  requireConfiguration('Ticket signing', [env.ticketSecret]);
  const result = await request.auth!.supabase.from('registrations')
    .select('id,event_id,status,checked_in_at,events(title,starts_at,venue,city)')
    .eq('user_id', request.auth!.user.id).in('status', ['confirmed', 'refunded']).order('created_at', { ascending: false });
  if (result.error) throw new AppError(500, 'tickets_unavailable', result.error.message);
  const tickets = await Promise.all((result.data ?? []).map(async (row) => {
    const event = row.events as unknown as { title: string; starts_at: string; venue: string; city: string };
    const token = createTicketToken(row.id as string, env.ticketSecret!);
    return {
      id: row.id, registrationId: row.id, eventId: row.event_id, eventTitle: event.title,
      startsAt: event.starts_at, venue: event.venue, city: event.city, status: row.status,
      checkedInAt: row.checked_in_at, qrDataUrl: await QRCode.toDataURL(token, { width: 320, margin: 2 })
    };
  }));
  response.json({ tickets });
}));

ticketsRouter.post('/check-ins', asyncHandler(async (request, response) => {
  requireConfiguration('Ticket signing', [env.ticketSecret]);
  const { token } = checkInSchema.parse(request.body);
  const registrationId = verifyTicketToken(token, env.ticketSecret!);
  const admin = getAdminClient();
  const registration = await admin.from('registrations')
    .select('id,ticket_token_hash,events(organization_id)').eq('id', registrationId).maybeSingle();
  if (registration.error || !registration.data) throw new AppError(404, 'ticket_not_found', 'Ticket not found.');
  const event = registration.data.events as unknown as { organization_id: string };
  requireMembership(request, event.organization_id, ['owner', 'manager', 'checkin_staff']);
  if (registration.data.ticket_token_hash !== sha256(token)) throw new AppError(400, 'invalid_ticket', 'Ticket code is invalid.');
  const checkedIn = await admin.rpc('check_in_ticket', {
    p_registration_id: registrationId, p_checked_in_by: request.auth!.user.id
  });
  if (checkedIn.error) throw new AppError(400, 'check_in_failed', checkedIn.error.message);
  response.json({ checkIn: Array.isArray(checkedIn.data) ? checkedIn.data[0] : checkedIn.data });
}));
