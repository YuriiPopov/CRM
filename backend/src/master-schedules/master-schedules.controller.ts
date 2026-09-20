import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { GetMasterScheduleQueryDto } from './dto/get-master-schedule-query.dto';
import { UpsertMasterScheduleDto } from './dto/upsert-master-schedule.dto';
import { MasterSchedulesService } from './master-schedules.service';

// Регулярный график работы мастеров задаёт только ADMIN (item28, подзадача №33) — MASTER доступа
// к записи не имеет (см. тот же приём в NotificationsController). Исключение — findMonth ниже:
// мастер-приложению нужно читать свой уже утверждённый график (см. master-app), доступ
// самостоятельно ограничен своим masterId в сервисе (см. MasterSchedulesService.findMonth).
@Controller('master-schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MasterSchedulesController {
  constructor(
    private readonly masterSchedulesService: MasterSchedulesService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.MASTER)
  findMonth(
    @Query() query: GetMasterScheduleQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.masterSchedulesService.findMonth(query, user);
  }

  @Put()
  upsertMonth(
    @Body() dto: UpsertMasterScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.masterSchedulesService.upsertMonth(dto, user);
  }

  @Post('conflicts')
  findConflicts(
    @Body() dto: UpsertMasterScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.masterSchedulesService.findConflicts(dto, user);
  }
}
