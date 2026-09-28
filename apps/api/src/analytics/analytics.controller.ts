import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { type AnalyticsQuery, analyticsQuerySchema } from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';

/** Photographer insights (Figma "Analytics"). `range` is 7d, 30d (default), 6m or 12m. */
@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentAuth() auth: AccessClaims, @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery) {
    return this.analytics.overview(auth.photographerId, query.range);
  }

  @Get('timeseries')
  timeseries(@CurrentAuth() auth: AccessClaims, @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery) {
    return this.analytics.timeseries(auth.photographerId, query.range);
  }

  @Get('top-clients')
  topClients(@CurrentAuth() auth: AccessClaims, @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery) {
    return this.analytics.topClients(auth.photographerId, query.range);
  }

  @Get('top-galleries')
  topGalleries(@CurrentAuth() auth: AccessClaims, @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery) {
    return this.analytics.topGalleries(auth.photographerId, query.range);
  }
}
