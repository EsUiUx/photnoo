import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
  type CompleteUploadInput,
  completeUploadSchema,
  type CreateUploadInput,
  createUploadSchema,
  type SignPartsInput,
  signPartsSchema,
} from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UploadsService } from './uploads.service';

/** Endpoints map one-to-one onto Uppy's AwsS3 multipart callbacks. */
@Controller()
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('galleries/:galleryId/uploads')
  create(
    @CurrentAuth() auth: AccessClaims,
    @Param('galleryId', ParseUUIDPipe) galleryId: string,
    @Body(new ZodValidationPipe(createUploadSchema)) body: CreateUploadInput,
  ) {
    return this.uploads.create(auth.photographerId, galleryId, body);
  }

  @Post('uploads/:fileId/parts')
  @HttpCode(HttpStatus.OK)
  signParts(
    @CurrentAuth() auth: AccessClaims,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body(new ZodValidationPipe(signPartsSchema)) body: SignPartsInput,
  ) {
    return this.uploads.signParts(auth.photographerId, fileId, body.partNumbers);
  }

  @Get('uploads/:fileId/parts')
  listParts(@CurrentAuth() auth: AccessClaims, @Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.uploads.listParts(auth.photographerId, fileId);
  }

  @Post('uploads/:fileId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentAuth() auth: AccessClaims,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body(new ZodValidationPipe(completeUploadSchema)) body: CompleteUploadInput,
  ) {
    return this.uploads.complete(auth.photographerId, fileId, body);
  }

  @Delete('uploads/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  abort(@CurrentAuth() auth: AccessClaims, @Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.uploads.abort(auth.photographerId, fileId);
  }
}
