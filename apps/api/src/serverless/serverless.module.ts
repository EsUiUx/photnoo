import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { BillingLifecycleModule } from '../billing/billing-lifecycle.module';
import { ENV, type Env } from '../config/env';
import { JobsService } from '../jobs/jobs.service';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { FileProcessorService } from '../media/file-processor.service';
import { MediaModule } from '../media/media.module';
import { CronController } from './cron.controller';

/** What the worker process does, for hosting without one (JOBS_INLINE, see env.ts). */
@Module({
  imports: [MediaModule, LifecycleModule, BillingLifecycleModule],
  controllers: [CronController],
})
export class ServerlessModule implements OnModuleInit {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly jobs: JobsService,
    private readonly files: FileProcessorService,
  ) {}

  onModuleInit(): void {
    if (this.env.JOBS_INLINE) this.jobs.registerInline('file.process', ({ fileId }) => this.files.process(fileId));
  }
}
