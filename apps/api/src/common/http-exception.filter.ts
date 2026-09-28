import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const DEFAULT_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  429: 'rate_limited',
};

/**
 * Every error leaves the API as { error: { code, message, requestId, fields? } }.
 * Unknown errors are logged in full and returned as a generic 500 - internals never leak.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = String(req.id ?? '');

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload: Record<string, unknown> =
        typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : { message: body };
      res.status(status).json({
        error: {
          code: typeof payload.code === 'string' ? payload.code : defaultCode(status),
          message: typeof payload.message === 'string' ? payload.message : exception.message,
          ...(payload.fields ? { fields: payload.fields } : {}),
          ...(payload.details ? { details: payload.details } : {}),
          requestId,
        },
      });
      return;
    }

    this.logger.error({ err: exception, requestId }, 'Unhandled error');
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'internal_error', message: 'Something went wrong. Please try again.', requestId },
    });
  }
}

function defaultCode(status: number): string {
  return DEFAULT_CODES[status] ?? (status >= 500 ? 'internal_error' : 'error');
}
