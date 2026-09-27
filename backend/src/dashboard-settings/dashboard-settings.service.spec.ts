import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DashboardSettingsService } from './dashboard-settings.service';

describe('DashboardSettingsService', () => {
  let service: DashboardSettingsService;
  let prisma: {
    dashboardWidgetRoleDefault: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    dashboardWidgetUserOverride: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    user: { findFirst: jest.Mock };
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
    masterId: 'master-1',
  };

  beforeEach(async () => {
    prisma = {
      dashboardWidgetRoleDefault: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      dashboardWidgetUserOverride: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardSettingsService);
  });

  describe('getEffectiveWidgets', () => {
    it('defaults every widget to visible when neither override nor role default is set', async () => {
      const result = await service.getEffectiveWidgets(master);

      expect(result).toContain('daily-timeline');
      expect(result).toContain('weekly-timeline');
    });

    it('applies the role default over the static true fallback', async () => {
      prisma.dashboardWidgetRoleDefault.findMany.mockResolvedValue([
        { widgetKey: 'monthly-revenue', visible: false },
      ]);

      const result = await service.getEffectiveWidgets(master);

      expect(result).not.toContain('monthly-revenue');
      expect(result).toContain('daily-timeline');
    });

    it('lets a user override win over the role default', async () => {
      prisma.dashboardWidgetRoleDefault.findMany.mockResolvedValue([
        { widgetKey: 'monthly-revenue', visible: false },
      ]);
      prisma.dashboardWidgetUserOverride.findMany.mockResolvedValue([
        { widgetKey: 'monthly-revenue', visible: true },
      ]);

      const result = await service.getEffectiveWidgets(master);

      expect(result).toContain('monthly-revenue');
    });

    it('shows the pending online bookings widget to ADMIN by default, first in order', async () => {
      const result = await service.getEffectiveWidgets(admin);

      expect(result[0]).toBe('pending-online-bookings');
    });

    it('never shows the ADMIN-only widget to MASTER, even with a visible override', async () => {
      prisma.dashboardWidgetRoleDefault.findMany.mockResolvedValue([
        { widgetKey: 'pending-online-bookings', visible: true },
      ]);
      prisma.dashboardWidgetUserOverride.findMany.mockResolvedValue([
        { widgetKey: 'pending-online-bookings', visible: true },
      ]);

      const result = await service.getEffectiveWidgets(master);

      expect(result).not.toContain('pending-online-bookings');
    });
  });

  describe('getConfig', () => {
    it('reports the ADMIN-only widget as off for MASTER and on for ADMIN by default', async () => {
      const config = await service.getConfig(admin);

      expect(config.roleDefaults[Role.ADMIN]['pending-online-bookings']).toBe(
        true,
      );
      expect(config.roleDefaults[Role.MASTER]['pending-online-bookings']).toBe(
        false,
      );
    });
  });

  describe('setRoleDefault', () => {
    it('rejects configuring the ADMIN-only widget for MASTER', async () => {
      await expect(
        service.setRoleDefault(
          {
            role: Role.MASTER,
            widgetKey: 'pending-online-bookings',
            visible: true,
          },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.dashboardWidgetRoleDefault.upsert).not.toHaveBeenCalled();
    });
  });

  describe('setUserOverride', () => {
    it('throws NotFoundException when the target user does not belong to the salon', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.setUserOverride(
          { userId: 'other-user', widgetKey: 'daily-timeline', visible: false },
          admin,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.dashboardWidgetUserOverride.upsert).not.toHaveBeenCalled();
    });

    it('upserts the override scoped to the admin salon once the user is verified', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'master-user-1' });

      await service.setUserOverride(
        {
          userId: 'master-user-1',
          widgetKey: 'daily-timeline',
          visible: false,
        },
        admin,
      );

      expect(prisma.dashboardWidgetUserOverride.upsert).toHaveBeenCalledWith({
        where: {
          userId_widgetKey: {
            userId: 'master-user-1',
            widgetKey: 'daily-timeline',
          },
        },
        create: {
          salonId: 'salon-1',
          userId: 'master-user-1',
          widgetKey: 'daily-timeline',
          visible: false,
        },
        update: { visible: false },
      });
    });
  });

  describe('setUserOverride for an ADMIN-only widget', () => {
    it('rejects the override when the target user is a MASTER', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'master-user-1',
        role: Role.MASTER,
      });

      await expect(
        service.setUserOverride(
          {
            userId: 'master-user-1',
            widgetKey: 'pending-online-bookings',
            visible: true,
          },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.dashboardWidgetUserOverride.upsert).not.toHaveBeenCalled();
    });

    it('allows the override for an ADMIN user', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'admin-2',
        role: Role.ADMIN,
      });

      await service.setUserOverride(
        {
          userId: 'admin-2',
          widgetKey: 'pending-online-bookings',
          visible: false,
        },
        admin,
      );

      expect(prisma.dashboardWidgetUserOverride.upsert).toHaveBeenCalled();
    });
  });

  describe('removeUserOverride', () => {
    it('throws NotFoundException when the target user does not belong to the salon', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.removeUserOverride('other-user', 'daily-timeline', admin),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(
        prisma.dashboardWidgetUserOverride.deleteMany,
      ).not.toHaveBeenCalled();
    });

    it('deletes the override once the user is verified', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'master-user-1' });

      await service.removeUserOverride(
        'master-user-1',
        'daily-timeline',
        admin,
      );

      expect(
        prisma.dashboardWidgetUserOverride.deleteMany,
      ).toHaveBeenCalledWith({
        where: { userId: 'master-user-1', widgetKey: 'daily-timeline' },
      });
    });
  });
});
