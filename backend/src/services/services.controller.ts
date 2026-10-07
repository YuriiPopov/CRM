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
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { UploadServicePhotoDto } from './dto/upload-service-photo.dto';
import { ServicePhotosService } from './service-photos.service';
import { ServicesService } from './services.service';

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly servicePhotosService: ServicePhotosService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  create(
    @Body() dto: CreateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.servicesService.create(dto, user.salonId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MASTER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.servicesService.findAll(user.salonId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MASTER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.servicesService.findOne(id, user.salonId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.servicesService.update(id, dto, user.salonId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.servicesService.remove(id, user.salonId);
  }

  // Фото услуги (item84) — только ADMIN
  @Get(':id/photos')
  @Roles(Role.ADMIN)
  listPhotos(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.servicePhotosService.list(id, user.salonId);
  }

  @Post(':id/photos')
  @Roles(Role.ADMIN)
  addPhoto(
    @Param('id') id: string,
    @Body() dto: UploadServicePhotoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.servicePhotosService.add(id, dto, user.salonId);
  }

  // Тело — массив id фото в новом порядке
  @Put(':id/photos/order')
  @Roles(Role.ADMIN)
  reorderPhotos(
    @Param('id') id: string,
    @Body() photoIds: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.servicePhotosService.reorder(id, photoIds, user.salonId);
  }

  @Delete(':id/photos/:photoId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.servicePhotosService.remove(id, photoId, user.salonId);
  }
}
