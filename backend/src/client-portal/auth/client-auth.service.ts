import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Client } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestCodeDto } from '../dto/request-code.dto';
import { VerifyCodeDto } from '../dto/verify-code.dto';
import { SMS_PROVIDER } from '../sms/sms-provider.interface';
import type { SmsProvider } from '../sms/sms-provider.interface';
import { CLIENT_JWT_AUDIENCE, ClientJwtPayload } from './client-jwt';

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const BCRYPT_SALT_ROUNDS = 10;

export const PROFILE_REQUIRED = 'PROFILE_REQUIRED';

export interface ClientProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

// "+48 601-234-567" → "+48601234567": клиенты в БД хранятся с телефоном без пробелов/дефисов
// (так их заводит и админка, и публичная запись), поэтому сравнение идёт по нормализованной форме.
export function normalizePhone(raw: string): string {
  const phone = raw.replace(/[\s\-()]/g, '');
  if (!/^\+?\d{9,15}$/.test(phone)) {
    throw new BadRequestException('Invalid phone number');
  }
  return phone;
}

export function toClientProfile(client: Client): ClientProfile {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
  };
}

@Injectable()
export class ClientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  // Клиентское приложение — для одного салона (филиала). Какого именно — задаёт
  // CLIENT_APP_SALON_ID; без него берётся самый первый салон (dev/демо-окружение).
  async resolveSalonId(): Promise<string> {
    const configured = this.config.get<string>('CLIENT_APP_SALON_ID');
    const salon = configured
      ? await this.prisma.salon.findUnique({ where: { id: configured } })
      : await this.prisma.salon.findFirst({ orderBy: { createdAt: 'asc' } });

    if (!salon) {
      throw new InternalServerErrorException(
        'Client app salon is not configured',
      );
    }
    return salon.id;
  }

  async requestCode(dto: RequestCodeDto) {
    const phone = normalizePhone(dto.phone);
    const salonId = await this.resolveSalonId();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    // Новый код делает предыдущие недействительными — в работе всегда только последний
    await this.prisma.clientOtp.updateMany({
      where: { salonId, phone, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.clientOtp.create({
      data: {
        salonId,
        phone,
        codeHash: await bcrypt.hash(code, BCRYPT_SALT_ROUNDS),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    });

    await this.sms.send(phone, `B4U: kod logowania ${code}`);

    return {
      phone,
      expiresInSec: OTP_TTL_MINUTES * 60,
      // Только при явном CLIENT_OTP_DEV_MODE=true (локальная разработка без SMS-провайдера):
      // код возвращается в ответе, чтобы его можно было ввести на телефоне без доступа к логам.
      ...(this.isDevMode() ? { devCode: code } : {}),
    };
  }

  async verifyCode(dto: VerifyCodeDto) {
    const phone = normalizePhone(dto.phone);
    const salonId = await this.resolveSalonId();

    const activeOtp = {
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: OTP_MAX_ATTEMPTS },
    };

    const otp = await this.prisma.clientOtp.findFirst({
      where: { salonId, phone, ...activeOtp },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new UnauthorizedException('Code expired or was not requested');
    }

    // Попытка резервируется атомарно ДО сравнения кода: условный UPDATE перепроверяет
    // attempts < MAX под блокировкой строки, поэтому параллельные запросы (в т.ч. с разных IP,
    // мимо rate limit) в сумме не получат больше OTP_MAX_ATTEMPTS проверок одного кода.
    // Считается любая проверка, и верная тоже — лимита хватает на сценарий PROFILE_REQUIRED.
    const reserved = await this.prisma.clientOtp.updateMany({
      where: { id: otp.id, ...activeOtp },
      data: { attempts: { increment: 1 } },
    });
    if (reserved.count === 0) {
      throw new UnauthorizedException('Code expired or was not requested');
    }

    if (!(await bcrypt.compare(dto.code, otp.codeHash))) {
      throw new UnauthorizedException('Invalid code');
    }

    let client = await this.prisma.client.findFirst({
      where: { salonId, phone },
    });
    const isNewClient = !client;

    // Код верный, но карточки нет — код НЕ гасим: приложение спросит имя и согласие и
    // повторит запрос с тем же кодом.
    if (!client && (!dto.name || !dto.consentGiven)) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: PROFILE_REQUIRED,
        message: 'Name and consent are required to create a client profile',
      });
    }

    // Гасим код атомарно и ДО создания клиента: из параллельных запросов с верным кодом
    // проходит ровно один — второй получит 401, а не дубль карточки клиента.
    const consumed = await this.prisma.clientOtp.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException('Code has already been used');
    }

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          salonId,
          // name проверен выше (PROFILE_REQUIRED), TS не выводит это через условие
          name: dto.name!.trim(),
          phone,
          email: dto.email,
          consentGivenAt: new Date(),
        },
      });
    }

    const payload: ClientJwtPayload = { sub: client.id, salonId };
    const accessToken = this.jwtService.sign(payload, {
      audience: CLIENT_JWT_AUDIENCE,
      // Мобильная сессия живёт дольше, чем сессия сотрудника в веб-CRM (JWT_EXPIRES_IN)
      expiresIn: this.config.get<string>(
        'CLIENT_JWT_EXPIRES_IN',
        '30d',
      ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    return { accessToken, client: toClientProfile(client), isNewClient };
  }

  private isDevMode(): boolean {
    return this.config.get<string>('CLIENT_OTP_DEV_MODE') === 'true';
  }
}
