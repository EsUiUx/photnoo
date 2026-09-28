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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type CreateFolderInput,
  createFolderSchema,
  type CreateGalleryInput,
  createGallerySchema,
  type GalleryListQuery,
  galleryListQuerySchema,
  type MoveFileInput,
  moveFileSchema,
  type MoveFilesInput,
  moveFilesSchema,
  type ReorderFoldersInput,
  reorderFoldersSchema,
  type SetCoverInput,
  setCoverSchema,
  type UpdateFolderInput,
  updateFolderSchema,
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
      cycleStart: data.cycleStart,
      trends: data.trends,
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
  async list(@CurrentAuth() auth: AccessClaims, @Query(new ZodValidationPipe(galleryListQuerySchema)) query: GalleryListQuery) {
    const page = await this.galleries.list(auth.photographerId, query);
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

  @Patch('folders/:id')
  async updateFolder(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateFolderSchema)) body: UpdateFolderInput,
  ) {
    return folderJson(await this.galleries.updateFolder(auth.photographerId, id, body));
  }

  @Post('galleries/:id/folders/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderFolders(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reorderFoldersSchema)) body: ReorderFoldersInput,
  ) {
    return { folders: (await this.galleries.reorderFolders(auth.photographerId, id, body.folderIds)).map(folderJson) };
  }

  @Post('galleries/:id/files/move')
  @HttpCode(HttpStatus.OK)
  moveFiles(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(moveFilesSchema)) body: MoveFilesInput,
  ) {
    return this.galleries.moveFiles(auth.photographerId, id, body);
  }

  @Put('galleries/:id/cover')
  async setCover(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setCoverSchema)) body: SetCoverInput,
  ) {
    return galleryJson(await this.galleries.setCover(auth.photographerId, id, body.fileId));
  }

  @Patch('files/:id')
  async moveFile(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(moveFileSchema)) body: MoveFileInput,
  ) {
    return fileJson(await this.galleries.moveFile(auth.photographerId, id, body.folderId));
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
