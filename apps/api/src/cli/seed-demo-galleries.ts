import type { PrismaClient } from '@photnoo/db';

const DAY = 24 * 60 * 60 * 1000;

/** Clients without a gallery yet, so the Clients page shows a real mix. */
const EXTRA_CLIENTS = [
  { name: 'Nadine Samir', phone: '+201001234871', email: 'nadine.samir@example.com', notes: 'Engagement shoot planned for next month at Al-Azhar Park.', daysAgo: 4 },
  { name: 'Youssef El-Masry', phone: '+201112345092', email: null, notes: 'Corporate headshots for 12 staff. Invoice to the company.', daysAgo: 12 },
  { name: 'Farida Mostafa', phone: '+201223456713', email: 'farida.m@example.com', notes: null, daysAgo: 26 },
  { name: 'Karim Abdelaziz', phone: '+201554567334', email: null, notes: 'Prefers WhatsApp voice notes over calls.', daysAgo: 41 },
];

/**
 * Links the demo galleries to managed clients (by phone, one client per phone) and adds a few
 * clients without galleries. Idempotent: phones already present are left alone, and galleries
 * that already have a client are skipped.
 */
export async function seedDemoGalleries(prisma: PrismaClient, photographerId: string): Promise<void> {
  const galleries = await prisma.gallery.findMany({
    where: { photographerId, clientId: null, clientPhone: { not: null }, clientName: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, clientName: true, clientPhone: true, clientEmail: true, createdAt: true },
  });

  for (const gallery of galleries) {
    const phone = gallery.clientPhone!.trim();
    const client = await prisma.client.upsert({
      where: { photographerId_phone: { photographerId, phone } },
      // The first (oldest) gallery of a phone decides when the client "joined".
      create: { photographerId, name: gallery.clientName!, phone, email: gallery.clientEmail, createdAt: gallery.createdAt },
      update: {},
      select: { id: true },
    });
    await prisma.gallery.update({ where: { id: gallery.id }, data: { clientId: client.id } });
  }

  const now = Date.now();
  for (const extra of EXTRA_CLIENTS) {
    await prisma.client.upsert({
      where: { photographerId_phone: { photographerId, phone: extra.phone } },
      create: {
        photographerId,
        name: extra.name,
        phone: extra.phone,
        email: extra.email,
        notes: extra.notes,
        createdAt: new Date(now - extra.daysAgo * DAY),
      },
      update: {},
    });
  }
}
