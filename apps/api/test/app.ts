import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
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

export async function createTestApp() {
  const mail = new FakeMail();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, mail, prisma: app.get(PrismaService).client };
}
