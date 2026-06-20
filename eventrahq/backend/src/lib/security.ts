import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';

export const slugify = (value: string): string =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export function createTicketToken(registrationId: string, secret: string): string {
  return `${registrationId}.${createHmac('sha256', secret).update(registrationId).digest('base64url')}`;
}

export function verifyTicketToken(token: string, secret: string): string {
  const separator = token.lastIndexOf('.');
  if (separator < 1) throw new AppError(400, 'invalid_ticket', 'Ticket code is invalid.');
  const registrationId = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(createHmac('sha256', secret).update(registrationId).digest('base64url'));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new AppError(400, 'invalid_ticket', 'Ticket code is invalid.');
  }
  return registrationId;
}

function safeEqual(expected: string, provided: string): boolean {
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(provided, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  return safeEqual(createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex'), signature);
}

export function verifyWebhookSignature(body: Buffer, signature: string, secret: string): boolean {
  return safeEqual(createHmac('sha256', secret).update(body).digest('hex'), signature);
}
