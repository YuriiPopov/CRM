import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { PublicBookingService } from './public-booking.service';

// Публичный, без авторизации — минимальная онлайн-запись для клиентов (см. ТЗ, раздел 8 "MVP и roadmap").
// ThrottlerGuard применяется только на этом контроллере, а не глобально — это единственный
// анонимный вход в API (остальные маршруты уже защищены JwtAuthGuard).
@Controller('public/booking')
@UseGuards(ThrottlerGuard)
export class PublicBookingController {
  constructor(private readonly publicBookingService: PublicBookingService) {}

  @Get('slots')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getAvailableSlots(@Query() query: AvailableSlotsQueryDto) {
    return this.publicBookingService.getAvailableSlots(query);
  }

  // Строже, чем чтение слотов — создание записи дороже и чувствительнее к злоупотреблению
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createBooking(@Body() dto: CreatePublicBookingDto) {
    return this.publicBookingService.createBooking(dto);
  }
}
