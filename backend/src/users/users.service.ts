import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(salonId: string) {
    const users = await this.prisma.user.findMany({
      where: { salonId },
      select: {
        id: true,
        email: true,
        role: true,
        master: { select: { name: true } },
      },
      orderBy: { email: 'asc' },
    });

    return users.map(({ master, ...user }) => ({
      ...user,
      masterName: master?.name ?? null,
    }));
  }
}
