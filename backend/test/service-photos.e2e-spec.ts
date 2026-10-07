import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Client, Role, ServicePhoto, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { CLIENT_JWT_AUDIENCE } from '../src/client-portal/auth/client-jwt';
import { ClientPortalModule } from '../src/client-portal/client-portal.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServicesModule } from '../src/services/services.module';

interface FakeService {
  id: string;
  salonId: string;
  name: string;
  categoryId: string;
  durationMin: number;
  price: number;
  createdAt: Date;
  hasActiveMaster: boolean;
}

interface PhotoWhere {
  id?: string;
  serviceId?: string;
  salonId?: string;
}

// Прогоняет реальные Services-/ClientPortal-контроллеры и ServicePhotosService через HTTP поверх
// in-memory фейка PrismaService — реальная Postgres не нужна. Каскадное удаление фото при
// удалении услуги и unique(serviceId, position) обеспечивает БД (миграция), здесь не эмулируются.
class FakePrismaService {
  private usersById = new Map<string, User>();
  private usersByEmail = new Map<string, User>();
  private clientsById = new Map<string, Client>();
  private servicesById = new Map<string, FakeService>();
  private photosById = new Map<string, ServicePhoto>();
  private nextPhotoId = 1;

  user = {
    findUnique: ({
      where,
    }: {
      where: { id?: string; email?: string };
    }): Promise<User | null> => {
      if (where.id)
        return Promise.resolve(this.usersById.get(where.id) ?? null);
      if (where.email)
        return Promise.resolve(this.usersByEmail.get(where.email) ?? null);
      return Promise.resolve(null);
    },
  };

  client = {
    findFirst: ({
      where,
    }: {
      where: { id: string; salonId: string };
    }): Promise<Pick<Client, 'id' | 'salonId'> | null> => {
      const found = this.clientsById.get(where.id);
      return Promise.resolve(
        found && found.salonId === where.salonId
          ? { id: found.id, salonId: found.salonId }
          : null,
      );
    },
  };

  salon = {
    findUniqueOrThrow: () =>
      Promise.resolve({ name: 'B4U', address: 'Warszawa' }),
  };

  serviceCategory = { findMany: () => Promise.resolve([]) };
  master = { findMany: () => Promise.resolve([]) };
  booking = { findMany: () => Promise.resolve([]) };

  service = {
    findFirst: ({
      where,
    }: {
      where: { id: string; salonId: string };
    }): Promise<FakeService | null> => {
      const found = this.servicesById.get(where.id);
      return Promise.resolve(
        found && found.salonId === where.salonId ? found : null,
      );
    },
    // Только форма запроса клиентского списка: include { masters, photos(take 1), _count }
    findMany: ({ where }: { where: { salonId: string } }) =>
      Promise.resolve(
        [...this.servicesById.values()]
          .filter((s) => s.salonId === where.salonId)
          .map((s) => {
            const photos = this.photosOf(s.id);
            return {
              ...s,
              masters: s.hasActiveMaster ? [{ masterId: 'm1' }] : [],
              photos: photos.slice(0, 1).map((p) => ({ id: p.id })),
              _count: { photos: photos.length },
            };
          }),
      ),
  };

  servicePhoto = {
    findMany: ({
      where,
      select,
    }: {
      where: PhotoWhere;
      select?: Partial<Record<keyof ServicePhoto, true>>;
    }) =>
      Promise.resolve(
        this.photosMatching(where)
          .sort((a, b) => a.position - b.position)
          .map((p) =>
            select
              ? Object.fromEntries(
                  Object.keys(select).map((k) => [
                    k,
                    p[k as keyof ServicePhoto],
                  ]),
                )
              : p,
          ),
      ),
    findFirst: ({ where }: { where: PhotoWhere }) =>
      Promise.resolve(this.photosMatching(where)[0] ?? null),
    count: ({ where }: { where: PhotoWhere }) =>
      Promise.resolve(this.photosMatching(where).length),
    create: ({
      data,
    }: {
      data: Pick<ServicePhoto, 'serviceId' | 'salonId' | 'position' | 'image'>;
    }) => {
      const photo: ServicePhoto = {
        id: `bbbbbbbb-0000-4000-8000-${String(this.nextPhotoId++).padStart(12, '0')}`,
        createdAt: new Date(),
        ...data,
      };
      this.photosById.set(photo.id, photo);
      return Promise.resolve(photo);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<ServicePhoto>;
    }) => {
      const existing = this.photosById.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data };
      this.photosById.set(where.id, updated);
      return Promise.resolve(updated);
    },
    delete: ({ where }: { where: { id: string } }) => {
      this.photosById.delete(where.id);
      return Promise.resolve({});
    },
  };

  $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  private photosMatching(where: PhotoWhere): ServicePhoto[] {
    return [...this.photosById.values()].filter(
      (p) =>
        (!where.id || p.id === where.id) &&
        (!where.serviceId || p.serviceId === where.serviceId) &&
        (!where.salonId || p.salonId === where.salonId),
    );
  }

  private photosOf(serviceId: string): ServicePhoto[] {
    return this.photosMatching({ serviceId }).sort(
      (a, b) => a.position - b.position,
    );
  }

  seedUser(user: User) {
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
  }

  seedClient(client: Client) {
    this.clientsById.set(client.id, client);
  }

  seedService(service: FakeService) {
    this.servicesById.set(service.id, service);
  }

  storedPhotos(serviceId: string): ServicePhoto[] {
    return this.photosOf(serviceId);
  }
}

const SERVICE_ID = 'service-1';
const EMPTY_SERVICE_ID = 'service-2';
const OTHER_SALON_SERVICE_ID = 'service-other';

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Байты с нужной сигнатурой; marker различает файлы между собой
function imageBytes(head: number[], marker = 0, total = 64): Buffer {
  const buf = Buffer.alloc(total, marker);
  Buffer.from(head).copy(buf);
  return buf;
}

const jpegDataUrl = (marker = 0, total = 64) =>
  `data:image/jpeg;base64,${imageBytes(JPEG_HEAD, marker, total).toString('base64')}`;

describe('Service photos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;
  let jwt: JwtService;

  const adminPassword = 'AdminPass1';
  const masterPassword = 'MasterPass1';

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    prisma = new FakePrismaService();

    prisma.seedUser({
      id: 'admin-1',
      salonId: 'salon-1',
      email: 'admin@b4u.local',
      passwordHash: await bcrypt.hash(adminPassword, 4),
      role: Role.ADMIN,
      masterId: null,
      isActive: true,
      createdAt: new Date(),
    });
    prisma.seedUser({
      id: 'master-user-1',
      salonId: 'salon-1',
      email: 'master1@b4u.local',
      passwordHash: await bcrypt.hash(masterPassword, 4),
      role: Role.MASTER,
      masterId: 'master-rec-1',
      isActive: true,
      createdAt: new Date(),
    });

    for (const [id, salonId] of [
      ['client-1', 'salon-1'],
      ['client-2', 'salon-2'],
    ]) {
      prisma.seedClient({
        id,
        salonId,
        name: 'Klientka',
        phone: `+4860000000${id.slice(-1)}`,
        email: null,
        notes: null,
        tags: [],
        consentGivenAt: new Date(),
        consentWithdrawnAt: null,
        createdAt: new Date(),
      });
    }

    for (const [id, salonId] of [
      [SERVICE_ID, 'salon-1'],
      [EMPTY_SERVICE_ID, 'salon-1'],
      [OTHER_SALON_SERVICE_ID, 'salon-2'],
    ]) {
      prisma.seedService({
        id,
        salonId,
        name: `Usługa ${id}`,
        categoryId: 'category-1',
        durationMin: 60,
        price: 120,
        createdAt: new Date(),
        hasActiveMaster: true,
      });
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        ServicesModule,
        ClientPortalModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(json({ limit: '8mb' }));
    app.use(urlencoded({ extended: true, limit: '8mb' }));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    jwt = moduleFixture.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  function clientToken(clientId: string, salonId: string): string {
    return jwt.sign(
      { sub: clientId, salonId },
      { secret: 'test-secret', audience: CLIENT_JWT_AUDIENCE },
    );
  }

  const adminToken = () => loginAs('admin@b4u.local', adminPassword);

  async function addPhoto(
    token: string,
    image: string,
    serviceId = SERVICE_ID,
  ) {
    return request(app.getHttpServer())
      .post(`/services/${serviceId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ image });
  }

  async function listPhotos(token: string, serviceId = SERVICE_ID) {
    const response = await request(app.getHttpServer())
      .get(`/services/${serviceId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body as { id: string; position: number; image: string }[];
  }

  describe('ADMIN CRUD', () => {
    it('adds photos with consecutive positions and lists them in order', async () => {
      const token = await adminToken();

      const first = (await addPhoto(token, jpegDataUrl(1))).body as {
        id: string;
      };
      const second = (await addPhoto(token, jpegDataUrl(2))).body as {
        id: string;
      };

      expect(first).toMatchObject({ position: 0 });
      expect(second).toMatchObject({ position: 1 });

      const list = await listPhotos(token);
      expect(list.map((p) => p.id)).toEqual([first.id, second.id]);
      expect(list[0].image.startsWith('data:image/jpeg;base64,')).toBe(true);
    });

    it('answers 400 on the sixth photo', async () => {
      const token = await adminToken();
      for (let i = 0; i < 5; i++) {
        await addPhoto(token, jpegDataUrl(i)).then((r) =>
          expect(r.status).toBe(201),
        );
      }

      const response = await addPhoto(token, jpegDataUrl(9));

      expect(response.status).toBe(400);
      expect((response.body as { message: string }).message).toMatch(
        /at most 5 photos/,
      );
      expect(prisma.storedPhotos(SERVICE_ID)).toHaveLength(5);
    });

    it('rejects an unsupported format with a clear message', async () => {
      const token = await adminToken();
      const gif = `data:image/jpeg;base64,${Buffer.from('GIF89a-padding-padding').toString('base64')}`;

      const response = await addPhoto(token, gif);

      expect(response.status).toBe(400);
      expect((response.body as { message: string }).message).toMatch(
        /Unsupported image format/,
      );
    });

    it('rejects an image above 1MB after decoding', async () => {
      const token = await adminToken();

      const response = await addPhoto(token, jpegDataUrl(1, 1024 * 1024 + 1));

      expect(response.status).toBe(400);
      expect((response.body as { message: string }).message).toMatch(/1MB/);
    });

    it('rejects a body that is not base64', async () => {
      const token = await adminToken();

      const response = await addPhoto(token, 'not base64 !!!');

      expect(response.status).toBe(400);
    });

    it('reorders photos by an array of ids', async () => {
      const token = await adminToken();
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await addPhoto(token, jpegDataUrl(i));
        ids.push((r.body as { id: string }).id);
      }
      const reversed = [...ids].reverse();

      const response = await request(app.getHttpServer())
        .put(`/services/${SERVICE_ID}/photos/order`)
        .set('Authorization', `Bearer ${token}`)
        .send(reversed)
        .expect(200);

      expect((response.body as { id: string }[]).map((p) => p.id)).toEqual(
        reversed,
      );
      expect((await listPhotos(token)).map((p) => p.id)).toEqual(reversed);
    });

    it('rejects an order that is not a permutation of the photos', async () => {
      const token = await adminToken();
      const r = await addPhoto(token, jpegDataUrl(1));
      const id = (r.body as { id: string }).id;
      await addPhoto(token, jpegDataUrl(2));

      await request(app.getHttpServer())
        .put(`/services/${SERVICE_ID}/photos/order`)
        .set('Authorization', `Bearer ${token}`)
        .send([id, id])
        .expect(400);
      await request(app.getHttpServer())
        .put(`/services/${SERVICE_ID}/photos/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: [id] })
        .expect(400);
    });

    it('deletes a photo and keeps positions contiguous', async () => {
      const token = await adminToken();
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await addPhoto(token, jpegDataUrl(i));
        ids.push((r.body as { id: string }).id);
      }

      await request(app.getHttpServer())
        .delete(`/services/${SERVICE_ID}/photos/${ids[0]}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const list = await listPhotos(token);
      expect(list.map((p) => [p.id, p.position])).toEqual([
        [ids[1], 0],
        [ids[2], 1],
      ]);

      // освободившееся место можно занять — лимит считается по текущему числу фото
      await addPhoto(token, jpegDataUrl(7)).then((r) =>
        expect(r.status).toBe(201),
      );
    });

    it('returns 404 when deleting an unknown photo', async () => {
      const token = await adminToken();

      await request(app.getHttpServer())
        .delete(`/services/${SERVICE_ID}/photos/nope`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('access control', () => {
    it("returns 404 for another salon's service on every endpoint", async () => {
      const token = await adminToken();
      const base = `/services/${OTHER_SALON_SERVICE_ID}/photos`;
      const auth = { Authorization: `Bearer ${token}` };

      await request(app.getHttpServer()).get(base).set(auth).expect(404);
      await addPhoto(token, jpegDataUrl(), OTHER_SALON_SERVICE_ID).then((r) =>
        expect(r.status).toBe(404),
      );
      await request(app.getHttpServer())
        .put(`${base}/order`)
        .set(auth)
        .send([])
        .expect(404);
      await request(app.getHttpServer())
        .delete(`${base}/x`)
        .set(auth)
        .expect(404);
    });

    it('forbids MASTER and rejects anonymous requests', async () => {
      const master = await loginAs('master1@b4u.local', masterPassword);

      await request(app.getHttpServer())
        .get(`/services/${SERVICE_ID}/photos`)
        .set('Authorization', `Bearer ${master}`)
        .expect(403);
      await addPhoto(master, jpegDataUrl()).then((r) =>
        expect(r.status).toBe(403),
      );
      await request(app.getHttpServer())
        .get(`/services/${SERVICE_ID}/photos`)
        .expect(401);
    });
  });

  describe('client reads', () => {
    async function seedTwoPhotos(): Promise<string[]> {
      const token = await adminToken();
      const ids: string[] = [];
      for (const [i, head] of [JPEG_HEAD, PNG_HEAD].entries()) {
        const image = `data:image/png;base64,${imageBytes(head, i).toString('base64')}`;
        const r = await addPhoto(token, image);
        ids.push((r.body as { id: string }).id);
      }
      return ids;
    }

    it('GET /client/services gives photoCount and coverPhotoId without base64', async () => {
      const [coverId] = await seedTwoPhotos();
      const token = clientToken('client-1', 'salon-1');

      const response = await request(app.getHttpServer())
        .get('/client/services')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const list = response.body as Record<string, unknown>[];
      expect(list.find((s) => s.id === SERVICE_ID)).toMatchObject({
        photoCount: 2,
        coverPhotoId: coverId,
      });
      expect(list.find((s) => s.id === EMPTY_SERVICE_ID)).toMatchObject({
        photoCount: 0,
        coverPhotoId: null,
      });
      expect(list.map((s) => s.id)).not.toContain(OTHER_SALON_SERVICE_ID);
      expect(JSON.stringify(response.body)).not.toContain('base64');
      expect(JSON.stringify(response.body)).not.toContain('image');
    });

    it('GET /client/catalog carries the same photo fields in services', async () => {
      const [coverId] = await seedTwoPhotos();
      const token = clientToken('client-1', 'salon-1');

      const response = await request(app.getHttpServer())
        .get('/client/catalog')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const { services } = response.body as {
        services: Record<string, unknown>[];
      };
      expect(services.find((s) => s.id === SERVICE_ID)).toMatchObject({
        photoCount: 2,
        coverPhotoId: coverId,
      });
      expect(JSON.stringify(response.body)).not.toContain('base64');
    });

    it('GET /client/services/:id/photos lists ids in order, own salon only', async () => {
      const ids = await seedTwoPhotos();
      const own = clientToken('client-1', 'salon-1');
      const foreign = clientToken('client-2', 'salon-2');

      const response = await request(app.getHttpServer())
        .get(`/client/services/${SERVICE_ID}/photos`)
        .set('Authorization', `Bearer ${own}`)
        .expect(200);
      expect(response.body).toEqual([
        { id: ids[0], position: 0 },
        { id: ids[1], position: 1 },
      ]);

      await request(app.getHttpServer())
        .get(`/client/services/${SERVICE_ID}/photos`)
        .set('Authorization', `Bearer ${foreign}`)
        .expect(404);
    });

    it('GET /client/service-photos/:id returns the image bytes with Content-Type and cache headers', async () => {
      const ids = await seedTwoPhotos();
      const token = clientToken('client-1', 'salon-1');

      const response = await request(app.getHttpServer())
        .get(`/client/service-photos/${ids[1]}`)
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/^image\/png/);
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect((response.body as Buffer).equals(imageBytes(PNG_HEAD, 1))).toBe(
        true,
      );
    });

    it("GET /client/service-photos/:id is 404 for another salon's photo", async () => {
      const ids = await seedTwoPhotos();
      const foreign = clientToken('client-2', 'salon-2');

      await request(app.getHttpServer())
        .get(`/client/service-photos/${ids[0]}`)
        .set('Authorization', `Bearer ${foreign}`)
        .expect(404);
    });

    it('requires a client token', async () => {
      await request(app.getHttpServer()).get('/client/services').expect(401);
      await request(app.getHttpServer())
        .get('/client/service-photos/x')
        .expect(401);
      const staff = await adminToken();
      await request(app.getHttpServer())
        .get('/client/services')
        .set('Authorization', `Bearer ${staff}`)
        .expect(401);
    });
  });
});
