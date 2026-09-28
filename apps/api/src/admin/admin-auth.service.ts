import { ForbiddenException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { AdminRole, AdminUser } from '@photnoo/db';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuditService } from '../audit/audit.service';
import { verifyPassword } from '../auth/passwords';
import { decrypt, randomToken, sha256 } from '../common/crypto';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { verifyTotp } from './totp';

const HOUR = 60 * 60 * 1000;
export const ADMIN_SESSION_MS = 12 * HOUR;
const IDLE_MS = HOUR;
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;

export type AdminMeta = { ip: string | null; userAgent: string | null; accessJwt?: string | null };
export type AdminPrincipal = { id: string; name: string; email: string; role: AdminRole; sessionId: string };

export const ROLE_LEVEL: Record<AdminRole, number> = { support: 1, operations: 2, super_admin: 3 };

const invalid = () => new UnauthorizedException({ code: 'invalid_credentials', message: 'Email, password or code is not right.' });

/**
 * Admin sign-in (PRD section 8): password plus a mandatory TOTP code, five failures lock the
 * account for 15 minutes, and every attempt is audited. Sessions are opaque tokens stored
 * hashed, capped at 12 hours and ended after an hour idle.
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {
    if (env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD) {
      this.jwks = createRemoteJWKSet(new URL(`https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`));
    }
  }

  async login(email: string, password: string, code: string, meta: AdminMeta) {
    const now = new Date();
    const admin = await this.prisma.client.adminUser.findUnique({ where: { email } });
    const fail = async (why: string, target?: AdminUser) => {
      await this.audit.record({
        actorType: 'admin',
        actorId: target?.id ?? null,
        action: 'admin.login_failed',
        targetType: 'admin',
        targetId: target?.id,
        ip: meta.ip,
        data: { email, why },
      });
      if (target) {
        const failures = target.failedLogins + 1;
        await this.prisma.client.adminUser.update({
          where: { id: target.id },
          data: { failedLogins: failures, lockedUntil: failures >= LOCK_AFTER ? new Date(now.getTime() + LOCK_MS) : target.lockedUntil },
        });
      }
      return invalid();
    };

    if (!admin || admin.disabledAt) {
      // Same work and answer as a wrong password, so accounts cannot be probed.
      await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFy', password).catch(() => false);
      throw await fail('unknown_or_disabled');
    }
    if (admin.lockedUntil && admin.lockedUntil > now) {
      await fail('locked', admin);
      throw new ForbiddenException({ code: 'account_locked', message: 'Too many attempts. Try again in 15 minutes.' });
    }
    await this.checkAccess(admin.email, meta);
    if (!(await verifyPassword(admin.passwordHash, password))) throw await fail('password', admin);
    if (!admin.totpSecret) throw await fail('totp_not_set', admin);
    const step = verifyTotp(decrypt(this.env.JWT_ACCESS_SECRET, admin.totpSecret), code, now.getTime());
    if (step === null || (admin.totpLastStep !== null && step <= admin.totpLastStep)) throw await fail('totp', admin);

    const token = randomToken();
    const expiresAt = new Date(now.getTime() + ADMIN_SESSION_MS);
    await this.prisma.client.$transaction([
      this.prisma.client.adminUser.update({
        where: { id: admin.id },
        data: { failedLogins: 0, lockedUntil: null, totpLastStep: step, lastLoginAt: now },
      }),
      this.prisma.client.adminSession.create({
        data: { adminId: admin.id, tokenHash: sha256(token), ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300), expiresAt },
      }),
    ]);
    await this.audit.record({ actorType: 'admin', actorId: admin.id, action: 'admin.login', targetType: 'admin', targetId: admin.id, ip: meta.ip });
    return { token, expiresAt, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } };
  }

  /** Resolves a session cookie to an admin, sliding the idle timeout. */
  async authenticate(token: string | undefined, meta: AdminMeta): Promise<AdminPrincipal> {
    if (!token) throw new UnauthorizedException({ code: 'unauthenticated', message: 'Please sign in.' });
    const now = new Date();
    const session = await this.prisma.client.adminSession.findUnique({ where: { tokenHash: sha256(token) }, include: { admin: true } });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.lastUsedAt.getTime() + IDLE_MS <= now.getTime() ||
      session.admin.disabledAt
    ) {
      throw new UnauthorizedException({ code: 'unauthenticated', message: 'Please sign in.' });
    }
    await this.checkAccess(session.admin.email, meta);
    if (now.getTime() - session.lastUsedAt.getTime() > 60_000) {
      await this.prisma.client.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    }
    const { admin } = session;
    return { id: admin.id, name: admin.name, email: admin.email, role: admin.role, sessionId: session.id };
  }

  async logout(token: string | undefined, meta: AdminMeta): Promise<void> {
    if (!token) return;
    const session = await this.prisma.client.adminSession.findUnique({ where: { tokenHash: sha256(token) } });
    if (!session || session.revokedAt) return;
    await this.prisma.client.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await this.audit.record({ actorType: 'admin', actorId: session.adminId, action: 'admin.logout', targetType: 'admin', targetId: session.adminId, ip: meta.ip });
  }

  /**
   * Cloudflare Access in front of the admin app: when configured, the request must carry an
   * Access JWT for the same email. Skipped locally, where there is no Access.
   */
  private async checkAccess(email: string, meta: AdminMeta): Promise<void> {
    if (!this.jwks) return;
    try {
      if (!meta.accessJwt) throw new Error('missing');
      const { payload } = await jwtVerify(meta.accessJwt, this.jwks, {
        issuer: `https://${this.env.CF_ACCESS_TEAM_DOMAIN}`,
        audience: this.env.CF_ACCESS_AUD,
      });
      if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== email.toLowerCase()) throw new Error('email');
    } catch (err) {
      this.logger.warn({ reason: (err as Error).message }, 'Cloudflare Access check failed');
      throw new ForbiddenException({ code: 'access_denied', message: 'Open the admin app through Cloudflare Access.' });
    }
  }
}
