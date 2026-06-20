import 'dotenv/config';
import { z } from 'zod';

const blankToUndefined = (value: unknown) => value === '' ? undefined : value;
const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5050),
  APP_URL: z.url().default('http://localhost:5173'),
  CLIENT_ORIGINS: z.string().default('http://localhost:5173'),
  SUPABASE_URL: optionalUrl,
  SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default('EventraHQ <onboarding@resend.dev>'),
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  TICKET_SECRET: optionalString,
  JOB_POLL_INTERVAL_MS: z.coerce.number().int().min(500).max(60_000).default(2_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(180),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV, port: parsed.data.PORT, appUrl: parsed.data.APP_URL,
  clientOrigins: parsed.data.CLIENT_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  supabaseUrl: parsed.data.SUPABASE_URL, supabasePublishableKey: parsed.data.SUPABASE_PUBLISHABLE_KEY,
  supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY, geminiApiKey: parsed.data.GEMINI_API_KEY,
  geminiModel: parsed.data.GEMINI_MODEL, resendApiKey: parsed.data.RESEND_API_KEY,
  emailFrom: parsed.data.EMAIL_FROM, razorpayKeyId: parsed.data.RAZORPAY_KEY_ID,
  razorpayKeySecret: parsed.data.RAZORPAY_KEY_SECRET, razorpayWebhookSecret: parsed.data.RAZORPAY_WEBHOOK_SECRET,
  ticketSecret: parsed.data.TICKET_SECRET, jobPollIntervalMs: parsed.data.JOB_POLL_INTERVAL_MS,
  rateLimitMax: parsed.data.RATE_LIMIT_MAX, logLevel: parsed.data.LOG_LEVEL
} as const;

export const isProduction = env.nodeEnv === 'production';
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey && env.supabaseServiceRoleKey);

export function requireConfiguration(name: string, values: Array<string | undefined>): void {
  if (values.some((value) => !value)) throw new Error(`${name} is not configured. Check backend/.env.`);
}
