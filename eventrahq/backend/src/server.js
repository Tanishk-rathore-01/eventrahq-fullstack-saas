import compression from 'compression';
import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { adminRouter } from './routes/admin.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { apiLimiter, corsMiddleware, helmetMiddleware } from './middleware/security.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

app.disable('x-powered-by');
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    service: 'EventraHQ API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

app.use(notFound);
app.use(errorHandler);


app.listen(env.port, () => {
  console.log(`EventraHQ API running on http://localhost:${env.port}`);
});

export default app;
