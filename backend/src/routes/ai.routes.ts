import { aiBriefRequestSchema } from '@eventrahq/contracts';
import { Router } from 'express';
import { getAdminClient } from '../lib/database.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { sha256 } from '../lib/security.js';
import { requireAuth, requireMembership } from '../middleware/auth.js';
import { enqueueJob } from '../services/jobs.js';

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.post('/event-brief', asyncHandler(async (request, response) => {
  const input = aiBriefRequestSchema.parse(request.body);
  const admin = getAdminClient();
  const event = await admin.from('events').select('id,title,description,organization_id').eq('id', input.eventId).maybeSingle();
  if (event.error || !event.data) throw new AppError(404, 'event_not_found', 'Event not found.');
  requireMembership(request, event.data.organization_id as string, ['owner', 'manager']);
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const usage = await admin.from('jobs').select('id', { count: 'exact', head: true })
    .eq('created_by', request.auth!.user.id).eq('type', 'ai_event_brief').gte('created_at', start.toISOString());
  if ((usage.count ?? 0) >= 5) throw new AppError(429, 'ai_quota_exceeded', 'Daily AI generation limit reached.');
  const payload = {
    eventId: input.eventId, userId: request.auth!.user.id, title: event.data.title,
    description: event.data.description, audience: input.audience, goal: input.goal
  };
  const jobId = await enqueueJob('ai_event_brief', payload, request.auth!.user.id, `ai:${sha256(JSON.stringify(payload))}`);
  response.status(202).json({ jobId, status: 'queued' });
}));

aiRouter.get('/jobs/:jobId', asyncHandler(async (request, response) => {
  const result = await getAdminClient().from('jobs')
    .select('id,status,result,error,attempts,created_at,completed_at,created_by').eq('id', request.params.jobId!).maybeSingle();
  if (result.error || !result.data || (result.data.created_by !== request.auth!.user.id && request.auth!.profile.platformRole !== 'admin')) {
    throw new AppError(404, 'job_not_found', 'AI job not found.');
  }
  response.json({
    id: result.data.id, status: result.data.status, result: result.data.result, error: result.data.error,
    attempts: result.data.attempts, createdAt: result.data.created_at, completedAt: result.data.completed_at
  });
}));

aiRouter.get('/events/:eventId/briefs', asyncHandler(async (request, response) => {
  const event = await getAdminClient().from('events').select('organization_id').eq('id', request.params.eventId!).maybeSingle();
  if (event.error || !event.data) throw new AppError(404, 'event_not_found', 'Event not found.');
  requireMembership(request, event.data.organization_id as string, ['owner', 'manager']);
  const result = await request.auth!.supabase.from('ai_briefs').select('*').eq('event_id', request.params.eventId!).order('created_at', { ascending: false });
  if (result.error) throw new AppError(500, 'briefs_unavailable', result.error.message);
  response.json({ briefs: result.data });
}));
