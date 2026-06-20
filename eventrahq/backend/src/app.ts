import { randomUUID } from 'node:crypto';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isProduction, isSupabaseConfigured } from './config/env.js';
import { AppError, asyncHandler, errorHandler, notFound } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { adminRouter } from './routes/admin.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { meRouter } from './routes/me.routes.js';
import { operationsRouter } from './routes/operations.routes.js';
import { organizationsRouter } from './routes/organizations.routes.js';
import { paymentsRouter, razorpayWebhook } from './routes/payments.routes.js';
import { ticketsRouter } from './routes/tickets.routes.js';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((request, response, next) => {
    const requestId = String(request.headers['x-request-id'] ?? randomUUID());
    response.locals.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.use(pinoHttp({ logger, genReqId: (request) => String(request.headers['x-request-id'] ?? randomUUID()) }));
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: { defaultSrc: ['self'], frameSrc: ['self', 'https://api.razorpay.com', 'https://checkout.razorpay.com'] }
    } : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin)) callback(null, true);
      else callback(new AppError(403, 'origin_denied', 'Origin is not allowed.'));
    },
    credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
  }));
  app.use(compression());
  app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json', limit: '256kb' }),
    asyncHandler(async (request, response) => razorpayWebhook(request, response)));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000, limit: env.rateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ status: 'error', code: 'rate_limited', message: 'Too many requests.' })
  }));
  app.get('/api/health/live', (_request, response) => response.json({ status: 'ok', service: 'eventrahq-api' }));
  app.get('/api/health/ready', (_request, response) => {
    response.status(isSupabaseConfigured ? 200 : 503).json({ status: isSupabaseConfigured ? 'ready' : 'not_ready', supabase: isSupabaseConfigured });
  });
  app.use('/api/me', meRouter);
  app.use('/api/organizations', organizationsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api', operationsRouter);
  app.use('/api', paymentsRouter);
  app.use('/api/tickets', ticketsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/admin', adminRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
