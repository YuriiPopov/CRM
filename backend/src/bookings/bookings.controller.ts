import {
  Body,
  Controller,
  Get,
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
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MASTER)
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MASTER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findAll(user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MASTER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findOne(id, user);
  }

  @Patch(':id/reschedule')
  @Roles(Role.ADMIN)
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.reschedule(id, dto, user.salonId);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.MASTER)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.updateStatus(id, dto, user);
  }
}
