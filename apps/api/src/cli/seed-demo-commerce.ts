import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OrderStatus, PrintItem, PrintType, PrismaClient, Product } from '@photnoo/db';
import sharp from 'sharp';
import type { Storage } from '../storage/storage';

const DAY = 24 * 60 * 60 * 1000;

const PRODUCTS: Array<{ name: string; description: string; price: number; sale?: number; inStock?: boolean; colors: [string, string] }> = [
  { name: 'Cinematic Lightroom presets', description: 'Twelve warm, filmic presets for weddings and portraits. Desktop and mobile.', price: 600, sale: 450, colors: ['#2b1d16', '#c98b52'] },
  { name: 'Wedding album, 30x30 cm', description: 'Lay-flat album, 20 spreads, linen cover with your names debossed.', price: 4500, colors: ['#efe3d3', '#a07a55'] },
  { name: 'Mini portrait session', description: '30 minutes in the studio in Zamalek, 10 edited photos delivered in a week.', price: 1800, sale: 1500, colors: ['#dfe6ee', '#4a5d73'] },
  { name: 'Gift card, 1,000 EGP', description: 'Valid for a year on any session or print. Delivered on WhatsApp.', price: 1000, colors: ['#e7f0e4', '#4f7a55'] },
  { name: 'Framed fine-art print, 50x70 cm', description: 'Museum paper, black oak frame. Choose any photo from our portfolio.', price: 2200, colors: ['#1f2a33', '#8aa1b3'] },
  { name: 'Photo retouching, 10 photos', description: 'Skin, colour and background clean-up on 10 photos of your choice.', price: 750, inStock: false, colors: ['#f4e6ef', '#a8768f'] },
];

const PRINTS: Array<{ type: PrintType; name: string; size: string; price: number; available?: boolean }> = [
  { type: 'album', name: 'Classic album', size: 'A4 (21x30 cm)', price: 2800 },
  { type: 'album', name: 'Large album', size: 'A3 (30x42 cm)', price: 4200 },
  { type: 'frame', name: 'Wooden frame', size: '20x30 cm', price: 450 },
  { type: 'frame', name: 'Wooden frame', size: '30x40 cm', price: 650 },
  { type: 'frame', name: 'Gallery frame', size: '50x70 cm', price: 1200 },
  { type: 'canvas', name: 'Stretched canvas', size: '40x60 cm', price: 1500 },
  { type: 'wooden', name: 'Wooden portrait', size: '30x30 cm', price: 900 },
  { type: 'magazine', name: 'Wedding magazine', size: 'A4, 24 pages', price: 1100, available: false },
];

const CUSTOMERS = [
  { name: 'Nour Hassan', phone: '+201001234501', email: 'nour.hassan@example.com' },
  { name: 'Omar Farouk', phone: '+201112345602', email: null },
  { name: 'Salma Adel', phone: '+201223456703', email: 'salma.adel@example.com' },
  { name: 'Karim Mostafa', phone: '+201534567804', email: null },
  { name: 'Mariam Youssef', phone: '+201045678905', email: 'mariam.y@example.com' },
  { name: 'Youssef Samir', phone: '+201156789006', email: null },
];

/** [days ago, status, paid] for the store and print orders. */
const STORE_ORDERS: Array<[number, OrderStatus, boolean, number[]]> = [
  [1, 'pending', false, [0]],
  [2, 'pending', false, [2, 3]],
  [4, 'in_production', true, [1]],
  [9, 'ready', true, [4]],
  [16, 'delivered', true, [0, 3]],
  [38, 'delivered', true, [1]],
  [45, 'cancelled', false, [2]],
];
const PRINT_ORDERS: Array<[number, OrderStatus, boolean, number, number]> = [
  [0, 'pending', false, 3, 1],
  [3, 'in_production', true, 0, 1],
  [6, 'ready', true, 4, 2],
  [12, 'delivered', true, 6, 1],
  [40, 'delivered', true, 2, 3],
];

/** Cached Unsplash stock (see seed-demo.ts) used as product photos when available. */
const PRODUCT_STOCK = ['c7MW7mXqYhE', 'JS2sbw2UGAQ', '0cmJRW5rOJ8', 'habFekYtg34', '1iuFKizvxQo', 'ZjhwmDiROIc'];

function stockImage(position: number): Buffer | null {
  const id = PRODUCT_STOCK[position % PRODUCT_STOCK.length]!;
  for (const dir of [join(process.cwd(), '.local', 'demo-photos'), join(process.cwd(), '..', '..', '.local', 'demo-photos')]) {
    const file = join(dir, `${id}.jpg`);
    if (existsSync(file)) return readFileSync(file);
  }
  return null;
}

async function productImage(colors: [string, string], seed: number): Promise<{ main: Buffer; preview: Buffer }> {
  const stock = stockImage(seed);
  if (stock) {
    const photo = sharp(stock).rotate();
    return {
      main: await photo.clone().resize({ width: 1600, height: 1200, fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
      preview: await photo.clone().resize({ width: 720, height: 540, fit: 'cover' }).jpeg({ quality: 76, mozjpeg: true }).toBuffer(),
    };
  }
  const [a, b] = colors;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="r" cx="${0.3 + (seed % 3) * 0.2}" cy="0.35" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>
    <rect width="1200" height="900" fill="url(#g)"/><rect width="1200" height="900" fill="url(#r)"/></svg>`;
  const base = sharp(Buffer.from(svg));
  return {
    main: await base.clone().jpeg({ quality: 82 }).toBuffer(),
    preview: await base.clone().resize(720).jpeg({ quality: 76 }).toBuffer(),
  };
}

/**
 * Demo store and prints for one photographer: 6 products, a print catalog, 12 orders across
 * every status (some paid), and both switches on. Idempotent: does nothing once the
 * photographer has any product. Pass `storage` to give products a picture.
 */
export async function seedDemoCommerce(prisma: PrismaClient, photographerId: string, storage?: Storage): Promise<void> {
  if ((await prisma.product.count({ where: { photographerId } })) > 0) return;
  const now = Date.now();

  await prisma.photographer.update({ where: { id: photographerId }, data: { storeEnabled: true, printsEnabled: true } });

  const products: Product[] = [];
  for (const [position, spec] of PRODUCTS.entries()) {
    let imageKey: string | null = null;
    if (storage) {
      const image = await productImage(spec.colors, position);
      imageKey = `photographers/${photographerId}/product/${randomUUID()}.jpg`;
      await storage.putObject(imageKey, image.main, 'image/jpeg');
      await storage.putObject(imageKey.replace(/\.jpg$/, '-preview.jpg'), image.preview, 'image/jpeg');
    }
    products.push(
      await prisma.product.create({
        data: {
          photographerId,
          name: spec.name,
          description: spec.description,
          priceEgp: spec.price.toFixed(2),
          salePriceEgp: spec.sale ? spec.sale.toFixed(2) : null,
          inStock: spec.inStock ?? true,
          imageKey,
          position,
          createdAt: new Date(now - (50 - position * 6) * DAY),
        },
      }),
    );
  }

  const prints: PrintItem[] = [];
  for (const [position, spec] of PRINTS.entries()) {
    prints.push(
      await prisma.printItem.create({
        data: { photographerId, type: spec.type, name: spec.name, size: spec.size, priceEgp: spec.price.toFixed(2), available: spec.available ?? true, position },
      }),
    );
  }

  const gallery = await prisma.gallery.findFirst({
    where: { photographerId, state: 'active' },
    orderBy: { createdAt: 'desc' },
    include: { files: { where: { status: 'ready', previewKey: { not: null } }, take: 6, orderBy: { position: 'asc' } } },
  });

  async function place(input: {
    kind: 'store' | 'print';
    daysAgo: number;
    status: OrderStatus;
    paid: boolean;
    customer: (typeof CUSTOMERS)[number];
    galleryId?: string;
    note?: string;
    items: Array<{ productId?: string; printItemId?: string; fileId?: string; name: string; detail: string | null; unit: number; quantity: number }>;
  }) {
    const createdAt = new Date(now - input.daysAgo * DAY - (input.daysAgo % 5) * 60 * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ lastOrderNumber: number }>>`
        INSERT INTO "PhotographerCounter" ("photographerId", "lastOrderNumber") VALUES (${photographerId}::uuid, 1001)
        ON CONFLICT ("photographerId") DO UPDATE SET "lastOrderNumber" = "PhotographerCounter"."lastOrderNumber" + 1
        RETURNING "lastOrderNumber"`;
      const client = await tx.client.upsert({
        where: { photographerId_phone: { photographerId, phone: input.customer.phone } },
        create: { photographerId, name: input.customer.name, phone: input.customer.phone, email: input.customer.email, createdAt },
        update: {},
      });
      const total = input.items.reduce((sum, item) => sum + item.unit * item.quantity, 0);
      await tx.order.create({
        data: {
          photographerId,
          number: row!.lastOrderNumber,
          kind: input.kind,
          status: input.status,
          clientId: client.id,
          galleryId: input.galleryId ?? null,
          customerName: input.customer.name,
          customerPhone: input.customer.phone,
          customerEmail: input.customer.email,
          note: input.note ?? null,
          totalEgp: total.toFixed(2),
          paidAt: input.paid ? new Date(createdAt.getTime() + 3 * 60 * 60 * 1000) : null,
          createdAt,
          updatedAt: createdAt,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId ?? null,
              printItemId: item.printItemId ?? null,
              fileId: item.fileId ?? null,
              name: item.name,
              detail: item.detail,
              unitPriceEgp: item.unit.toFixed(2),
              quantity: item.quantity,
            })),
          },
        },
      });
    });
  }

  // Oldest first, so numbers follow the dates.
  const timeline = [
    ...STORE_ORDERS.map(([daysAgo, status, paid, indexes], i) => ({ kind: 'store' as const, daysAgo, status, paid, indexes, i })),
    ...PRINT_ORDERS.map(([daysAgo, status, paid, printIndex, quantity], i) => ({ kind: 'print' as const, daysAgo, status, paid, printIndex, quantity, i })),
  ].sort((a, b) => b.daysAgo - a.daysAgo);

  for (const entry of timeline) {
    const customer = CUSTOMERS[(entry.i + (entry.kind === 'print' ? 3 : 0)) % CUSTOMERS.length]!;
    if (entry.kind === 'store') {
      await place({
        kind: 'store',
        daysAgo: entry.daysAgo,
        status: entry.status,
        paid: entry.paid,
        customer,
        note: entry.i === 1 ? 'Please send the presets on WhatsApp.' : undefined,
        items: entry.indexes.map((index) => {
          const p = products[index]!;
          return { productId: p.id, name: p.name, detail: null, unit: Number(p.salePriceEgp ?? p.priceEgp), quantity: 1 };
        }),
      });
    } else {
      const print = prints[entry.printIndex]!;
      const file = gallery?.files[entry.i % Math.max(1, gallery.files.length)];
      await place({
        kind: 'print',
        daysAgo: entry.daysAgo,
        status: entry.status,
        paid: entry.paid,
        customer: gallery?.clientName && gallery.clientPhone && entry.i === 0 ? { name: gallery.clientName, phone: gallery.clientPhone, email: null } : customer,
        galleryId: file ? gallery!.id : undefined,
        note: entry.i === 2 ? 'Matte finish, please.' : undefined,
        items: [
          {
            printItemId: print.id,
            fileId: file?.id,
            name: print.name,
            detail: [print.size, file?.originalName].filter(Boolean).join(' · '),
            unit: Number(print.priceEgp),
            quantity: entry.quantity,
          },
        ],
      });
    }
  }
}
