import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const asyncHandler = <T extends Request>(
  handler: (request: T, response: Response, next: NextFunction) => Promise<unknown>
) => (request: T, response: Response, next: NextFunction): void => {
  void handler(request, response, next).catch(next);
};

export function notFound(request: Request, response: Response): void {
  response.status(404).json({
    status: 'error', code: 'route_not_found', message: `Route not found: ${request.method} ${request.originalUrl}`,
    requestId: response.locals.requestId as string | undefined
  });
}

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  const requestId = response.locals.requestId as string | undefined;
  if (error instanceof ZodError) {
    response.status(400).json({ status: 'error', code: 'validation_error', message: 'Request validation failed.', details: error.flatten(), requestId });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ status: 'error', code: error.code, message: error.message, details: error.details, requestId });
    return;
  }
  request.log?.error({ err: error, requestId }, 'Unhandled request error');
  response.status(500).json({
    status: 'error', code: 'internal_error', message: 'Internal server error.', requestId,
    ...(!isProduction && error instanceof Error ? { details: error.message } : {})
  });
}
