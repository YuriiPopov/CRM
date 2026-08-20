import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Прогоняет реальные Auth-контроллер/сервис/guard'ы/JWT-стратегию через HTTP,
// но подменяет PrismaService in-memory фейком — реальная Postgres для этого теста не нужна.
class FakePrismaService {
  private byId = new Map<string, User>();
  private byEmail = new Map<string, User>();
  private nextId = 1;

  user = {
    findUnique: ({
      where,
    }: {
      where: { id?: string; email?: string };
    }): Promise<User | null> => {
      if (where.id) return Promise.resolve(this.byId.get(where.id) ?? null);
      if (where.email)
        return Promise.resolve(this.byEmail.get(where.email) ?? null);
      return Promise.resolve(null);
    },
    create: ({
      data,
    }: {
      data: Omit<User, 'id' | 'isActive' | 'createdAt'>;
    }): Promise<User> => {
      const user: User = {
        id: `user-${this.nextId++}`,
        isActive: true,
        createdAt: new Date(),
        ...data,
        masterId: data.masterId ?? null,
      };
      this.byId.set(user.id, user);
      this.byEmail.set(user.email, user);
      return Promise.resolve(user);
    },
  };

  seed(user: User) {
    this.byId.set(user.id, user);
    this.byEmail.set(user.email, user);
  }
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;

  const adminPassword = 'AdminPass1';
  const masterPassword = 'MasterPass1';

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    prisma = new FakePrismaService();

    prisma.seed({
      id: 'admin-1',
      salonId: 'salon-1',
      email: 'admin@b4u.local',
      passwordHash: await bcrypt.hash(adminPassword, 4),
      role: Role.ADMIN,
      masterId: null,
      isActive: true,
      createdAt: new Date(),
    });
    prisma.seed({
      id: 'master-1',
      salonId: 'salon-1',
      email: 'master@b4u.local',
      passwordHash: await bcrypt.hash(masterPassword, 4),
      role: Role.MASTER,
      masterId: null,
      isActive: true,
      createdAt: new Date(),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const body = response.body as { accessToken: string };
    return body.accessToken;
  }

  it('logs in with valid credentials and rejects a wrong password', async () => {
    const token = await loginAs('admin@b4u.local', adminPassword);
    expect(typeof token).toBe('string');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@b4u.local', password: 'wrong-password' })
      .expect(401);
  });

  it('rejects /auth/me without a token and returns the user profile with one', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const token = await loginAs('admin@b4u.local', adminPassword);

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'admin-1',
      email: 'admin@b4u.local',
      role: Role.ADMIN,
      salonId: 'salon-1',
    });
  });

  it('allows ADMIN to register a new user scoped to their own salon', async () => {
    const adminToken = await loginAs('admin@b4u.local', adminPassword);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'new-master@b4u.local',
        password: 'strongpass1',
        role: Role.MASTER,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      email: 'new-master@b4u.local',
      role: Role.MASTER,
      salonId: 'salon-1',
    });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('forbids MASTER from registering new users', async () => {
    const masterToken = await loginAs('master@b4u.local', masterPassword);

    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({
        email: 'someone@b4u.local',
        password: 'strongpass1',
        role: Role.MASTER,
      })
      .expect(403);
  });
});
