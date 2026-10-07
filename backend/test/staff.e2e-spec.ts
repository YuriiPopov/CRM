import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Master,
  MasterService,
  MasterSpecialization,
  Prisma,
  Role,
  Service,
  ServiceCategory,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StaffModule } from '../src/staff/staff.module';

interface MasterWhere {
  id?: string;
  salonId?: string;
  AND?: MasterWhere[];
}

type MasterWithRelations = Master & {
  services: (MasterService & { service: Service })[];
  specializations: MasterSpecialization[];
  _count: { bookings: number };
};

// Прогоняет реальные Staff-контроллер/сервис/guard'ы (включая привязку/отвязку услуг через MasterService
// и назначение специализаций через MasterSpecialization) через HTTP поверх настоящего Auth-модуля,
// с in-memory фейком PrismaService — реальная Postgres не нужна.
class FakePrismaService {
  private usersById = new Map<string, User>();
  private usersByEmail = new Map<string, User>();
  private mastersById = new Map<string, Master>();
  private servicesById = new Map<string, Service>();
  private categoriesById = new Map<string, ServiceCategory>();
  private masterServices: MasterService[] = [];
  private masterSpecializations: MasterSpecialization[] = [];
  private bookingMasterIds: string[] = [];
  private nextMasterId = 1;

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
    updateMany: ({
      where,
      data,
    }: {
      where: { masterId: string };
      data: Partial<User>;
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const user of [...this.usersById.values()]) {
        if (user.masterId !== where.masterId) continue;
        const updated = { ...user, ...data };
        this.usersById.set(updated.id, updated);
        this.usersByEmail.set(updated.email, updated);
        count++;
      }
      return Promise.resolve({ count });
    },
  };

  booking = {
    count: ({ where }: { where: { masterId: string } }): Promise<number> =>
      Promise.resolve(
        this.bookingMasterIds.filter((id) => id === where.masterId).length,
      ),
  };

  master = {
    create: ({
      data,
    }: {
      data: Omit<Master, 'id' | 'createdAt' | 'isActive'> &
        Partial<Pick<Master, 'isActive'>> & {
          specializations?: { create: { categoryId: string }[] };
        };
    }): Promise<MasterWithRelations> => {
      const { specializations, ...masterData } = data;
      const master: Master = {
        id: `master-${this.nextMasterId++}`,
        createdAt: new Date(),
        isActive: true,
        ...masterData,
      };
      this.mastersById.set(master.id, master);

      for (const { categoryId } of specializations?.create ?? []) {
        this.masterSpecializations.push({ masterId: master.id, categoryId });
      }

      return Promise.resolve(this.withRelations(master));
    },
    findMany: ({
      where,
    }: {
      where: MasterWhere;
    }): Promise<MasterWithRelations[]> => {
      return Promise.resolve(
        [...this.mastersById.values()]
          .filter((m) => this.matches(m, where))
          .map((m) => this.withRelations(m)),
      );
    },
    findFirst: ({
      where,
    }: {
      where: MasterWhere;
    }): Promise<MasterWithRelations | null> => {
      const found = [...this.mastersById.values()].find((m) =>
        this.matches(m, where),
      );
      return Promise.resolve(found ? this.withRelations(found) : null);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Master>;
    }): Promise<MasterWithRelations> => {
      const existing = this.mastersById.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data };
      this.mastersById.set(where.id, updated);
      return Promise.resolve(this.withRelations(updated));
    },
    delete: ({ where }: { where: { id: string } }): Promise<Master> => {
      const existing = this.mastersById.get(where.id);
      if (!existing) throw new Error('not found');
      const hasLinks =
        this.masterServices.some((link) => link.masterId === where.id) ||
        this.bookingMasterIds.includes(where.id);
      if (hasLinks) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint violated',
          { code: 'P2003', clientVersion: '6.19.3' },
        );
      }
      this.mastersById.delete(where.id);
      return Promise.resolve(existing);
    },
  };

  service = {
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
  };

  // Используется только count() — им же проверяется, что все specializationCategoryIds
  // принадлежат салону вызывающего (см. assertCategoriesInSalon в staff.service.ts).
  serviceCategory = {
    count: ({
      where,
    }: {
      where: { salonId?: string; id?: { in: string[] } };
    }): Promise<number> => {
      const ids = where.id?.in ?? [];
      const matched = ids.filter((id) => {
        const category = this.categoriesById.get(id);
        return (
          category && (!where.salonId || category.salonId === where.salonId)
        );
      });
      return Promise.resolve(matched.length);
    },
  };

  masterService = {
    upsert: ({
      where,
      create,
    }: {
      where: { masterId_serviceId: { masterId: string; serviceId: string } };
      create: MasterService;
    }): Promise<MasterService> => {
      const { masterId, serviceId } = where.masterId_serviceId;
      const existing = this.masterServices.find(
        (l) => l.masterId === masterId && l.serviceId === serviceId,
      );
      if (existing) return Promise.resolve(existing);
      this.masterServices.push(create);
      return Promise.resolve(create);
    },
    findUnique: ({
      where,
    }: {
      where: { masterId_serviceId: { masterId: string; serviceId: string } };
    }): Promise<MasterService | null> => {
      const { masterId, serviceId } = where.masterId_serviceId;
      const found = this.masterServices.find(
        (l) => l.masterId === masterId && l.serviceId === serviceId,
      );
      return Promise.resolve(found ?? null);
    },
    deleteMany: ({
      where,
    }: {
      where: { masterId: string };
    }): Promise<{ count: number }> => {
      const before = this.masterServices.length;
      this.masterServices = this.masterServices.filter(
        (l) => l.masterId !== where.masterId,
      );
      return Promise.resolve({ count: before - this.masterServices.length });
    },
    delete: ({
      where,
    }: {
      where: { masterId_serviceId: { masterId: string; serviceId: string } };
    }): Promise<MasterService> => {
      const { masterId, serviceId } = where.masterId_serviceId;
      const index = this.masterServices.findIndex(
        (l) => l.masterId === masterId && l.serviceId === serviceId,
      );
      if (index === -1) throw new Error('not found');
      const [removed] = this.masterServices.splice(index, 1);
      return Promise.resolve(removed);
    },
  };

  masterSchedule = { deleteMany: () => Promise.resolve({ count: 0 }) };
  masterBlock = { deleteMany: () => Promise.resolve({ count: 0 }) };

  masterSpecialization = {
    deleteMany: ({
      where,
    }: {
      where: { masterId: string };
    }): Promise<{ count: number }> => {
      const before = this.masterSpecializations.length;
      this.masterSpecializations = this.masterSpecializations.filter(
        (s) => s.masterId !== where.masterId,
      );
      return Promise.resolve({
        count: before - this.masterSpecializations.length,
      });
    },
    createMany: ({
      data,
    }: {
      data: MasterSpecialization[];
    }): Promise<{ count: number }> => {
      this.masterSpecializations.push(...data);
      return Promise.resolve({ count: data.length });
    },
  };

  // Поддерживает обе формы: массив операций и интерактивную транзакцию (callback). Фейк не
  // откатывает изменения — тесты проверяют, что при отказе ничего не успело измениться.
  $transaction = <T>(arg: Promise<T>[] | ((tx: this) => Promise<T>)) =>
    typeof arg === 'function' ? arg(this) : Promise.all(arg);

  private withRelations(master: Master): MasterWithRelations {
    const services = this.masterServices
      .filter((link) => link.masterId === master.id)
      .map((link) => ({
        ...link,
        service: this.servicesById.get(link.serviceId)!,
      }));
    const specializations = this.masterSpecializations.filter(
      (s) => s.masterId === master.id,
    );
    const bookings = this.bookingMasterIds.filter(
      (id) => id === master.id,
    ).length;
    return { ...master, services, specializations, _count: { bookings } };
  }

  private matches(master: Master, where: MasterWhere): boolean {
    if (where.id && master.id !== where.id) return false;
    if (where.salonId && master.salonId !== where.salonId) return false;
    if (where.AND && !where.AND.every((cond) => this.matches(master, cond))) {
      return false;
    }
    return true;
  }

  seedUser(user: User) {
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
  }

  seedMaster(master: Master) {
    this.mastersById.set(master.id, master);
  }

  seedService(service: Service) {
    this.servicesById.set(service.id, service);
  }

  seedCategory(category: ServiceCategory) {
    this.categoriesById.set(category.id, category);
  }

  seedBooking(masterId: string) {
    this.bookingMasterIds.push(masterId);
  }

  hasMaster(id: string): boolean {
    return this.mastersById.has(id);
  }

  getUser(id: string): User | undefined {
    return this.usersById.get(id);
  }

  seedMasterService(masterId: string, serviceId: string) {
    this.masterServices.push({ masterId, serviceId });
  }

  seedMasterSpecialization(masterId: string, categoryId: string) {
    this.masterSpecializations.push({ masterId, categoryId });
  }
}

describe('Staff (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;

  const adminPassword = 'AdminPass1';
  const master1Password = 'Master1Pass1';
  const master2Password = 'Master2Pass1';

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
      passwordHash: await bcrypt.hash(master1Password, 4),
      role: Role.MASTER,
      masterId: 'master-rec-1',
      isActive: true,
      createdAt: new Date(),
    });
    prisma.seedUser({
      id: 'master-user-2',
      salonId: 'salon-1',
      email: 'master2@b4u.local',
      passwordHash: await bcrypt.hash(master2Password, 4),
      role: Role.MASTER,
      masterId: 'master-rec-2',
      isActive: true,
      createdAt: new Date(),
    });

    prisma.seedCategory({
      id: 'bbbbbbbb-0000-4000-8000-000000000001',
      salonId: 'salon-1',
      name: 'СПА',
      isDefault: true,
      createdAt: new Date(),
    });
    prisma.seedCategory({
      id: 'bbbbbbbb-0000-4000-8000-000000000002',
      salonId: 'salon-1',
      name: 'Массаж',
      isDefault: false,
      createdAt: new Date(),
    });
    prisma.seedCategory({
      id: 'bbbbbbbb-0000-4000-8000-000000000003',
      salonId: 'salon-2',
      name: 'СПА',
      isDefault: true,
      createdAt: new Date(),
    });
    prisma.seedCategory({
      id: 'bbbbbbbb-0000-4000-8000-000000000004',
      salonId: 'salon-2',
      name: 'Массаж',
      isDefault: false,
      createdAt: new Date(),
    });

    prisma.seedMaster({
      id: 'master-rec-1',
      salonId: 'salon-1',
      name: 'Anna',
      isActive: true,
      photo: null,
      createdAt: new Date(),
    });
    prisma.seedMasterSpecialization(
      'master-rec-1',
      'bbbbbbbb-0000-4000-8000-000000000001',
    );
    prisma.seedMaster({
      id: 'master-rec-2',
      salonId: 'salon-1',
      name: 'Boris',
      isActive: true,
      photo: null,
      createdAt: new Date(),
    });
    prisma.seedMasterSpecialization(
      'master-rec-2',
      'bbbbbbbb-0000-4000-8000-000000000002',
    );
    prisma.seedMaster({
      id: 'master-other-salon',
      salonId: 'salon-2',
      name: 'Someone else',
      isActive: true,
      photo: null,
      createdAt: new Date(),
    });
    prisma.seedMasterSpecialization(
      'master-other-salon',
      'bbbbbbbb-0000-4000-8000-000000000003',
    );

    prisma.seedService({
      id: 'service-a',
      salonId: 'salon-1',
      name: 'Massage',
      categoryId: 'bbbbbbbb-0000-4000-8000-000000000002',
      durationMin: 60,
      price: 150 as unknown as Service['price'],
      createdAt: new Date(),
    });
    prisma.seedService({
      id: 'service-other-salon',
      salonId: 'salon-2',
      name: 'Massage elsewhere',
      categoryId: 'bbbbbbbb-0000-4000-8000-000000000004',
      durationMin: 60,
      price: 150 as unknown as Service['price'],
      createdAt: new Date(),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        StaffModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    // bodyParser: false + higher manual limit — mirrors main.ts (item41: base64 photo uploads
    // exceed express's default 100kb JSON body limit).
    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(json({ limit: '4mb' }));
    app.use(urlencoded({ extended: true, limit: '4mb' }));
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

  describe('POST /staff', () => {
    it('allows ADMIN to create a master', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .post('/staff')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Master',
          specializationCategoryIds: ['bbbbbbbb-0000-4000-8000-000000000001'],
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'New Master',
        salonId: 'salon-1',
        specializationCategoryIds: ['bbbbbbbb-0000-4000-8000-000000000001'],
      });
    });

    it('forbids MASTER from creating masters', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .post('/staff')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Master',
          specializationCategoryIds: ['bbbbbbbb-0000-4000-8000-000000000001'],
        })
        .expect(403);
    });

    it('rejects a categoryId from another salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/staff')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Master',
          specializationCategoryIds: ['bbbbbbbb-0000-4000-8000-000000000003'],
        })
        .expect(400);
    });
  });

  describe('GET /staff', () => {
    it('lets ADMIN see every master in their own salon only', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .get('/staff')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Master[];
      expect(body.map((m) => m.id).sort()).toEqual([
        'master-rec-1',
        'master-rec-2',
      ]);
    });

    it('lets MASTER see only their own record', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .get('/staff')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Master[];
      expect(body.map((m) => m.id)).toEqual(['master-rec-1']);
    });
  });

  describe('GET /staff/:id', () => {
    it('returns 404 when a MASTER requests another master profile', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .get('/staff/master-rec-2')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns the profile when a MASTER requests their own record', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .get('/staff/master-rec-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'master-rec-1',
        specializationCategoryIds: ['bbbbbbbb-0000-4000-8000-000000000001'],
      });
    });

    it('returns 404 for a master belonging to another salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .get('/staff/master-other-salon')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PATCH /staff/:id', () => {
    it('forbids MASTER from updating profiles (including their own)', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .patch('/staff/master-rec-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed' })
        .expect(403);
    });

    it('allows ADMIN to update a master in their own salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .patch('/staff/master-rec-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'master-rec-1',
        name: 'Renamed',
      });
    });

    it('replaces specializations when specializationCategoryIds is provided', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .patch('/staff/master-rec-1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          specializationCategoryIds: ['bbbbbbbb-0000-4000-8000-000000000002'],
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'master-rec-1',
        specializationCategoryIds: ['bbbbbbbb-0000-4000-8000-000000000002'],
      });
    });
  });

  describe('service assignment', () => {
    it('allows ADMIN to assign a service to a master', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/staff/master-rec-1/services/service-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const detail = await request(app.getHttpServer())
        .get('/staff/master-rec-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(
        (detail.body as { services: Service[] }).services.map((s) => s.id),
      ).toEqual(['service-a']);
    });

    it('forbids MASTER from assigning services', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .post('/staff/master-rec-1/services/service-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects assigning a service from another salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/staff/master-rec-1/services/service-other-salon')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('allows ADMIN to unassign a previously assigned service', async () => {
      prisma.seedMasterService('master-rec-1', 'service-a');
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .delete('/staff/master-rec-1/services/service-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('returns 404 when unassigning a link that does not exist', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .delete('/staff/master-rec-1/services/service-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('photo upload', () => {
    const validPhoto =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    it('allows ADMIN to upload a photo', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .post('/staff/master-rec-1/photo')
        .set('Authorization', `Bearer ${token}`)
        .send({ photo: validPhoto })
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'master-rec-1',
        photo: validPhoto,
      });

      const detail = await request(app.getHttpServer())
        .get('/staff/master-rec-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect((detail.body as { photo: string }).photo).toEqual(validPhoto);
    });

    it('forbids MASTER from uploading a photo', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .post('/staff/master-rec-1/photo')
        .set('Authorization', `Bearer ${token}`)
        .send({ photo: validPhoto })
        .expect(403);
    });

    it('rejects a data URL with a disallowed mime type', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/staff/master-rec-1/photo')
        .set('Authorization', `Bearer ${token}`)
        .send({ photo: 'data:image/gif;base64,AAAA' })
        .expect(400);
    });

    it('rejects a photo exceeding 2MB after decoding', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);
      const oversizedPhoto = `data:image/png;base64,${'A'.repeat(3_000_000)}`;

      await request(app.getHttpServer())
        .post('/staff/master-rec-1/photo')
        .set('Authorization', `Bearer ${token}`)
        .send({ photo: oversizedPhoto })
        .expect(400);
    });

    it('returns 404 when uploading a photo for a master outside the salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/staff/master-other-salon/photo')
        .set('Authorization', `Bearer ${token}`)
        .send({ photo: validPhoto })
        .expect(404);
    });

    it('allows ADMIN to remove a previously uploaded photo', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/staff/master-rec-1/photo')
        .set('Authorization', `Bearer ${token}`)
        .send({ photo: validPhoto })
        .expect(201);

      await request(app.getHttpServer())
        .delete('/staff/master-rec-1/photo')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const detail = await request(app.getHttpServer())
        .get('/staff/master-rec-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect((detail.body as { photo: string | null }).photo).toBeNull();
    });

    it('forbids MASTER from removing a photo', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .delete('/staff/master-rec-1/photo')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('DELETE /staff/:id', () => {
    it('deletes a master without bookings together with services and specializations', async () => {
      prisma.seedMasterService('master-rec-2', 'service-a');
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .delete('/staff/master-rec-2')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(prisma.hasMaster('master-rec-2')).toBe(false);
      await request(app.getHttpServer())
        .get('/staff/master-rec-2')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('unlinks and deactivates the master user so they can no longer log in', async () => {
      const adminToken = await loginAs('admin@b4u.local', adminPassword);
      const masterToken = await loginAs('master2@b4u.local', master2Password);

      await request(app.getHttpServer())
        .delete('/staff/master-rec-2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      expect(prisma.getUser('master-user-2')).toMatchObject({
        masterId: null,
        isActive: false,
      });
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'master2@b4u.local', password: master2Password })
        .expect(401);
      // уже выданный токен тоже перестаёт работать
      await request(app.getHttpServer())
        .get('/staff')
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(401);
    });

    it('responds 409 MASTER_HAS_BOOKINGS when the master has any booking', async () => {
      prisma.seedBooking('master-rec-1');
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .delete('/staff/master-rec-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(409);

      expect(response.body).toMatchObject({ code: 'MASTER_HAS_BOOKINGS' });
      expect(prisma.hasMaster('master-rec-1')).toBe(true);
      expect(prisma.getUser('master-user-1')?.isActive).toBe(true);
    });

    it('responds 404 for a master of another salon and leaves it intact', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .delete('/staff/master-other-salon')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(prisma.hasMaster('master-other-salon')).toBe(true);
    });

    it('forbids a MASTER from deleting', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .delete('/staff/master-rec-2')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('canDelete', () => {
    it('is exposed by GET /staff and GET /staff/:id', async () => {
      prisma.seedBooking('master-rec-1');
      const token = await loginAs('admin@b4u.local', adminPassword);

      const list = await request(app.getHttpServer())
        .get('/staff')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const byId = Object.fromEntries(
        (list.body as { id: string; canDelete: boolean }[]).map((m) => [
          m.id,
          m.canDelete,
        ]),
      );
      expect(byId['master-rec-1']).toBe(false);
      expect(byId['master-rec-2']).toBe(true);

      const one = await request(app.getHttpServer())
        .get('/staff/master-rec-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(one.body).toMatchObject({ canDelete: false });
      expect(one.body).not.toHaveProperty('_count');
    });
  });
});
