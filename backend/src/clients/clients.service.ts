import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toPaymentView } from '../payments/payment-view.util';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto, salonId: string) {
    if (!dto.consentGiven) {
      throw new BadRequestException(
        'Client consent to data processing is required',
      );
    }

    return this.prisma.client.create({
      data: {
        salonId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        notes: dto.notes,
        tags: dto.tags ?? [],
        consentGivenAt: new Date(),
      },
    });
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.client.findMany({
      where: this.scopeWhere(user),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.scopeWhere(user) },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(id: string, dto: UpdateClientDto, salonId: string) {
    await this.assertExistsInSalon(id, salonId);

    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.consentWithdrawn && { consentWithdrawnAt: new Date() }),
      },
    });
  }

  async remove(id: string, salonId: string): Promise<void> {
    await this.assertExistsInSalon(id, salonId);

    try {
      await this.prisma.client.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Cannot delete a client with existing bookings',
        );
      }
      throw error;
    }
  }

  // GDPR «право на удаление» (ADMIN-only, см. RolesGuard на контроллере).
  //
  // Не выполняет физическое удаление строки Client: Booking.clientId — обязательный FK
  // (у клиента почти всегда есть история записей), а Payment должен переживать эрайзер по
  // требованиям бухучёта (GDPR Art. 17(3)(b) — retention для соответствия юридическим
  // обязательствам перекрывает право на удаление именно для этих данных). Вместо этого —
  // анонимизация: обнуляем идентифицирующие поля карточки, Booking/Payment остаются как есть
  // (они и так не хранят имя/контакты клиента напрямую, только clientId).
  // Так же поступаем и для клиента без единой записи — единый код-путь без FK-развилки,
  // и результат для конкретного человека идентичен полному удалению (ничего идентифицирующего
  // не остаётся), но не оставляет расхождения в поведении API между «есть история» и «нет».
  // DataDeletionRequest — обязательный аудиторский след подтверждения обработки запроса,
  // создаётся в той же транзакции, что и анонимизация.
  async eraseClientData(id: string, salonId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, salonId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const alreadyErased = await this.prisma.dataDeletionRequest.findFirst({
      where: { clientId: id, status: 'processed' },
    });
    if (alreadyErased) {
      throw new ConflictException('Client data has already been erased');
    }

    const processedAt = new Date();

    const [, deletionRequest] = await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id },
        data: {
          name: 'Erased client',
          phone: `erased-${id}`,
          email: null,
          notes: null,
          tags: [],
          consentWithdrawnAt: processedAt,
        },
      }),
      this.prisma.dataDeletionRequest.create({
        data: {
          clientId: id,
          status: 'processed',
          processedAt,
        },
      }),
    ]);

    return {
      clientId: id,
      status: deletionRequest.status,
      processedAt: deletionRequest.processedAt,
    };
  }

  // GDPR «право на переносимость» — карточка + история записей клиента.
  // Видимость наследует существующие правила: MASTER получает только свои записи (scopeWhere
  // здесь же гарантирует доступ к самому клиенту) и урезанный вид оплаты (см. PaymentsService).
  async exportClientData(id: string, user: AuthenticatedUser) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.scopeWhere(user) },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const bookingWhere: Prisma.BookingWhereInput =
      user.role === Role.ADMIN
        ? { clientId: id }
        : { clientId: id, masterId: user.masterId ?? '__none__' };

    const bookings = await this.prisma.booking.findMany({
      where: bookingWhere,
      orderBy: { startTime: 'desc' },
      include: { service: true, payment: true },
    });

    return {
      client,
      bookings: bookings.map((booking) => ({
        id: booking.id,
        masterId: booking.masterId,
        serviceId: booking.serviceId,
        serviceName: booking.service.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        source: booking.source,
        payment: booking.payment ? toPaymentView(booking.payment, user) : null,
      })),
      exportedAt: new Date(),
    };
  }

  private async assertExistsInSalon(
    id: string,
    salonId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id, salonId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  // ADMIN видит всех клиентов салона; MASTER — только клиентов по своим записям (см. ТЗ, раздел 2 "Роли пользователей")
  private scopeWhere(user: AuthenticatedUser): Prisma.ClientWhereInput {
    if (user.role === Role.ADMIN) {
      return { salonId: user.salonId };
    }

    if (!user.masterId) {
      return { id: '__none__' };
    }

    return {
      salonId: user.salonId,
      bookings: { some: { masterId: user.masterId } },
    };
  }
}
