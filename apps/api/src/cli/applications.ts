import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ApplicationsService } from '../applications/applications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Operations CLI until the admin app exists (PRD A-01).
 *   node dist/cli/applications.js list
 *   node dist/cli/applications.js approve <id> [--trial]
 *   node dist/cli/applications.js reject <id> "<reason>"
 */
async function main(): Promise<void> {
  const [command, id, ...rest] = process.argv.slice(2);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const applications = app.get(ApplicationsService);
    const prisma = app.get(PrismaService);

    if (command === 'list') {
      const pending = await prisma.client.application.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
      });
      console.table(
        pending.map((a) => ({ id: a.id, name: a.name, email: a.email, city: a.city, portfolio: a.portfolioUrl })),
      );
    } else if (command === 'approve' && id) {
      const url = await applications.approve(id, { grantTrial: rest.includes('--trial') });
      console.log(`Approved. Invite link (also emailed): ${url}`);
    } else if (command === 'reject' && id && rest[0]) {
      await applications.reject(id, rest[0]);
      console.log('Rejected.');
    } else {
      console.log('Usage: applications list | approve <id> [--trial] | reject <id> "<reason>"');
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main();
