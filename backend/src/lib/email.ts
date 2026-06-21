function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]!);
}

function safeActionUrl(value: string, fallback: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
  } catch {
    // Invalid or relative URLs fall back to the configured application URL.
  }
  return new URL(fallback).toString();
}

export function renderEmailHtml(input: {
  heading: string;
  body: string;
  actionUrl: string;
  fallbackUrl: string;
}): string {
  const heading = escapeHtml(input.heading);
  const body = escapeHtml(input.body).replace(/\r?\n/g, '<br>');
  const actionUrl = escapeHtml(safeActionUrl(input.actionUrl, input.fallbackUrl));
  return `<!doctype html><html lang="en"><body style="margin:0;background:#070911;color:#f8fafc;font-family:Arial,sans-serif"><main style="max-width:600px;margin:0 auto;padding:40px 24px"><h1>${heading}</h1><p style="line-height:1.6">${body}</p><a href="${actionUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#8b5cf6;color:#fff;text-decoration:none">Open EventraHQ</a></main></body></html>`;
}
