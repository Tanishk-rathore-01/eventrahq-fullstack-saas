import { HttpError } from './httpError.js';

export function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length) {
    throw new HttpError(400, `Missing required field(s): ${missing.join(', ')}`);
  }
}

export function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

export function safeString(value, max = 250) {
  return String(value || '').trim().slice(0, max);
}

export function assertRole(user, roles) {
  if (!user || !roles.includes(user.role)) {
    throw new HttpError(403, 'You do not have permission to perform this action.');
  }
}
