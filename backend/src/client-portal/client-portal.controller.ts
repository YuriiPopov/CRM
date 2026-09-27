import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AvailableSlotsQueryDto } from '../public-booking/dto/available-slots-query.dto';
import { ClientAuthService } from './auth/client-auth.service';
import type { AuthenticatedClient } from './auth/client-jwt';
import { ClientJwtAuthGuard } from './auth/client-jwt.strategy';
import { CurrentClient } from './auth/current-client.decorator';
import { ClientPortalService } from './client-portal.service';
import { CreateClientBookingDto } from './dto/create-client-booking.dto';
import { RequestCodeDto } from './dto/request-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

// Вход в клиентское мобильное приложение — анонимный, поэтому под ThrottlerGuard (как и
// /public/booking): отправка SMS стоит денег, а проверку кода нельзя давать перебирать.
@Controller('client/auth')
@UseGuards(ThrottlerGuard)
export class ClientAuthController {
  constructor(private readonly clientAuthService: ClientAuthService) {}

  @Post('request-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  requestCode(@Body() dto: RequestCodeDto) {
    return this.clientAuthService.requestCode(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@Body() dto: VerifyCodeDto) {
    return this.clientAuthService.verifyCode(dto);
  }
}

@Controller('client')
@UseGuards(ClientJwtAuthGuard)
export class ClientPortalController {
  constructor(private readonly clientPortalService: ClientPortalService) {}

  @Get('me')
  me(@CurrentClient() client: AuthenticatedClient) {
    return this.clientPortalService.me(client);
  }

  @Get('catalog')
  catalog(@CurrentClient() client: AuthenticatedClient) {
    return this.clientPortalService.catalog(client);
  }

  @Get('slots')
  slots(
    @CurrentClient() client: AuthenticatedClient,
    @Query() query: AvailableSlotsQueryDto,
  ) {
    return this.clientPortalService.slots(client, query);
  }

  @Get('bookings')
  bookings(@CurrentClient() client: AuthenticatedClient) {
    return this.clientPortalService.bookings(client);
  }

  @Post('bookings')
  createBooking(
    @CurrentClient() client: AuthenticatedClient,
    @Body() dto: CreateClientBookingDto,
  ) {
    return this.clientPortalService.createBooking(client, dto);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelBooking(
    @CurrentClient() client: AuthenticatedClient,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientPortalService.cancelBooking(client, id);
  }
}
