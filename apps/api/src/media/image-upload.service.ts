import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import sharp from 'sharp';
import { STORAGE, type Storage } from '../storage/storage';
import { sniff } from './file-sniff';

/** A file multer kept in memory (no storage option on the interceptor). */
export type UploadedImage = { buffer: Buffer; originalname: string; size: number };

export type ImageKind = 'avatar' | 'logo' | 'product' | 'print' | 'portfolio';

export type StoredImage = {
  /** Web-sized JPEG kept as the "original" for catalog images (they are never print masters). */
  imageKey: string;
  /** Smaller JPEG for grids and cards. */
  previewKey: string;
  width: number;
  height: number;
  blurDataUrl: string;
};

/** Upload limit for catalog, profile and portfolio images. */
export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;

const SIZES: Record<ImageKind, { main: number; preview: number }> = {
  avatar: { main: 512, preview: 160 },
  logo: { main: 800, preview: 320 },
  product: { main: 1600, preview: 720 },
  print: { main: 1600, preview: 720 },
  portfolio: { main: 2400, preview: 1080 },
};

/**
 * Stores photographer-owned images (profile, logo, store and print catalog, portfolio).
 * Unlike gallery files these are re-encoded on the way in: EXIF and GPS are stripped, the
 * orientation is applied, and only JPEG or PNG input is accepted.
 */
@Injectable()
export class ImageUploadService {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  async store(photographerId: string, kind: ImageKind, file: UploadedImage | undefined): Promise<StoredImage> {
    if (!file) throw new BadRequestException({ code: 'image_required', message: 'Choose an image to upload.' });
    if (file.size > IMAGE_MAX_BYTES) {
      throw new PayloadTooLargeException({ code: 'image_too_large', message: 'Images can be up to 15 MB.' });
    }
    const type = sniff(file.buffer.subarray(0, 64));
    if (type !== 'jpeg' && type !== 'png') {
      throw new BadRequestException({ code: 'image_type', message: 'Upload a JPEG or PNG image.' });
    }

    let source: sharp.Sharp;
    try {
      source = sharp(file.buffer, { failOn: 'error' }).rotate();
      await source.metadata();
    } catch {
      throw new BadRequestException({ code: 'image_unreadable', message: "This image couldn't be read. Export a new copy and try again." });
    }

    const size = SIZES[kind];
    const main = await source
      .clone()
      .resize({ width: size.main, height: size.main, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const preview = await source
      .clone()
      .resize({ width: size.preview, height: size.preview, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 76, mozjpeg: true })
      .toBuffer();
    const blur = await source.clone().resize(16, 16, { fit: 'inside' }).jpeg({ quality: 50 }).toBuffer();

    const id = randomUUID();
    const base = `photographers/${photographerId}/${kind}/${id}`;
    const imageKey = `${base}.jpg`;
    const previewKey = `${base}-preview.jpg`;
    await this.storage.putObject(imageKey, main.data, 'image/jpeg');
    await this.storage.putObject(previewKey, preview, 'image/jpeg');

    return {
      imageKey,
      previewKey,
      width: main.info.width,
      height: main.info.height,
      blurDataUrl: `data:image/jpeg;base64,${blur.toString('base64')}`,
    };
  }

  /** Preview key for an image key produced by `store`. */
  previewKeyOf(imageKey: string): string {
    return imageKey.replace(/\.jpg$/, '-preview.jpg');
  }

  /** Short-lived URL for showing a stored image; null passes through. */
  async url(key: string | null | undefined, ttlSeconds = 3600): Promise<string | null> {
    return key ? this.storage.signDownload(key, ttlSeconds) : null;
  }

  async remove(imageKey: string | null | undefined): Promise<void> {
    if (!imageKey) return;
    await this.storage.deleteObjects([imageKey, this.previewKeyOf(imageKey)]);
  }
}
