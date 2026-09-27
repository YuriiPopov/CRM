import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthenticatedClient,
  CLIENT_JWT_AUDIENCE,
  ClientJwtPayload,
} from './client-jwt';
import { DEFAULT_JWT_SECRET } from '../../common/config/assert-production-config';

export const CLIENT_JWT_STRATEGY = 'client-jwt';

@Injectable()
export class ClientJwtStrategy extends PassportStrategy(
  Strategy,
  CLIENT_JWT_STRATEGY,
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', DEFAULT_JWT_SECRET),
      audience: CLIENT_JWT_AUDIENCE,
    });
  }

  // Как и у сотрудников — клиент перечитывается из БД на каждый запрос: удаление карточки
  // (например, по GDPR-запросу) сразу отзывает доступ.
  async validate(payload: ClientJwtPayload): Promise<AuthenticatedClient> {
    const client = await this.prisma.client.findFirst({
      where: { id: payload.sub, salonId: payload.salonId },
      select: { id: true, salonId: true },
    });

    if (!client) {
      throw new UnauthorizedException('Client not found');
    }

    return { clientId: client.id, salonId: client.salonId };
  }
}

@Injectable()
export class ClientJwtAuthGuard extends AuthGuard(CLIENT_JWT_STRATEGY) {}
