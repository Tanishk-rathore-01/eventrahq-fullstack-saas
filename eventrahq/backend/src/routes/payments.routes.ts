import { paymentVerificationSchema } from '@eventrahq/contracts';
import { Router, type Request, type Response } from 'express';
import Razorpay from 'razorpay';
import { env, requireConfiguration } from '../config/env.js';
import { getAdminClient } from '../lib/database.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { createTicketToken, sha256, verifyRazorpayPaymentSignature, verifyWebhookSignature } from '../lib/security.js';
import { requireAuth } from '../middleware/auth.js';
import { enqueueJob } from '../services/jobs.js';

export const paymentsRouter = Router();

async function queueTicketEmail(userId: string, eventId: string, registrationId: string): Promise<void> {
  const admin = getAdminClient();
  const [profile, event] = await Promise.all([
    admin.from('profiles').select('email,name').eq('id', userId).single(),
    admin.from('events').select('title').eq('id', eventId).single()
  ]);
  if (profile.data && event.data) {
    await enqueueJob('send_email', {
      to: profile.data.email, subject: `Your ticket for ${event.data.title}`, heading: 'Your ticket is confirmed',
      body: `Your EventraHQ registration for ${event.data.title} is confirmed. Open your ticket wallet to display the QR code.`,
      actionUrl: `${env.appUrl}/tickets`
    }, userId, `ticket-email:${registrationId}`);
  }
}

paymentsRouter.post('/events/:eventId/checkout', requireAuth, asyncHandler(async (request, response) => {
  requireConfiguration('Ticket signing', [env.ticketSecret]);
  const admin = getAdminClient();
  const event = await admin.from('events').select('id,title,price_paise,currency,status').eq('id', request.params.eventId!).maybeSingle();
  if (event.error || !event.data || event.data.status !== 'published') throw new AppError(404, 'event_not_found', 'Published event not found.');
  const provisionalToken = createTicketToken(request.auth!.user.id + ':' + event.data.id, env.ticketSecret!);
  const reserved = await admin.rpc('reserve_event_seat', {
    p_event_id: event.data.id, p_user_id: request.auth!.user.id, p_ticket_hash: sha256(provisionalToken)
  });
  if (reserved.error) throw new AppError(409, 'reservation_failed', reserved.error.message);
  const registration = Array.isArray(reserved.data) ? reserved.data[0] : reserved.data;
  if (!registration) throw new AppError(409, 'reservation_failed', 'Seat could not be reserved.');
  const ticketToken = createTicketToken(registration.registration_id as string, env.ticketSecret!);
  const tokenUpdate = await admin.from('registrations').update({ ticket_token_hash: sha256(ticketToken) })
    .eq('id', registration.registration_id);
  if (tokenUpdate.error) throw new AppError(500, 'ticket_create_failed', tokenUpdate.error.message);
  if (Number(event.data.price_paise) === 0) {
    await queueTicketEmail(request.auth!.user.id, event.data.id, registration.registration_id as string);
    response.json({ kind: 'free', registrationId: registration.registration_id, ticketId: registration.registration_id });
    return;
  }
  requireConfiguration('Razorpay', [env.razorpayKeyId, env.razorpayKeySecret]);
  const razorpay = new Razorpay({ key_id: env.razorpayKeyId!, key_secret: env.razorpayKeySecret! });
  const order = await razorpay.orders.create({
    amount: Number(event.data.price_paise), currency: 'INR',
    receipt: `reg_${String(registration.registration_id).slice(0, 30)}`,
    notes: { registrationId: registration.registration_id as string, eventId: event.data.id, userId: request.auth!.user.id }
  });
  const payment = await admin.from('payments').insert({
    registration_id: registration.registration_id, provider_order_id: order.id,
    amount_paise: event.data.price_paise, currency: 'INR', status: 'created'
  });
  if (payment.error) throw new AppError(500, 'payment_create_failed', payment.error.message);
  response.json({
    kind: 'razorpay', registrationId: registration.registration_id, orderId: order.id,
    amount: Number(event.data.price_paise), currency: 'INR', keyId: env.razorpayKeyId,
    expiresAt: registration.expires_at
  });
}));

paymentsRouter.post('/payments/verify', requireAuth, asyncHandler(async (request, response) => {
  requireConfiguration('Razorpay', [env.razorpayKeySecret]);
  const input = paymentVerificationSchema.parse(request.body);
  if (!verifyRazorpayPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature, env.razorpayKeySecret!)) {
    throw new AppError(400, 'invalid_payment_signature', 'Payment signature verification failed.');
  }
  const admin = getAdminClient();
  const confirmed = await admin.rpc('confirm_payment', {
    p_order_id: input.razorpayOrderId, p_payment_id: input.razorpayPaymentId, p_user_id: request.auth!.user.id
  });
  if (confirmed.error) throw new AppError(400, 'payment_confirmation_failed', confirmed.error.message);
  const row = Array.isArray(confirmed.data) ? confirmed.data[0] : confirmed.data;
  await queueTicketEmail(request.auth!.user.id, row.event_id as string, row.registration_id as string);
  response.json({ status: 'confirmed', registrationId: row.registration_id });
}));

export async function razorpayWebhook(request: Request, response: Response): Promise<void> {
  requireConfiguration('Razorpay webhook', [env.razorpayWebhookSecret]);
  const signature = String(request.headers['x-razorpay-signature'] ?? '');
  const body = request.body as Buffer;
  if (!verifyWebhookSignature(body, signature, env.razorpayWebhookSecret!)) {
    throw new AppError(400, 'invalid_webhook_signature', 'Webhook signature verification failed.');
  }
  const event = JSON.parse(body.toString('utf8')) as { event: string; payload: { payment?: { entity?: Record<string, unknown> } } };
  const payment = event.payload.payment?.entity;
  const eventId = String(request.headers['x-razorpay-event-id'] ?? sha256(body.toString('utf8')));
  const admin = getAdminClient();
  const stored = await admin.from('webhook_events').insert({ provider: 'razorpay', provider_event_id: eventId, event_type: event.event });
  if (stored.error?.code === '23505') { response.status(200).json({ received: true, duplicate: true }); return; }
  if (stored.error) throw new AppError(500, 'webhook_store_failed', stored.error.message);
  if (event.event === 'payment.captured' && payment) {
    const confirmed = await admin.rpc('confirm_payment', {
      p_order_id: String(payment.order_id), p_payment_id: String(payment.id), p_user_id: null
    });
    if (!confirmed.error) {
      const row = Array.isArray(confirmed.data) ? confirmed.data[0] : confirmed.data;
      if (row) {
        const registration = await admin.from('registrations').select('user_id').eq('id', row.registration_id).single();
        if (registration.data) await queueTicketEmail(registration.data.user_id as string, row.event_id as string, row.registration_id as string);
      }
    }
  }
  response.status(200).json({ received: true });
}
