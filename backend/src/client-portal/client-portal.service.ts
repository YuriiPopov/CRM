import { Injectable, NotFoundException } from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { BookingsService } from '../bookings/bookings.service';
import { AvailableSlotsQueryDto } from '../public-booking/dto/available-slots-query.dto';
import { PublicBookingService } from '../public-booking/public-booking.service';
import { PrismaService } from '../prisma/prisma.service';
import { toClientProfile } from './auth/client-auth.service';
import { AuthenticatedClient } from './auth/client-jwt';
import { CreateClientBookingDto } from './dto/create-client-booking.dto';

const bookingInclude = {
  service: { select: { name: true, price: true } },
  master: { select: { name: true } },
  payment: { select: { amount: true } },
} satisfies Prisma.BookingInclude;

// Фото услуги в списках — только счётчик и id обложки (item84): base64 в список не попадает,
// картинки клиент тянет отдельно (GET /client/service-photos/:photoId)
const serviceListInclude = {
  masters: {
    where: { master: { isActive: true } },
    select: { masterId: true },
  },
  photos: {
    orderBy: { position: 'asc' },
    take: 1,
    select: { id: true },
  },
  _count: { select: { photos: true } },
} satisfies Prisma.ServiceInclude;

type ServiceForClient = Prisma.ServiceGetPayload<{
  include: typeof serviceListInclude;
}>;

function toClientService(s: ServiceForClient) {
  return {
    id: s.id,
    name: s.name,
    categoryId: s.categoryId,
    durationMin: s.durationMin,
    price: Number(s.price),
    photoCount: s._count.photos,
    coverPhotoId: s.photos[0]?.id ?? null,
  };
}

type BookingWithDetails = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

// Всё, что видит клиент, — только данные его салона и только его собственные записи; чужие
// записи и внутренние данные салона (заметки, теги, материалы) наружу не отдаются.
@Injectable()
export class ClientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly publicBookingService: PublicBookingService,
  ) {}

  async me(client: AuthenticatedClient) {
    const found = await this.prisma.client.findUniqueOrThrow({
      where: { id: client.clientId },
    });
    return toClientProfile(found);
  }

  async services(client: AuthenticatedClient) {
    const services = await this.prisma.service.findMany({
      where: { salonId: client.salonId },
      orderBy: { createdAt: 'asc' },
      include: serviceListInclude,
    });
    return services.filter((s) => s.masters.length > 0).map(toClientService);
  }

  async catalog(client: AuthenticatedClient) {
    const { salonId } = client;
    const [salon, categories, services, masters] = await Promise.all([
      this.prisma.salon.findUniqueOrThrow({
        where: { id: salonId },
        select: { name: true, address: true },
      }),
      this.prisma.serviceCategory.findMany({
        where: { salonId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.service.findMany({
        where: { salonId },
        orderBy: { createdAt: 'asc' },
        include: serviceListInclude,
      }),
      this.prisma.master.findMany({
        where: { salonId, isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          services: { select: { serviceId: true } },
          specializations: { select: { category: { select: { name: true } } } },
        },
      }),
    ]);

    // Услуга без единого активного мастера не бронируется — клиенту её не показываем
    const bookable = services.filter((s) => s.masters.length > 0);

    return {
      salon,
      categories: categories.filter((c) =>
        bookable.some((s) => s.categoryId === c.id),
      ),
      services: bookable.map(toClientService),
      masters: masters.map((m) => ({
        id: m.id,
        name: m.name,
        // base64 data URL (item41); фото уже сжаты при загрузке, ~20–40 КБ на мастера
        photo: m.photo,
        serviceIds: m.services.map((link) => link.serviceId),
        specializations: m.specializations.map((sp) => sp.category.name),
      })),
    };
  }

  async slots(client: AuthenticatedClient, query: AvailableSlotsQueryDto) {
    // PublicBookingService не скоупит по салону — проверяем, что мастер из салона клиента
    await this.assertMasterInSalon(query.masterId, client.salonId);
    return this.publicBookingService.getAvailableSlots(query);
  }

  async bookings(client: AuthenticatedClient) {
    const bookings = await this.prisma.booking.findMany({
      where: { clientId: client.clientId },
      include: bookingInclude,
      orderBy: { startTime: 'desc' },
    });
    return bookings.map((b) => this.toClientBooking(b));
  }

  async createBooking(
    client: AuthenticatedClient,
    dto: CreateClientBookingDto,
  ) {
    const booking = await this.bookingsService.createForClient({
      salonId: client.salonId,
      clientId: client.clientId,
      ...dto,
    });
    return this.loadClientBooking(booking);
  }

  async cancelBooking(client: AuthenticatedClient, bookingId: string) {
    const booking = await this.bookingsService.cancelForClient(
      bookingId,
      client.clientId,
    );
    return this.loadClientBooking(booking);
  }

  private async loadClientBooking(booking: Booking) {
    const withDetails = await this.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: bookingInclude,
    });
    return this.toClientBooking(withDetails);
  }

  private toClientBooking(b: BookingWithDetails) {
    return {
      id: b.id,
      serviceId: b.serviceId,
      serviceName: b.service.name,
      masterId: b.masterId,
      masterName: b.master.name,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      // Фактическая сумма оплаты, если она уже проведена (могла быть скидка), иначе прайс услуги
      price: Number(b.payment?.amount ?? b.service.price),
    };
  }

  private async assertMasterInSalon(masterId: string, salonId: string) {
    const master = await this.prisma.master.findFirst({
      where: { id: masterId, salonId, isActive: true },
      select: { id: true },
    });
    if (!master) {
      throw new NotFoundException('Master not found');
    }
  }
}
