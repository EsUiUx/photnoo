import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { AdminRole } from '@photnoo/db';
import { AppModule } from '../app.module';
import { newTotpSecret, otpauthUri } from '../admin/totp';
import { AuditService } from '../audit/audit.service';
import { hashPassword } from '../auth/passwords';
import { encrypt } from '../common/crypto';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const ROLES: AdminRole[] = ['super_admin', 'operations', 'support'];

/**
 * Staff accounts (PRD section 8). Run on the server by someone with shell access; the output
 * (a one-time password and the authenticator setup key) is shown once and never stored plain.
 *   node dist/cli/admins.js create <email> "<name>" <super_admin|operations|support>
 *   node dist/cli/admins.js reset <email>        new password and authenticator key
 *   node dist/cli/admins.js disable <email>
 *   node dist/cli/admins.js list
 */
async function main(): Promise<void> {
  const [command, email, ...rest] = process.argv.slice(2);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const prisma = app.get(PrismaService).client;
    const audit = app.get(AuditService);
    const env = app.get<Env>(ENV);

    const credentials = async () => {
      const password = randomBytes(15).toString('base64url');
      const secret = newTotpSecret();
      return { password, secret, passwordHash: await hashPassword(password), totpSecret: encrypt(env.JWT_ACCESS_SECRET, secret) };
    };
    const show = (address: string, c: { password: string; secret: string }) => {
      console.log(`\nAdmin: ${address}`);
      console.log(`One-time password: ${c.password}`);
      console.log(`Authenticator key: ${c.secret}`);
      console.log(`Or scan this URI as a QR code: ${otpauthUri(c.secret, address)}\n`);
      console.log('Share these over a secure channel. They are not shown again.');
    };

    if (command === 'create' && email && rest[0] && ROLES.includes(rest[1] as AdminRole)) {
      const c = await credentials();
      const admin = await prisma.adminUser.create({
        data: { email: email.toLowerCase(), name: rest[0], role: rest[1] as AdminRole, passwordHash: c.passwordHash, totpSecret: c.totpSecret },
      });
      await audit.record({ actorType: 'system', action: 'admin.created', targetType: 'admin', targetId: admin.id, data: { role: admin.role } });
      show(admin.email, c);
    } else if (command === 'reset' && email) {
      const c = await credentials();
      const admin = await prisma.adminUser.update({
        where: { email: email.toLowerCase() },
        data: { passwordHash: c.passwordHash, totpSecret: c.totpSecret, totpLastStep: null, failedLogins: 0, lockedUntil: null },
      });
      await prisma.adminSession.updateMany({ where: { adminId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit.record({ actorType: 'system', action: 'admin.credentials_reset', targetType: 'admin', targetId: admin.id });
      show(admin.email, c);
    } else if (command === 'disable' && email) {
      const admin = await prisma.adminUser.update({ where: { email: email.toLowerCase() }, data: { disabledAt: new Date() } });
      await prisma.adminSession.updateMany({ where: { adminId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit.record({ actorType: 'system', action: 'admin.disabled', targetType: 'admin', targetId: admin.id });
      console.log('Disabled.');
    } else if (command === 'list') {
      const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
      console.table(admins.map((a) => ({ email: a.email, name: a.name, role: a.role, lastLogin: a.lastLoginAt, disabled: Boolean(a.disabledAt) })));
    } else {
      console.log('Usage: admins create <email> "<name>" <super_admin|operations|support> | reset <email> | disable <email> | list');
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main();
