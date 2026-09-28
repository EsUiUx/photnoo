import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { FlagsService } from './flags.service';

/** PRD A-05 maintenance mode: 503 for everyone except the admin API and health checks. */
@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly flags: FlagsService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const path = req.originalUrl;
    if (path.startsWith('/v1/admin') || path.startsWith('/health')) return next();
    if (await this.flags.isOn('maintenance')) {
      return next(
        new HttpException(
          { code: 'maintenance', message: 'Photnoo is under maintenance. Please try again shortly.' },
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      );
    }
    next();
  }
}
