import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplicationContext } from '@nestjs/common';
import { DeliveryRules } from '@photnoo/shared';
import type { PrismaClient } from '@photnoo/db';
import { ImageUploadService } from '../media/image-upload.service';
import { objectKeys } from '../storage/storage';

/**
 * Demo data for Portfolio and Analytics:
 * - about 20 portfolio images from the cached Unsplash stock photos, stored through
 *   ImageUploadService exactly like a real upload, and the portfolio published;
 * - seven past client galleries spread over the last six months (delivered, expired and purged,
 *   as they would be by now), with back-dated gallery opens and download receipts, so the
 *   analytics charts have a realistic history. No gallery files are stored for them.
 *
 * Idempotent: the portfolio is skipped when it already has images, and past galleries are
 * matched by name. Needs the Nest application context (for ImageUploadService); without it
 * nothing is written. Orders and revenue come from the store/prints demo seed.
 *
 *   await seedDemoInsights(prisma, photographerId, app)
 */

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const PHOTO_DIRS = [join(process.cwd(), '.local', 'demo-photos'), join(process.cwd(), '..', '..', '.local', 'demo-photos'), join(process.cwd(), 'apps', 'api', '.local', 'demo-photos')];

function stock(id: string): Buffer | null {
  for (const dir of PHOTO_DIRS) {
    const file = join(dir, `${id}.jpg`);
    if (existsSync(file)) return readFileSync(file);
  }
  return null;
}

/** Portfolio picks: [stock photo id, category, caption]. */
const PORTFOLIO: Array<[string, string, string | null]> = [
  ['JS2sbw2UGAQ', 'Wedding', 'First look on the Nile'],
  ['c7MW7mXqYhE', 'Wedding', null],
  ['GpCkjyu00z8', 'Wedding', 'Zaffa at the Marriott Mena House'],
  ['habFekYtg34', 'Wedding', null],
  ['ZjhwmDiROIc', 'Wedding', 'Golden hour, Giza'],
  ['noLogqwlFSA', 'Wedding', null],
  ['1iuFKizvxQo', 'Engagement', 'Downtown Cairo rooftop'],
  ['h1CYHSp4lIY', 'Engagement', null],
  ['eKf6tehpuP0', 'Engagement', 'Al-Azhar Park'],
  ['uGLgY4hjvYk', 'Portrait', 'Maternity, El Gouna'],
  ['Hff5W3b5wPA', 'Portrait', null],
  ['vTknj2OxDVg', 'Portrait', 'Newborn studio session'],
  ['4_mJ1TbMK8A', 'Family', 'Sunday in Zamalek'],
  ['OMl0o6TSQXU', 'Family', null],
  ['vISLDBH5Sic', 'Family', null],
  ['m7yOJx0ALME', 'Event', 'Graduation day'],
  ['MD_ha01Bk7c', 'Event', "Farida's first birthday"],
  ['pAtA8xe_iVM', 'Commercial', 'Executive headshots'],
  ['LMzwJDu6hTE', 'Commercial', 'Cairo Roastery product line'],
  ['h9Iq22JJlGk', 'Commercial', null],
];

type PastGallery = { name: string; client: string; phone: string; photos: number; age: number; opens: number; downloads: number };

/** Older deliveries: the link ran for a week, then expired. */
const PAST: PastGallery[] = [
  { name: 'Hana & Youssef Wedding', client: 'Hana Mostafa', phone: '+201001235601', photos: 6, age: 172, opens: 14, downloads: 22 },
  { name: 'Salma Engagement — Al-Azhar Park', client: 'Salma Ibrahim', phone: '+201001235602', photos: 4, age: 146, opens: 9, downloads: 11 },
  { name: 'Delta Pharma — Annual Summit', client: 'Karim Fouad (Marketing)', phone: '+201001235603', photos: 5, age: 118, opens: 11, downloads: 17 },
  { name: 'The Rashad Family — Eid', client: 'Mai Rashad', phone: '+201001235604', photos: 4, age: 92, opens: 7, downloads: 9 },
  { name: 'Hana Mostafa — Newborn', client: 'Hana Mostafa', phone: '+201001235601', photos: 4, age: 66, opens: 10, downloads: 12 },
  { name: 'Nadine Maternity — El Gouna', client: 'Nadine Khalil', phone: '+201001235605', photos: 4, age: 41, opens: 8, downloads: 8 },
  { name: 'GUC Class of 2026', client: 'Ali Hamdy', phone: '+201001235606', photos: 5, age: 23, opens: 16, downloads: 19 },
];

const COUNTRIES = ['EG', 'EG', 'EG', 'EG', 'EG', 'EG', 'EG', 'SA', 'AE', 'EG', 'KW', 'GB'];
const DEVICES = ['mobile', 'mobile', 'mobile', 'desktop', 'mobile', 'desktop', 'tablet', 'mobile'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export async function seedDemoInsights(prisma: PrismaClient, photographerId: string, app?: INestApplicationContext): Promise<void> {
  if (!app) {
    console.log('  insights: skipped (needs the application context for storage)');
    return;
  }
  const images = app.get(ImageUploadService);
  const now = Date.now();

  // ---------- Portfolio ----------
  const photographer = await prisma.photographer.findUniqueOrThrow({ where: { id: photographerId } });
  if ((await prisma.portfolioItem.count({ where: { photographerId } })) === 0) {
    let position = 0;
    for (const [id, category, caption] of PORTFOLIO) {
      const bytes = stock(id);
      if (!bytes) continue;
      const stored = await images.store(photographerId, 'portfolio', { buffer: bytes, originalname: `${id}.jpg`, size: bytes.length });
      await prisma.portfolioItem.create({
        data: { photographerId, ...stored, caption, category, position, createdAt: new Date(now - (PORTFOLIO.length - position) * HOUR) },
      });
      position += 1;
    }
    console.log(`  + portfolio (${position} images)`);
  } else {
    console.log('  = portfolio (already there)');
  }

  let slug = photographer.slug;
  if (!slug) {
    const base = (photographer.studioName ?? photographer.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'studio';
    slug = base;
    for (let n = 2; await prisma.photographer.findFirst({ where: { slug, id: { not: photographerId } } }); n += 1) slug = `${base}-${n}`;
  }
  await prisma.photographer.update({
    where: { id: photographerId },
    data: {
      slug,
      portfolioPublished: true,
      bio:
        photographer.bio ??
        'Wedding and portrait photographer based in Cairo. I photograph real moments with soft, natural light, from katb ketab to family Sundays, and deliver every gallery privately to my clients.',
      city: photographer.city ?? 'Cairo',
      instagramUrl: photographer.instagramUrl ?? `https://instagram.com/${slug.replace(/-/g, '')}`,
    },
  });
  console.log(`  public profile /p/${slug}`);

  // ---------- Past galleries with client activity ----------
  for (const [index, spec] of PAST.entries()) {
    const found = await prisma.gallery.findFirst({ where: { photographerId, name: spec.name } });
    if (found) {
      console.log(`  = ${spec.name} (already there)`);
      continue;
    }
    const random = rng(4242 + index * 97);
    const createdAt = new Date(now - (spec.age + 2) * DAY - 5 * HOUR);
    const activatedAt = new Date(now - spec.age * DAY - (8 + index) * HOUR);
    const expiresAt = new Date(activatedAt.getTime() + DeliveryRules.linkActiveDays * DAY);

    const client = await prisma.client.upsert({
      where: { photographerId_phone: { photographerId, phone: spec.phone } },
      update: {},
      create: { photographerId, name: spec.client, phone: spec.phone, createdAt },
    });
    const gallery = await prisma.gallery.create({
      data: { photographerId, name: spec.name, clientId: client.id, clientName: spec.client, clientPhone: spec.phone, createdAt },
    });

    // Delivered long ago, so the files are already purged (receipts outlive them, like in production).
    const files = await Promise.all(
      Array.from({ length: spec.photos }, (_, i) => {
        const id = randomUUID();
        return prisma.file.create({
          data: {
            id,
            galleryId: gallery.id,
            originalName: `IMG_${String(7100 + index * 100 + i).padStart(4, '0')}.jpg`,
            sizeBytes: BigInt(4_200_000 + Math.floor(random() * 3_800_000)),
            mimeType: 'image/jpeg',
            originalKey: objectKeys.original(gallery.id, id),
            status: 'purged',
            position: i,
            createdAt: new Date(createdAt.getTime() + i * 60_000),
          },
        });
      }),
    );
    const total = files.reduce((sum, f) => sum + f.sizeBytes, 0n);

    // Opens and downloads during the week the link was live, mostly in the first days.
    const at = () => new Date(activatedAt.getTime() + Math.min(6.9, random() ** 1.8 * 7) * DAY + random() * HOUR);
    const opens = Array.from({ length: spec.opens }, () => ({
      at: at(),
      country: COUNTRIES[Math.floor(random() * COUNTRIES.length)]!,
      deviceType: DEVICES[Math.floor(random() * DEVICES.length)]!,
    })).sort((a, b) => a.at.getTime() - b.at.getTime());
    await prisma.accessEvent.createMany({
      data: opens.flatMap((o, v) => [
        { galleryId: gallery.id, type: 'password_ok' as const, ip: `41.35.${20 + index}.${10 + v}`, country: o.country, deviceType: o.deviceType, createdAt: o.at },
        { galleryId: gallery.id, type: 'open' as const, ip: `41.35.${20 + index}.${10 + v}`, country: o.country, deviceType: o.deviceType, createdAt: new Date(o.at.getTime() + 1000) },
      ]),
    });
    let served = 0n;
    const receipts = Array.from({ length: spec.downloads }, (_, d) => {
      const visit = opens[Math.floor(random() * opens.length)]!;
      const file = files[d % files.length]!;
      served += file.sizeBytes;
      return {
        galleryId: gallery.id,
        fileId: file.id,
        bytes: file.sizeBytes,
        sessionId: `seed-${gallery.id.slice(0, 8)}-${d % 4}`,
        country: visit.country,
        deviceType: visit.deviceType,
        createdAt: new Date(visit.at.getTime() + (2 + d) * 60_000),
      };
    });
    await prisma.downloadReceipt.createMany({ data: receipts });

    await prisma.gallery.update({
      where: { id: gallery.id },
      data: {
        state: 'purged',
        closedReason: 'expired',
        activatedAt,
        expiresAt,
        closedAt: expiresAt,
        purgedAt: new Date(expiresAt.getTime() + 3 * DAY),
        totalBytes: total,
        servedBytes: served,
        capBytes: total * BigInt(DeliveryRules.downloadCapMultiplier),
        fileCount: files.length,
        lastUploadAt: new Date(createdAt.getTime() + files.length * 60_000),
      },
    });
    console.log(`  + ${spec.name} (expired and purged, ${files.length} files, ${spec.opens} opens, ${spec.downloads} downloads)`);
  }
}
