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
  type CommerceSettingsInput,
  commerceSettingsSchema,
  type CreateProductInput,
  createProductSchema,
  type UpdateProductInput,
  updateProductSchema,
} from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IMAGE_MAX_BYTES, type UploadedImage } from '../media/image-upload.service';
import { StoreService } from './store.service';

// One byte over the limit lets the service answer with a clear message instead of multer's.
export const imageInterceptor = () => FileInterceptor('image', { limits: { fileSize: IMAGE_MAX_BYTES + 1, files: 1, fields: 2 } });

@Controller('store')
@UseGuards(AuthGuard)
export class StoreController {
  constructor(private readonly store: StoreService) {}

  /** Store and prints switches plus the photographer's public handle. */
  @Get('settings')
  settings(@CurrentAuth() auth: AccessClaims) {
    return this.store.settings(auth.photographerId);
  }

  @Patch('settings')
  updateSettings(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(commerceSettingsSchema)) body: CommerceSettingsInput) {
    return this.store.updateSettings(auth.photographerId, body);
  }

  @Get('stats')
  stats(@CurrentAuth() auth: AccessClaims) {
    return this.store.stats(auth.photographerId);
  }

  @Get('products')
  products(@CurrentAuth() auth: AccessClaims) {
    return this.store.products(auth.photographerId);
  }

  @Post('products')
  create(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput) {
    return this.store.create(auth.photographerId, body);
  }

  @Patch('products/:id')
  update(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
  ) {
    return this.store.update(auth.photographerId, id, body);
  }

  /** Deletes, or archives when the product has orders. */
  @Delete('products/:id')
  remove(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.store.remove(auth.photographerId, id);
  }

  /** Multipart `image` (JPEG or PNG, up to 15 MB); replaces the current picture. */
  @Post('products/:id/image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(imageInterceptor())
  setImage(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: UploadedImage | undefined) {
    return this.store.setImage(auth.photographerId, id, file);
  }

  @Delete('products/:id/image')
  removeImage(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.store.removeImage(auth.photographerId, id);
  }
}
