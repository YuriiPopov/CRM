// Создаёт салон и первого admin-пользователя для локальной разработки —
// без него некому вызвать защищённый POST /auth/register (он доступен только ADMIN).
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 10;

async function main() {
  const salonName = process.env.SEED_SALON_NAME ?? 'B4U Demo Salon';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@b4u.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const salon = await prisma.salon.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: salonName,
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      salonId: salon.id,
    },
  });

  console.log(`Seed OK: salon "${salon.name}", admin "${adminEmail}"`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
