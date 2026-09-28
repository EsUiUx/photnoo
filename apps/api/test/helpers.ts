import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@photnoo/db';
import request from 'supertest';
import { ApplicationsService } from '../src/applications/applications.service';

let counter = 0;
export const PASSWORD = 'Nile-sunset-2026!';

export function uniqueApplicant() {
  counter += 1;
  const n = `${Date.now()}${counter}${process.pid}`.slice(-9);
  return {
    name: `Photographer ${n}`,
    city: 'Cairo',
    phone: `+2011${n}`,
    email: `p${n}@example.com`,
    portfolioUrl: 'https://instagram.com/example',
  };
}

/** A photographer who applied, was approved and accepted the invite. Cookies persist on `agent`. */
export async function signUp(app: INestApplication, prisma: PrismaClient, options: { trial: boolean } = { trial: true }) {
  const applicant = uniqueApplicant();
  const server = app.getHttpServer();
  await request(server).post('/v1/applications').send(applicant).expect(202);
  const application = await prisma.application.findFirstOrThrow({ where: { email: applicant.email } });
  const url = await app.get(ApplicationsService).approve(application.id, { grantTrial: options.trial });
  const agent = request.agent(server);
  const res = await agent
    .post('/v1/auth/accept-invite')
    .send({ token: url.split('/invite/')[1], password: PASSWORD, acceptTerms: true, acceptContentDeclaration: true })
    .expect(201);
  const photographer = await prisma.photographer.findUniqueOrThrow({ where: { email: applicant.email } });
  return { agent, csrf: res.body.csrfToken as string, applicant, photographerId: photographer.id };
}

/** Turns a signed local-storage URL into the path supertest can call. */
export function localPath(signedUrl: string): string {
  const url = new URL(signedUrl);
  return `${url.pathname}${url.search}`;
}
