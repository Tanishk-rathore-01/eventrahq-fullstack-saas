import { Router } from 'express';
import { getAdminClient } from '../lib/database.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requirePlatformAdmin);

adminRouter.get('/stats', asyncHandler(async (_request, response) => {
  const admin = getAdminClient();
  const [profiles, organizations, events, registrations, jobs, logs] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('organizations').select('id', { count: 'exact', head: true }),
    admin.from('events').select('id', { count: 'exact', head: true }),
    admin.from('registrations').select('id', { count: 'exact', head: true }),
    admin.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    admin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(12)
  ]);
  const failed = [profiles, organizations, events, registrations, jobs, logs].find((result) => result.error);
  if (failed?.error) throw new AppError(500, 'admin_stats_unavailable', failed.error.message);
  response.json({
    stats: {
      users: profiles.count ?? 0, organizations: organizations.count ?? 0, events: events.count ?? 0,
      registrations: registrations.count ?? 0, failedJobs: jobs.count ?? 0
    },
    recentAuditLogs: logs.data ?? []
  });
}));
