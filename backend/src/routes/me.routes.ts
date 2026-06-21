import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const meRouter = Router();
meRouter.get('/', requireAuth, (request, response) => {
  response.json({ profile: request.auth!.profile, memberships: request.auth!.memberships });
});
