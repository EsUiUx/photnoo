import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
import { JobsService, type JobName, type JobPayloads } from '../src/jobs/jobs.service';
import type { Mail } from '../src/mail/mail.service';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

/** Captures outgoing email instead of sending it. */
export class FakeMail {
  readonly sent: Mail[] = [];
  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
  }
  last(to: string): Mail | undefined {
    return [...this.sent].reverse().find((m) => m.to === to);
  }
}

/** Records queued jobs; tests run the handlers themselves so they stay deterministic. */
export class FakeJobs {
  readonly sent: Array<{ name: JobName; data: JobPayloads[JobName] }> = [];
  async send<N extends JobName>(name: N, data: JobPayloads[N]): Promise<void> {
    this.sent.push({ name, data });
  }
  async work(): Promise<void> {}
}

export async function createTestApp() {
  const mail = new FakeMail();
  const jobs = new FakeJobs();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideProvider(JobsService)
    .useValue(jobs)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, mail, jobs, prisma: app.get(PrismaService).client };
}
