import { isProduction } from '../config/env.js';

export function notFound(req, res, next) {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

export function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: statusCode === 500 ? 'Internal server error' : error.message,
    details: error.details || null,
    stack: isProduction ? undefined : error.stack
  });
}
