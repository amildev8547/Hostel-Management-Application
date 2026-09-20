import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to run the development seed.`);
  return value;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('The destructive development seed cannot run in production.');
  const superAdminPassword = required('SUPER_ADMIN_PASSWORD');
  const hostelAdminPassword = required('SEED_HOSTEL_ADMIN_PASSWORD');
  if (superAdminPassword.length < 12 || hostelAdminPassword.length < 12) throw new Error('Seed passwords must contain at least 12 characters.');

  console.log('Clearing local development data...');
  await prisma.auditLog.deleteMany();
  await prisma.credentialToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.devicePushToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.admissionSubmissionGuard.deleteMany();
  await prisma.admissionFormToken.deleteMany();
  await prisma.admissionApplication.deleteMany();
  await prisma.room.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const superAdmin = await prisma.user.create({
    data: {
      name: process.env.SUPER_ADMIN_NAME?.trim() || 'HostelHub Super Admin',
      email: required('SUPER_ADMIN_EMAIL').toLowerCase(),
      password: await bcrypt.hash(superAdminPassword, 12),
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  const organization = await prisma.organization.create({
    data: {
      name: 'HostelHub Demo Hostel',
      slug: 'hostelhub-demo',
      status: 'ACTIVE',
      plan: 'STANDARD',
      contactName: 'Demo Administrator',
      contactEmail: 'admin@demo-hostel.test',
      createdByUserId: superAdmin.id,
    },
  });
  const admin = await prisma.user.create({
    data: {
      name: 'Demo Hostel Admin',
      email: 'admin@demo-hostel.test',
      password: await bcrypt.hash(hostelAdminPassword, 12),
      role: 'HOSTEL_ADMIN',
      status: 'ACTIVE',
      organizationId: organization.id,
    },
  });
  const branch = await prisma.branch.create({
    data: {
      name: 'Demo Residency', address: '12 Sample Road, Bengaluru', phone: '9876543210', rentDueDay: 5,
      status: 'ACTIVE', organizationId: organization.id, legacyUserId: admin.id,
    },
  });
  const [room101, room102] = await Promise.all([
    prisma.room.create({ data: { roomNumber: '101', floor: 'Ground', roomType: '2 Share', capacity: 2, monthlyRent: 6500, admissionFee: 1500, organizationId: organization.id, branchId: branch.id } }),
    prisma.room.create({ data: { roomNumber: '102', floor: 'Ground', roomType: '3 Share', capacity: 3, monthlyRent: 5200, admissionFee: 1500, organizationId: organization.id, branchId: branch.id } }),
  ]);
  const resident = await prisma.tenant.create({
    data: {
      name: 'Demo Resident', phone: '9000000001', whatsappNumber: '9000000001', address: '', guardianName: '', guardianPhone: '',
      nearestPoliceStation: '', occupation: '', workLocation: '', joiningDate: new Date(), status: 'ACTIVE',
      organizationId: organization.id, roomId: room101.id,
    },
  });
  await prisma.payment.create({
    data: { amount: room101.monthlyRent, status: 'PENDING', paymentType: 'RENT', dueDate: new Date(), organizationId: organization.id, tenantId: resident.id, branchId: branch.id },
  });
  await prisma.setting.createMany({ data: [
    { key: 'business_name', value: organization.name, organizationId: organization.id },
    { key: 'currency', value: 'INR', organizationId: organization.id },
    { key: 'notification_alerts_enabled', value: 'true', userId: admin.id },
  ] });
  console.log(`Seed complete: ${organization.name}, rooms ${room101.roomNumber} and ${room102.roomNumber}.`);
  console.log(`Super Admin: ${superAdmin.email}`);
  console.log(`Hostel Admin: ${admin.email}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
