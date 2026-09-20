import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error('Set SUPER_ADMIN_EMAIL and a SUPER_ADMIN_PASSWORD with at least 12 characters.');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account exists for ${email}. Run migrate:organizations first.`);
  if (user.role !== 'SUPER_ADMIN') throw new Error(`${email} is not a Super Admin account.`);
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 12), role: 'SUPER_ADMIN', status: 'ACTIVE', organizationId: null, mustChangePassword: true, tokenVersion: { increment: 1 } } });
  await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  console.log(`Super Admin access reset for ${email}. All previous sessions were revoked.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
