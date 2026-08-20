import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
  };
  let jwtService: { sign: jest.Mock };

  const existingUser = {
    id: 'user-1',
    salonId: 'salon-1',
    email: 'admin@b4u.local',
    passwordHash: '',
    role: Role.ADMIN,
    masterId: null,
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    existingUser.passwordHash = await bcrypt.hash('correct-password', 4);

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    it('returns a signed access token for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.login({
        email: existingUser.email,
        password: 'correct-password',
      });

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        salonId: existingUser.salonId,
      });
    });

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@b4u.local', password: 'whatever1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        service.login({
          email: existingUser.email,
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a deactivated user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...existingUser,
        isActive: false,
      });

      await expect(
        service.login({
          email: existingUser.email,
          password: 'correct-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('register', () => {
    const creator = {
      id: 'admin-1',
      email: existingUser.email,
      role: Role.ADMIN,
      salonId: 'salon-1',
    };

    it('creates a user scoped to the creating admin salon and strips the password hash', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-2',
        salonId: creator.salonId,
        email: 'master@b4u.local',
        passwordHash: 'hashed',
        role: Role.MASTER,
        masterId: null,
        isActive: true,
        createdAt: new Date(),
      });

      const result = await service.register(
        {
          email: 'master@b4u.local',
          password: 'strongpass1',
          role: Role.MASTER,
        },
        creator,
      );

      expect(prisma.user.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
        data: expect.objectContaining({
          email: 'master@b4u.local',
          role: Role.MASTER,
          salonId: creator.salonId,
        }),
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects a duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        service.register(
          {
            email: existingUser.email,
            password: 'strongpass1',
            role: Role.MASTER,
          },
          creator,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
});
