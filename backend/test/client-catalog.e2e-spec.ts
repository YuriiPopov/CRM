import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { CLIENT_JWT_AUDIENCE } from '../src/client-portal/auth/client-jwt';
import { ClientPortalModule } from '../src/client-portal/client-portal.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface Category {
  id: string;
  salonId: string;
  name: string;
}
interface Svc {
  id: string;
  salonId: string;
  categoryId: string;
  createdAt: Date;
  photoIds: string[];
  activeMasterIds: string[];
}
interface Visit {
  clientId: string;
  salonId: string;
  serviceId: string;
  masterId: string;
  startTime: Date;
  status: BookingStatus;
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

// Фейк PrismaService под формы запросов ClientPortalService.catalog (item88)
class FakePrismaService {
  categories: Category[] = [];
  services: Svc[] = [];
  visits: Visit[] = [];
  masters: {
    id: string;
    salonId: string;
    name: string;
    serviceIds: string[];
    specializationCategoryIds: string[];
  }[] = [];

  client = {
    findFirst: ({ where }: { where: { id: string; salonId: string } }) =>
      Promise.resolve(
        ['client-new', 'client-regular'].includes(where.id) &&
          where.salonId === 'salon-1'
          ? { id: where.id, salonId: where.salonId }
          : null,
      ),
  };
  salon = {
    findUniqueOrThrow: () =>
      Promise.resolve({ name: 'B4U', address: 'Warszawa' }),
  };
  serviceCategory = {
    findMany: ({ where }: { where: { salonId: string } }) =>
      Promise.resolve(
        this.categories
          .filter((c) => c.salonId === where.salonId)
          .map((c) => ({ id: c.id, name: c.name })),
      ),
  };
  service = {
    findMany: ({ where }: { where: { salonId: string } }) =>
      Promise.resolve(
        this.services
          .filter((s) => s.salonId === where.salonId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((s) => ({
            id: s.id,
            name: `Usługa ${s.id}`,
            categoryId: s.categoryId,
            durationMin: 60,
            price: 100,
            createdAt: s.createdAt,
            masters: s.activeMasterIds.map((masterId) => ({ masterId })),
            photos: s.photoIds.slice(0, 1).map((id) => ({ id })),
            _count: { photos: s.photoIds.length },
          })),
      ),
  };
  master = {
    findMany: ({ where }: { where: { salonId: string } }) =>
      Promise.resolve(
        this.masters
          .filter((m) => m.salonId === where.salonId)
          .map((m) => ({
            id: m.id,
            name: m.name,
            photo: null,
            services: m.serviceIds.map((serviceId) => ({ serviceId })),
            specializations: m.specializationCategoryIds.map((categoryId) => ({
              categoryId,
              category: {
                name: this.categories.find((c) => c.id === categoryId)?.name,
              },
            })),
          })),
      ),
  };
  booking = {
    findMany: ({
      where,
    }: {
      where: { clientId: string; salonId: string; status: BookingStatus };
    }) =>
      Promise.resolve(
        this.visits
          .filter(
            (v) =>
              v.clientId === where.clientId &&
              v.salonId === where.salonId &&
              v.status === where.status,
          )
          .sort((a, b) => b.startTime.getTime() - a.startTime.getTime()),
      ),
  };
}

interface CatalogBody {
  categories: { id: string; coverPhotoId: string | null }[];
  client: {
    isNew: boolean;
    services: {
      serviceId: string;
      lastMasterId: string;
      lastVisitAt: string;
    }[];
  };
  masters: { id: string; specializationCategoryIds: string[] }[];
}

describe('Client catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;
  let jwt: JwtService;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    prisma = new FakePrismaService();
    prisma.categories = [
      { id: 'cat-hair', salonId: 'salon-1', name: 'Fryzury' },
      { id: 'cat-nails', salonId: 'salon-1', name: 'Paznokcie' },
      { id: 'cat-empty', salonId: 'salon-1', name: 'Puste' },
      { id: 'cat-nomaster', salonId: 'salon-1', name: 'Bez mistrza' },
    ];
    prisma.services = [
      // hair: старейшая без фото, вторая с фото → обложка 'photo-hair-2'
      svc('s-hair-1', 'cat-hair', 1, []),
      svc('s-hair-2', 'cat-hair', 2, ['photo-hair-2', 'photo-hair-2b']),
      svc('s-hair-3', 'cat-hair', 3, ['photo-hair-3']),
      // nails: ни одного фото → заглушка (coverPhotoId null)
      svc('s-nails-1', 'cat-nails', 4, []),
      // услуга без активных мастеров — категорию не делает видимой
      {
        ...svc('s-orphan', 'cat-nomaster', 5, ['photo-x']),
        activeMasterIds: [],
      },
    ];
    prisma.masters = [
      {
        id: 'm1',
        salonId: 'salon-1',
        name: 'Anna',
        serviceIds: ['s-hair-1', 's-hair-2'],
        specializationCategoryIds: ['cat-hair'],
      },
      {
        id: 'm2',
        salonId: 'salon-1',
        name: 'Ola',
        serviceIds: ['s-nails-1'],
        specializationCategoryIds: ['cat-nails'],
      },
    ];

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        ClientPortalModule,
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
    jwt = moduleFixture.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  function svc(
    id: string,
    categoryId: string,
    created: number,
    photoIds: string[],
  ): Svc {
    return {
      id,
      salonId: 'salon-1',
      categoryId,
      createdAt: day(created),
      photoIds,
      activeMasterIds: ['m1'],
    };
  }

  function visit(
    over: Partial<Visit> & Pick<Visit, 'serviceId' | 'startTime'>,
  ): Visit {
    return {
      clientId: 'client-regular',
      salonId: 'salon-1',
      masterId: 'm1',
      status: BookingStatus.COMPLETED,
      ...over,
    };
  }

  async function catalog(clientId: string): Promise<CatalogBody> {
    const token = jwt.sign(
      { sub: clientId, salonId: 'salon-1' },
      { secret: 'test-secret', audience: CLIENT_JWT_AUDIENCE },
    );
    const res = await request(app.getHttpServer())
      .get('/client/catalog')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body as CatalogBody;
  }

  it('shows cover ids, hides empty categories and never leaks base64', async () => {
    const body = await catalog('client-new');

    expect(body.categories).toEqual([
      { id: 'cat-hair', name: 'Fryzury', coverPhotoId: 'photo-hair-2' },
      { id: 'cat-nails', name: 'Paznokcie', coverPhotoId: null },
    ]);
    expect(JSON.stringify(body)).not.toContain('data:image');
  });

  it('exposes master specializationCategoryIds', async () => {
    const body = await catalog('client-new');

    expect(
      body.masters.map((m) => [m.id, m.specializationCategoryIds]),
    ).toEqual([
      ['m1', ['cat-hair']],
      ['m2', ['cat-nails']],
    ]);
  });

  it('marks a client with no visits as new', async () => {
    const body = await catalog('client-new');

    expect(body.client).toEqual({ isNew: true, services: [] });
  });

  it('does not count cancelled, no-show or future-only bookings as visits', async () => {
    prisma.visits = [
      visit({
        serviceId: 's-hair-1',
        startTime: day(5),
        status: BookingStatus.CANCELLED,
      }),
      visit({
        serviceId: 's-hair-1',
        startTime: day(6),
        status: BookingStatus.NO_SHOW,
      }),
      visit({
        serviceId: 's-hair-1',
        startTime: day(7),
        status: BookingStatus.CONFIRMED,
      }),
      visit({
        serviceId: 's-hair-1',
        startTime: day(8),
        status: BookingStatus.CREATED,
      }),
    ];

    const body = await catalog('client-regular');

    expect(body.client).toEqual({ isNew: true, services: [] });
  });

  it('returns deduped services with the last master, latest first', async () => {
    prisma.visits = [
      visit({ serviceId: 's-hair-1', masterId: 'm-old', startTime: day(1) }),
      visit({ serviceId: 's-nails-1', masterId: 'm2', startTime: day(4) }),
      visit({ serviceId: 's-hair-1', masterId: 'm1', startTime: day(8) }),
      visit({ serviceId: 's-gone', masterId: 'm1', startTime: day(9) }),
      // чужая клиентка и чужой салон не попадают
      visit({
        serviceId: 's-hair-2',
        clientId: 'client-new',
        startTime: day(9),
      }),
      visit({ serviceId: 's-hair-2', salonId: 'salon-2', startTime: day(9) }),
    ];

    const body = await catalog('client-regular');

    expect(body.client.isNew).toBe(false);
    expect(body.client.services).toEqual([
      {
        serviceId: 's-hair-1',
        lastMasterId: 'm1',
        lastVisitAt: day(8).toISOString(),
      },
      {
        serviceId: 's-nails-1',
        lastMasterId: 'm2',
        lastVisitAt: day(4).toISOString(),
      },
    ]);
  });

  it('does not make a client with only another client’s visits regular', async () => {
    prisma.visits = [visit({ serviceId: 's-hair-1', startTime: day(2) })];

    const body = await catalog('client-new');

    expect(body.client.isNew).toBe(true);
  });
});
