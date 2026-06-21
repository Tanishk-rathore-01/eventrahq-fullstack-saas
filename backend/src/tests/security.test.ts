import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createTicketToken, sha256, slugify, verifyRazorpayPaymentSignature,
  verifyTicketToken, verifyWebhookSignature
} from '../lib/security.js';

describe('security primitives', () => {
  it('creates stable slugs and hashes', () => {
    expect(slugify('  AI Product Leaders 2026! ')).toBe('ai-product-leaders-2026');
    expect(sha256('eventrahq')).toHaveLength(64);
  });

  it('round-trips a signed ticket and rejects tampering', () => {
    const token = createTicketToken('registration-id', 'a-strong-ticket-secret');
    expect(verifyTicketToken(token, 'a-strong-ticket-secret')).toBe('registration-id');
    expect(() => verifyTicketToken(`${token}x`, 'a-strong-ticket-secret')).toThrow('invalid');
  });

  it('verifies Razorpay signatures using constant-time comparison', () => {
    const signature = createHmac('sha256', 'secret').update('order_1|pay_1').digest('hex');
    expect(verifyRazorpayPaymentSignature('order_1', 'pay_1', signature, 'secret')).toBe(true);
    expect(verifyRazorpayPaymentSignature('order_1', 'pay_2', signature, 'secret')).toBe(false);
  });

  it('verifies raw webhook bodies', () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const signature = createHmac('sha256', 'webhook').update(body).digest('hex');
    expect(verifyWebhookSignature(body, signature, 'webhook')).toBe(true);
  });
});
