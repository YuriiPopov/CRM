import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DashboardSettingsService } from './dashboard-settings.service';
import { SetRoleDefaultDto } from './dto/set-role-default.dto';
import { SetUserOverrideDto } from './dto/set-user-override.dto';

@Controller('dashboard-settings')
@UseGuards(JwtAuthGuard)
export class DashboardSettingsController {
  constructor(
    private readonly dashboardSettingsService: DashboardSettingsService,
  ) {}

  // Эффективный список виджетов для СВОЕГО дашборда — доступен любой аутентифицированной
  // роли (в отличие от остальных эндпоинтов ниже, которые только для ADMIN).
  @Get('effective')
  getEffective(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardSettingsService.getEffectiveWidgets(user);
  }

  @Get('config')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardSettingsService.getConfig(user);
  }

  @Put('role-defaults')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  setRoleDefault(
    @Body() dto: SetRoleDefaultDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardSettingsService.setRoleDefault(dto, user);
  }

  @Put('user-overrides')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  setUserOverride(
    @Body() dto: SetUserOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardSettingsService.setUserOverride(dto, user);
  }

  @Delete('user-overrides/:userId/:widgetKey')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  removeUserOverride(
    @Param('userId') userId: string,
    @Param('widgetKey') widgetKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardSettingsService.removeUserOverride(
      userId,
      widgetKey,
      user,
    );
  }
}
