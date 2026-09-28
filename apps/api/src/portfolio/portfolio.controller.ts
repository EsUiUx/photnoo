import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type PortfolioSettingsInput,
  portfolioSettingsSchema,
  type PortfolioUploadInput,
  portfolioUploadSchema,
  type ReorderPortfolioInput,
  reorderPortfolioSchema,
  type UpdatePortfolioItemInput,
  updatePortfolioItemSchema,
} from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IMAGE_MAX_BYTES, type UploadedImage } from '../media/image-upload.service';
import { PortfolioService } from './portfolio.service';
import { PublicProfileService } from './public-profile.service';

/** The photographer's portfolio manager. */
@Controller('portfolio')
@UseGuards(AuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  list(@CurrentAuth() auth: AccessClaims) {
    return this.portfolio.list(auth.photographerId);
  }

  /** Multipart: one `image` (JPEG or PNG, up to 15 MB) plus optional `caption` and `category`. */
  @Post('items')
  @UseInterceptors(
    // Memory storage; one byte over the limit lets the service answer with a clear message.
    FileInterceptor('image', { limits: { fileSize: IMAGE_MAX_BYTES + 1, files: 1, fields: 4 } }),
  )
  add(
    @CurrentAuth() auth: AccessClaims,
    @UploadedFile() file: UploadedImage | undefined,
    @Body(new ZodValidationPipe(portfolioUploadSchema)) body: PortfolioUploadInput,
  ) {
    return this.portfolio.add(auth.photographerId, file, body);
  }

  @Patch('items/:id')
  update(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePortfolioItemSchema)) body: UpdatePortfolioItemInput,
  ) {
    return this.portfolio.update(auth.photographerId, id, body);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    await this.portfolio.remove(auth.photographerId, id);
  }

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  reorder(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(reorderPortfolioSchema)) body: ReorderPortfolioInput) {
    return this.portfolio.reorder(auth.photographerId, body.ids);
  }

  @Patch('settings')
  settings(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(portfolioSettingsSchema)) body: PortfolioSettingsInput) {
    return this.portfolio.settings(auth.photographerId, body.published);
  }
}

/** Public profile page data. The shop under /public/p/:slug/shop belongs to the store module. */
@Controller('public/p')
export class PublicProfileController {
  constructor(private readonly profile: PublicProfileService) {}

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.profile.get(slug);
  }
}
