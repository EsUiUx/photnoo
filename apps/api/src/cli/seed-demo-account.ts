import type { NotificationType, Prisma, PrismaClient } from '@photnoo/db';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Demo account data: a filled-in profile (handle `mona-adel`, links, bio) and a notification
 * inbox with a few of every type, some unread. Safe to run again: the profile only fills empty
 * fields, and notifications are skipped once the demo ones exist.
 */
export async function seedDemoAccount(prisma: PrismaClient, photographerId: string): Promise<void> {
  const photographer = await prisma.photographer.findUniqueOrThrow({ where: { id: photographerId } });

  const slugOwner = await prisma.photographer.findUnique({ where: { slug: 'mona-adel' }, select: { id: true } });
  await prisma.photographer.update({
    where: { id: photographerId },
    data: {
      studioName: photographer.studioName ?? 'Mona Adel Photography',
      city: photographer.city ?? 'Cairo',
      bio:
        photographer.bio ??
        'Wedding and family photographer based in Cairo. Natural light, real moments, and galleries delivered within two weeks.',
      instagramUrl: photographer.instagramUrl ?? 'https://instagram.com/mona.adel.photo',
      behanceUrl: photographer.behanceUrl ?? 'https://www.behance.net/monaadel',
      websiteUrl: photographer.websiteUrl ?? 'https://monaadel.photos',
      slug: photographer.slug ?? (slugOwner ? undefined : 'mona-adel'),
    },
  });

  if ((await prisma.notification.count({ where: { photographerId, dedupeKey: { startsWith: 'demo:' } } })) > 0) return;

  // Client-activity notices only make sense on shared links, and "closed" on closed ones.
  const select = { id: true, name: true, clientName: true } as const;
  const active = await prisma.gallery.findMany({ where: { photographerId, state: 'active' }, orderBy: { createdAt: 'desc' }, take: 6, select });
  const closed = await prisma.gallery.findMany({ where: { photographerId, state: 'closed' }, orderBy: { closedAt: 'desc' }, take: 2, select });
  const pick = (i: number) => (i === 4 ? closed[0] : active[i % Math.max(active.length, 1)]);
  const gallery = (i: number, fallback: string, client: string) => ({
    galleryId: pick(i)?.id,
    data: { gallery: pick(i)?.name ?? fallback, client: pick(i)?.clientName ?? client },
  });
  const orders = await prisma.order.findMany({ where: { photographerId }, orderBy: { createdAt: 'desc' }, take: 2 });

  const now = Date.now();
  type Spec = { type: NotificationType; ago: number; read?: boolean; galleryId?: string; orderId?: string; data: Prisma.InputJsonObject };
  const specs: Spec[] = [
    { type: 'gallery_opened', ago: 12 * MINUTE, ...gallery(0, 'Nour & Karim wedding', 'Nour Hassan') },
    { type: 'gallery_downloaded', ago: 2 * HOUR, ...withData(gallery(1, 'Salma birthday', 'Salma Fathy'), { reason: 'all_files' }) },
    {
      type: 'gallery_expiring',
      ago: 5 * HOUR,
      ...withData(gallery(2, 'El Sayed family day', 'Ahmed El Sayed'), { expiresAt: new Date(now + 19 * HOUR).toISOString() }),
    },
    { type: 'gallery_ready', ago: 9 * HOUR, ...withData(gallery(3, 'Rana engagement', 'Rana Mostafa'), { files: 148 }) },
    ...orders.map<Spec>((order, i) => ({
      type: 'order_placed',
      ago: (14 + i * 20) * HOUR,
      read: i > 0,
      orderId: order.id,
      galleryId: order.galleryId ?? undefined,
      data: { number: order.number, kind: order.kind, customerName: order.customerName, totalEgp: Number(order.totalEgp) },
    })),
    { type: 'payment_approved', ago: 2 * DAY, read: true, data: { reference: 'PN-7K2Q-94', plan: '500 GB, annual', amountEgp: 3000, periodEnd: new Date(now + 363 * DAY).toISOString() } },
    { type: 'renewal_due', ago: 3 * DAY, read: true, data: { days: 15, cycleEnd: new Date(now + 12 * DAY).toISOString(), trial: 0 } },
    { type: 'gallery_closed', ago: 4 * DAY, read: true, ...withData(gallery(4, 'Hany & Dina henna', 'Dina Samir'), { reason: 'expired' }) },
    { type: 'payment_rejected', ago: 6 * DAY, read: true, data: { reference: 'PN-3MX8-21', reason: 'The transferred amount does not match the invoice.', amountEgp: 3000 } },
    { type: 'gallery_opened', ago: 7 * DAY, read: true, ...gallery(5, 'Omar graduation', 'Omar Tarek') },
  ];

  await prisma.notification.createMany({
    data: specs.map((spec, i) => ({
      photographerId,
      type: spec.type,
      data: spec.data,
      galleryId: spec.galleryId,
      orderId: spec.orderId,
      dedupeKey: `demo:${i}`,
      readAt: spec.read ? new Date(now - spec.ago + 30 * MINUTE) : null,
      createdAt: new Date(now - spec.ago),
    })),
  });
}

function withData<T extends { data: Prisma.InputJsonObject }>(base: T, extra: Prisma.InputJsonObject): T {
  return { ...base, data: { ...base.data, ...extra } };
}
