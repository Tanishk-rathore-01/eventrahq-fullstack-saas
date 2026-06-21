import { paymentVerificationSchema } from '@eventrahq/contracts';
import { Router, type Request, type Response } from 'express';
import Razorpay from 'razorpay';
import { env, requireConfiguration } from '../config/env.js';
import { getAdminClient } from '../lib/database.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
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
      to: profile.data.email, template: 'ticket_confirmation', subject: `Your ticket for ${event.data.title}`, heading: 'Your ticket is confirmed',
      body: `Your EventraHQ registration for ${event.data.title} is confirmed. Open your ticket wallet to display the QR code.`,
      actionUrl: `${env.appUrl}/tickets`
    }, userId, `ticket-email:${registrationId}`);
  }
}

async function queuePaymentFailureEmail(userId: string, eventId: string, registrationId: string, reason: string): Promise<void> {
  const admin = getAdminClient();
  const [profile, event] = await Promise.all([
    admin.from('profiles').select('email').eq('id', userId).single(),
    admin.from('events').select('title').eq('id', eventId).single()
  ]);
  if (profile.error || event.error || !profile.data || !event.data) throw new Error('Payment failure email recipient is unavailable.');
  await enqueueJob('send_email', {
    to: profile.data.email,
    template: 'payment_failure',
    subject: `Payment issue for ${event.data.title}`,
    heading: 'Payment could not be confirmed',
    body: `${reason} Your seat is not confirmed. Open EventraHQ to try again.`,
    actionUrl: `${env.appUrl}/events/${eventId}`
  }, userId, `payment-failure:${registrationId}`);
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
  try {
    await queueTicketEmail(request.auth!.user.id, row.event_id as string, row.registration_id as string);
  } catch (error) {
    logger.warn({ err: error, registrationId: row.registration_id }, 'Ticket email could not be queued during payment verification');
  }
  response.json({ status: 'confirmed', registrationId: row.registration_id });
}));

export async function razorpayWebhook(request: Request, response: Response): Promise<void> {
  requireConfiguration('Razorpay webhook', [env.razorpayWebhookSecret]);
  const signature = String(request.headers['x-razorpay-signature'] ?? '');
  const body = request.body as Buffer;
  if (!verifyWebhookSignature(body, signature, env.razorpayWebhookSecret!)) {
    throw new AppError(400, 'invalid_webhook_signature', 'Webhook signature verification failed.');
  }
  let event: { event: string; payload: { payment?: { entity?: Record<string, unknown> } } };
  try {
    event = JSON.parse(body.toString('utf8')) as typeof event;
  } catch {
    throw new AppError(400, 'invalid_webhook_payload', 'Webhook body is not valid JSON.');
  }
  const payment = event.payload.payment?.entity;
  const eventId = String(request.headers['x-razorpay-event-id'] ?? sha256(body.toString('utf8')));
  const admin = getAdminClient();
  const inserted = await admin.from('webhook_events').insert({
    provider: 'razorpay', provider_event_id: eventId, event_type: event.event
  }).select('id,processed_at').single();
  let webhookId = inserted.data?.id as string | undefined;
  if (inserted.error?.code === '23505') {
    const existing = await admin.from('webhook_events').select('id,processed_at')
      .eq('provider', 'razorpay').eq('provider_event_id', eventId).single();
    if (existing.error || !existing.data) throw new AppError(500, 'webhook_lookup_failed', 'Stored webhook could not be loaded.');
    if (existing.data.processed_at) { response.status(200).json({ received: true, duplicate: true }); return; }
    webhookId = existing.data.id as string;
  } else if (inserted.error) {
    throw new AppError(500, 'webhook_store_failed', inserted.error.message);
  }
  if (!webhookId) throw new AppError(500, 'webhook_store_failed', 'Webhook identifier was not created.');
  try {
    if (event.event === 'payment.captured' && payment) {
      const orderId = String(payment.order_id);
      const confirmed = await admin.rpc('confirm_payment', {
        p_order_id: orderId, p_payment_id: String(payment.id), p_user_id: null
      });
      if (confirmed.error) {
        if (confirmed.error.message.includes('Reservation expired before payment confirmation')) {
          const paymentRow = await admin.from('payments').select('id,registration_id').eq('provider_order_id', orderId).single();
          if (paymentRow.error || !paymentRow.data) throw new Error(paymentRow.error?.message ?? 'Expired payment record not found.');
          const registration = await admin.from('registrations').select('user_id,event_id').eq('id', paymentRow.data.registration_id).single();
          if (registration.error || !registration.data) throw new Error(registration.error?.message ?? 'Expired registration not found.');
          const marked = await admin.from('payments').update({ status: 'requires_action', provider_payment_id: String(payment.id) })
            .eq('id', paymentRow.data.id);
          if (marked.error) throw new Error(marked.error.message);
          await queuePaymentFailureEmail(String(registration.data.user_id), String(registration.data.event_id),
            String(paymentRow.data.registration_id), 'The payment arrived after the checkout hold expired.');
        } else {
          throw new Error(confirmed.error.message);
        }
      } else {
        const row = Array.isArray(confirmed.data) ? confirmed.data[0] : confirmed.data;
        if (row) {
          const registration = await admin.from('registrations').select('user_id').eq('id', row.registration_id).single();
          if (registration.error || !registration.data) throw new Error(registration.error?.message ?? 'Registration owner not found.');
          await queueTicketEmail(String(registration.data.user_id), String(row.event_id), String(row.registration_id));
        }
      }
    }
    if (event.event === 'payment.failed' && payment) {
      const paymentRow = await admin.from('payments').select('id,registration_id').eq('provider_order_id', String(payment.order_id)).single();
      if (paymentRow.error || !paymentRow.data) throw new Error(paymentRow.error?.message ?? 'Failed payment record not found.');
      const registration = await admin.from('registrations').select('user_id,event_id,status')
        .eq('id', paymentRow.data.registration_id).single();
      if (registration.error || !registration.data) throw new Error(registration.error?.message ?? 'Failed registration not found.');
      const [paymentUpdate, registrationUpdate] = await Promise.all([
        admin.from('payments').update({ status: 'failed', provider_payment_id: String(payment.id) }).eq('id', paymentRow.data.id),
        registration.data.status === 'pending'
          ? admin.from('registrations').update({ status: 'cancelled', expires_at: null }).eq('id', paymentRow.data.registration_id)
          : Promise.resolve({ error: null })
      ]);
      if (paymentUpdate.error || registrationUpdate.error) throw new Error(paymentUpdate.error?.message ?? registrationUpdate.error?.message);
      await queuePaymentFailureEmail(String(registration.data.user_id), String(registration.data.event_id),
        String(paymentRow.data.registration_id), String(payment.error_description ?? 'Razorpay reported that the payment failed.'));
    }
    const processed = await admin.from('webhook_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', webhookId);
    if (processed.error) throw new Error(processed.error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    await admin.from('webhook_events').update({ error: message }).eq('id', webhookId);
    throw new AppError(503, 'webhook_processing_failed', message);
  }
  response.status(200).json({ received: true });
}
