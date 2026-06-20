import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabase, publicUser } from '../data/supabase.js';
import { HttpError } from '../utils/httpError.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.jwtSecret,
    { expiresIn: '8h', issuer: 'eventrahq-api' }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) throw new HttpError(401, 'Authentication required.');

    const payload = jwt.verify(token, env.jwtSecret, { issuer: 'eventrahq-api' });
    const { data: user, error } = await supabase.from('app_users').select('*').eq('id', payload.sub).maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (!user) throw new HttpError(401, 'User session is no longer valid.');

    req.user = publicUser(user);
    next();
  } catch (error) {
    next(error.statusCode ? error : new HttpError(401, 'Invalid or expired token.'));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new HttpError(403, 'Permission denied.'));
      return;
    }
    next();
  };
}
