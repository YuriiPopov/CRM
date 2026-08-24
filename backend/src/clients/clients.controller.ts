import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // MASTER видит и заводит клиентов салона наравне с ADMIN (просмотр + создание, без
  // редактирования/GDPR — см. Roles на Patch/Delete ниже; item19). Изначально это было
  // единственным путём завести клиента под ролью MASTER (из формы создания записи, до того
  // как /clients открылся для неё на фронте) — оставлено и сейчас как второй равнозначный путь.
  @Post()
  @Roles(Role.ADMIN, Role.MASTER)
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.create(dto, user.salonId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MASTER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.findAll(user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MASTER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.update(id, dto, user.salonId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.remove(id, user.salonId);
  }

  // GDPR «право на удаление» — анонимизация карточки (см. ClientsService.eraseClientData)
  @Delete(':id/gdpr-erasure')
  @Roles(Role.ADMIN)
  eraseClientData(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.eraseClientData(id, user.salonId);
  }

  // GDPR «право на переносимость» — карточка + история записей
  @Get(':id/export')
  @Roles(Role.ADMIN, Role.MASTER)
  exportClientData(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.exportClientData(id, user);
  }
}
