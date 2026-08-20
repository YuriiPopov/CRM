import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Role, ServiceCategory } from '@prisma/client';
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
    masterService: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
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
      masterService: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StaffService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(StaffService);
  });

  describe('create', () => {
    it('creates a master scoped to the salon', async () => {
      prisma.master.create.mockResolvedValue({ id: 'master-1' });

      await service.create(
        { name: 'Anna', specialization: ServiceCategory.SPA },
        'salon-1',
      );

      expect(prisma.master.create).toHaveBeenCalledWith({
        data: {
          salonId: 'salon-1',
          name: 'Anna',
          specialization: ServiceCategory.SPA,
        },
      });
    });
  });

  describe('findAll', () => {
    it('scopes ADMIN to the whole staff of the salon', async () => {
      prisma.master.findMany.mockResolvedValue([]);

      await service.findAll(admin);

      expect(prisma.master.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('scopes MASTER to their own record only', async () => {
      prisma.master.findMany.mockResolvedValue([]);

      await service.findAll(master);

      expect(prisma.master.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1', id: 'master-rec-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns nothing for a MASTER without a linked master profile', async () => {
      prisma.master.findMany.mockResolvedValue([]);

      await service.findAll({ ...master, masterId: null });

      expect(prisma.master.findMany).toHaveBeenCalledWith({
        where: { id: '__none__' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('flattens the assigned services relation', async () => {
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
      });

      const result = await service.findOne('master-1', admin);

      expect(result).toEqual({
        id: 'master-1',
        salonId: 'salon-1',
        services: [{ id: 'svc-1', name: 'Manicure' }],
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

    it('updates only the provided fields', async () => {
      prisma.master.findFirst.mockResolvedValue({
        id: 'master-1',
        salonId: 'salon-1',
      });
      prisma.master.update.mockResolvedValue({ id: 'master-1' });

      await service.update('master-1', { isActive: false }, 'salon-1');

      expect(prisma.master.update).toHaveBeenCalledWith({
        where: { id: 'master-1' },
        data: { isActive: false },
      });
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
