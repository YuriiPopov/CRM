import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Client, NewsPost, NewsStatus, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import sharp from 'sharp';
import { AuthModule } from '../src/auth/auth.module';
import { CLIENT_JWT_AUDIENCE } from '../src/client-portal/auth/client-jwt';
import { registerBodyParsers } from '../src/common/body-parsers';
import { ClientPortalModule } from '../src/client-portal/client-portal.module';
import { NewsModule } from '../src/news/news.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface NewsWhere {
  id?: string;
  salonId?: string;
  status?: NewsStatus;
  contentHtml?: { not: null };
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
      omit,
    }: {
      where: NewsWhere;
      orderBy?: NewsOrderBy;
      select?: Partial<Record<keyof NewsPost, true>>;
      omit?: Partial<Record<keyof NewsPost, true>>;
    }): Promise<Partial<NewsPost>[]> => {
      const [field] = Object.keys(orderBy ?? {}) as (keyof NewsOrderBy)[];
      const sorted = [...this.postsById.values()]
        .filter((p) => this.matches(p, where))
        .sort((a, b) =>
          field ? (b[field]?.getTime() ?? 0) - (a[field]?.getTime() ?? 0) : 0,
        );
      return Promise.resolve(
        sorted.map((p) => {
          if (select) return this.pick(p, select);
          if (omit) {
            return Object.fromEntries(
              Object.entries(p).filter(([key]) => !(key in omit)),
            );
          }
          return p;
        }),
      );
    },
    findFirst: ({
      where,
      select,
    }: {
      where: NewsWhere;
      select?: Partial<Record<keyof NewsPost, true>>;
    }): Promise<Partial<NewsPost> | null> => {
      const found = [...this.postsById.values()].find((p) =>
        this.matches(p, where),
      );
      if (!found) return Promise.resolve(null);
      return Promise.resolve(select ? this.pick(found, select) : found);
    },
    create: ({
      data,
    }: {
      data: Pick<
        NewsPost,
        'salonId' | 'category' | 'title' | 'body' | 'status' | 'publishedAt'
      > &
        Partial<Pick<NewsPost, 'contentHtml'>>;
    }): Promise<NewsPost> => {
      const now = new Date();
      const post: NewsPost = {
        id: this.uuid(this.nextPostId++),
        imageUrl: null,
        contentHtml: null,
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
    if (where.contentHtml && post.contentHtml === null) return false;
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
      contentHtml: '<p>Cudzy artykuł</p>',
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
      contentHtml: '<p>Cudzy szkic artykułu</p>',
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

    // Те же парсеры тела, что в main.ts: 8MB для картинки, 16MB для статьи (/news, /news/:id)
    app = moduleFixture.createNestApplication({ bodyParser: false });
    registerBodyParsers(app);
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
        [
          'body',
          'category',
          'hasArticle',
          'id',
          'imageUrl',
          'publishedAt',
          'title',
        ].sort(),
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

  describe('article (contentHtml)', () => {
    const MB = 1024 * 1024;

    function htmlOfBytes(byteLength: number): string {
      const overhead = '<p></p>'.length;
      return `<p>${'a'.repeat(byteLength - overhead)}</p>`;
    }

    async function pngDataUri(width: number, height: number): Promise<string> {
      const buf = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 120, g: 30, b: 60 },
        },
      })
        .png()
        .toBuffer();
      return `data:image/png;base64,${buf.toString('base64')}`;
    }

    interface ErrorBody {
      statusCode: number;
      code?: string;
      message: string;
    }

    function getOne(token: string, id: string) {
      return request(app.getHttpServer())
        .get(`/news/${id}`)
        .set('Authorization', `Bearer ${token}`);
    }

    it('stores sanitised HTML, answers with hasArticle and without the HTML itself', async () => {
      const token = await adminToken();
      const post = await createPost(token, {
        contentHtml:
          '<article><p onclick="x()">Treść</p><script>alert(1)</script><a href="javascript:alert(1)">a</a><a href="#book">Umów</a></article>',
      });

      expect(post).toMatchObject({ hasArticle: true });
      expect(post).not.toHaveProperty('contentHtml');

      const stored = prisma.post(post.id)?.contentHtml ?? '';
      expect(stored).toContain('Treść');
      expect(stored).toContain('href="#book"');
      expect(stored).not.toMatch(/script|onclick|javascript/i);
    });

    it('removes <script>, onerror, javascript: and external images', async () => {
      const token = await adminToken();
      const post = await createPost(token, {
        contentHtml:
          '<p>ok</p><img src="https://evil.example/x.png" onerror="alert(1)"><img src=x onerror=alert(1)><a href="javascript:alert(1)">a</a><script>alert(1)</script><iframe src="https://evil.example"></iframe>',
      });

      const stored = prisma.post(post.id)?.contentHtml ?? '';
      expect(stored).toBe('<p>ok</p><a>a</a>');
    });

    it('recompresses inline images: long side ≤ 1200 px, JPEG', async () => {
      const token = await adminToken();
      const post = await createPost(token, {
        contentHtml: `<img src="${await pngDataUri(2400, 1200)}" alt="">`,
      });

      const stored = prisma.post(post.id)?.contentHtml ?? '';
      const [, uri] = /src="(data:image\/jpeg;base64,[^"]+)"/.exec(stored)!;
      const meta = await sharp(
        Buffer.from(uri.split(',')[1], 'base64'),
      ).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual([
        'jpeg',
        1200,
        600,
      ]);
    });

    it('answers 422 ARTICLE_IMAGE_INVALID for a corrupt inline image and creates nothing', async () => {
      const token = await adminToken();
      const bad = `data:image/png;base64,${Buffer.from('nope').toString('base64')}`;

      const response = await request(app.getHttpServer())
        .post('/news')
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: 'NOWOSC',
          title: 'T',
          body: 'B',
          status: 'PUBLISHED',
          contentHtml: `<img src="${bad}">`,
        })
        .expect(422);

      expect((response.body as ErrorBody).code).toBe('ARTICLE_IMAGE_INVALID');
      // своих постов нет: ни один шаг не сохранился
      const own = await request(app.getHttpServer())
        .get('/news')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(own.body).toEqual([]);
    });

    it('answers 422 ARTICLE_INVALID_HTML when nothing is left after sanitising', async () => {
      const token = await adminToken();

      const response = await request(app.getHttpServer())
        .post('/news')
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: 'NOWOSC',
          title: 'T',
          body: 'B',
          contentHtml: '<script>alert(1)</script>',
        })
        .expect(422);

      expect((response.body as ErrorBody).code).toBe('ARTICLE_INVALID_HTML');
    });

    it('limits the source to 12MB (422 ARTICLE_TOO_LARGE) and accepts 12MB itself up to the 4MB check', async () => {
      const token = await adminToken();
      const send = (html: string) =>
        request(app.getHttpServer())
          .post('/news')
          .set('Authorization', `Bearer ${token}`)
          .send({
            category: 'NOWOSC',
            title: 'T',
            body: 'B',
            contentHtml: html,
          });

      const over = await send(htmlOfBytes(12 * MB + 1)).expect(422);
      expect((over.body as ErrorBody).code).toBe('ARTICLE_TOO_LARGE');

      // ровно 12 МБ проходит исходный лимит, но не итоговый
      const exact = await send(htmlOfBytes(12 * MB)).expect(422);
      expect((exact.body as ErrorBody).code).toBe('ARTICLE_RESULT_TOO_LARGE');
    });

    it('limits the processed result to 4MB (4MB passes, 4MB + 1 byte does not)', async () => {
      const token = await adminToken();
      const send = (html: string) =>
        request(app.getHttpServer())
          .post('/news')
          .set('Authorization', `Bearer ${token}`)
          .send({
            category: 'NOWOSC',
            title: 'T',
            body: 'B',
            contentHtml: html,
          });

      await send(htmlOfBytes(4 * MB)).expect(201);
      const over = await send(htmlOfBytes(4 * MB + 1)).expect(422);
      expect((over.body as ErrorBody).code).toBe('ARTICLE_RESULT_TOO_LARGE');
    });

    it('raises the JSON limit only for POST /news and PATCH /news/:id', async () => {
      const token = await adminToken();
      const post = await createPost(token);
      const auth = `Bearer ${token}`;

      // 17 МБ — больше лимита маршрутов статьи (16 МБ)
      const huge = 'a'.repeat(17 * MB);
      await request(app.getHttpServer())
        .post('/news')
        .set('Authorization', auth)
        .send({ category: 'NOWOSC', title: 'T', body: 'B', contentHtml: huge })
        .expect(413);
      // 9 МБ: для статьи — норма (дойдёт до 422 по размеру результата), для картинки — уже 413 (лимит 8 МБ)
      await request(app.getHttpServer())
        .patch(`/news/${post.id}`)
        .set('Authorization', auth)
        .send({ contentHtml: htmlOfBytes(9 * MB) })
        .expect(422);
      await request(app.getHttpServer())
        .post(`/news/${post.id}/image`)
        .set('Authorization', auth)
        .send({ image: `data:image/jpeg;base64,${'A'.repeat(9 * MB)}` })
        .expect(413);
    });

    it('does not return contentHtml in the list, only hasArticle', async () => {
      const token = await adminToken();
      const withArticle = await createPost(token, { contentHtml: '<p>x</p>' });
      const without = await createPost(token);

      const response = await request(app.getHttpServer())
        .get('/news')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const list = response.body as (NewsPost & { hasArticle: boolean })[];

      expect(list.every((p) => !('contentHtml' in p))).toBe(true);
      expect(list.find((p) => p.id === withArticle.id)?.hasArticle).toBe(true);
      expect(list.find((p) => p.id === without.id)?.hasArticle).toBe(false);
    });

    it('GET /news/:id returns contentHtml (admin only, own salon only)', async () => {
      const token = await adminToken();
      const post = await createPost(token, { contentHtml: '<p>Treść</p>' });

      const response = await getOne(token, post.id).expect(200);
      expect(response.body).toMatchObject({
        id: post.id,
        contentHtml: '<p>Treść</p>',
        hasArticle: true,
      });

      await getOne(token, OTHER_SALON_POST_ID).expect(404);
      await getOne(token, MISSING_POST_ID).expect(404);
      await getOne(await masterToken(), post.id).expect(403);
      await request(app.getHttpServer()).get(`/news/${post.id}`).expect(401);
    });

    it('PATCH: keeps the article when contentHtml is absent, replaces it, removes it with null or ""', async () => {
      const token = await adminToken();
      const post = await createPost(token, { contentHtml: '<p>Pierwsza</p>' });
      const patch = (payload: Record<string, unknown>) =>
        request(app.getHttpServer())
          .patch(`/news/${post.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

      const renamed = await patch({ title: 'Nowy tytuł' }).expect(200);
      expect(renamed.body).toMatchObject({ hasArticle: true });
      expect(prisma.post(post.id)?.contentHtml).toBe('<p>Pierwsza</p>');

      await patch({ contentHtml: '<p>Druga</p>' }).expect(200);
      expect(prisma.post(post.id)?.contentHtml).toBe('<p>Druga</p>');

      const cleared = await patch({ contentHtml: null }).expect(200);
      expect(cleared.body).toMatchObject({ hasArticle: false });
      expect(prisma.post(post.id)?.contentHtml).toBeNull();

      await patch({ contentHtml: '<p>Trzecia</p>' }).expect(200);
      await patch({ contentHtml: '' }).expect(200);
      expect(prisma.post(post.id)?.contentHtml).toBeNull();
    });

    it('PATCH with a bad article is 422 and leaves the stored article and other fields unchanged', async () => {
      const token = await adminToken();
      const post = await createPost(token, { contentHtml: '<p>Stara</p>' });

      await request(app.getHttpServer())
        .patch(`/news/${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Zmieniony',
          status: 'PUBLISHED',
          contentHtml: '<style></style>',
        })
        .expect(422);

      expect(prisma.post(post.id)).toMatchObject({
        title: 'Nowa linia zabiegów',
        status: 'DRAFT',
        contentHtml: '<p>Stara</p>',
      });
    });

    it('another salon post is 404 on PATCH even with an invalid article (no 422 before the 404)', async () => {
      const token = await adminToken();

      await request(app.getHttpServer())
        .patch(`/news/${OTHER_SALON_POST_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ contentHtml: '<script>x</script>' })
        .expect(404);
      expect(prisma.post(OTHER_SALON_POST_ID)?.contentHtml).toBe(
        '<p>Cudzy artykuł</p>',
      );
    });

    it('MASTER cannot write an article (403)', async () => {
      await request(app.getHttpServer())
        .post('/news')
        .set('Authorization', `Bearer ${await masterToken()}`)
        .send({
          category: 'NOWOSC',
          title: 'T',
          body: 'B',
          contentHtml: '<p>x</p>',
        })
        .expect(403);
    });

    describe('client app', () => {
      const clientGet = (
        id: string,
        token = clientToken('client-1', 'salon-1'),
      ) =>
        request(app.getHttpServer())
          .get(`/client/news/${id}`)
          .set('Authorization', `Bearer ${token}`);

      it('the feed carries hasArticle and never the HTML', async () => {
        const admin = await adminToken();
        const withArticle = await createPost(admin, {
          status: 'PUBLISHED',
          contentHtml: '<p>x</p>',
        });
        const without = await createPost(admin, { status: 'PUBLISHED' });

        const feed = await clientFeed(clientToken('client-1', 'salon-1'));

        expect(feed.every((p) => !('contentHtml' in p))).toBe(true);
        expect(feed.find((p) => p.id === withArticle.id)?.hasArticle).toBe(
          true,
        );
        expect(feed.find((p) => p.id === without.id)?.hasArticle).toBe(false);
      });

      it('GET /client/news/:id returns the article of a published post of its salon', async () => {
        const admin = await adminToken();
        const post = await createPost(admin, {
          status: 'PUBLISHED',
          contentHtml: '<h1>Tytuł</h1>',
        });

        const response = await clientGet(post.id).expect(200);

        expect(response.body).toEqual({
          id: post.id,
          title: 'Nowa linia zabiegów',
          contentHtml: '<h1>Tytuł</h1>',
        });
      });

      it('a published post without an article answers contentHtml: null', async () => {
        const admin = await adminToken();
        const post = await createPost(admin, { status: 'PUBLISHED' });

        const response = await clientGet(post.id).expect(200);

        expect(
          (response.body as { contentHtml: unknown }).contentHtml,
        ).toBeNull();
      });

      it('a draft is 404; so is a published post of another salon and a missing one', async () => {
        const admin = await adminToken();
        const draft = await createPost(admin, { contentHtml: '<p>x</p>' });

        await clientGet(draft.id).expect(404);
        await clientGet(OTHER_SALON_POST_ID).expect(404);
        await clientGet(MISSING_POST_ID).expect(404);
        // и наоборот: клиент чужого салона не видит наш опубликованный пост
        const published = await createPost(admin, {
          status: 'PUBLISHED',
          contentHtml: '<p>x</p>',
        });
        await clientGet(
          published.id,
          clientToken('client-2', 'salon-2'),
        ).expect(404);
      });

      it('a post unpublished after the client opened the feed becomes 404', async () => {
        const admin = await adminToken();
        const post = await createPost(admin, {
          status: 'PUBLISHED',
          contentHtml: '<p>x</p>',
        });
        await clientGet(post.id).expect(200);

        await request(app.getHttpServer())
          .patch(`/news/${post.id}`)
          .set('Authorization', `Bearer ${admin}`)
          .send({ status: 'DRAFT' })
          .expect(200);

        await clientGet(post.id).expect(404);
      });

      it('rejects a malformed id (400), staff tokens and anonymous requests (401)', async () => {
        await clientGet('not-a-uuid').expect(400);
        await request(app.getHttpServer())
          .get(`/client/news/${OTHER_SALON_POST_ID}`)
          .set('Authorization', `Bearer ${await adminToken()}`)
          .expect(401);
        await request(app.getHttpServer())
          .get(`/client/news/${OTHER_SALON_POST_ID}`)
          .expect(401);
      });
    });
  });
});
