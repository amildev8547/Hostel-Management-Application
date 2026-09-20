import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();
const USER_PREFERENCE_KEYS = new Set(['notification_alerts_enabled', 'dismissed_live_alerts']);

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54) || 'hostel';
}

async function uniqueSlug(base: string) {
  let slug = base;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) slug = `${base}-${suffix++}`;
  return slug;
}

async function ensureSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const plainPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !plainPassword) {
    console.log('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is missing; Super Admin bootstrap skipped.');
    return;
  }
  if (plainPassword.length < 12) throw new Error('SUPER_ADMIN_PASSWORD must contain at least 12 characters.');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'SUPER_ADMIN' && existing.organizationId) {
      throw new Error(`SUPER_ADMIN_EMAIL ${email} belongs to a hostel administrator. Use a separate email for the platform Super Admin.`);
    }
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'SUPER_ADMIN', status: 'ACTIVE', organizationId: null } });
    console.log(`Super Admin ready: ${email}`);
    return;
  }
  await prisma.user.create({
    data: { email, name: process.env.SUPER_ADMIN_NAME?.trim() || 'HostelHub Super Admin', password: await bcrypt.hash(plainPassword, 12), role: 'SUPER_ADMIN', status: 'ACTIVE' },
  });
  console.log(`Super Admin created: ${email}`);
}

async function migrateOwner(user: { id: string; name: string; email: string; organizationId: string | null; role: string }) {
  if (user.role === 'SUPER_ADMIN') return;
  let organizationId = user.organizationId;
  if (!organizationId) {
    const firstBranch = await prisma.branch.findFirst({ where: { legacyUserId: user.id }, orderBy: { createdAt: 'asc' } });
    const name = firstBranch?.name || `${user.name}'s Hostel`;
    const organization = await prisma.organization.create({
      data: {
        name,
        slug: await uniqueSlug(slugify(name)),
        contactName: user.name,
        contactEmail: user.email,
        status: 'ACTIVE',
        plan: 'STANDARD',
      },
    });
    organizationId = organization.id;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { email: user.email.trim().toLowerCase(), role: 'HOSTEL_ADMIN', status: 'ACTIVE', organizationId },
  });

  const branches = await prisma.branch.findMany({ where: { OR: [{ organizationId }, { legacyUserId: user.id }] }, select: { id: true } });
  const branchIds = branches.map((item) => item.id);
  if (branchIds.length) {
    await prisma.branch.updateMany({ where: { id: { in: branchIds } }, data: { organizationId } });
    await Promise.all([
      prisma.room.updateMany({ where: { branchId: { in: branchIds } }, data: { organizationId } }),
      prisma.booking.updateMany({ where: { branchId: { in: branchIds } }, data: { organizationId } }),
      prisma.admissionApplication.updateMany({ where: { branchId: { in: branchIds } }, data: { organizationId } }),
      prisma.payment.updateMany({ where: { branchId: { in: branchIds } }, data: { organizationId } }),
      prisma.admissionFormToken.updateMany({ where: { branchId: { in: branchIds } }, data: { organizationId } }),
      prisma.admissionSubmissionGuard.updateMany({ where: { branchId: { in: branchIds } }, data: { organizationId } }),
    ]);
    const rooms = await prisma.room.findMany({ where: { branchId: { in: branchIds } }, select: { id: true } });
    const roomIds = rooms.map((item) => item.id);
    if (roomIds.length) await prisma.tenant.updateMany({ where: { roomId: { in: roomIds } }, data: { organizationId } });
    const [tenants, applications] = await Promise.all([
      prisma.tenant.findMany({ where: { organizationId }, select: { id: true } }),
      prisma.admissionApplication.findMany({ where: { organizationId }, select: { id: true } }),
    ]);
    const tenantIds = tenants.map((item) => item.id);
    const applicationIds = applications.map((item) => item.id);
    if (tenantIds.length || applicationIds.length) {
      await prisma.document.updateMany({
        where: { OR: [
          ...(tenantIds.length ? [{ tenantId: { in: tenantIds } }] : []),
          ...(applicationIds.length ? [{ admissionApplicationId: { in: applicationIds } }] : []),
        ] },
        data: { organizationId },
      });
    }
  }
  await prisma.notification.updateMany({ where: { userId: user.id }, data: { organizationId } });
  const settings = await prisma.setting.findMany({ where: { userId: user.id } });
  for (const setting of settings) {
    if (!USER_PREFERENCE_KEYS.has(setting.key)) {
      await prisma.setting.update({ where: { id: setting.id }, data: { organizationId, userId: null } });
    }
  }
  console.log(`Migrated ${user.email} to organization ${organizationId}`);
}

async function verify() {
  const checks = await Promise.all([
    prisma.branch.count({ where: { organizationId: null } }),
    prisma.room.count({ where: { organizationId: null } }),
    prisma.tenant.count({ where: { organizationId: null } }),
    prisma.booking.count({ where: { organizationId: null } }),
    prisma.admissionApplication.count({ where: { organizationId: null } }),
    prisma.payment.count({ where: { organizationId: null } }),
    prisma.document.count({ where: { organizationId: null } }),
  ]);
  const labels = ['branches', 'rooms', 'residents', 'bookings', 'admissions', 'payments', 'documents'];
  const missing = checks.map((count, index) => ({ label: labels[index], count })).filter((item) => item.count > 0);
  if (missing.length) throw new Error(`Migration incomplete: ${missing.map((item) => `${item.count} ${item.label}`).join(', ')} still have no organization.`);
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, organizationId: true, role: true } });
  for (const user of users) await migrateOwner(user);
  await ensureSuperAdmin();
  await verify();
  console.log('Organization migration verified successfully.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
