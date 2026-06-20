import type { Membership, Profile } from '@eventrahq/contracts';
import type { NextFunction, Request, Response } from 'express';
import { createUserClient } from '../lib/database.js';
import { AppError, asyncHandler } from '../lib/errors.js';

function bearerToken(request: Request): string {
  const header = request.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) throw new AppError(401, 'authentication_required', 'Authentication required.');
  return header.slice(7);
}

export const requireAuth = asyncHandler(async (request: Request, _response: Response, next: NextFunction) => {
  const accessToken = bearerToken(request);
  const supabase = createUserClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) throw new AppError(401, 'invalid_session', 'Session is invalid or expired.');
  const [profileResult, membershipsResult] = await Promise.all([
    supabase.from('profiles').select('id,name,email,platform_role,avatar_url,created_at').eq('id', authData.user.id).single(),
    supabase.from('organization_memberships').select('organization_id,role,organizations(name,slug)').eq('user_id', authData.user.id)
  ]);
  if (profileResult.error || !profileResult.data) throw new AppError(403, 'profile_missing', 'Your application profile is not available.');
  if (membershipsResult.error) throw new AppError(500, 'memberships_unavailable', membershipsResult.error.message);
  const row = profileResult.data as Record<string, unknown>;
  const profile: Profile = {
    id: String(row.id), name: String(row.name), email: String(row.email),
    platformRole: row.platform_role === 'admin' ? 'admin' : 'user',
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null, createdAt: String(row.created_at)
  };
  const memberships: Membership[] = (membershipsResult.data ?? []).map((membership) => {
    const organization = membership.organizations as unknown as { name: string; slug: string };
    return {
      organizationId: membership.organization_id as string,
      organizationName: organization.name, organizationSlug: organization.slug,
      role: membership.role as Membership['role']
    };
  });
  request.auth = { user: authData.user, profile, memberships, supabase, accessToken };
  next();
});

export function requirePlatformAdmin(request: Request, _response: Response, next: NextFunction): void {
  if (request.auth?.profile.platformRole !== 'admin') {
    next(new AppError(403, 'permission_denied', 'Platform administrator access is required.'));
    return;
  }
  next();
}

export function requireMembership(request: Request, organizationId: string, roles: Membership['role'][]): Membership {
  const membership = request.auth?.memberships.find((item) => item.organizationId === organizationId);
  if (!membership || !roles.includes(membership.role)) {
    throw new AppError(403, 'permission_denied', 'You do not have permission for this workspace.');
  }
  return membership;
}
