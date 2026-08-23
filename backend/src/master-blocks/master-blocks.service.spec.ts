import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MasterBlocksService } from './master-blocks.service';

describe('MasterBlocksService', () => {
  let service: MasterBlocksService;
  let prisma: {
    master: { findFirst: jest.Mock };
    booking: { findFirst: jest.Mock };
    masterBlock: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
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

  const masterUser: AuthenticatedUser = {
    id: 'master-user-1',
    email: 'master@b4u.local',
    role: Role.MASTER,
    salonId: 'salon-1',
    masterId: 'master-rec-1',
  };

  const baseDto = {
    startTime: '2026-01-10T10:00:00.000Z',
    endTime: '2026-01-10T11:00:00.000Z',
  };

  beforeEach(async () => {
    prisma = {
      master: { findFirst: jest.fn() },
      booking: { findFirst: jest.fn() },
      masterBlock: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterBlocksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(MasterBlocksService);
  });

  describe('create', () => {
    it('lets ADMIN block a specific master', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.masterBlock.findFirst.mockResolvedValue(null);
      prisma.masterBlock.create.mockResolvedValue({ id: 'block-1' });

      await service.create(
        { ...baseDto, masterId: 'master-rec-1', reason: 'Отпуск' },
        admin,
      );

      expect(prisma.masterBlock.create).toHaveBeenCalledWith({
        data: {
          salonId: 'salon-1',
          masterId: 'master-rec-1',
          startTime: new Date(baseDto.startTime),
          endTime: new Date(baseDto.endTime),
          reason: 'Отпуск',
        },
      });
    });

    it('rejects ADMIN creation without a masterId', async () => {
      await expect(service.create(baseDto, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.masterBlock.create).not.toHaveBeenCalled();
    });

    it('lets MASTER block themselves without specifying masterId', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.masterBlock.findFirst.mockResolvedValue(null);
      prisma.masterBlock.create.mockResolvedValue({ id: 'block-1' });

      await service.create(baseDto, masterUser);

      expect(prisma.master.findFirst).toHaveBeenCalledWith({
        where: { id: 'master-rec-1', salonId: 'salon-1' },
      });
    });

    it('rejects MASTER blocking a different master', async () => {
      await expect(
        service.create({ ...baseDto, masterId: 'someone-else' }, masterUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.masterBlock.create).not.toHaveBeenCalled();
    });

    it('rejects when the master does not exist in the salon', async () => {
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, masterId: 'master-rec-1' }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an endTime that is not after startTime', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });

      await expect(
        service.create(
          {
            masterId: 'master-rec-1',
            startTime: '2026-01-10T11:00:00.000Z',
            endTime: '2026-01-10T10:00:00.000Z',
          },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.masterBlock.create).not.toHaveBeenCalled();
    });

    it('rejects blocking a period that has active bookings', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.booking.findFirst.mockResolvedValue({ id: 'existing-booking' });

      await expect(
        service.create({ ...baseDto, masterId: 'master-rec-1' }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.masterBlock.create).not.toHaveBeenCalled();
    });

    it('rejects a period that already overlaps another block', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.masterBlock.findFirst.mockResolvedValue({ id: 'block-existing' });

      await expect(
        service.create({ ...baseDto, masterId: 'master-rec-1' }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.masterBlock.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes MASTER to their own blocks regardless of the masterId query param', async () => {
      prisma.masterBlock.findMany.mockResolvedValue([]);

      await service.findAll({ masterId: 'someone-else' }, masterUser);

      expect(prisma.masterBlock.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1', masterId: 'master-rec-1' },
        orderBy: { startTime: 'asc' },
      });
    });

    it('lets ADMIN filter by an explicit masterId', async () => {
      prisma.masterBlock.findMany.mockResolvedValue([]);

      await service.findAll({ masterId: 'master-rec-1' }, admin);

      expect(prisma.masterBlock.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1', masterId: 'master-rec-1' },
        orderBy: { startTime: 'asc' },
      });
    });
  });

  describe('remove', () => {
    it('lets ADMIN remove any block in the salon', async () => {
      prisma.masterBlock.findFirst.mockResolvedValue({
        id: 'block-1',
        masterId: 'master-rec-1',
        salonId: 'salon-1',
      });

      await service.remove('block-1', admin);

      expect(prisma.masterBlock.delete).toHaveBeenCalledWith({
        where: { id: 'block-1' },
      });
    });

    it('lets MASTER remove their own block', async () => {
      prisma.masterBlock.findFirst.mockResolvedValue({
        id: 'block-1',
        masterId: 'master-rec-1',
        salonId: 'salon-1',
      });

      await service.remove('block-1', masterUser);

      expect(prisma.masterBlock.delete).toHaveBeenCalledWith({
        where: { id: 'block-1' },
      });
    });

    it("rejects MASTER removing someone else's block", async () => {
      prisma.masterBlock.findFirst.mockResolvedValue({
        id: 'block-1',
        masterId: 'someone-else',
        salonId: 'salon-1',
      });

      await expect(
        service.remove('block-1', masterUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.masterBlock.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the block does not exist in the salon', async () => {
      prisma.masterBlock.findFirst.mockResolvedValue(null);

      await expect(service.remove('missing', admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
