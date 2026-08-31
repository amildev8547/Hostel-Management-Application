import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@hostelhub.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'owner123';
const OWNER_NAME = process.env.OWNER_NAME || 'Amil Dev';

async function main() {
  const password = await bcrypt.hash(OWNER_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: OWNER_EMAIL.toLowerCase() },
    update: {
      password,
      name: OWNER_NAME,
      role: 'OWNER',
    },
    create: {
      email: OWNER_EMAIL.toLowerCase(),
      password,
      name: OWNER_NAME,
      role: 'OWNER',
    },
  });

  console.log(`Owner credentials ready for ${OWNER_EMAIL.toLowerCase()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
