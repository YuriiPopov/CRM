import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.create(dto, user.salonId);
  }

  // Регистрирован до ':id' намеренно — хотя коллизии с ':id' (один сегмент) тут нет,
  // так явный порядок надёжнее держать неизменным при будущих правках роутов.
  @Get('report/revenue')
  @Roles(Role.ADMIN)
  getRevenueReport(
    @Query() query: RevenueReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.getRevenueReport(query, user.salonId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MASTER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findAll(user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MASTER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findOne(id, user);
  }
}
