import { describe, expect, it } from 'vitest';
import { renderEmailHtml } from '../lib/email.js';

describe('email rendering', () => {
  it('escapes user-controlled content and preserves safe links', () => {
    const html = renderEmailHtml({
      heading: '<script>alert(1)</script>',
      body: 'Welcome & enjoy',
      actionUrl: 'https://eventrahq.example/tickets?from=email&kind=ticket',
      fallbackUrl: 'https://eventrahq.example'
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Welcome &amp; enjoy');
    expect(html).toContain('from=email&amp;kind=ticket');
  });

  it('rejects executable action URLs', () => {
    const html = renderEmailHtml({
      heading: 'Ticket ready', body: 'Open your wallet.', actionUrl: 'javascript:alert(1)',
      fallbackUrl: 'https://eventrahq.example/dashboard'
    });
    expect(html).not.toContain('javascript:');
    expect(html).toContain('https://eventrahq.example/dashboard');
  });
});
