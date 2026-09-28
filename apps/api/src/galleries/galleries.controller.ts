import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  type CreateFolderInput,
  createFolderSchema,
  type CreateGalleryInput,
  createGallerySchema,
} from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GalleriesService } from './galleries.service';
import { fileJson, folderJson, galleryJson } from './serializers';

@Controller('galleries')
@UseGuards(AuthGuard)
export class GalleriesController {
  constructor(private readonly galleries: GalleriesService) {}

  /** PRD P-05: a new gallery starts as a Draft. */
  @Post()
  async create(
    @CurrentAuth() auth: AccessClaims,
    @Body(new ZodValidationPipe(createGallerySchema)) body: CreateGalleryInput,
  ) {
    return galleryJson(await this.galleries.create(auth.photographerId, body));
  }

  @Get()
  async list(@CurrentAuth() auth: AccessClaims, @Query('cursor') cursor?: string) {
    const safeCursor = cursor && /^[0-9a-f-]{36}$/i.test(cursor) ? cursor : undefined;
    const page = await this.galleries.list(auth.photographerId, safeCursor);
    return { items: page.items.map(galleryJson), nextCursor: page.nextCursor };
  }

  @Get(':id')
  async detail(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    const { gallery, folders, files } = await this.galleries.detail(auth.photographerId, id);
    return { ...galleryJson(gallery), folders: folders.map(folderJson), files: files.map(fileJson) };
  }

  @Post(':id/folders')
  async createFolder(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createFolderSchema)) body: CreateFolderInput,
  ) {
    return folderJson(await this.galleries.createFolder(auth.photographerId, id, body));
  }
}
