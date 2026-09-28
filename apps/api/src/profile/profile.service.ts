import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type ChangePasswordInput,
  type NotificationPreferencesInput,
  slugProblem,
  type UpdateProfileInput,
} from '@photnoo/shared';
import { type Photographer, Prisma } from '@photnoo/db';
import { AuditService } from '../audit/audit.service';
import { AccessCheckService } from '../auth/access-check.service';
import { hashPassword, passwordProblem, verifyPassword } from '../auth/passwords';
import { ImageUploadService, type UploadedImage } from '../media/image-upload.service';
import { PrismaService } from '../prisma/prisma.service';

const MINUTE = 60_000;
/** Wrong current passwords allowed per window before the form pauses (a stolen session is not a key). */
const PASSWORD_ATTEMPTS = 5;
const PASSWORD_WINDOW_MS = 15 * MINUTE;

export type SlugAvailability = { slug: string; available: boolean; reason?: 'length' | 'characters' | 'reserved' | 'taken' };

/**
 * The photographer's own account (Settings): profile, public handle, branding for the client
 * gallery (PRD P-15), notification preferences and password. Every query is scoped to the
 * logged-in photographer.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageUploadService,
    private readonly audit: AuditService,
    private readonly access: AccessCheckService,
  ) {}

  async get(photographerId: string) {
    return this.json(await this.load(photographerId));
  }

  async update(photographerId: string, input: UpdateProfileInput) {
    const current = await this.load(photographerId);
    if (input.slug && input.slug !== current.slug) {
      const availability = await this.slugAvailable(photographerId, input.slug);
      if (!availability.available) throw slugTaken();
    }
    if (input.phone && input.phone !== current.phone) {
      const other = await this.prisma.client.photographer.findUnique({ where: { phone: input.phone }, select: { id: true } });
      if (other) throw phoneTaken();
    }
    try {
      const updated = await this.prisma.client.photographer.update({ where: { id: photographerId }, data: input });
      return this.json(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Lost a race with another account between the check above and the write.
        throw input.phone && JSON.stringify(error.meta ?? {}).includes('phone') ? phoneTaken() : slugTaken();
      }
      throw error;
    }
  }

  async slugAvailable(photographerId: string, raw: string): Promise<SlugAvailability> {
    const slug = raw.trim().toLowerCase();
    const problem = slugProblem(slug);
    if (problem) return { slug, available: false, reason: problem };
    const owner = await this.prisma.client.photographer.findUnique({ where: { slug }, select: { id: true } });
    if (owner && owner.id !== photographerId) return { slug, available: false, reason: 'taken' };
    return { slug, available: true };
  }

  async setImage(photographerId: string, kind: 'avatar' | 'logo', file: UploadedImage | undefined) {
    const current = await this.load(photographerId);
    const stored = await this.images.store(photographerId, kind, file);
    const field = kind === 'avatar' ? 'avatarKey' : 'logoKey';
    const updated = await this.prisma.client.photographer.update({ where: { id: photographerId }, data: { [field]: stored.imageKey } });
    await this.images.remove(current[field]).catch(() => undefined);
    return this.json(updated);
  }

  async removeImage(photographerId: string, kind: 'avatar' | 'logo') {
    const current = await this.load(photographerId);
    const field = kind === 'avatar' ? 'avatarKey' : 'logoKey';
    if (!current[field]) return this.json(current);
    const updated = await this.prisma.client.photographer.update({ where: { id: photographerId }, data: { [field]: null } });
    await this.images.remove(current[field]).catch(() => undefined);
    return this.json(updated);
  }

  async setNotificationPreferences(photographerId: string, input: NotificationPreferencesInput) {
    await this.load(photographerId);
    const updated = await this.prisma.client.photographer.update({ where: { id: photographerId }, data: input });
    return preferences(updated);
  }

  /** Needs the current password. Optionally ends every other login, keeping this one. */
  async changePassword(photographerId: string, sessionId: string, input: ChangePasswordInput, ip: string | null) {
    const photographer = await this.load(photographerId);

    const recentFailures = await this.prisma.client.auditLog.count({
      where: {
        actorId: photographerId,
        action: 'auth.password_change_failed',
        createdAt: { gt: new Date(Date.now() - PASSWORD_WINDOW_MS) },
      },
    });
    if (recentFailures >= PASSWORD_ATTEMPTS) {
      throw new HttpException(
        { code: 'too_many_attempts', message: 'Too many attempts. Try again in 15 minutes.', details: { retryAfterSeconds: PASSWORD_WINDOW_MS / 1000 } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!(await verifyPassword(photographer.passwordHash, input.currentPassword))) {
      await this.audit.record({
        actorType: 'photographer',
        actorId: photographerId,
        action: 'auth.password_change_failed',
        targetType: 'photographer',
        targetId: photographerId,
        ip,
      });
      const message = 'Your current password is not right.';
      throw new BadRequestException({ code: 'wrong_password', message, fields: [{ path: 'currentPassword', message }] });
    }
    const problem = passwordProblem(input.newPassword, photographer.email);
    if (problem) throw new BadRequestException({ code: 'validation_failed', message: problem, fields: [{ path: 'newPassword', message: problem }] });
    if (input.currentPassword === input.newPassword) {
      const message = 'Choose a password different from the current one.';
      throw new BadRequestException({ code: 'validation_failed', message, fields: [{ path: 'newPassword', message }] });
    }

    const passwordHash = await hashPassword(input.newPassword);
    const loggedOut = await this.prisma.client.$transaction(async (tx) => {
      await tx.photographer.update({ where: { id: photographerId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } });
      const revoked = input.logoutOtherDevices
        ? await tx.session.updateMany({
            where: { photographerId, revokedAt: null, id: { not: sessionId } },
            data: { revokedAt: new Date() },
          })
        : { count: 0 };
      await this.audit.record(
        {
          actorType: 'photographer',
          actorId: photographerId,
          action: 'auth.password_changed',
          targetType: 'photographer',
          targetId: photographerId,
          ip,
          data: { otherSessionsEnded: revoked.count },
        },
        tx,
      );
      return revoked.count;
    });
    // Drop cached "session is live" answers so the other devices are refused at once here.
    if (loggedOut > 0) this.access.forgetPhotographer(photographerId);
    return { otherSessionsEnded: loggedOut };
  }

  // ---------- helpers ----------

  private async load(photographerId: string): Promise<Photographer> {
    const photographer = await this.prisma.client.photographer.findFirst({ where: { id: photographerId, deletedAt: null } });
    if (!photographer) throw new NotFoundException({ code: 'not_found', message: 'Account not found.' });
    return photographer;
  }

  private async json(p: Photographer) {
    const [avatarUrl, logoUrl] = await Promise.all([this.images.url(p.avatarKey), this.images.url(p.logoKey)]);
    return {
      id: p.id,
      name: p.name,
      studioName: p.studioName,
      email: p.email,
      phone: p.phone,
      city: p.city,
      bio: p.bio,
      slug: p.slug,
      locale: p.locale,
      galleryTheme: p.galleryTheme,
      avatarUrl,
      logoUrl,
      links: { instagramUrl: p.instagramUrl, behanceUrl: p.behanceUrl, websiteUrl: p.websiteUrl, otherUrl: p.otherUrl },
      notifications: preferences(p),
    };
  }
}

function preferences(p: Photographer) {
  return {
    notifyFirstOpen: p.notifyFirstOpen,
    notifyFullDownload: p.notifyFullDownload,
    notifyExpiring: p.notifyExpiring,
    notifyOrders: p.notifyOrders,
    notifyByEmail: p.notifyByEmail,
  };
}

function phoneTaken() {
  const message = 'Another account uses this phone number.';
  return new ConflictException({ code: 'phone_taken', message, fields: [{ path: 'phone', message }] });
}

function slugTaken() {
  const message = 'This handle is taken. Choose another.';
  return new ConflictException({ code: 'slug_taken', message, fields: [{ path: 'slug', message }] });
}
