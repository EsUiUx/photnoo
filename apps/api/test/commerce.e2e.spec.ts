import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './app';
import { newGallery, photo, readyFiles } from './gallery-helpers';
import { signUp } from './helpers';
import { seedDemoCommerce } from '../src/cli/seed-demo-commerce';

type Prisma = Awaited<ReturnType<typeof createTestApp>>['prisma'];
type Session = Awaited<ReturnType<typeof signUp>>;

let app: INestApplication;
let prisma: Prisma;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

let slugCounter = 0;

/** A photographer with an open store and a public handle. */
async function shopOwner() {
  const owner = await signUp(app, prisma);
  slugCounter += 1;
  const slug = `studio-${process.pid}-${Date.now().toString(36)}-${slugCounter}`;
  await prisma.photographer.update({ where: { id: owner.photographerId }, data: { slug, storeEnabled: true } });
  return { ...owner, slug };
}

async function product(owner: Session, body: Record<string, unknown>) {
  const res = await owner.agent.post('/v1/store/products').set('x-csrf-token', owner.csrf).send(body).expect(201);
  return res.body as { id: string; priceEgp: number; salePriceEgp: number | null };
}

const customer = { name: 'Nour Hassan', phone: '01012345678' };

function placeOrder(slug: string, items: Array<{ productId: string; quantity: number }>, extra: Record<string, unknown> = {}) {
  return request(app.getHttpServer())
    .post(`/v1/public/p/${slug}/orders`)
    .set('x-forwarded-for', `10.0.${slugCounter}.${Math.floor(Math.random() * 250)}`)
    .send({ ...customer, items, ...extra });
}

describe('store products', () => {
  it('requires the sale price to be lower than the price, on create and on edit', async () => {
    const owner = await shopOwner();
    const bad = await owner.agent
      .post('/v1/store/products')
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'Lightroom presets', priceEgp: 450, salePriceEgp: 450 })
      .expect(400);
    expect(bad.body.error.fields[0].path).toBe('salePriceEgp');

    const ok = await product(owner, { name: 'Lightroom presets', priceEgp: 600, salePriceEgp: 450 });
    expect(ok).toMatchObject({ priceEgp: 600, salePriceEgp: 450 });

    // Lowering the price under the existing sale price is refused too.
    await owner.agent.patch(`/v1/store/products/${ok.id}`).set('x-csrf-token', owner.csrf).send({ priceEgp: 400 }).expect(400);
    const cleared = await owner.agent
      .patch(`/v1/store/products/${ok.id}`)
      .set('x-csrf-token', owner.csrf)
      .send({ priceEgp: 400, salePriceEgp: null })
      .expect(200);
    expect(cleared.body).toMatchObject({ priceEgp: 400, salePriceEgp: null });
  });

  it('archives an ordered product instead of deleting it', async () => {
    const owner = await shopOwner();
    const ordered = await product(owner, { name: 'Wedding album', priceEgp: 2500 });
    const unused = await product(owner, { name: 'Mini prints', priceEgp: 150 });
    await placeOrder(owner.slug, [{ productId: ordered.id, quantity: 1 }]).expect(201);

    const a = await owner.agent.delete(`/v1/store/products/${ordered.id}`).set('x-csrf-token', owner.csrf).expect(200);
    const b = await owner.agent.delete(`/v1/store/products/${unused.id}`).set('x-csrf-token', owner.csrf).expect(200);
    expect(a.body.archived).toBe(true);
    expect(b.body.archived).toBe(false);
    expect(await prisma.product.findUnique({ where: { id: ordered.id } })).toMatchObject({ archivedAt: expect.any(Date) });
    expect(await prisma.product.findUnique({ where: { id: unused.id } })).toBeNull();
    const list = await owner.agent.get('/v1/store/products').expect(200);
    expect(list.body.items).toHaveLength(0);
  });
});

describe('public shop orders', () => {
  it('computes totals from the catalog and ignores prices sent by the browser', async () => {
    const owner = await shopOwner();
    const sale = await product(owner, { name: 'Presets', priceEgp: 600, salePriceEgp: 450 });
    const full = await product(owner, { name: 'Album', priceEgp: 1200 });

    const res = await placeOrder(
      owner.slug,
      [
        { productId: sale.id, quantity: 2, priceEgp: 1 } as never,
        { productId: full.id, quantity: 1 },
      ],
      { totalEgp: 1 },
    ).expect(201);
    expect(res.body.totalEgp).toBe(450 * 2 + 1200);

    const order = await prisma.order.findFirstOrThrow({ where: { photographerId: owner.photographerId }, include: { items: true } });
    expect(Number(order.totalEgp)).toBe(2100);
    expect(order.status).toBe('pending');
    expect(order.customerPhone).toBe('+201012345678');
    expect(order.items.map((i) => Number(i.unitPriceEgp)).sort()).toEqual([1200, 450].sort());
    // The customer becomes a client, and the photographer is notified.
    expect(order.clientId).toBeTruthy();
    await vi.waitFor(async () => {
      expect(await prisma.notification.count({ where: { photographerId: owner.photographerId, type: 'order_placed', orderId: order.id } })).toBe(1);
    });
  });

  it('numbers orders per photographer from 1001, without gaps under concurrency', async () => {
    const a = await shopOwner();
    const b = await shopOwner();
    const pa = await product(a, { name: 'Presets', priceEgp: 100 });
    const pb = await product(b, { name: 'Presets', priceEgp: 100 });

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        request(app.getHttpServer())
          .post(`/v1/public/p/${a.slug}/orders`)
          .set('x-forwarded-for', `10.9.9.${i + 1}`)
          .send({ ...customer, items: [{ productId: pa.id, quantity: 1 }] })
          .expect(201),
      ),
    );
    expect(results.map((r) => r.body.number as number).sort()).toEqual([1001, 1002, 1003, 1004, 1005, 1006]);

    const other = await placeOrder(b.slug, [{ productId: pb.id, quantity: 1 }]).expect(201);
    expect(other.body.number).toBe(1001);
  });

  it('refuses products from another shop, unknown slugs and disabled stores', async () => {
    const a = await shopOwner();
    const b = await shopOwner();
    const foreign = await product(b, { name: 'Not yours', priceEgp: 100 });
    await placeOrder(a.slug, [{ productId: foreign.id, quantity: 1 }]).expect(404);

    await request(app.getHttpServer()).get('/v1/public/p/no-such-studio/shop').expect(404);
    await prisma.photographer.update({ where: { id: a.photographerId }, data: { storeEnabled: false } });
    const off = await request(app.getHttpServer()).get(`/v1/public/p/${a.slug}/shop`).expect(404);
    expect(off.body.error.code).toBe('shop_not_found');

    const shop = await request(app.getHttpServer()).get(`/v1/public/p/${b.slug}/shop`).expect(200);
    expect(shop.body.products).toHaveLength(1);
    expect(shop.body.products[0]).toMatchObject({ name: 'Not yours', priceEgp: 100 });
  });

  it('rate limits orders per IP and shop', async () => {
    const owner = await shopOwner();
    const p = await product(owner, { name: 'Presets', priceEgp: 100 });
    const send = () =>
      request(app.getHttpServer())
        .post(`/v1/public/p/${owner.slug}/orders`)
        .set('x-forwarded-for', '10.66.66.66')
        .send({ ...customer, items: [{ productId: p.id, quantity: 1 }] });
    for (let i = 0; i < 10; i += 1) await send().expect(201);
    const limited = await send().expect(429);
    expect(limited.body.error.code).toBe('rate_limited');
  });
});

describe('managing orders', () => {
  it('keeps orders private to their photographer', async () => {
    const owner = await shopOwner();
    const stranger = await shopOwner();
    const p = await product(owner, { name: 'Presets', priceEgp: 300 });
    const placed = await placeOrder(owner.slug, [{ productId: p.id, quantity: 1 }]).expect(201);
    const order = await prisma.order.findFirstOrThrow({ where: { photographerId: owner.photographerId, number: placed.body.number } });

    await stranger.agent.get(`/v1/orders/${order.id}`).expect(404);
    await stranger.agent.patch(`/v1/orders/${order.id}`).set('x-csrf-token', stranger.csrf).send({ paid: true }).expect(404);
    await stranger.agent.patch(`/v1/store/products/${p.id}`).set('x-csrf-token', stranger.csrf).send({ name: 'Mine' }).expect(404);
    const theirs = await stranger.agent.get('/v1/orders?kind=store').expect(200);
    expect(theirs.body.total).toBe(0);
    const mine = await owner.agent.get('/v1/orders?kind=store').expect(200);
    expect(mine.body.total).toBe(1);
  });

  it('moves through statuses, records payment and counts paid revenue only', async () => {
    const owner = await shopOwner();
    const p = await product(owner, { name: 'Album', priceEgp: 1000 });
    const first = await placeOrder(owner.slug, [{ productId: p.id, quantity: 2 }]).expect(201);
    await placeOrder(owner.slug, [{ productId: p.id, quantity: 1 }]).expect(201);
    const order = await prisma.order.findFirstOrThrow({ where: { photographerId: owner.photographerId, number: first.body.number } });
    const patch = (body: object) => owner.agent.patch(`/v1/orders/${order.id}`).set('x-csrf-token', owner.csrf).send(body);

    await patch({ status: 'delivered' }).expect(409);
    await patch({ status: 'in_production' }).expect(200);
    const paid = await patch({ paid: true, status: 'ready' }).expect(200);
    expect(paid.body).toMatchObject({ status: 'ready', paidAt: expect.any(String) });

    const stats = await owner.agent.get('/v1/store/stats').expect(200);
    expect(stats.body).toMatchObject({ products: { value: 1 }, orders: { value: 2 }, revenueEgp: { value: 2000 }, pending: 1 });

    await patch({ status: 'cancelled' }).expect(200);
    const after = await owner.agent.get('/v1/store/stats').expect(200);
    expect(after.body.revenueEgp.value).toBe(0);

    const found = await owner.agent.get(`/v1/orders?kind=store&q=%23${first.body.number}`).expect(200);
    expect(found.body.items.map((o: { id: string }) => o.id)).toEqual([order.id]);
  });
});

describe('client print orders', () => {
  async function galleryWithPrints() {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const [fileId] = await readyFiles(app, owner, galleryId, [['DSC_0101.jpg', await photo(1200, 800)]]);
    const res = await owner.agent.post(`/v1/galleries/${galleryId}/activate`).set('x-csrf-token', owner.csrf).expect(200);
    const token = new URL(res.body.link).pathname.split('/g/')[1]!;
    const client = request.agent(app.getHttpServer());
    await client.post(`/v1/g/${token}/session`).send({ password: res.body.password }).expect(200);
    const item = await owner.agent
      .post('/v1/prints/items')
      .set('x-csrf-token', owner.csrf)
      .send({ type: 'frame', name: 'Wooden frame', size: '30x40 cm', priceEgp: 850 })
      .expect(201);
    return { owner, galleryId, fileId: fileId!, token, client, itemId: item.body.id as string };
  }

  it('offers prints only when the photographer and the gallery allow them', async () => {
    const { owner, galleryId, token, client } = await galleryWithPrints();
    const off = await client.get(`/v1/g/${token}/prints`).expect(200);
    expect(off.body.enabled).toBe(false);

    await owner.agent.patch('/v1/prints/settings').set('x-csrf-token', owner.csrf).send({ printsEnabled: true }).expect(200);
    const on = await client.get(`/v1/g/${token}/prints`).expect(200);
    expect(on.body).toMatchObject({ enabled: true, customer: { name: 'Sara', phone: '+201012345678' } });
    expect(on.body.items).toHaveLength(1);

    await owner.agent.patch(`/v1/prints/galleries/${galleryId}`).set('x-csrf-token', owner.csrf).send({ printsEnabled: false }).expect(200);
    expect((await client.get(`/v1/g/${token}/prints`).expect(200)).body.enabled).toBe(false);

    // Without the gallery session there is nothing to see.
    await request(app.getHttpServer()).get(`/v1/g/${token}/prints`).expect(401);
  });

  it('creates a pending print order linked to the gallery, photo and client', async () => {
    const { owner, galleryId, fileId, token, client, itemId } = await galleryWithPrints();
    await owner.agent.patch('/v1/prints/settings').set('x-csrf-token', owner.csrf).send({ printsEnabled: true }).expect(200);

    const res = await client
      .post(`/v1/g/${token}/prints/orders`)
      .send({ name: 'Sara', phone: '+201012345678', printItemId: itemId, fileId, quantity: 2, note: 'Matte please', priceEgp: 1 })
      .expect(201);
    expect(res.body).toMatchObject({ number: 1001, totalEgp: 1700, status: 'pending' });

    const order = await prisma.order.findFirstOrThrow({ where: { photographerId: owner.photographerId }, include: { items: true } });
    expect(order).toMatchObject({ kind: 'print', galleryId, note: 'Matte please' });
    expect(order.items[0]).toMatchObject({ fileId, printItemId: itemId, quantity: 2 });
    expect(order.clientId).toBeTruthy();

    const detail = await owner.agent.get(`/v1/orders/${order.id}`).expect(200);
    expect(detail.body.items[0].thumbnailUrl).toEqual(expect.any(String));
    const stats = await owner.agent.get('/v1/prints/stats').expect(200);
    expect(stats.body).toMatchObject({ pending: 1, inProduction: 0, delivered: 0 });
  });

  it("refuses another gallery's photo and a stranger's print option", async () => {
    const a = await galleryWithPrints();
    const b = await galleryWithPrints();
    await a.owner.agent.patch('/v1/prints/settings').set('x-csrf-token', a.owner.csrf).send({ printsEnabled: true }).expect(200);
    const body = { name: 'Sara', phone: '01012345678', quantity: 1 };
    await a.client.post(`/v1/g/${a.token}/prints/orders`).send({ ...body, printItemId: a.itemId, fileId: b.fileId }).expect(404);
    await a.client.post(`/v1/g/${a.token}/prints/orders`).send({ ...body, printItemId: b.itemId, fileId: a.fileId }).expect(404);
    expect(await prisma.order.count({ where: { photographerId: a.owner.photographerId } })).toBe(0);
  });
});

describe('demo seed', () => {
  it('seeds products, prints and 12 numbered orders once', async () => {
    const owner = await signUp(app, prisma);
    await seedDemoCommerce(prisma, owner.photographerId);
    await seedDemoCommerce(prisma, owner.photographerId);
    expect(await prisma.product.count({ where: { photographerId: owner.photographerId } })).toBe(6);
    expect(await prisma.printItem.count({ where: { photographerId: owner.photographerId } })).toBe(8);
    const orders = await prisma.order.findMany({ where: { photographerId: owner.photographerId }, orderBy: { number: 'asc' } });
    expect(orders.map((o) => o.number)).toEqual(Array.from({ length: 12 }, (_, i) => 1001 + i));
    const stats = await owner.agent.get('/v1/store/stats').expect(200);
    expect(stats.body.products.value).toBe(6);
    expect(stats.body.revenueEgp.value).toBeGreaterThan(0);
  });
});
