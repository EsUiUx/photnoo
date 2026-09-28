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
import {
  type CreatePrintItemInput,
  createPrintItemSchema,
  type GalleryPrintsInput,
  galleryPrintsSchema,
  type UpdatePrintItemInput,
  updatePrintItemSchema,
} from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { UploadedImage } from '../media/image-upload.service';
import { imageInterceptor } from '../store/store.controller';
import { PrintsService } from './prints.service';

@Controller('prints')
@UseGuards(AuthGuard)
export class PrintsController {
  constructor(private readonly prints: PrintsService) {}

  /** Whether prints are offered in client galleries, plus how many galleries opted out. */
  @Get('settings')
  settings(@CurrentAuth() auth: AccessClaims) {
    return this.prints.settings(auth.photographerId);
  }

  @Patch('settings')
  setEnabled(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(galleryPrintsSchema)) body: GalleryPrintsInput) {
    return this.prints.setEnabled(auth.photographerId, body.printsEnabled);
  }

  @Get('stats')
  stats(@CurrentAuth() auth: AccessClaims) {
    return this.prints.stats(auth.photographerId);
  }

  /** Per-gallery override: `{ printsEnabled }` for one gallery. */
  @Get('galleries/:id')
  galleryPrints(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.prints.galleryPrints(auth.photographerId, id);
  }

  @Patch('galleries/:id')
  setGalleryPrints(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(galleryPrintsSchema)) body: GalleryPrintsInput,
  ) {
    return this.prints.setGalleryPrints(auth.photographerId, id, body.printsEnabled);
  }

  @Get('items')
  items(@CurrentAuth() auth: AccessClaims) {
    return this.prints.items(auth.photographerId);
  }

  @Post('items')
  create(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(createPrintItemSchema)) body: CreatePrintItemInput) {
    return this.prints.create(auth.photographerId, body);
  }

  @Patch('items/:id')
  update(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePrintItemSchema)) body: UpdatePrintItemInput,
  ) {
    return this.prints.update(auth.photographerId, id, body);
  }

  @Delete('items/:id')
  remove(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.prints.remove(auth.photographerId, id);
  }

  @Post('items/:id/image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(imageInterceptor())
  setImage(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: UploadedImage | undefined) {
    return this.prints.setImage(auth.photographerId, id, file);
  }

  @Delete('items/:id/image')
  removeImage(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.prints.removeImage(auth.photographerId, id);
  }
}
