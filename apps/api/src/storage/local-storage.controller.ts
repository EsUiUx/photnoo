import { Controller, ForbiddenException, Get, Inject, NotFoundException, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { attachmentDisposition, STORAGE, type Storage } from './storage';
import { LocalStorage } from './local.storage';

/**
 * Serves the signed URLs of the local storage driver (development and tests only). With the
 * S3 driver these URLs point at R2 instead and this controller answers 404.
 */
@Controller('local-storage')
export class LocalStorageController {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  private local(query: Record<string, string | undefined>) {
    if (!(this.storage instanceof LocalStorage)) throw new NotFoundException();
    const request = this.storage.verify(query);
    if (!request) throw new ForbiddenException({ code: 'signature_invalid', message: 'This link has expired.' });
    return { storage: this.storage, request };
  }

  @Put()
  async putPart(@Query() query: Record<string, string>, @Req() req: Request, @Res() res: Response) {
    const { storage, request } = this.local(query);
    if (request.action !== 'part') throw new ForbiddenException();
    const etag = await storage.writePart(request.key, request.uploadId, request.partNumber, req);
    res.setHeader('ETag', etag);
    res.status(200).end();
  }

  @Get()
  async get(@Query() query: Record<string, string>, @Res() res: Response) {
    const { storage, request } = this.local(query);
    if (request.action !== 'get') throw new ForbiddenException();
    const size = await storage.headObject(request.key);
    if (size === null) throw new NotFoundException();
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Type', request.key.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
    if (request.fileName) res.setHeader('Content-Disposition', attachmentDisposition(request.fileName));
    (await storage.getObjectStream(request.key)).pipe(res);
  }
}
