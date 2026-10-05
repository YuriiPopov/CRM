import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Client, NewsPost, NewsStatus, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { CLIENT_JWT_AUDIENCE } from '../src/client-portal/auth/client-jwt';
import { ClientPortalModule } from '../src/client-portal/client-portal.module';
import { NewsModule } from '../src/news/news.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface NewsWhere {
  id?: string;
  salonId?: string;
  status?: NewsStatus;
}

type NewsOrderBy = Partial<Record<'createdAt' | 'publishedAt', 'asc' | 'desc'>>;

// Прогоняет реальные News-контроллер/сервис, ClientPortalController (GET /client/news) и оба
// JWT-guard'а (сотрудники и клиентское приложение) через HTTP поверх in-memory фейка
// PrismaService — реальная Postgres не нужна.
class FakePrismaService {
  private usersById = new Map<string, User>();
  private usersByEmail = new Map<string, User>();
  private clientsById = new Map<string, Client>();
  private postsById = new Map<string, NewsPost>();
  private nextPostId = 1;

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

  newsPost = {
    findMany: ({
      where,
      orderBy,
      select,
    }: {
      where: NewsWhere;
      orderBy: NewsOrderBy;
      select?: Partial<Record<keyof NewsPost, true>>;
    }): Promise<Partial<NewsPost>[]> => {
      const [field] = Object.keys(orderBy) as (keyof NewsOrderBy)[];
      const sorted = [...this.postsById.values()]
        .filter((p) => this.matches(p, where))
        .sort(
          (a, b) => (b[field]?.getTime() ?? 0) - (a[field]?.getTime() ?? 0),
        );
      return Promise.resolve(
        sorted.map((p) => (select ? this.pick(p, select) : p)),
      );
    },
    findFirst: ({ where }: { where: NewsWhere }): Promise<NewsPost | null> => {
      const found = [...this.postsById.values()].find((p) =>
        this.matches(p, where),
      );
      return Promise.resolve(found ?? null);
    },
    create: ({
      data,
    }: {
      data: Pick<
        NewsPost,
        'salonId' | 'category' | 'title' | 'body' | 'status' | 'publishedAt'
      >;
    }): Promise<NewsPost> => {
      const now = new Date();
      const post: NewsPost = {
        id: this.uuid(this.nextPostId++),
        imageUrl: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      this.postsById.set(post.id, post);
      return Promise.resolve(post);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<NewsPost>;
    }): Promise<NewsPost> => {
      const existing = this.postsById.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this.postsById.set(where.id, updated);
      return Promise.resolve(updated);
    },
    delete: ({ where }: { where: { id: string } }): Promise<NewsPost> => {
      const existing = this.postsById.get(where.id);
      if (!existing) throw new Error('not found');
      this.postsById.delete(where.id);
      return Promise.resolve(existing);
    },
  };

  private matches(post: NewsPost, where: NewsWhere): boolean {
    if (where.id && post.id !== where.id) return false;
    if (where.salonId && post.salonId !== where.salonId) return false;
    if (where.status && post.status !== where.status) return false;
    return true;
  }

  private pick(
    post: NewsPost,
    select: Partial<Record<keyof NewsPost, true>>,
  ): Partial<NewsPost> {
    return Object.fromEntries(
      Object.keys(select).map((key) => [key, post[key as keyof NewsPost]]),
    );
  }

  private uuid(n: number): string {
    return `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
  }

  seedUser(user: User) {
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
  }

  seedClient(client: Client) {
    this.clientsById.set(client.id, client);
  }

  seedPost(post: NewsPost) {
    this.postsById.set(post.id, post);
  }

  post(id: string): NewsPost | undefined {
    return this.postsById.get(id);
  }
}

const OTHER_SALON_POST_ID = 'cccccccc-0000-4000-8000-000000000001';
const OTHER_SALON_DRAFT_ID = 'cccccccc-0000-4000-8000-000000000002';
const MISSING_POST_ID = 'dddddddd-0000-4000-8000-000000000001';

// 1×1 PNG
const validImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function imageOfBytes(byteLength: number): string {
  return `data:image/jpeg;base64,${Buffer.alloc(byteLength, 1).toString('base64')}`;
}

describe('News (e2e)', () => {
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

    prisma.seedPost({
      id: OTHER_SALON_POST_ID,
      salonId: 'salon-2',
      category: 'NOWOSC',
      title: 'Cudza nowość',
      body: 'Opublikowana w innym salonie',
      imageUrl: null,
      status: NewsStatus.PUBLISHED,
      publishedAt: new Date('2026-10-01T10:00:00Z'),
      createdAt: new Date('2026-10-01T09:00:00Z'),
      updatedAt: new Date('2026-10-01T10:00:00Z'),
    });
    prisma.seedPost({
      id: OTHER_SALON_DRAFT_ID,
      salonId: 'salon-2',
      category: 'DIGEST',
      title: 'Cudzy szkic',
      body: 'Szkic w innym salonie',
      imageUrl: null,
      status: NewsStatus.DRAFT,
      publishedAt: null,
      createdAt: new Date('2026-10-01T09:00:00Z'),
      updatedAt: new Date('2026-10-01T09:00:00Z'),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        NewsModule,
        ClientPortalModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    // Тот же лимит тела, что в main.ts: картинка новости до 5MB даёт ~6.7MB base64
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

  // Токен клиентского приложения — как его выдаёт ClientAuthService.verifyCode
  function clientToken(clientId: string, salonId: string): string {
    return jwt.sign(
      { sub: clientId, salonId },
      { secret: 'test-secret', audience: CLIENT_JWT_AUDIENCE },
    );
  }

  const adminToken = () => loginAs('admin@b4u.local', adminPassword);
  const masterToken = () => loginAs('master1@b4u.local', masterPassword);

  async function createPost(
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<NewsPost> {
    const response = await request(app.getHttpServer())
      .post('/news')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'NOWOSC',
        title: 'Nowa linia zabiegów',
        body: 'Sprawdź ofertę w salonie.',
        ...overrides,
      })
      .expect(201);
    return response.body as NewsPost;
  }

  async function clientFeed(token: string) {
    const response = await request(app.getHttpServer())
      .get('/client/news')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body as Record<string, unknown>[];
  }

  describe('ADMIN', () => {
    it('creates a draft by default — without publishedAt', async () => {
      const token = await adminToken();
      const post = await createPost(token);

      expect(post).toMatchObject({
        salonId: 'salon-1',
        category: 'NOWOSC',
        title: 'Nowa linia zabiegów',
        status: 'DRAFT',
        publishedAt: null,
        imageUrl: null,
      });
    });

    it('sets publishedAt when a post is created as published', async () => {
      const token = await adminToken();
      const post = await createPost(token, { status: 'PUBLISHED' });

      expect(post.status).toBe('PUBLISHED');
      expect(post.publishedAt).not.toBeNull();
    });

    it('lists only the posts of its own salon, drafts included', async () => {
      const token = await adminToken();
      const draft = await createPost(token);
      const published = await createPost(token, { status: 'PUBLISHED' });

      const response = await request(app.getHttpServer())
        .get('/news')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = (response.body as NewsPost[]).map((p) => p.id).sort();
      expect(ids).toEqual([draft.id, published.id].sort());
    });

    it('sets publishedAt on the first publication only', async () => {
      const token = await adminToken();
      const post = await createPost(token);

      const published = await request(app.getHttpServer())
        .patch(`/news/${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);
      const firstPublishedAt = (published.body as NewsPost).publishedAt;
      expect(firstPublishedAt).not.toBeNull();

      await request(app.getHttpServer())
        .patch(`/news/${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'DRAFT' })
        .expect(200);
      const republished = await request(app.getHttpServer())
        .patch(`/news/${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);

      expect((republished.body as NewsPost).publishedAt).toEqual(
        firstPublishedAt,
      );
    });

    it('edits category, title and body', async () => {
      const token = await adminToken();
      const post = await createPost(token);

      const response = await request(app.getHttpServer())
        .patch(`/news/${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: 'INSPIRACJA',
          title: 'Nowy tytuł',
          body: 'Nowa treść',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        category: 'INSPIRACJA',
        title: 'Nowy tytuł',
        body: 'Nowa treść',
        status: 'DRAFT',
      });
    });

    it('deletes a post', async () => {
      const token = await adminToken();
      const post = await createPost(token);

      await request(app.getHttpServer())
        .delete(`/news/${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(prisma.post(post.id)).toBeUndefined();
    });

    it('cannot edit, delete or attach an image to another salon post (404)', async () => {
      const token = await adminToken();
      const server = app.getHttpServer();
      const auth = `Bearer ${token}`;

      await request(server)
        .patch(`/news/${OTHER_SALON_POST_ID}`)
        .set('Authorization', auth)
        .send({ title: 'Przejęte' })
        .expect(404);
      await request(server)
        .delete(`/news/${OTHER_SALON_POST_ID}`)
        .set('Authorization', auth)
        .expect(404);
      await request(server)
        .post(`/news/${OTHER_SALON_POST_ID}/image`)
        .set('Authorization', auth)
        .send({ image: validImage })
        .expect(404);
      await request(server)
        .delete(`/news/${OTHER_SALON_POST_ID}/image`)
        .set('Authorization', auth)
        .expect(404);

      expect(prisma.post(OTHER_SALON_POST_ID)?.title).toBe('Cudza nowość');
    });

    it('returns 404 for a missing post and 400 for a non-UUID id', async () => {
      const token = await adminToken();

      await request(app.getHttpServer())
        .patch(`/news/${MISSING_POST_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'X' })
        .expect(404);
      await request(app.getHttpServer())
        .delete('/news/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('field validation', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['empty title', { title: '' }],
      ['whitespace-only title', { title: '   ' }],
      ['title longer than 120 characters', { title: 'a'.repeat(121) }],
      ['empty body', { body: '' }],
      ['body longer than 2000 characters', { body: 'a'.repeat(2001) }],
      ['unknown category', { category: 'PROMOCJA' }],
      ['unknown status', { status: 'ARCHIVED' }],
      ['missing title', { title: undefined }],
      ['missing body', { body: undefined }],
      ['missing category', { category: undefined }],
    ];

    it.each(cases)('rejects %s on create (400)', async (_, overrides) => {
      const token = await adminToken();

      await request(app.getHttpServer())
        .post('/news')
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: 'NOWOSC',
          title: 'Tytuł',
          body: 'Treść',
          ...overrides,
        })
        .expect(400);
    });

    it('accepts the boundary lengths: title 1 and 120, body 1 and 2000', async () => {
      const token = await adminToken();

      await createPost(token, { title: 'a', body: 'b' });
      const post = await createPost(token, {
        title: 'a'.repeat(120),
        body: 'b'.repeat(2000),
      });

      expect(post.title).toHaveLength(120);
      expect(post.body).toHaveLength(2000);
    });

    it('trims title and body', async () => {
      const token = await adminToken();
      const post = await createPost(token, {
        title: '  Tytuł  ',
        body: ' Treść ',
      });

      expect(post.title).toBe('Tytuł');
      expect(post.body).toBe('Treść');
    });

    it.each([
      ['empty title', { title: '' }],
      ['title longer than 120 characters', { title: 'a'.repeat(121) }],
      ['body longer than 2000 characters', { body: 'a'.repeat(2001) }],
      ['unknown category', { category: 'PROMOCJA' }],
    ])('rejects %s on update (400)', async (_, payload) => {
      const token = await adminToken();
      const post = await createPost(token);

      await request(app.getHttpServer())
        .patch(`/news/${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload)
        .expect(400);
    });
  });

  describe('image', () => {
    it('uploads and removes an image', async () => {
      const token = await adminToken();
      const post = await createPost(token);

      const uploaded = await request(app.getHttpServer())
        .post(`/news/${post.id}/image`)
        .set('Authorization', `Bearer ${token}`)
        .send({ image: validImage })
        .expect(201);
      expect((uploaded.body as NewsPost).imageUrl).toBe(validImage);

      await request(app.getHttpServer())
        .delete(`/news/${post.id}/image`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
      expect(prisma.post(post.id)?.imageUrl).toBeNull();
    });

    it.each(['jpeg', 'png', 'webp'])('accepts image/%s', async (mime) => {
      const token = await adminToken();
      const post = await createPost(token);

      await request(app.getHttpServer())
        .post(`/news/${post.id}/image`)
        .set('Authorization', `Bearer ${token}`)
        .send({ image: `data:image/${mime};base64,AAAA` })
        .expect(201);
    });

    it.each([
      ['GIF', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='],
      ['SVG', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
      ['a plain URL', 'https://example.com/a.jpg'],
      ['non-base64 payload', 'data:image/png;base64,@@@'],
    ])('rejects %s (400)', async (_, image) => {
      const token = await adminToken();
      const post = await createPost(token);

      await request(app.getHttpServer())
        .post(`/news/${post.id}/image`)
        .set('Authorization', `Bearer ${token}`)
        .send({ image })
        .expect(400);
    });

    it('accepts exactly 5MB and rejects 5MB + 1 byte after decoding', async () => {
      const token = await adminToken();
      const post = await createPost(token);
      const limit = 5 * 1024 * 1024;

      await request(app.getHttpServer())
        .post(`/news/${post.id}/image`)
        .set('Authorization', `Bearer ${token}`)
        .send({ image: imageOfBytes(limit) })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/news/${post.id}/image`)
        .set('Authorization', `Bearer ${token}`)
        .send({ image: imageOfBytes(limit + 1) })
        .expect(400);
    });
  });

  describe('MASTER', () => {
    it('gets 403 on every /news endpoint', async () => {
      const admin = await adminToken();
      const post = await createPost(admin);
      const auth = `Bearer ${await masterToken()}`;
      const server = app.getHttpServer();

      await request(server).get('/news').set('Authorization', auth).expect(403);
      await request(server)
        .post('/news')
        .set('Authorization', auth)
        .send({ category: 'NOWOSC', title: 'T', body: 'B' })
        .expect(403);
      await request(server)
        .patch(`/news/${post.id}`)
        .set('Authorization', auth)
        .send({ status: 'PUBLISHED' })
        .expect(403);
      await request(server)
        .delete(`/news/${post.id}`)
        .set('Authorization', auth)
        .expect(403);
      await request(server)
        .post(`/news/${post.id}/image`)
        .set('Authorization', auth)
        .send({ image: validImage })
        .expect(403);
      await request(server)
        .delete(`/news/${post.id}/image`)
        .set('Authorization', auth)
        .expect(403);

      expect(prisma.post(post.id)).toMatchObject({
        status: 'DRAFT',
        imageUrl: null,
      });
    });
  });

  describe('client app', () => {
    it('sees only published posts of its own salon, newest first', async () => {
      const admin = await adminToken();
      const older = await createPost(admin, {
        title: 'Starsza',
        status: 'PUBLISHED',
      });
      await createPost(admin, { title: 'Szkic' });
      const newer = await createPost(admin, {
        title: 'Nowsza',
        status: 'PUBLISHED',
      });
      // publishedAt обеих создаётся в одну миллисекунду — разводим явно
      await prisma.newsPost.update({
        where: { id: older.id },
        data: { publishedAt: new Date('2026-10-02T10:00:00Z') },
      });
      await prisma.newsPost.update({
        where: { id: newer.id },
        data: { publishedAt: new Date('2026-10-03T10:00:00Z') },
      });

      const feed = await clientFeed(clientToken('client-1', 'salon-1'));

      expect(feed.map((p) => p.title)).toEqual(['Nowsza', 'Starsza']);
    });

    it('gets only the fields of the news card — no salonId or status', async () => {
      const admin = await adminToken();
      await createPost(admin, { status: 'PUBLISHED' });

      const [post] = await clientFeed(clientToken('client-1', 'salon-1'));

      expect(Object.keys(post).sort()).toEqual(
        ['body', 'category', 'id', 'imageUrl', 'publishedAt', 'title'].sort(),
      );
    });

    it('a draft appears after publication and disappears after deletion', async () => {
      const admin = await adminToken();
      const token = clientToken('client-1', 'salon-1');
      const post = await createPost(admin, { title: 'Scenariusz' });

      expect(await clientFeed(token)).toEqual([]);

      await request(app.getHttpServer())
        .patch(`/news/${post.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);
      expect((await clientFeed(token)).map((p) => p.id)).toEqual([post.id]);

      await request(app.getHttpServer())
        .delete(`/news/${post.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(204);
      expect(await clientFeed(token)).toEqual([]);
    });

    it('a published post moved back to draft disappears from the feed', async () => {
      const admin = await adminToken();
      const token = clientToken('client-1', 'salon-1');
      const post = await createPost(admin, { status: 'PUBLISHED' });

      await request(app.getHttpServer())
        .patch(`/news/${post.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ status: 'DRAFT' })
        .expect(200);

      expect(await clientFeed(token)).toEqual([]);
    });

    it('a client of another salon sees only its salon posts', async () => {
      const admin = await adminToken();
      await createPost(admin, { status: 'PUBLISHED' });

      const feed = await clientFeed(clientToken('client-2', 'salon-2'));

      expect(feed.map((p) => p.id)).toEqual([OTHER_SALON_POST_ID]);
    });

    it('gets 401 on the admin /news API', async () => {
      await request(app.getHttpServer())
        .get('/news')
        .set('Authorization', `Bearer ${clientToken('client-1', 'salon-1')}`)
        .expect(401);
    });

    it('/client/news rejects staff tokens and anonymous requests (401)', async () => {
      await request(app.getHttpServer())
        .get('/client/news')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .expect(401);
      await request(app.getHttpServer()).get('/client/news').expect(401);
    });
  });
});
