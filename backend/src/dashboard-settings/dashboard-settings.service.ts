import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DASHBOARD_WIDGET_KEYS } from './dashboard-widget-keys';
import { SetRoleDefaultDto } from './dto/set-role-default.dto';
import { SetUserOverrideDto } from './dto/set-user-override.dto';

const ROLES: Role[] = [Role.ADMIN, Role.MASTER];

@Injectable()
export class DashboardSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Для экрана настроек (ADMIN) — полная матрица роль×виджет (недостающие комбинации
  // дополняются visible=true, см. schema.prisma) плюс все текущие пользовательские
  // переопределения салона.
  async getConfig(user: AuthenticatedUser) {
    const [roleDefaultRows, userOverrides] = await Promise.all([
      this.prisma.dashboardWidgetRoleDefault.findMany({
        where: { salonId: user.salonId },
      }),
      this.prisma.dashboardWidgetUserOverride.findMany({
        where: { salonId: user.salonId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const roleDefaults = Object.fromEntries(
      ROLES.map((role) => [
        role,
        Object.fromEntries(
          DASHBOARD_WIDGET_KEYS.map((widgetKey) => [
            widgetKey,
            roleDefaultRows.find(
              (row) => row.role === role && row.widgetKey === widgetKey,
            )?.visible ?? true,
          ]),
        ),
      ]),
    ) as Record<Role, Record<string, boolean>>;

    return {
      widgetKeys: DASHBOARD_WIDGET_KEYS,
      roleDefaults,
      userOverrides: userOverrides.map((row) => ({
        userId: row.userId,
        widgetKey: row.widgetKey,
        visible: row.visible,
      })),
    };
  }

  async setRoleDefault(dto: SetRoleDefaultDto, user: AuthenticatedUser) {
    await this.prisma.dashboardWidgetRoleDefault.upsert({
      where: {
        salonId_role_widgetKey: {
          salonId: user.salonId,
          role: dto.role,
          widgetKey: dto.widgetKey,
        },
      },
      create: {
        salonId: user.salonId,
        role: dto.role,
        widgetKey: dto.widgetKey,
        visible: dto.visible,
      },
      update: { visible: dto.visible },
    });
    return this.getConfig(user);
  }

  async setUserOverride(dto: SetUserOverrideDto, user: AuthenticatedUser) {
    await this.assertUserInSalon(dto.userId, user.salonId);

    await this.prisma.dashboardWidgetUserOverride.upsert({
      where: {
        userId_widgetKey: { userId: dto.userId, widgetKey: dto.widgetKey },
      },
      create: {
        salonId: user.salonId,
        userId: dto.userId,
        widgetKey: dto.widgetKey,
        visible: dto.visible,
      },
      update: { visible: dto.visible },
    });
    return this.getConfig(user);
  }

  async removeUserOverride(
    targetUserId: string,
    widgetKey: string,
    user: AuthenticatedUser,
  ) {
    await this.assertUserInSalon(targetUserId, user.salonId);

    // Строки может и не быть (override уже снят/не задавался) — тихий no-op, а не 404,
    // "снять переопределение" идемпотентно.
    await this.prisma.dashboardWidgetUserOverride.deleteMany({
      where: { userId: targetUserId, widgetKey },
    });
    return this.getConfig(user);
  }

  // Эффективная видимость для дашборда текущего пользователя (любая роль): пользовательское
  // переопределение приоритетнее ролевого дефолта, тот — приоритетнее статичного true
  // (см. Context в плане реализации).
  async getEffectiveWidgets(user: AuthenticatedUser): Promise<string[]> {
    const [overrideRows, roleDefaultRows] = await Promise.all([
      this.prisma.dashboardWidgetUserOverride.findMany({
        where: { userId: user.id },
      }),
      this.prisma.dashboardWidgetRoleDefault.findMany({
        where: { salonId: user.salonId, role: user.role },
      }),
    ]);

    return DASHBOARD_WIDGET_KEYS.filter((widgetKey) => {
      const override = overrideRows.find((row) => row.widgetKey === widgetKey);
      if (override) return override.visible;

      const roleDefault = roleDefaultRows.find(
        (row) => row.widgetKey === widgetKey,
      );
      if (roleDefault) return roleDefault.visible;

      return true;
    });
  }

  private async assertUserInSalon(
    userId: string,
    salonId: string,
  ): Promise<void> {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, salonId },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }
  }
}
