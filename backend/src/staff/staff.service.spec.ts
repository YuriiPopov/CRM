import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { StaffService } from './staff.service';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: {
    master: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    service: { findFirst: jest.Mock };
    booking: { findFirst: jest.Mock };
    serviceCategory: { count: jest.Mock };
    masterService: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
    masterSpecialization: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@b4u.local',
    role: Role.ADMIN,
    salonId: 'salon-1',
    masterId: null,
  };

  const master: AuthenticatedUser = {
    id: 'master-user-1',
    email: 'master@b4u.local',
    role: Role.MASTER,
    salonId: 'salon-1',
    masterId: 'master-rec-1',
  };

  beforeEach(async () => {
    prisma = {
      master: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      service: { findFirst: jest.fn() },
      booking: { findFirst: jest.fn() },
      serviceCategory: { count: jest.fn() },
      masterService: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      masterSpecialization: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StaffService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(StaffService);
  });

  describe('create', () => {
    it('creates a master scoped to the salon with its specializations', async () => {
      prisma.serviceCategory.count.mockResolvedValue(2);
      prisma.master.create.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
        name: 'Anna',
        isActive: true,
        createdAt: new Date(),
        services: [],
        specializations: [
          { masterId: 'master-1', categoryId: 'cat-1' },
          { masterId: 'master-1', categoryId: 'cat-2' },
        ],
      });

      const result = await service.create(
        { name: 'Anna', specializationCategoryIds: ['cat-1', 'cat-2'] },
        'salon-1',
      );

      expect(prisma.serviceCategory.count).toHaveBeenCalledWith({
        where: { salonId: 'salon-1', id: { in: ['cat-1', 'cat-2'] } },
      });
      expect(prisma.master.create).toHaveBeenCalledWith({
        data: {
          salonId: 'salon-1',
          name: 'Anna',
          specializations: {
            create: [{ categoryId: 'cat-1' }, { categoryId: 'cat-2' }],
          },
        },
        include: {
          services: { include: { service: true } },
          specializations: true,
        },
      });
      expect(result.specializationCategoryIds).toEqual(['cat-1', 'cat-2']);
      expect(result.services).toEqual([]);
    });

    it('rejects duplicate category ids without querying the database', async () => {
      await expect(
        service.create(
          { name: 'Anna', specializationCategoryIds: ['cat-1', 'cat-1'] },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.serviceCategory.count).not.toHaveBeenCalled();
      expect(prisma.master.create).not.toHaveBeenCalled();
    });

    it('rejects a categoryId that does not belong to the salon', async () => {
      prisma.serviceCategory.count.mockResolvedValue(1);

      await expect(
        service.create(
          { name: 'Anna', specializationCategoryIds: ['cat-1', 'cat-2'] },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.master.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes ADMIN to the whole staff of the salon and flattens relations', async () => {
      prisma.master.findMany.mockResolvedValue([
        {
          id: 'master-1',
          salonId: 'salon-1',
          services: [],
          specializations: [{ masterId: 'master-1', categoryId: 'cat-1' }],
        },
      ]);

      const result = await service.findAll(admin);

      expect(prisma.master.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          services: { include: { service: true } },
          specializations: true,
        },
      });
      expect(result).toEqual([
        {
          id: 'master-1',
          salonId: 'salon-1',
          services: [],
          specializationCategoryIds: ['cat-1'],
        },
      ]);
    });

    it('scopes MASTER to their own record only', async () => {
      prisma.master.findMany.mockResolvedValue([]);

      await service.findAll(master);

      expect(prisma.master.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1', id: 'master-rec-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          services: { include: { service: true } },
          specializations: true,
        },
      });
    });

    it('returns nothing for a MASTER without a linked master profile', async () => {
      prisma.master.findMany.mockResolvedValue([]);

      await service.findAll({ ...master, masterId: null });

      expect(prisma.master.findMany).toHaveBeenCalledWith({
        where: { id: '__none__' },
        orderBy: { createdAt: 'desc' },
        include: {
          services: { include: { service: true } },
          specializations: true,
        },
      });
    });
  });

  describe('findOne', () => {
    it('flattens both the assigned services and specializations relations', async () => {
      prisma.master.findFirst.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
        services: [
          {
            masterId: 'master-1',
            serviceId: 'svc-1',
            service: { id: 'svc-1', name: 'Manicure' },
          },
        ],
        specializations: [{ masterId: 'master-1', categoryId: 'cat-1' }],
      });

      const result = await service.findOne('master-1', admin);

      expect(result).toEqual({
        id: 'master-1',
        salonId: 'salon-1',
        services: [{ id: 'svc-1', name: 'Manicure' }],
        specializationCategoryIds: ['cat-1'],
      });
    });

    it('throws NotFoundException when out of scope', async () => {
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(service.findOne('master-1', master)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the master is not in the salon', async () => {
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(
        service.update('master-1', { name: 'New name' }, 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.master.update).not.toHaveBeenCalled();
    });

    it('updates only the provided fields when specializations are untouched', async () => {
      prisma.master.findFirst.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
      });
      prisma.master.update.mockResolvedValue({
        id: 'master-1',
        isActive: false,
        services: [],
        specializations: [],
      });

      await service.update('master-1', { isActive: false }, 'salon-1');

      expect(prisma.master.update).toHaveBeenCalledWith({
        where: { id: 'master-1' },
        data: { isActive: false },
        include: {
          services: { include: { service: true } },
          specializations: true,
        },
      });
      expect(prisma.masterSpecialization.deleteMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('replaces specializations in a transaction when specializationCategoryIds is provided', async () => {
      prisma.master.findFirst.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
      });
      prisma.serviceCategory.count.mockResolvedValue(1);
      prisma.master.update.mockResolvedValue({
        id: 'master-1',
        services: [],
        specializations: [{ masterId: 'master-1', categoryId: 'cat-2' }],
      });

      const result = await service.update(
        'master-1',
        { specializationCategoryIds: ['cat-2'] },
        'salon-1',
      );

      expect(prisma.masterSpecialization.deleteMany).toHaveBeenCalledWith({
        where: { masterId: 'master-1' },
      });
      expect(prisma.masterSpecialization.createMany).toHaveBeenCalledWith({
        data: [{ masterId: 'master-1', categoryId: 'cat-2' }],
      });
      expect(prisma.master.update).toHaveBeenCalledWith({
        where: { id: 'master-1' },
        data: {},
        include: {
          services: { include: { service: true } },
          specializations: true,
        },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.specializationCategoryIds).toEqual(['cat-2']);
    });

    it('rejects an invalid categoryId in specializationCategoryIds', async () => {
      prisma.master.findFirst.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
      });
      prisma.serviceCategory.count.mockResolvedValue(0);

      await expect(
        service.update(
          'master-1',
          { specializationCategoryIds: ['cat-x'] },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects deactivation when the master has an upcoming CREATED/CONFIRMED booking', async () => {
      prisma.master.findFirst.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
      });
      prisma.booking.findFirst.mockResolvedValue({ id: 'booking-1' });

      await expect(
        service.update('master-1', { isActive: false }, 'salon-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: {
          masterId: 'master-1',
          startTime: { gte: expect.any(Date) as Date },
          status: { in: ['CREATED', 'CONFIRMED'] },
        },
      });
      expect(prisma.master.update).not.toHaveBeenCalled();
    });

    it('allows deactivation when the master has no upcoming CREATED/CONFIRMED bookings', async () => {
      prisma.master.findFirst.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.master.update.mockResolvedValue({
        id: 'master-1',
        isActive: false,
        services: [],
        specializations: [],
      });

      await expect(
        service.update('master-1', { isActive: false }, 'salon-1'),
      ).resolves.toBeDefined();
      expect(prisma.master.update).toHaveBeenCalled();
    });

    it('allows reactivation without checking for bookings', async () => {
      prisma.master.findFirst.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
      });
      prisma.master.update.mockResolvedValue({
        id: 'master-1',
        isActive: true,
        services: [],
        specializations: [],
      });

      await service.update('master-1', { isActive: true }, 'salon-1');

      expect(prisma.booking.findFirst).not.toHaveBeenCalled();
      expect(prisma.master.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the master is not in the salon', async () => {
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('master-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.master.delete).not.toHaveBeenCalled();
    });

    it('rejects deletion of a master with linked user/bookings/services', async () => {
      prisma.master.findFirst.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
      });
      prisma.master.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint violated',
          { code: 'P2003', clientVersion: '6.19.3' },
        ),
      );

      await expect(
        service.remove('master-1', 'salon-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('assignService', () => {
    it('throws NotFoundException when the master is not in the salon', async () => {
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(
        service.assignService('master-1', 'svc-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.masterService.upsert).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the service is not in the salon', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.assignService('master-1', 'svc-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.masterService.upsert).not.toHaveBeenCalled();
    });

    it('upserts the link so re-assigning is idempotent', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });
      prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
      prisma.masterService.upsert.mockResolvedValue({
        masterId: 'master-1',
        serviceId: 'svc-1',
      });

      await service.assignService('master-1', 'svc-1', 'salon-1');

      expect(prisma.masterService.upsert).toHaveBeenCalledWith({
        where: {
          masterId_serviceId: { masterId: 'master-1', serviceId: 'svc-1' },
        },
        update: {},
        create: { masterId: 'master-1', serviceId: 'svc-1' },
      });
    });
  });

  describe('unassignService', () => {
    it('throws NotFoundException when the master is not in the salon', async () => {
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(
        service.unassignService('master-1', 'svc-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.masterService.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the link does not exist', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });
      prisma.masterService.findUnique.mockResolvedValue(null);

      await expect(
        service.unassignService('master-1', 'svc-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.masterService.delete).not.toHaveBeenCalled();
    });

    it('deletes an existing link', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });
      prisma.masterService.findUnique.mockResolvedValue({
        masterId: 'master-1',
        serviceId: 'svc-1',
      });
      prisma.masterService.delete.mockResolvedValue({});

      await expect(
        service.unassignService('master-1', 'svc-1', 'salon-1'),
      ).resolves.toBeUndefined();

      expect(prisma.masterService.delete).toHaveBeenCalledWith({
        where: {
          masterId_serviceId: { masterId: 'master-1', serviceId: 'svc-1' },
        },
      });
    });
  });
});
