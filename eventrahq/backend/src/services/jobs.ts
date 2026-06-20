import { GoogleGenAI } from '@google/genai';
import { aiBriefSchema, type AiBrief } from '@eventrahq/contracts';
import { Resend } from 'resend';
import { env, requireConfiguration } from '../config/env.js';
import { getAdminClient } from '../lib/database.js';
import { logger } from '../lib/logger.js';

type JobType = 'ai_event_brief' | 'send_email';
interface ClaimedJob { id: string; type: JobType; payload: Record<string, unknown>; attempts: number; }

export async function enqueueJob(type: JobType, payload: Record<string, unknown>, createdBy: string | null, dedupeKey?: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin.from('jobs').insert({
    type, payload, created_by: createdBy, dedupe_key: dedupeKey ?? null
  }).select('id').single();
  if (error) {
    if (error.code === '23505' && dedupeKey) {
      const existing = await admin.from('jobs').select('id').eq('dedupe_key', dedupeKey).single();
      if (!existing.error && existing.data) return existing.data.id as string;
    }
    throw new Error(error.message);
  }
  return data.id as string;
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

async function sendEmail(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  requireConfiguration('Resend', [env.resendApiKey]);
  const resend = new Resend(env.resendApiKey);
  const actionUrl = String(payload.actionUrl ?? env.appUrl);
  const heading = String(payload.heading ?? 'EventraHQ update');
  const body = String(payload.body ?? '');
  const html = `<main style=font-family:Arial;background:#070911;color:#f8fafc;padding:40px><h1>${heading}</h1><p>${body}</p><a href=${actionUrl}>Open EventraHQ</a></main>`;
  const result = await resend.emails.send({
    from: env.emailFrom, to: [String(payload.to)], subject: String(payload.subject), html
  });
  if (result.error) throw new Error(result.error.message);
  return { emailId: result.data?.id ?? null };
}

async function processJob(job: ClaimedJob): Promise<Record<string, unknown>> {
  if (job.type === 'send_email') return sendEmail(job.payload);
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
