import { GoogleGenAI } from '@google/genai';
import { aiBriefSchema, type AiBrief } from '@eventrahq/contracts';
import { Resend } from 'resend';
import { env, requireConfiguration } from '../config/env.js';
import { getAdminClient } from '../lib/database.js';
import { renderEmailHtml } from '../lib/email.js';
import { logger } from '../lib/logger.js';

type JobType = 'ai_event_brief' | 'send_email' | 'event_cancellation';
interface ClaimedJob {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  created_by: string | null;
}

async function ensureEmailDelivery(jobId: string, payload: Record<string, unknown>): Promise<void> {
  const result = await getAdminClient().from('email_deliveries').upsert({
    job_id: jobId,
    recipient: String(payload.to),
    template: String(payload.template ?? 'generic'),
    status: 'queued'
  }, { onConflict: 'job_id', ignoreDuplicates: true });
  if (result.error) throw new Error(result.error.message);
}

export async function enqueueJob(type: JobType, payload: Record<string, unknown>, createdBy: string | null, dedupeKey?: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin.from('jobs').insert({
    type, payload, created_by: createdBy, dedupe_key: dedupeKey ?? null
  }).select('id').single();
  if (error) {
    if (error.code === '23505' && dedupeKey) {
      const existing = await admin.from('jobs').select('id').eq('dedupe_key', dedupeKey).single();
      if (!existing.error && existing.data) {
        const existingId = existing.data.id as string;
        if (type === 'send_email') await ensureEmailDelivery(existingId, payload);
        return existingId;
      }
    }
    throw new Error(error.message);
  }
  const jobId = data.id as string;
  if (type === 'send_email') await ensureEmailDelivery(jobId, payload);
  return jobId;
}

async function generateEventBrief(payload: Record<string, unknown>): Promise<AiBrief> {
  requireConfiguration('Gemini', [env.geminiApiKey]);
  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey! });
  const prompt = [
    'You are a senior event operations strategist. Return valid JSON only.',
    'Required keys: summary, agenda, risks, marketingAngles, staffingPlan, promotionCopy.',
    'Agenda and staffing need 3-8 items. Risks and marketingAngles need 3-6 items.',
    `Event: ${String(payload.title)}`, `Audience: ${String(payload.audience)}`,
    `Goal: ${String(payload.goal)}`, `Context: ${String(payload.description)}`
  ].join('\n');
  const response = await ai.models.generateContent({
    model: env.geminiModel, contents: prompt,
    config: { responseMimeType: 'application/json', maxOutputTokens: 1800, temperature: 0.45 }
  });
  if (!response.text) throw new Error('Gemini returned an empty response.');
  return aiBriefSchema.parse(JSON.parse(response.text));
}

async function sendEmail(jobId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  requireConfiguration('Resend', [env.resendApiKey]);
  await ensureEmailDelivery(jobId, payload);
  const resend = new Resend(env.resendApiKey);
  const actionUrl = String(payload.actionUrl ?? env.appUrl);
  const heading = String(payload.heading ?? 'EventraHQ update');
  const body = String(payload.body ?? '');
  const html = renderEmailHtml({ heading, body, actionUrl, fallbackUrl: env.appUrl });
  try {
    const result = await resend.emails.send({
      from: env.emailFrom, to: [String(payload.to)], subject: String(payload.subject), html
    }, { idempotencyKey: jobId });
    if (result.error) throw new Error(result.error.message);
    const emailId = result.data?.id ?? null;
    const recorded = await getAdminClient().from('email_deliveries').update({
      status: 'sent', provider_message_id: emailId, error: null, sent_at: new Date().toISOString()
    }).eq('job_id', jobId);
    if (recorded.error) throw new Error(recorded.error.message);
    return { emailId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email delivery failed';
    await getAdminClient().from('email_deliveries').update({ status: 'failed', error: message }).eq('job_id', jobId);
    throw error;
  }
}

async function queueCancellationEmails(job: ClaimedJob): Promise<Record<string, unknown>> {
  const eventId = String(job.payload.eventId);
  const admin = getAdminClient();
  const event = await admin.from('events').select('title').eq('id', eventId).single();
  if (event.error || !event.data) throw new Error(event.error?.message ?? 'Cancelled event not found.');
  let offset = 0;
  let queued = 0;
  const pageSize = 200;
  while (true) {
    const registrations = await admin.from('registrations').select('id,user_id')
      .eq('event_id', eventId).eq('status', 'confirmed').range(offset, offset + pageSize - 1);
    if (registrations.error) throw new Error(registrations.error.message);
    const rows = registrations.data ?? [];
    if (!rows.length) break;
    const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
    const profiles = await admin.from('profiles').select('id,email').in('id', userIds);
    if (profiles.error) throw new Error(profiles.error.message);
    const emailByUser = new Map((profiles.data ?? []).map((profile) => [String(profile.id), String(profile.email)]));
    for (let index = 0; index < rows.length; index += 25) {
      await Promise.all(rows.slice(index, index + 25).map(async (registration) => {
        const email = emailByUser.get(String(registration.user_id));
        if (!email) return;
        await enqueueJob('send_email', {
          to: email,
          template: 'event_cancellation',
          subject: `${event.data.title} has been cancelled`,
          heading: 'Event cancellation',
          body: `The organizer cancelled ${event.data.title}. If you paid for this event, the organizer will contact you about the refund process.`,
          actionUrl: `${env.appUrl}/tickets`
        }, job.created_by, `event-cancel-email:${eventId}:${registration.id}`);
        queued += 1;
      }));
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return { queued };
}

async function processJob(job: ClaimedJob): Promise<Record<string, unknown>> {
  if (job.type === 'send_email') return sendEmail(job.id, job.payload);
  if (job.type === 'event_cancellation') return queueCancellationEmails(job);
  const started = Date.now();
  const brief = await generateEventBrief(job.payload);
  const { error } = await getAdminClient().from('ai_briefs').insert({
    event_id: job.payload.eventId, job_id: job.id, created_by: job.payload.userId,
    model: env.geminiModel, prompt_version: 'event-brief-v2',
    latency_ms: Date.now() - started, content: brief
  });
  if (error) throw new Error(error.message);
  return brief;
}

let timer: NodeJS.Timeout | undefined;
let processing = false;

async function tick(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const admin = getAdminClient();
    const claimed = await admin.rpc('claim_next_job');
    if (claimed.error) throw new Error(claimed.error.message);
    const job = Array.isArray(claimed.data) ? claimed.data[0] as ClaimedJob | undefined : claimed.data as ClaimedJob | null;
    if (!job) return;
    try {
      const result = await processJob(job);
      const completion = await admin.rpc('complete_job', { p_job_id: job.id, p_result: result });
      if (completion.error) throw new Error(completion.error.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown job failure';
      await admin.rpc('fail_job', { p_job_id: job.id, p_error: message });
      logger.warn({ jobId: job.id, err: message }, 'Background job failed');
    }
  } catch (error) {
    logger.error({ err: error }, 'Job worker tick failed');
  } finally {
    processing = false;
  }
}

export function startJobWorker(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), env.jobPollIntervalMs);
  timer.unref();
  void tick();
}

export function stopJobWorker(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
