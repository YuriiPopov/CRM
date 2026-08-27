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
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { ServiceCategoriesService } from './service-categories.service';

@Controller('service-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceCategoriesController {
  constructor(
    private readonly serviceCategoriesService: ServiceCategoriesService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  create(
    @Body() dto: CreateServiceCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.serviceCategoriesService.create(dto, user.salonId);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.serviceCategoriesService.findAll(user.salonId);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.serviceCategoriesService.findOne(id, user.salonId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.serviceCategoriesService.update(id, dto, user.salonId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.serviceCategoriesService.remove(id, user.salonId);
  }
}
