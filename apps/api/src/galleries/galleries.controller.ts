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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type CreateFolderInput,
  createFolderSchema,
  type CreateGalleryInput,
  createGallerySchema,
  type UpdateGalleryInput,
  updateGallerySchema,
} from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GalleriesService, type GalleryStats } from './galleries.service';
import { fileJson, folderJson, galleryJson } from './serializers';

type ListItem = { gallery: Parameters<typeof galleryJson>[0]; stats: GalleryStats; coverUrl: string | null };
const listItemJson = (item: ListItem) => ({ ...galleryJson(item.gallery), ...item.stats, coverUrl: item.coverUrl });

@Controller()
@UseGuards(AuthGuard)
export class GalleriesController {
  constructor(private readonly galleries: GalleriesService) {}

  @Get('dashboard')
  async dashboard(@CurrentAuth() auth: AccessClaims) {
    const data = await this.galleries.dashboard(auth.photographerId);
    return {
      clients: data.clients,
      activeGalleries: data.activeGalleries,
      downloads: data.downloads,
      storage: data.storage
        ? { usedBytes: data.storage.usedBytes.toString(), allowanceBytes: data.storage.allowanceBytes.toString(), state: data.storage.state }
        : null,
      recentGalleries: data.recentGalleries.map(listItemJson),
      activity: data.activity,
    };
  }

  /** PRD P-05: a new gallery starts as a Draft. */
  @Post('galleries')
  async create(
    @CurrentAuth() auth: AccessClaims,
    @Body(new ZodValidationPipe(createGallerySchema)) body: CreateGalleryInput,
  ) {
    return galleryJson(await this.galleries.create(auth.photographerId, body));
  }

  @Get('galleries')
  async list(@CurrentAuth() auth: AccessClaims, @Query('cursor') cursor?: string, @Query('q') q?: string) {
    const safeCursor = cursor && /^[0-9a-f-]{36}$/i.test(cursor) ? cursor : undefined;
    const search = q?.trim().slice(0, 80) || undefined;
    const page = await this.galleries.list(auth.photographerId, { cursor: safeCursor, q: search });
    return { items: page.items.map(listItemJson), nextCursor: page.nextCursor };
  }

  @Get('galleries/:id')
  async detail(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    const { gallery, folders, files, stats, coverUrl } = await this.galleries.detail(auth.photographerId, id);
    return {
      ...galleryJson(gallery),
      ...stats,
      coverUrl,
      folders: folders.map(folderJson),
      files: files.map(({ file, previewUrl }) => ({ ...fileJson(file), previewUrl })),
    };
  }

  @Patch('galleries/:id')
  async update(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateGallerySchema)) body: UpdateGalleryInput,
  ) {
    return galleryJson(await this.galleries.update(auth.photographerId, id, body));
  }

  @Delete('galleries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.galleries.remove(auth.photographerId, id);
  }

  @Post('galleries/:id/folders')
  async createFolder(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createFolderSchema)) body: CreateFolderInput,
  ) {
    return folderJson(await this.galleries.createFolder(auth.photographerId, id, body));
  }

  @Delete('folders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFolder(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.galleries.deleteFolder(auth.photographerId, id);
  }

  @Delete('files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFile(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.galleries.deleteFile(auth.photographerId, id);
  }
}
