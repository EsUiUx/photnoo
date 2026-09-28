import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type NotificationPreferencesInput,
  notificationPreferencesSchema,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IMAGE_MAX_BYTES, type UploadedImage } from '../media/image-upload.service';
import { ProfileService } from './profile.service';

// One byte over the limit lets ImageUploadService answer with a clear message instead of multer's.
const imageUpload = FileInterceptor('image', { limits: { fileSize: IMAGE_MAX_BYTES + 1, files: 1, fields: 2 } });

/** Settings: the photographer's own profile, branding, handle, notifications and password. */
@Controller('me')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('profile')
  get(@CurrentAuth() auth: AccessClaims) {
    return this.profile.get(auth.photographerId);
  }

  @Patch('profile')
  update(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput) {
    return this.profile.update(auth.photographerId, body);
  }

  @Get('slug-available')
  slugAvailable(@CurrentAuth() auth: AccessClaims, @Query('slug') slug = '') {
    return this.profile.slugAvailable(auth.photographerId, String(slug).slice(0, 64));
  }

  /** Multipart with an `image` field (JPEG or PNG, up to 15 MB). */
  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(imageUpload)
  setAvatar(@CurrentAuth() auth: AccessClaims, @UploadedFile() file: UploadedImage | undefined) {
    return this.profile.setImage(auth.photographerId, 'avatar', file);
  }

  @Delete('avatar')
  removeAvatar(@CurrentAuth() auth: AccessClaims) {
    return this.profile.removeImage(auth.photographerId, 'avatar');
  }

  /** Studio logo for the client password screen and gallery header (PRD P-15). */
  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(imageUpload)
  setLogo(@CurrentAuth() auth: AccessClaims, @UploadedFile() file: UploadedImage | undefined) {
    return this.profile.setImage(auth.photographerId, 'logo', file);
  }

  @Delete('logo')
  removeLogo(@CurrentAuth() auth: AccessClaims) {
    return this.profile.removeImage(auth.photographerId, 'logo');
  }

  @Patch('notification-preferences')
  preferences(
    @CurrentAuth() auth: AccessClaims,
    @Body(new ZodValidationPipe(notificationPreferencesSchema)) body: NotificationPreferencesInput,
  ) {
    return this.profile.setNotificationPreferences(auth.photographerId, body);
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentAuth() auth: AccessClaims,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
  ) {
    return this.profile.changePassword(auth.photographerId, auth.sessionId, body, req.ip ?? null);
  }
}
