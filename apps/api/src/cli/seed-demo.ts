import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { addCycle, cycleAllowanceBytes, DeliveryRules, TrialDefaults } from '@photnoo/shared';
import sharp from 'sharp';
import { AppModule } from '../app.module';
import { hashPassword } from '../auth/passwords';
import { randomToken, sha256 } from '../common/crypto';
import { ENV, type Env } from '../config/env';
import { FileProcessorService } from '../media/file-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from '../sharing/sharing.service';
import { objectKeys, STORAGE, type Storage } from '../storage/storage';

/**
 * Local demo data, so the whole platform can be clicked through as a real photographer and as
 * an admin. Development only: refuses to run in production. Safe to run again; it only adds
 * what is missing (matched by gallery name and email).
 *
 *   node dist/cli/seed-demo.js [photographer-email] [--reset]
 *
 * --reset first deletes the demo galleries (by name) with their files and activity, then seeds again.
 *
 * Photos are generated (soft gradients and bokeh), then pushed through the real file
 * processor, so previews, blur placeholders and sizes are exactly what uploads produce.
 */

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const GB = 1024n ** 3n;

type Palette = [string, string, string];
const PALETTES: Record<string, Palette[]> = {
  wedding: [['#f3e3cf', '#c99b6d', '#fff7ea'], ['#e9d6c2', '#8c6a52', '#fbe9d3'], ['#f7efe6', '#b88a5a', '#ffffff']],
  engagement: [['#f6d6c8', '#b46a5b', '#ffe9df'], ['#e7c3b8', '#7d4b43', '#fff1ea']],
  birthday: [['#ffe0ec', '#ff9bb8', '#fff6c8'], ['#d9f2ff', '#7cc4f0', '#fff0f6'], ['#fff1c9', '#ffb74d', '#ffe0ec']],
  family: [['#dfe9d6', '#6f8f5e', '#fdf6e3'], ['#e8e2d0', '#8a7b5c', '#f7f2e4']],
  corporate: [['#dfe6ee', '#4a5d73', '#f5f7fa'], ['#e4e7eb', '#2f3e4e', '#ffffff']],
  graduation: [['#d7e3f4', '#2f4f7f', '#f6f0d8'], ['#e6ecf5', '#8a6d2f', '#ffffff']],
  maternity: [['#f4e6ef', '#a8768f', '#fff5f9'], ['#efe7df', '#9c8166', '#fffaf4']],
  product: [['#2b1d16', '#a0663b', '#f1d9b5'], ['#1f1a17', '#6f4a2f', '#e8c9a0']],
  newborn: [['#f7f1ea', '#d9c3ad', '#ffffff'], ['#eef3f6', '#b9cad6', '#ffffff']],
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A photo-like JPEG: diagonal light, out-of-focus highlights and a vignette, like a soft-focus frame. */
async function makePhoto(kind: string, seed: number, portrait: boolean): Promise<Buffer> {
  const random = rng(seed);
  const palettes = PALETTES[kind] ?? PALETTES.wedding!;
  const [light, deep, glow] = palettes[Math.floor(random() * palettes.length)]!;
  const width = portrait ? 2000 : 3000;
  const height = portrait ? 3000 : 2000;
  const bokeh = Array.from({ length: 22 }, () => {
    const r = 40 + random() * 160;
    return `<circle cx="${(random() * width).toFixed(0)}" cy="${(random() * height * 0.7).toFixed(0)}" r="${r.toFixed(0)}" fill="${glow}" opacity="${(0.15 + random() * 0.45).toFixed(2)}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="${random().toFixed(2)}" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${deep}"/>
      </linearGradient>
      <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
      </radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="${portrait ? 38 : 48}"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <g filter="url(#soft)">${bokeh}</g>
    <rect width="100%" height="100%" fill="url(#vig)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer();
}

type GallerySpec = {
  name: string;
  client: string;
  phone: string;
  kind: string;
  folders?: string[];
  photos: number;
  /** Days ago the gallery was created. */
  age: number;
  /** Share it: days ago the 7-day link started. */
  sharedDaysAgo?: number;
  /** Client activity after sharing. */
  visits?: number;
  downloads?: number;
  close?: 'expired' | 'cap_used';
  suspend?: string;
  zip?: boolean;
};

const MONA_GALLERIES: GallerySpec[] = [
  { name: 'Nour & Karim Engagement', client: 'Nour Hassan', phone: '+201001234501', kind: 'engagement', folders: ['Getting ready', 'Ceremony', 'Portraits'], photos: 18, age: 6, sharedDaysAgo: 2, visits: 4, downloads: 9, zip: true },
  { name: "Farida's 1st Birthday", client: 'Dina Farouk', phone: '+201001234502', kind: 'birthday', folders: ['Party', 'Cake smash'], photos: 14, age: 9, sharedDaysAgo: 6, visits: 3, downloads: 5 },
  { name: 'Nile Bank — Executive Headshots', client: 'Rania Salem (HR)', phone: '+201001234503', kind: 'corporate', photos: 12, age: 4, sharedDaysAgo: 1, visits: 6, downloads: 12 },
  { name: 'El-Masry Family Portraits', client: 'Hany El-Masry', phone: '+201001234504', kind: 'family', photos: 10, age: 3, sharedDaysAgo: 0, visits: 1 },
  { name: 'Layla Maternity Session', client: 'Layla Mourad', phone: '+201001234505', kind: 'maternity', photos: 9, age: 1 },
  { name: 'Mariam & Ahmed Katb Ketab', client: 'Mariam Adel', phone: '+201001234506', kind: 'wedding', photos: 0, age: 0 },
  { name: 'Baby Selim — Newborn', client: 'Yasmin Selim', phone: '+201001234507', kind: 'newborn', photos: 8, age: 2, sharedDaysAgo: 1, visits: 2, downloads: 2 },
  { name: 'Omar Graduation — AUC', client: 'Omar Tarek', phone: '+201001234508', kind: 'graduation', photos: 8, age: 12, sharedDaysAgo: 8, visits: 3, downloads: 6, close: 'expired' },
  { name: 'Cairo Roastery — Product Shoot', client: 'Sherif Nabil', phone: '+201001234509', kind: 'product', photos: 6, age: 15, sharedDaysAgo: 5, visits: 2, downloads: 6, close: 'cap_used' },
];

const EGYPT_IPS = ['41.35.12.', '156.203.44.', '197.34.88.', '102.40.7.'];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const email = (args.find((a) => !a.startsWith('--')) ?? 'mona.test@example.com').toLowerCase();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const env = app.get<Env>(ENV);
    if (env.NODE_ENV === 'production') throw new Error('seed-demo refuses to run in production.');
    const prisma = app.get(PrismaService).client;
    const storage = app.get<Storage>(STORAGE);
    const processor = app.get(FileProcessorService);
    const sharing = app.get(SharingService);
    const now = Date.now();
    const shareOut: string[] = [];

    const mona = await prisma.photographer.findUnique({ where: { email } });
    if (!mona) throw new Error(`No photographer with email ${email}. Sign one up first.`);
    if (mona.name === 'Mona Test') {
      await prisma.photographer.update({ where: { id: mona.id }, data: { name: 'Mona Adel', studioName: 'Mona Adel Photography' } });
    }

    /** One gallery with generated photos, sharing and client activity. */
    async function seedGallery(photographerId: string, spec: GallerySpec, index: number) {
      const existing = await prisma.gallery.findFirst({
        where: { photographerId, name: spec.name, state: { notIn: ['purged', 'anonymised'] } },
      });
      if (existing) return console.log(`  = ${spec.name} (already there)`);

      const createdAt = new Date(now - spec.age * DAY - index * HOUR);
      const gallery = await prisma.gallery.create({
        data: { photographerId, name: spec.name, clientName: spec.client, clientPhone: spec.phone, createdAt },
      });
      const folders = await Promise.all(
        (spec.folders ?? []).map((name, position) => prisma.folder.create({ data: { galleryId: gallery.id, name, position } })),
      );

      let total = 0n;
      const fileIds: string[] = [];
      for (let i = 0; i < spec.photos; i += 1) {
        const id = randomUUID();
        const portrait = i % 3 === 1;
        const bytes = await makePhoto(spec.kind, index * 1000 + i + 7, portrait);
        const key = objectKeys.original(gallery.id, id);
        await storage.putObject(key, bytes, 'image/jpeg');
        await prisma.file.create({
          data: {
            id,
            galleryId: gallery.id,
            folderId: folders.length ? folders[i % folders.length]!.id : null,
            originalName: `DSC_${String(4120 + index * 100 + i).padStart(4, '0')}.jpg`,
            sizeBytes: BigInt(bytes.length),
            mimeType: 'image/jpeg',
            originalKey: key,
            status: 'processing',
            position: i,
            createdAt: new Date(createdAt.getTime() + i * 60_000),
          },
        });
        await processor.process(id);
        total += BigInt(bytes.length);
        fileIds.push(id);
      }
      if (spec.zip) {
        // A non-photo delivery: shows the file-type tile instead of a preview.
        const id = randomUUID();
        const bytes = Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), randomBytes(180_000)]);
        const key = objectKeys.original(gallery.id, id);
        await storage.putObject(key, bytes, 'application/zip');
        await prisma.file.create({
          data: { id, galleryId: gallery.id, originalName: 'Highlights-video-and-selects.zip', sizeBytes: BigInt(bytes.length), mimeType: 'application/zip', originalKey: key, status: 'processing', position: spec.photos },
        });
        await processor.process(id);
        total += BigInt(bytes.length);
      }
      const ready = await prisma.file.findMany({ where: { galleryId: gallery.id, status: 'ready' }, orderBy: { position: 'asc' } });
      await prisma.gallery.update({
        where: { id: gallery.id },
        data: {
          totalBytes: total,
          fileCount: ready.length,
          capBytes: total * BigInt(DeliveryRules.downloadCapMultiplier),
          lastUploadAt: new Date(createdAt.getTime() + spec.photos * 60_000),
          coverFileId: ready.find((f) => f.previewKey)?.id ?? null,
        },
      });
      if (total > 0n) {
        await prisma.subscription.updateMany({ where: { photographerId }, data: { usedBytes: { increment: total } } });
        await prisma.usageEvent.create({ data: { photographerId, type: 'upload', bytes: total, galleryId: gallery.id, createdAt } });
      }

      if (spec.sharedDaysAgo === undefined || ready.length === 0) return console.log(`  + ${spec.name} (draft, ${ready.length} files)`);

      const shared = await sharing.activate(photographerId, gallery.id);
      const activatedAt = new Date(now - spec.sharedDaysAgo * DAY - 2 * HOUR);
      const expiresAt = new Date(activatedAt.getTime() + DeliveryRules.linkActiveDays * DAY);
      await prisma.gallery.update({ where: { id: gallery.id }, data: { activatedAt, expiresAt } });

      // Client activity: sessions, opens and downloads spread after the share.
      const ipBase = EGYPT_IPS[index % EGYPT_IPS.length]!;
      let served = 0n;
      const visits = spec.visits ?? 0;
      for (let v = 0; v < visits; v += 1) {
        const at = new Date(Math.min(now - 5 * 60_000, activatedAt.getTime() + (v + 1) * 5 * HOUR));
        const device = v % 3 === 2 ? 'desktop' : 'mobile';
        const ip = `${ipBase}${20 + v}`;
        const session = await prisma.clientSession.create({
          data: { galleryId: gallery.id, tokenHash: sha256(randomToken()), ip, country: 'EG', deviceType: device, expiresAt: new Date(at.getTime() + DAY), createdAt: at },
        });
        await prisma.accessEvent.createMany({
          data: [
            { galleryId: gallery.id, type: 'password_ok', ip, country: 'EG', deviceType: device, createdAt: at },
            { galleryId: gallery.id, type: 'open', ip, country: 'EG', deviceType: device, createdAt: new Date(at.getTime() + 1000) },
          ],
        });
        const perVisit = Math.ceil((spec.downloads ?? 0) / Math.max(1, visits));
        const startAt = v * perVisit;
        for (const file of ready.slice(startAt, Math.min(startAt + perVisit, spec.downloads ?? 0))) {
          await prisma.downloadReceipt.create({
            data: { galleryId: gallery.id, fileId: file.id, bytes: file.sizeBytes, sessionId: session.id, ip, country: 'EG', deviceType: device, createdAt: new Date(at.getTime() + 60_000) },
          });
          served += file.sizeBytes;
        }
      }
      if (spec.close === 'cap_used') served = total * BigInt(DeliveryRules.downloadCapMultiplier);
      await prisma.gallery.update({
        where: { id: gallery.id },
        data: {
          servedBytes: served,
          ...(spec.close
            ? { state: 'closed', closedReason: spec.close, closedAt: new Date(now - 10 * 60_000), expiresAt: spec.close === 'expired' ? new Date(now - 10 * 60_000) : expiresAt }
            : {}),
          ...(spec.suspend ? { suspended: true, suspendedReason: spec.suspend } : {}),
        },
      });
      if (!spec.close) shareOut.push(`- ${spec.name}: ${shared.link}  password ${shared.password}`);
      console.log(`  + ${spec.name} (${spec.close ?? 'active'}, ${ready.length} files, ${visits} visits)`);
    }

    if (reset) {
      const names = [...MONA_GALLERIES.map((g) => g.name), 'Sara & Hazem Wedding'];
      const old = await prisma.gallery.findMany({
        where: { name: { in: names }, photographer: { email: { in: [email, 'ahmed.samir@example.com'] } } },
      });
      for (const g of old) {
        await storage.deletePrefix(objectKeys.gallery(g.id));
        await prisma.gallery.delete({ where: { id: g.id } });
        const sub = await prisma.subscription.findFirst({ where: { photographerId: g.photographerId } });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { usedBytes: sub.usedBytes > g.totalBytes ? sub.usedBytes - g.totalBytes : 0n },
          });
        }
      }
      console.log(`Removed ${old.length} demo galleries`);
    }

    console.log(`Photographer ${email}`);
    for (const [i, spec] of MONA_GALLERIES.entries()) await seedGallery(mona.id, spec, i + 1);

    // ---------- other photographers, for the admin console ----------
    const demoPassword = await hashPassword(randomBytes(18).toString('base64url'));
    async function photographer(input: { name: string; studio: string; email: string; phone: string; city: string; state: 'trial' | 'pending_payment' | 'soft_locked' | 'active'; ageDays: number }) {
      const found = await prisma.photographer.findUnique({ where: { email: input.email } });
      if (found) return found;
      const createdAt = new Date(now - input.ageDays * DAY);
      const application = await prisma.application.create({
        data: { name: input.name, studioName: input.studio, city: input.city, phone: input.phone, email: input.email, portfolioUrl: `https://instagram.com/${input.email.split('@')[0]}`, status: 'approved', grantTrial: input.state === 'trial', decidedAt: createdAt, inviteUsedAt: createdAt, createdAt },
      });
      const person = await prisma.photographer.create({
        data: { name: input.name, studioName: input.studio, email: input.email, phone: input.phone, city: input.city, passwordHash: demoPassword, termsAcceptedAt: createdAt, applicationId: application.id, createdAt },
      });
      const plan = await prisma.plan.findFirst({ where: { tier: '250GB', cycle: 'monthly', activeTo: null } });
      const cycleStart = input.state === 'soft_locked' ? new Date(now - 40 * DAY) : createdAt;
      await prisma.subscription.create({
        data: {
          photographerId: person.id,
          state: input.state,
          planId: input.state === 'active' || input.state === 'soft_locked' ? (plan?.id ?? null) : null,
          priceEgp: plan?.priceEgp ?? null,
          cycleStart,
          cycleEnd: input.state === 'trial' ? new Date(createdAt.getTime() + TrialDefaults.days * DAY) : input.state === 'pending_payment' ? createdAt : addCycle(cycleStart, 'monthly'),
          allowanceBytes: input.state === 'trial' ? BigInt(TrialDefaults.allowanceBytes) : plan ? cycleAllowanceBytes(plan.allowanceBytes, 'monthly') : 0n,
          createdAt,
        },
      });
      console.log(`Photographer ${input.email} (${input.state})`);
      return person;
    }

    const ahmed = await photographer({ name: 'Ahmed Samir', studio: 'Samir Visuals', email: 'ahmed.samir@example.com', phone: '+201111000101', city: 'Giza', state: 'trial', ageDays: 5 });
    const rana = await photographer({ name: 'Rana Fathy', studio: 'Rana Fathy Studio', email: 'rana.fathy@example.com', phone: '+201111000102', city: 'Alexandria', state: 'pending_payment', ageDays: 2 });
    await photographer({ name: 'Khaled Mostafa', studio: 'KM Photography', email: 'khaled.mostafa@example.com', phone: '+201111000103', city: 'Mansoura', state: 'soft_locked', ageDays: 45 });

    await seedGallery(ahmed.id, { name: 'Sara & Hazem Wedding', client: 'Sara Nabil', phone: '+201001234520', kind: 'wedding', photos: 6, age: 3, sharedDaysAgo: 1, visits: 5, downloads: 4 }, 20);

    // Abuse report on Ahmed's shared gallery.
    const reported = await prisma.gallery.findFirst({ where: { photographerId: ahmed.id, name: 'Sara & Hazem Wedding' } });
    if (reported && (await prisma.abuseReport.count({ where: { galleryId: reported.id } })) === 0) {
      await prisma.abuseReport.create({
        data: { galleryId: reported.id, reason: 'I am in these photos and never agreed to them being shared with strangers.', reporterEmail: 'guest.complaint@example.com', createdAt: new Date(now - 3 * HOUR) },
      });
      console.log('Abuse report on Sara & Hazem Wedding');
    }

    // Rana paid for a plan and uploaded a receipt: she waits in the payments queue.
    const ranaSub = await prisma.subscription.findFirst({ where: { photographerId: rana.id } });
    const plan = await prisma.plan.findFirst({ where: { tier: '250GB', cycle: 'annual', activeTo: null } });
    if (ranaSub && plan && (await prisma.payment.count({ where: { photographerId: rana.id } })) === 0) {
      const id = randomUUID();
      const proofKey = `billing/${rana.id}/payments/${id}/proof-demo.jpg`;
      const receipt = await sharp({ create: { width: 900, height: 1400, channels: 3, background: '#f4f4f4' } })
        .composite([{ input: Buffer.from('<svg width="900" height="1400"><rect x="60" y="80" width="780" height="140" rx="16" fill="#6a2c91"/><text x="100" y="170" font-size="54" font-family="Arial" fill="#fff">InstaPay</text><text x="100" y="360" font-size="40" font-family="Arial" fill="#222">Transfer successful</text><text x="100" y="460" font-size="64" font-family="Arial" font-weight="bold" fill="#222">800.00 EGP</text><text x="100" y="560" font-size="34" font-family="Arial" fill="#555">Note: PHN-DEMO42</text></svg>'), top: 0, left: 0 }])
        .jpeg()
        .toBuffer();
      await storage.putObject(proofKey, receipt, 'image/jpeg');
      await prisma.payment.create({
        data: { id, photographerId: rana.id, subscriptionId: ranaSub.id, planId: plan.id, kind: 'new', amountEgp: plan.priceEgp, declaredAmountEgp: plan.priceEgp, method: 'instapay', reference: 'PHN-DEMO42', proofKey, proofName: 'instapay-receipt.jpg', proofMime: 'image/jpeg', status: 'pending', submittedAt: new Date(now - 90 * 60_000), createdAt: new Date(now - 2 * HOUR) },
      });
      console.log('Payment PHN-DEMO42 waiting for review');
    }

    // Pending applications.
    const applicants = [
      { name: 'Youssef Adly', studioName: 'Adly Weddings', city: 'Cairo', phone: '+201222000201', email: 'youssef.adly@example.com' },
      { name: 'Hana Magdy', studioName: null, city: 'Tanta', phone: '+201222000202', email: 'hana.magdy@example.com' },
      { name: 'Mostafa Ibrahim', studioName: 'Frame 25', city: 'Hurghada', phone: '+201222000203', email: 'mostafa.ibrahim@example.com' },
      { name: 'Nada Sherif', studioName: 'Nada Sherif Photography', city: 'Cairo', phone: '+201222000204', email: 'nada.sherif@example.com' },
    ];
    for (const [i, a] of applicants.entries()) {
      if (await prisma.application.findFirst({ where: { email: a.email } })) continue;
      await prisma.application.create({ data: { ...a, portfolioUrl: `https://behance.net/${a.email.split('@')[0]}`, createdAt: new Date(now - (i + 1) * 7 * HOUR) } });
    }
    console.log(`${applicants.length} applications to review`);

    console.log('\nShared links (open them to test the client side):');
    console.log(shareOut.join('\n') || '(none new this run)');
  } finally {
    await app.close();
  }
}

void main();
