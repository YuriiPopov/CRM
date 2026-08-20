import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, Service, ServiceCategory, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServicesModule } from '../src/services/services.module';

// Прогоняет реальные Services-контроллер/сервис/guard'ы через HTTP поверх настоящего Auth-модуля
// (токен добывается через живой /auth/login), но с in-memory фейком PrismaService — реальная Postgres не нужна.
class FakePrismaService {
  private usersById = new Map<string, User>();
  private usersByEmail = new Map<string, User>();
  private servicesById = new Map<string, Service>();
  private nextServiceId = 1;

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

  service = {
    create: ({
      data,
    }: {
      data: Omit<Service, 'id' | 'createdAt'>;
    }): Promise<Service> => {
      const service: Service = {
        id: `service-${this.nextServiceId++}`,
        createdAt: new Date(),
        ...data,
      };
      this.servicesById.set(service.id, service);
      return Promise.resolve(service);
    },
    findMany: ({
      where,
    }: {
      where: { salonId?: string };
    }): Promise<Service[]> => {
      return Promise.resolve(
        [...this.servicesById.values()].filter(
          (s) => !where.salonId || s.salonId === where.salonId,
        ),
      );
    },
    findFirst: ({
      where,
    }: {
      where: { id?: string; salonId?: string };
    }): Promise<Service | null> => {
      const found = [...this.servicesById.values()].find(
        (s) =>
          (!where.id || s.id === where.id) &&
          (!where.salonId || s.salonId === where.salonId),
      );
      return Promise.resolve(found ?? null);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Service>;
    }): Promise<Service> => {
      const existing = this.servicesById.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data };
      this.servicesById.set(where.id, updated);
      return Promise.resolve(updated);
    },
    delete: ({ where }: { where: { id: string } }): Promise<Service> => {
      const existing = this.servicesById.get(where.id);
      if (!existing) throw new Error('not found');
      this.servicesById.delete(where.id);
      return Promise.resolve(existing);
    },
  };

  seedUser(user: User) {
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
  }

  seedService(service: Service) {
    this.servicesById.set(service.id, service);
  }
}

describe('Services (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;

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
      email: 'master@b4u.local',
      passwordHash: await bcrypt.hash(masterPassword, 4),
      role: Role.MASTER,
      masterId: 'master-rec-1',
      isActive: true,
      createdAt: new Date(),
    });

    prisma.seedService({
      id: 'service-a',
      salonId: 'salon-1',
      name: 'Manicure',
      category: ServiceCategory.MANICURE_PEDICURE,
      durationMin: 60,
      price: 120 as unknown as Service['price'],
      createdAt: new Date(),
    });
    prisma.seedService({
      id: 'service-other-salon',
      salonId: 'salon-2',
      name: 'Massage elsewhere',
      category: ServiceCategory.MASSAGE,
      durationMin: 90,
      price: 200 as unknown as Service['price'],
      createdAt: new Date(),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        ServicesModule,
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

  describe('POST /services', () => {
    it('allows ADMIN to create a service', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Pedicure',
          category: ServiceCategory.MANICURE_PEDICURE,
          durationMin: 45,
          price: 100,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Pedicure',
        salonId: 'salon-1',
      });
    });

    it('forbids MASTER from creating services', async () => {
      const token = await loginAs('master@b4u.local', masterPassword);

      await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Pedicure',
          category: ServiceCategory.MANICURE_PEDICURE,
          durationMin: 45,
          price: 100,
        })
        .expect(403);
    });
  });

  describe('GET /services', () => {
    it('lets ADMIN read the salon catalog', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .get('/services')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Service[];
      expect(body.map((s) => s.id)).toEqual(['service-a']);
    });

    it('lets MASTER read the same salon catalog', async () => {
      const token = await loginAs('master@b4u.local', masterPassword);

      const response = await request(app.getHttpServer())
        .get('/services')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Service[];
      expect(body.map((s) => s.id)).toEqual(['service-a']);
    });
  });

  describe('GET /services/:id', () => {
    it('returns 404 for a service from another salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .get('/services/service-other-salon')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PATCH /services/:id', () => {
    it('forbids MASTER from updating a service', async () => {
      const token = await loginAs('master@b4u.local', masterPassword);

      await request(app.getHttpServer())
        .patch('/services/service-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 150 })
        .expect(403);
    });

    it('allows ADMIN to update a service in their own salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .patch('/services/service-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 150 })
        .expect(200);

      expect(response.body).toMatchObject({ id: 'service-a', price: 150 });
    });
  });

  describe('DELETE /services/:id', () => {
    it('deletes a service', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .delete('/services/service-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('forbids MASTER from deleting a service', async () => {
      const token = await loginAs('master@b4u.local', masterPassword);

      await request(app.getHttpServer())
        .delete('/services/service-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
