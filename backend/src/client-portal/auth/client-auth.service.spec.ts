import {
  BadRequestException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { SMS_PROVIDER } from '../sms/sms-provider.interface';
import { ClientAuthService, normalizePhone } from './client-auth.service';
import { CLIENT_JWT_AUDIENCE } from './client-jwt';

describe('normalizePhone', () => {
  it('strips spaces, dashes and parentheses', () => {
    expect(normalizePhone('+48 (601) 234-567')).toBe('+48601234567');
  });

  it('rejects non-phone input', () => {
    expect(() => normalizePhone('abc')).toThrow(BadRequestException);
    expect(() => normalizePhone('+48 12')).toThrow(BadRequestException);
  });
});

describe('ClientAuthService', () => {
  let service: ClientAuthService;
  let prisma: {
    salon: { findUnique: jest.Mock; findFirst: jest.Mock };
    client: { findFirst: jest.Mock; create: jest.Mock };
    clientOtp: {
      create: jest.Mock;
      updateMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let sms: { send: jest.Mock };
  let jwt: { sign: jest.Mock };
  let env: Record<string, string>;

  const phone = '+48555000111';
  const existingClient = {
    id: 'client-1',
    salonId: 'salon-1',
    name: 'Maria',
    phone,
    email: null,
  };

  type CreatedOtp = { data: { codeHash: string; salonId: string } };
  const createdOtp = () =>
    (prisma.clientOtp.create.mock.calls[0] as [CreatedOtp])[0].data;
  const sentSmsText = () => (sms.send.mock.calls[0] as [string, string])[1];

  type OtpUpdate = { where: { id: string }; data: Record<string, unknown> };
  const otpUpdates = () =>
    prisma.clientOtp.updateMany.mock.calls.map(([arg]) => arg as OtpUpdate);
  const consumeCalls = () =>
    otpUpdates().filter((u) => 'consumedAt' in u.data && u.where.id);

  const otpWithCode = async (code: string) => ({
    id: 'otp-1',
    codeHash: await bcrypt.hash(code, 4),
  });

  beforeEach(async () => {
    env = {};
    prisma = {
      salon: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'salon-1' }),
      },
      client: { findFirst: jest.fn(), create: jest.fn() },
      clientOtp: {
        create: jest.fn(),
        // По умолчанию условные UPDATE (резерв попытки, гашение кода) проходят — тесты на гонки
        // переопределяют count: 0 явно.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
      },
    };
    sms = { send: jest.fn().mockResolvedValue(undefined) };
    jwt = { sign: jest.fn().mockReturnValue('signed-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: SMS_PROVIDER, useValue: sms },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => env[key] ?? fallback,
          },
        },
      ],
    }).compile();

    service = module.get(ClientAuthService);
  });

  describe('requestCode', () => {
    it('stores only a hash, invalidates previous codes and sends the code by SMS', async () => {
      const result = await service.requestCode({ phone: '+48 555 000 111' });

      expect(prisma.clientOtp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { salonId: 'salon-1', phone, consumedAt: null },
        }),
      );
      const stored = createdOtp();
      const code = sentSmsText().match(/\d{6}/)![0];
      expect(stored.codeHash).not.toBe(code);
      expect(await bcrypt.compare(code, stored.codeHash)).toBe(true);
      expect(result).toEqual({ phone, expiresInSec: 300 });
    });

    it('echoes the code only with CLIENT_OTP_DEV_MODE=true', async () => {
      env.CLIENT_OTP_DEV_MODE = 'true';
      const result = await service.requestCode({ phone });
      expect(result.devCode).toMatch(/^\d{6}$/);
    });

    it('uses CLIENT_APP_SALON_ID when configured', async () => {
      env.CLIENT_APP_SALON_ID = 'salon-2';
      prisma.salon.findUnique.mockResolvedValue({ id: 'salon-2' });
      await service.requestCode({ phone });
      expect(createdOtp().salonId).toBe('salon-2');
    });
  });

  describe('verifyCode', () => {
    it('rejects when there is no active code', async () => {
      prisma.clientOtp.findFirst.mockResolvedValue(null);
      await expect(
        service.verifyCode({ phone, code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('reserves an attempt atomically before comparing the code', async () => {
      prisma.clientOtp.findFirst.mockResolvedValue(await otpWithCode('123456'));
      await expect(
        service.verifyCode({ phone, code: '000000' }),
      ).rejects.toThrow('Invalid code');

      const [reserve] = otpUpdates();
      expect(reserve.data).toEqual({ attempts: { increment: 1 } });
      // Условие attempts < MAX перепроверяется самим UPDATE, а не только предшествующим SELECT
      expect(reserve.where).toMatchObject({
        id: 'otp-1',
        consumedAt: null,
        attempts: { lt: 5 },
      });
      expect(consumeCalls()).toHaveLength(0);
    });

    it('rejects without checking the code when a parallel request used the last attempt', async () => {
      prisma.clientOtp.findFirst.mockResolvedValue(await otpWithCode('123456'));
      prisma.clientOtp.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.verifyCode({ phone, code: '123456' }),
      ).rejects.toThrow('Code expired or was not requested');
      expect(prisma.client.findFirst).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('logs in an existing client and consumes the code', async () => {
      prisma.clientOtp.findFirst.mockResolvedValue(await otpWithCode('123456'));
      prisma.client.findFirst.mockResolvedValue(existingClient);

      const result = await service.verifyCode({ phone, code: '123456' });

      expect(result).toEqual({
        accessToken: 'signed-token',
        client: { id: 'client-1', name: 'Maria', phone, email: null },
        isNewClient: false,
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'client-1', salonId: 'salon-1' },
        expect.objectContaining({ audience: CLIENT_JWT_AUDIENCE }),
      );
      const [consume] = consumeCalls();
      expect(consume.where).toEqual({ id: 'otp-1', consumedAt: null });
    });

    it('rejects when a parallel request already consumed the code', async () => {
      prisma.clientOtp.findFirst.mockResolvedValue(await otpWithCode('123456'));
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.clientOtp.updateMany
        .mockResolvedValueOnce({ count: 1 }) // резерв попытки
        .mockResolvedValueOnce({ count: 0 }); // гашение — уже погашен другим запросом

      await expect(
        service.verifyCode({
          phone,
          code: '123456',
          name: 'Ola',
          consentGiven: true,
        }),
      ).rejects.toThrow('Code has already been used');
      // Второй параллельный запрос не создаёт дубль карточки клиента
      expect(prisma.client.create).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('asks for a profile for an unknown phone without consuming the code', async () => {
      prisma.clientOtp.findFirst.mockResolvedValue(await otpWithCode('123456'));
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyCode({ phone, code: '123456' }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(consumeCalls()).toHaveLength(0);
      expect(prisma.client.create).not.toHaveBeenCalled();
    });

    it('creates a client with consent only after consuming the code', async () => {
      prisma.clientOtp.findFirst.mockResolvedValue(await otpWithCode('123456'));
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue({
        ...existingClient,
        name: 'Ola',
      });

      const result = await service.verifyCode({
        phone,
        code: '123456',
        name: '  Ola ',
        consentGiven: true,
      });

      expect(prisma.client.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
        data: expect.objectContaining({
          salonId: 'salon-1',
          name: 'Ola',
          phone,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed `any` in @types/jest
          consentGivenAt: expect.any(Date),
        }),
      });
      const consumeOrder =
        prisma.clientOtp.updateMany.mock.invocationCallOrder[1];
      const createOrder = prisma.client.create.mock.invocationCallOrder[0];
      expect(consumeOrder).toBeLessThan(createOrder);
      expect(result.isNewClient).toBe(true);
    });
  });
});
