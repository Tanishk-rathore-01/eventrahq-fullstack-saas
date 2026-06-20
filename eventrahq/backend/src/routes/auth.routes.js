import bcrypt from 'bcryptjs';
import express from 'express';
import { nanoid } from 'nanoid';
import { supabase, publicUser, insertAudit } from '../data/supabase.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import { isEmail, requireFields, safeString } from '../utils/validators.js';

export const authRouter = express.Router();

authRouter.post('/register', asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'email', 'password']);

  const name = safeString(req.body.name, 80);
  const email = safeString(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');

  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');

  const { data: existing } = await supabase.from('app_users').select('id').eq('email', email).maybeSingle();
  if (existing) throw new HttpError(409, 'Email is already registered.');

  const user = {
    id: `usr_${nanoid(14)}`,
    name,
    email,
    role: 'user',
    password_hash: await bcrypt.hash(password, 10)
  };

  const { data, error } = await supabase.from('app_users').insert(user).select('*').single();
  if (error) throw new HttpError(500, error.message);

  await insertAudit(data.id, 'auth.registered', { email });

  res.status(201).json({
    status: 'success',
    token: signToken(data),
    user: publicUser(data)
  });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  requireFields(req.body, ['email', 'password']);

  const email = safeString(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');

  const { data: user, error } = await supabase.from('app_users').select('*').eq('email', email).maybeSingle();
  if (error) throw new HttpError(500, error.message);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  await insertAudit(user.id, 'auth.login', { email });

  res.json({
    status: 'success',
    token: signToken(user),
    user: publicUser(user)
  });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ status: 'success', user: req.user });
}));
