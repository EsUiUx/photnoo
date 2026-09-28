import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './app';
import { newGallery, photo, readyFiles } from './gallery-helpers';
import { signUp } from './helpers';

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

const DAY = 86_400_000;
let phoneCounter = 0;
const phone = () => `+2012${String(Date.now()).slice(-6)}${String(++phoneCounter).padStart(2, '0')}`;

const post = (s: Session, path: string, body?: object) => s.agent.post(path).set('x-csrf-token', s.csrf).send(body);
const patch = (s: Session, path: string, body: object) => s.agent.patch(path).set('x-csrf-token', s.csrf).send(body);
const put = (s: Session, path: string, body: object) => s.agent.put(path).set('x-csrf-token', s.csrf).send(body);
const del = (s: Session, path: string) => s.agent.delete(path).set('x-csrf-token', s.csrf);

describe('clients', () => {
  it('creates, lists, searches, edits and refuses a duplicate phone', async () => {
    const owner = await signUp(app, prisma);
    const mona = phone();
    const created = await post(owner, '/v1/clients', { name: 'Mona Adel', phone: mona, email: 'mona@example.com', notes: 'Prefers WhatsApp' }).expect(201);
    expect(created.body).toMatchObject({ name: 'Mona Adel', phone: mona, email: 'mona@example.com', notes: 'Prefers WhatsApp' });
    await post(owner, '/v1/clients', { name: 'Hany', phone: phone() }).expect(201);

    const dup = await post(owner, '/v1/clients', { name: 'Someone else', phone: mona }).expect(409);
    expect(dup.body.error.code).toBe('client_exists');

    const list = await owner.agent.get('/v1/clients').expect(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items[0]).toMatchObject({ name: 'Hany', galleryCount: 0, lastDeliveryAt: null });
    const search = await owner.agent.get('/v1/clients?q=mona').expect(200);
    expect(search.body.items.map((c: { name: string }) => c.name)).toEqual(['Mona Adel']);

    const other = (await owner.agent.get('/v1/clients?q=hany').expect(200)).body.items[0].id as string;
    const clash = await patch(owner, `/v1/clients/${other}`, { phone: mona }).expect(409);
    expect(clash.body.error.code).toBe('client_exists');
    const edited = await patch(owner, `/v1/clients/${created.body.id}`, { name: 'Mona Adel Fahmy', email: null }).expect(200);
    expect(edited.body).toMatchObject({ name: 'Mona Adel Fahmy', email: null });
    await patch(owner, `/v1/clients/${created.body.id}`, {}).expect(400);
  });

  it('links galleries, shows them with orders, and keeps galleries when the client is removed', async () => {
    const owner = await signUp(app, prisma);
    const client = (await post(owner, '/v1/clients', { name: 'Salma Nabil', phone: phone(), email: 'salma@example.com' }).expect(201)).body;

    const gallery = await post(owner, '/v1/galleries', { name: 'Salma engagement', clientId: client.id }).expect(201);
    expect(gallery.body).toMatchObject({ clientId: client.id, clientName: 'Salma Nabil', clientPhone: client.phone, clientEmail: 'salma@example.com' });

    // Editing the client refreshes the snapshot of its open galleries.
    await patch(owner, `/v1/clients/${client.id}`, { name: 'Salma N. Hassan' }).expect(200);
    expect((await owner.agent.get(`/v1/galleries/${gallery.body.id}`).expect(200)).body.clientName).toBe('Salma N. Hassan');

    await prisma.order.create({
      data: {
        photographerId: owner.photographerId,
        number: 1001,
        kind: 'print',
        clientId: client.id,
        customerName: 'Salma',
        customerPhone: client.phone,
        totalEgp: 1250.5,
        items: { create: [{ name: 'Canvas 40x60', unitPriceEgp: 625.25, quantity: 2 }] },
      },
    });
    const detail = await owner.agent.get(`/v1/clients/${client.id}`).expect(200);
    expect(detail.body.galleries.map((g: { id: string }) => g.id)).toEqual([gallery.body.id]);
    expect(detail.body.orderCount).toBe(1);
    const orders = await owner.agent.get(`/v1/clients/${client.id}/orders`).expect(200);
    expect(orders.body).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(orders.body.items[0]).toMatchObject({ number: 1001, itemCount: 2, totalEgp: 1250.5, status: 'pending' });

    await del(owner, `/v1/clients/${client.id}`).expect(204);
    await owner.agent.get(`/v1/clients/${client.id}`).expect(404);
    const kept = await owner.agent.get(`/v1/galleries/${gallery.body.id}`).expect(200);
    expect(kept.body).toMatchObject({ clientId: null, clientName: 'Salma N. Hassan' });
  });

  it('attaches a typed phone to the existing client instead of duplicating it', async () => {
    const owner = await signUp(app, prisma);
    const tel = phone();
    await post(owner, '/v1/galleries', { name: 'First', clientName: 'Omar', clientPhone: tel }).expect(201);
    const second = await post(owner, '/v1/galleries', { name: 'Second', clientName: 'Omar Khaled', clientPhone: tel }).expect(201);
    const clients = await owner.agent.get('/v1/clients').expect(200);
    expect(clients.body.items).toHaveLength(1);
    expect(clients.body.items[0]).toMatchObject({ phone: tel, galleryCount: 2 });
    expect(second.body.clientId).toBe(clients.body.items[0].id);
    const bad = await post(owner, '/v1/galleries', { name: 'No client' }).expect(400);
    expect(bad.body.error.code).toBe('validation_failed');
  });

  it("never reveals or touches another photographer's clients", async () => {
    const owner = await signUp(app, prisma);
    const stranger = await signUp(app, prisma);
    const client = (await post(owner, '/v1/clients', { name: 'Private', phone: phone() }).expect(201)).body;

    await stranger.agent.get(`/v1/clients/${client.id}`).expect(404);
    await stranger.agent.get(`/v1/clients/${client.id}/orders`).expect(404);
    await patch(stranger, `/v1/clients/${client.id}`, { name: 'Hijacked' }).expect(404);
    await del(stranger, `/v1/clients/${client.id}`).expect(404);
    await post(stranger, '/v1/galleries', { name: 'Steal', clientId: client.id }).expect(404);
    expect((await stranger.agent.get('/v1/clients').expect(200)).body.items).toHaveLength(0);
    // The same phone is a separate client for another photographer.
    await post(stranger, '/v1/clients', { name: 'Private', phone: client.phone }).expect(201);
    expect((await owner.agent.get(`/v1/clients/${client.id}`).expect(200)).body.name).toBe('Private');
  });
});

describe('folders, files and cover', () => {
  it('renames and reorders folders, and refuses a partial order', async () => {
    const owner = await signUp(app, prisma);
    const id = await newGallery(owner);
    const names = ['Getting ready', 'Ceremony', 'Reception'];
    const folders: string[] = [];
    for (const name of names) folders.push((await post(owner, `/v1/galleries/${id}/folders`, { name }).expect(201)).body.id);

    const renamed = await patch(owner, `/v1/folders/${folders[0]}`, { name: 'Bride prep' }).expect(200);
    expect(renamed.body.name).toBe('Bride prep');
    const clash = await patch(owner, `/v1/folders/${folders[0]}`, { name: 'Ceremony' }).expect(409);
    expect(clash.body.error.code).toBe('folder_exists');

    await patch(owner, `/v1/folders/${folders[2]}`, { position: 0 }).expect(200);
    let detail = await owner.agent.get(`/v1/galleries/${id}`).expect(200);
    expect(detail.body.folders.map((f: { id: string }) => f.id)).toEqual([folders[2], folders[0], folders[1]]);

    const reordered = await post(owner, `/v1/galleries/${id}/folders/reorder`, { folderIds: [folders[1], folders[0], folders[2]] }).expect(200);
    expect(reordered.body.folders.map((f: { position: number }) => f.position)).toEqual([0, 1, 2]);
    detail = await owner.agent.get(`/v1/galleries/${id}`).expect(200);
    expect(detail.body.folders.map((f: { id: string }) => f.id)).toEqual([folders[1], folders[0], folders[2]]);

    const partial = await post(owner, `/v1/galleries/${id}/folders/reorder`, { folderIds: [folders[0], folders[1]] }).expect(400);
    expect(partial.body.error.code).toBe('folders_mismatch');
  });

  it('moves one or many files between folders and sets the cover', async () => {
    const owner = await signUp(app, prisma);
    const id = await newGallery(owner);
    const other = await newGallery(owner, 'Other gallery');
    const party = (await post(owner, `/v1/galleries/${id}/folders`, { name: 'Party' }).expect(201)).body.id as string;
    const foreignFolder = (await post(owner, `/v1/galleries/${other}/folders`, { name: 'Elsewhere' }).expect(201)).body.id as string;
    const image = await photo(400, 300);
    const [a, b, c] = await readyFiles(app, owner, id, [['a.jpg', image], ['b.jpg', image], ['c.jpg', image]]);
    const [foreignFile] = await readyFiles(app, owner, other, [['x.jpg', image]]);

    const single = await patch(owner, `/v1/files/${a}`, { folderId: party }).expect(200);
    expect(single.body.folderId).toBe(party);
    const bulk = await post(owner, `/v1/galleries/${id}/files/move`, { fileIds: [b, c], folderId: party }).expect(200);
    expect(bulk.body.moved).toBe(2);
    await post(owner, `/v1/galleries/${id}/files/move`, { fileIds: [c], folderId: null }).expect(200);
    const files = (await owner.agent.get(`/v1/galleries/${id}`).expect(200)).body.files as Array<{ id: string; folderId: string | null }>;
    expect(Object.fromEntries(files.map((f) => [f.id, f.folderId]))).toEqual({ [a!]: party, [b!]: party, [c!]: null });

    // A folder or file of another gallery is refused, and nothing moves.
    await patch(owner, `/v1/files/${a}`, { folderId: foreignFolder }).expect(404);
    await post(owner, `/v1/galleries/${id}/files/move`, { fileIds: [b, foreignFile], folderId: null }).expect(404);
    expect((await prisma.file.findUniqueOrThrow({ where: { id: b! } })).folderId).toBe(party);

    const cover = await put(owner, `/v1/galleries/${id}/cover`, { fileId: b }).expect(200);
    expect(cover.body.coverFileId).toBe(b);
    await put(owner, `/v1/galleries/${id}/cover`, { fileId: foreignFile }).expect(404);
  });

  it("refuses folder, file and cover changes on another photographer's gallery", async () => {
    const owner = await signUp(app, prisma);
    const stranger = await signUp(app, prisma);
    const id = await newGallery(owner);
    const folder = (await post(owner, `/v1/galleries/${id}/folders`, { name: 'Mine' }).expect(201)).body.id as string;
    const [file] = await readyFiles(app, owner, id, [['a.jpg', await photo(400, 300)]]);

    await patch(stranger, `/v1/folders/${folder}`, { name: 'Theirs' }).expect(404);
    await post(stranger, `/v1/galleries/${id}/folders/reorder`, { folderIds: [folder] }).expect(404);
    await patch(stranger, `/v1/files/${file}`, { folderId: null }).expect(404);
    await post(stranger, `/v1/galleries/${id}/files/move`, { fileIds: [file], folderId: null }).expect(404);
    await put(stranger, `/v1/galleries/${id}/cover`, { fileId: file }).expect(404);
    await post(stranger, `/v1/galleries/${id}/extend`, { days: 2 }).expect(404);
    expect((await prisma.folder.findUniqueOrThrow({ where: { id: folder } })).name).toBe('Mine');
  });
});

describe('link duration and extension', () => {
  it('shares for the chosen number of days, then extends once by up to 3 days', async () => {
    const owner = await signUp(app, prisma);
    const id = await newGallery(owner);
    await readyFiles(app, owner, id, [['a.jpg', await photo(400, 300)]]);
    await post(owner, `/v1/galleries/${id}/activate`, { days: 11 }).expect(400);
    const before = Date.now();
    const shared = await post(owner, `/v1/galleries/${id}/activate`, { days: 3 }).expect(200);
    const expires = new Date(shared.body.expiresAt).getTime();
    expect(expires - before).toBeGreaterThanOrEqual(3 * DAY - 5_000);
    expect(expires - before).toBeLessThan(3 * DAY + 60_000);

    await post(owner, `/v1/galleries/${id}/extend`, { days: 4 }).expect(400);
    const extended = await post(owner, `/v1/galleries/${id}/extend`, { days: 2 }).expect(200);
    expect(new Date(extended.body.expiresAt).getTime() - expires).toBe(2 * DAY);
    const again = await post(owner, `/v1/galleries/${id}/extend`, { days: 1 }).expect(409);
    expect(again.body.error.code).toBe('already_extended');
    const detail = await owner.agent.get(`/v1/galleries/${id}`).expect(200);
    expect(detail.body.extendedAt).not.toBeNull();
  });

  it('defaults to 7 days and refuses to extend a draft', async () => {
    const owner = await signUp(app, prisma);
    const id = await newGallery(owner);
    const draft = await post(owner, `/v1/galleries/${id}/extend`, { days: 1 }).expect(409);
    expect(draft.body.error.code).toBe('not_active');
    await readyFiles(app, owner, id, [['a.jpg', await photo(400, 300)]]);
    const shared = await post(owner, `/v1/galleries/${id}/activate`).expect(200);
    const days = (new Date(shared.body.expiresAt).getTime() - Date.now()) / DAY;
    expect(Math.round(days)).toBe(7);
  });
});

describe('gallery list filters and dashboard', () => {
  it('filters by status and created date, sorts four ways and pages with a cursor', async () => {
    const owner = await signUp(app, prisma);
    const ids = {
      old: await newGallery(owner, 'Old shoot'),
      mid: await newGallery(owner, 'Mid shoot'),
      fresh: await newGallery(owner, 'Fresh shoot'),
    };
    const image = await photo(400, 300);
    await readyFiles(app, owner, ids.mid, [['a.jpg', image]]);
    await readyFiles(app, owner, ids.fresh, [['a.jpg', image]]);
    await post(owner, `/v1/galleries/${ids.mid}/activate`, { days: 2 }).expect(200);
    await post(owner, `/v1/galleries/${ids.fresh}/activate`, { days: 9 }).expect(200);
    await prisma.gallery.update({ where: { id: ids.old }, data: { createdAt: new Date('2026-03-10T10:00:00Z') } });
    await prisma.gallery.update({ where: { id: ids.mid }, data: { createdAt: new Date('2026-06-15T10:00:00Z') } });
    for (let i = 0; i < 3; i += 1) await prisma.accessEvent.create({ data: { galleryId: ids.fresh, type: 'open' } });
    await prisma.accessEvent.create({ data: { galleryId: ids.mid, type: 'open' } });
    await prisma.accessEvent.create({ data: { galleryId: ids.old, type: 'password_fail' } });

    const names = async (query: string) =>
      ((await owner.agent.get(`/v1/galleries?${query}`).expect(200)).body.items as Array<{ name: string }>).map((g) => g.name);

    expect(await names('sort=newest')).toEqual(['Fresh shoot', 'Mid shoot', 'Old shoot']);
    expect(await names('sort=oldest')).toEqual(['Old shoot', 'Mid shoot', 'Fresh shoot']);
    expect(await names('sort=expiring')).toEqual(['Mid shoot', 'Fresh shoot', 'Old shoot']);
    expect(await names('sort=views')).toEqual(['Fresh shoot', 'Mid shoot', 'Old shoot']);
    expect(await names('status=drafts')).toEqual(['Old shoot']);
    expect(await names('status=active&sort=oldest')).toEqual(['Mid shoot', 'Fresh shoot']);
    expect(await names('from=2026-06-01&to=2026-06-30')).toEqual(['Mid shoot']);
    expect(await names('to=2026-06-15')).toEqual(['Mid shoot', 'Old shoot']);
    expect(await names('q=fresh&sort=bogus')).toEqual(['Fresh shoot']);

    const first = await owner.agent.get('/v1/galleries?sort=views&take=2').expect(200);
    expect(first.body.items.map((g: { name: string }) => g.name)).toEqual(['Fresh shoot', 'Mid shoot']);
    expect(first.body.nextCursor).toBe(ids.mid);
    const second = await owner.agent.get(`/v1/galleries?sort=views&take=2&cursor=${first.body.nextCursor}`).expect(200);
    expect(second.body.items.map((g: { name: string }) => g.name)).toEqual(['Old shoot']);
    expect(second.body.nextCursor).toBeNull();

    // Another photographer sees none of these.
    const stranger = await signUp(app, prisma);
    expect((await stranger.agent.get('/v1/galleries?sort=views').expect(200)).body.items).toHaveLength(0);
  });

  it('reports trends against the previous 30 days, and none without history', async () => {
    const owner = await signUp(app, prisma);
    const empty = await owner.agent.get('/v1/dashboard').expect(200);
    expect(empty.body.trends).toEqual({
      clients: { current: 0, previous: 0 },
      activeGalleries: { current: 0, previous: 0 },
      downloads: { current: 0, previous: 0 },
      allowance: { current: 0, previous: 0 },
    });

    const recent = (await post(owner, '/v1/clients', { name: 'New', phone: phone() }).expect(201)).body.id as string;
    const older = (await post(owner, '/v1/clients', { name: 'Older', phone: phone() }).expect(201)).body.id as string;
    await prisma.client.update({ where: { id: older }, data: { createdAt: new Date(Date.now() - 45 * DAY) } });
    const id = await newGallery(owner);
    await readyFiles(app, owner, id, [['a.jpg', await photo(400, 300)]]);
    await post(owner, `/v1/galleries/${id}/activate`).expect(200);

    const res = await owner.agent.get('/v1/dashboard').expect(200);
    expect(res.body.clients).toBe(3);
    expect(res.body.trends.clients).toEqual({ current: 2, previous: 1 });
    expect(res.body.trends.activeGalleries).toEqual({ current: 1, previous: 0 });
    expect(res.body.trends.allowance.current).toBeGreaterThan(0);
    expect(recent).toBeTruthy();
  });
});
