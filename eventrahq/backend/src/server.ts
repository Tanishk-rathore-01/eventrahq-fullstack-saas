import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env, isSupabaseConfigured } from './config/env.js';
import { logger } from './lib/logger.js';
import { startJobWorker, stopJobWorker } from './services/jobs.js';

const server = createServer(createApp());
server.listen(env.port, () => {
  logger.info({ port: env.port, environment: env.nodeEnv }, 'EventraHQ API started');
  if (isSupabaseConfigured) startJobWorker();
  else logger.warn('Supabase is not configured; readiness and data routes are unavailable.');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Graceful shutdown started');
  stopJobWorker();
  server.close((error) => {
    if (error) { logger.error({ err: error }, 'Server close failed'); process.exitCode = 1; }
    process.exit();
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
