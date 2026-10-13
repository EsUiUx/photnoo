import { randomUUID } from 'node:crypto';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { PrintsModule } from './prints/prints.module';
import { ProfileModule } from './profile/profile.module';
import { StoreModule } from './store/store.module';
import { BillingModule } from './billing/billing.module';
import { CsrfMiddleware } from './auth/csrf.middleware';
import { FlagsModule } from './flags/flags.module';
import { MaintenanceMiddleware } from './flags/maintenance.middleware';
import { ConfigModule } from './config/config.module';
import { GalleriesModule } from './galleries/galleries.module';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { SharingModule } from './sharing/sharing.module';
import { MediaModule } from './media/media.module';
import { StorageModule } from './storage/storage.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ServerlessModule } from './serverless/serverless.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // Never log credentials, tokens or cookies (PRD section 10).
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
        level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
      },
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    MailModule,
    StorageModule,
    JobsModule,
    AuthModule,
    GalleriesModule,
    SharingModule,
    BillingModule,
    FlagsModule,
    AdminModule,
    MediaModule,
    LifecycleModule,
    NotificationsModule,
    ClientsModule,
    ProfileModule,
    StoreModule,
    PrintsModule,
    PortfolioModule,
    AnalyticsModule,
    ServerlessModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MaintenanceMiddleware, CsrfMiddleware).forRoutes('*');
  }
}
