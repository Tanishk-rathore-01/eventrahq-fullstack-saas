import { createOrganizationSchema, inviteMemberSchema } from '@eventrahq/contracts';
import { Router } from 'express';
import { env } from '../config/env.js';
import { getAdminClient } from '../lib/database.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { randomToken, sha256, slugify } from '../lib/security.js';
import { requireAuth, requireMembership } from '../middleware/auth.js';
import { enqueueJob } from '../services/jobs.js';

export const organizationsRouter = Router();
organizationsRouter.use(requireAuth);

organizationsRouter.get('/', (request, response) => {
  response.json({ organizations: request.auth!.memberships });
});

organizationsRouter.post('/', asyncHandler(async (request, response) => {
  const input = createOrganizationSchema.parse(request.body);
  const result = await request.auth!.supabase.rpc('create_organization', {
    p_name: input.name, p_slug: slugify(input.name), p_description: input.description
  });
  if (result.error) throw new AppError(400, 'organization_create_failed', result.error.message);
  response.status(201).json({ organization: result.data });
}));

organizationsRouter.get('/:organizationId/members', asyncHandler(async (request, response) => {
  const organizationId = String(request.params.organizationId);
  requireMembership(request, organizationId, ['owner', 'manager', 'checkin_staff']);
  const result = await getAdminClient().from('organization_memberships')
    .select('user_id,role,created_at,profiles(name,email,avatar_url)').eq('organization_id', organizationId);
  if (result.error) throw new AppError(500, 'members_unavailable', result.error.message);
  response.json({ members: result.data });
}));

organizationsRouter.post('/:organizationId/invitations', asyncHandler(async (request, response) => {
  const organizationId = String(request.params.organizationId);
  requireMembership(request, organizationId, ['owner', 'manager']);
  const input = inviteMemberSchema.parse(request.body);
  const token = randomToken();
  const admin = getAdminClient();
  const result = await admin.from('organization_invitations').insert({
    organization_id: organizationId, email: input.email.toLowerCase(), role: input.role,
    token_hash: sha256(token), invited_by: request.auth!.user.id
  }).select('id').single();
  if (result.error) throw new AppError(400, 'invitation_failed', result.error.message);
  await enqueueJob('send_email', {
    to: input.email, subject: 'You are invited to EventraHQ', heading: 'Join an EventraHQ workspace',
    body: 'An organizer invited you to collaborate on event operations.',
    actionUrl: `${env.appUrl}/invitations/${token}`
  }, request.auth!.user.id, `invite:${result.data.id}`);
  response.status(201).json({ invitationId: result.data.id });
}));

organizationsRouter.post('/invitations/:token/accept', asyncHandler(async (request, response) => {
  const admin = getAdminClient();
  const invitation = await admin.from('organization_invitations').select('*')
    .eq('token_hash', sha256(String(request.params.token))).is('accepted_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (invitation.error || !invitation.data) throw new AppError(404, 'invitation_invalid', 'Invitation is invalid or expired.');
  if (invitation.data.email !== request.auth!.profile.email.toLowerCase()) {
    throw new AppError(403, 'invitation_email_mismatch', 'Sign in with the email address that received this invitation.');
  }
  const accepted = await admin.rpc('accept_organization_invitation', {
    p_invitation_id: invitation.data.id, p_user_id: request.auth!.user.id
  });
  if (accepted.error) throw new AppError(400, 'invitation_accept_failed', accepted.error.message);
  response.json({ organizationId: invitation.data.organization_id });
}));
