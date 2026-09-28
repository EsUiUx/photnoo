import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger, LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module';
import { JobsModule } from './jobs/jobs.module';
import { AuditModule } from './audit/audit.module';
import { BillingLifecycleModule } from './billing/billing-lifecycle.module';
import { BillingLifecycleService } from './billing/billing-lifecycle.service';
import { FlagsModule } from './flags/flags.module';
import { MailModule } from './mail/mail.module';
import { JobsService } from './jobs/jobs.service';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { LifecycleService } from './lifecycle/lifecycle.service';
import { FileProcessorService } from './media/file-processor.service';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: { transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined },
    }),
    PrismaModule,
    StorageModule,
    AuditModule,
    JobsModule,
    MediaModule,
    LifecycleModule,
    MailModule,
    FlagsModule,
    BillingLifecycleModule,
    NotificationsModule,
  ],
})
class WorkerModule {}

/** Background worker process: same codebase as the API, no HTTP server. */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const jobs = app.get(JobsService);
  const files = app.get(FileProcessorService);
  const lifecycle = app.get(LifecycleService);
  const billing = app.get(BillingLifecycleService);
  await jobs.work('file.process', ({ fileId }) => files.process(fileId), { concurrency: 2 });
  await jobs.work(
    'lifecycle.tick',
    async () => {
      await lifecycle.tick();
      await billing.tick();
    },
    { concurrency: 1 },
  );
  await jobs.schedule('lifecycle.tick', '*/5 * * * *', {});
  app.get(Logger).log('Worker started');
}

void main();
