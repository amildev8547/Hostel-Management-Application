import 'dotenv/config';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync, spawn, ChildProcess } from 'node:child_process';
import * as bcrypt from 'bcryptjs';

const PORT = 5123;
const API = `http://127.0.0.1:${PORT}/api`;

async function waitForServer(child: ChildProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Test API exited with code ${child.exitCode}`);
    try { if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) return; } catch { /* Wait for startup. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the test API.');
}

async function request(pathname: string, options: RequestInit & { token?: string } = {}) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  return fetch(`${API}${pathname}`, { ...options, headers });
}

async function login(email: string, password: string) {
  const response = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, platform: 'test' }) });
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${await response.text()}`);
  return response.json() as Promise<{ accessToken: string; refreshToken: string }>;
}

async function main() {
  process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, '../.cache/mongodb-binaries');
  fs.mkdirSync(process.env.MONGOMS_DOWNLOAD_DIR, { recursive: true });
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  const replSet = await MongoMemoryReplSet.create({
    binary: { version: '7.0.14', downloadDir: process.env.MONGOMS_DOWNLOAD_DIR },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const databaseUrl = replSet.getUri('hostelhub-isolation-test');
  const testEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: 'integration-test-secret-with-more-than-32-characters',
    SUPER_ADMIN_EMAIL: 'platform@test.local',
    SUPER_ADMIN_PASSWORD: 'StrongTestPassword!23',
    SUPER_ADMIN_NAME: 'Platform Admin',
    PORT: String(PORT),
    NODE_ENV: 'test',
  };

  process.env.DATABASE_URL = databaseUrl;
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  let server: ChildProcess | undefined;
  let serverOutput = '';
  try {
    const password = 'StrongTestPassword!23';
    const passwordHash = await bcrypt.hash(password, 4);

    const legacyOwner = await prisma.user.create({ data: { name: 'Legacy Owner', email: 'legacy@test.local', password: passwordHash, role: 'OWNER', status: 'ACTIVE' } });
    const legacyBranch = await prisma.branch.create({ data: { name: 'Legacy Hostel', address: 'Legacy address', phone: '', legacyUserId: legacyOwner.id } });
    const legacyRoom = await prisma.room.create({ data: { roomNumber: 'L1', floor: 'Ground', roomType: '2 Share', capacity: 2, monthlyRent: 4500, admissionFee: 900, branchId: legacyBranch.id } });
    const legacyTenant = await prisma.tenant.create({ data: { name: 'Legacy Resident', phone: '9111111111', whatsappNumber: '9111111111', address: '', guardianName: '', guardianPhone: '', nearestPoliceStation: '', occupation: '', workLocation: '', joiningDate: new Date(), roomId: legacyRoom.id } });
    const legacyApplication = await prisma.admissionApplication.create({ data: { name: 'Legacy Applicant', phone: '9222222222', whatsappNumber: '9222222222', address: 'Address', guardianName: 'Guardian', guardianPhone: '9333333333', nearestPoliceStation: 'Station', occupation: 'Work', workLocation: 'Office', joiningDate: new Date(), preferredRoomType: '2 Share', branchId: legacyBranch.id } });
    await Promise.all([
      prisma.payment.create({ data: { amount: 4500, paymentType: 'RENT', dueDate: new Date(), tenantId: legacyTenant.id, branchId: legacyBranch.id } }),
      prisma.document.create({ data: { fileName: 'identity.jpg', fileType: 'AADHAAR_FRONT', s3Key: 'legacy/key', s3Bucket: 'test', tenantId: legacyTenant.id } }),
      prisma.notification.create({ data: { title: 'Legacy', message: 'Legacy event', type: 'TEST', userId: legacyOwner.id } }),
      prisma.admissionFormToken.create({ data: { tokenHash: 'legacy-form-token', branchId: legacyBranch.id, expiresAt: new Date(Date.now() + 60000) } }),
      prisma.admissionSubmissionGuard.create({ data: { branchId: legacyBranch.id, phone: legacyApplication.phone, applicationId: legacyApplication.id } }),
      prisma.setting.create({ data: { key: 'payment_receiver_name', value: 'Legacy Payee', userId: legacyOwner.id } }),
      prisma.setting.create({ data: { key: 'notification_alerts_enabled', value: 'true', userId: legacyOwner.id } }),
    ]);
    execFileSync(process.execPath, [path.resolve(__dirname, '../node_modules/ts-node/dist/bin.js'), path.resolve(__dirname, '../prisma/migrateToOrganizations.ts')], { cwd: path.resolve(__dirname, '..'), env: testEnv, stdio: 'pipe' });
    const migratedOwner = await prisma.user.findUnique({ where: { id: legacyOwner.id } });
    assert.equal(migratedOwner?.role, 'HOSTEL_ADMIN');
    assert.ok(migratedOwner?.organizationId, 'Legacy owner must receive an organization.');
    const migratedOrganizationId = migratedOwner!.organizationId!;
    const migratedIds = await Promise.all([
      prisma.branch.count({ where: { organizationId: migratedOrganizationId } }), prisma.room.count({ where: { organizationId: migratedOrganizationId } }),
      prisma.tenant.count({ where: { organizationId: migratedOrganizationId } }), prisma.admissionApplication.count({ where: { organizationId: migratedOrganizationId } }),
      prisma.payment.count({ where: { organizationId: migratedOrganizationId } }), prisma.document.count({ where: { organizationId: migratedOrganizationId } }),
      prisma.notification.count({ where: { organizationId: migratedOrganizationId } }), prisma.admissionFormToken.count({ where: { organizationId: migratedOrganizationId } }),
      prisma.admissionSubmissionGuard.count({ where: { organizationId: migratedOrganizationId } }),
    ]);
    assert.deepEqual(migratedIds, [1, 1, 1, 1, 1, 1, 1, 1, 1], 'Every legacy record must be assigned to the migrated organization.');
    assert.equal((await prisma.payment.findFirst({ where: { organizationId: migratedOrganizationId } }))?.amount, 4500, 'Payment amounts must remain unchanged.');
    assert.equal((await prisma.tenant.findUnique({ where: { id: legacyTenant.id } }))?.roomId, legacyRoom.id, 'Resident room allocation must remain unchanged.');
    assert.equal((await prisma.admissionFormToken.findFirst({ where: { organizationId: migratedOrganizationId } }))?.tokenHash, 'legacy-form-token', 'Existing public form tokens must remain valid.');
    const organizationSetting = await prisma.setting.findFirst({ where: { organizationId: migratedOrganizationId, key: 'payment_receiver_name' } });
    const userPreference = await prisma.setting.findFirst({ where: { userId: legacyOwner.id, key: 'notification_alerts_enabled' } });
    assert.ok(organizationSetting && !organizationSetting.userId, 'Business settings must move to the organization.');
    assert.ok(userPreference && !userPreference.organizationId, 'Personal preferences must remain on the user.');

    await prisma.auditLog.deleteMany(); await prisma.credentialToken.deleteMany(); await prisma.session.deleteMany(); await prisma.devicePushToken.deleteMany();
    await prisma.notification.deleteMany(); await prisma.payment.deleteMany(); await prisma.document.deleteMany(); await prisma.booking.deleteMany(); await prisma.tenant.deleteMany();
    await prisma.admissionSubmissionGuard.deleteMany(); await prisma.admissionFormToken.deleteMany(); await prisma.admissionApplication.deleteMany();
    await prisma.room.deleteMany(); await prisma.branch.deleteMany(); await prisma.setting.deleteMany(); await prisma.user.deleteMany(); await prisma.organization.deleteMany();

    const superAdmin = await prisma.user.create({ data: { name: 'Platform Admin', email: 'platform@test.local', password: passwordHash, role: 'SUPER_ADMIN', status: 'ACTIVE' } });
    const organizationA = await prisma.organization.create({ data: { name: 'Hostel A', slug: 'hostel-a', maxBranches: 1, maxBeds: 2, createdByUserId: superAdmin.id } });
    const organizationB = await prisma.organization.create({ data: { name: 'Hostel B', slug: 'hostel-b', createdByUserId: superAdmin.id } });
    await prisma.user.create({ data: { name: 'Admin A', email: 'a@test.local', password: passwordHash, role: 'HOSTEL_ADMIN', status: 'ACTIVE', organizationId: organizationA.id } });
    await prisma.user.create({ data: { name: 'Admin B', email: 'b@test.local', password: passwordHash, role: 'HOSTEL_ADMIN', status: 'ACTIVE', organizationId: organizationB.id } });
    const branchA = await prisma.branch.create({ data: { name: 'Branch A', address: 'A address', phone: '', organizationId: organizationA.id } });
    const branchB = await prisma.branch.create({ data: { name: 'Branch B', address: 'B address', phone: '', organizationId: organizationB.id } });
    const roomA = await prisma.room.create({ data: { roomNumber: 'A1', floor: 'Ground', roomType: '2 Share', capacity: 2, monthlyRent: 5000, admissionFee: 1000, organizationId: organizationA.id, branchId: branchA.id } });
    const roomB = await prisma.room.create({ data: { roomNumber: 'B1', floor: 'Ground', roomType: '2 Share', capacity: 2, monthlyRent: 6000, admissionFee: 1200, organizationId: organizationB.id, branchId: branchB.id } });
    const tenantA = await prisma.tenant.create({ data: { name: 'Resident A', phone: '9000000001', whatsappNumber: '9000000001', address: '', guardianName: '', guardianPhone: '', nearestPoliceStation: '', occupation: '', workLocation: '', joiningDate: new Date(), organizationId: organizationA.id, roomId: roomA.id } });
    const applicationB = await prisma.admissionApplication.create({ data: { name: 'Applicant B', phone: '9000000002', whatsappNumber: '9000000002', address: 'B address', guardianName: 'Guardian', guardianPhone: '9000000003', nearestPoliceStation: 'Station', occupation: 'Work', workLocation: 'Office', joiningDate: new Date(), preferredRoomType: '2 Share', organizationId: organizationB.id, branchId: branchB.id } });
    const paymentB = await prisma.payment.create({ data: { amount: 6000, status: 'PENDING', paymentType: 'RENT', dueDate: new Date(), organizationId: organizationB.id, branchId: branchB.id } });

    server = spawn(process.execPath, [path.resolve(__dirname, '../dist/index.js')], { cwd: path.resolve(__dirname, '..'), env: testEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout?.on('data', (data) => { serverOutput += data.toString(); });
    server.stderr?.on('data', (data) => { serverOutput += data.toString(); });
    await waitForServer(server);

    assert.equal((await request('/branches')).status, 401, 'Anonymous hostel request must be rejected.');
    const [authA, authB, authSuper] = await Promise.all([login('a@test.local', password), login('b@test.local', password), login('platform@test.local', password)]);

    const branchesAResponse = await request('/branches', { token: authA.accessToken });
    assert.equal(branchesAResponse.status, 200);
    const branchesA = await branchesAResponse.json() as any[];
    assert.deepEqual(branchesA.map((branch) => branch.id), [branchA.id]);
    assert.equal((await request(`/branches/${branchB.id}`, { token: authA.accessToken })).status, 404, 'Admin A must not read Branch B.');
    assert.equal((await request('/rooms', { method: 'POST', token: authA.accessToken, body: JSON.stringify({ branchId: branchB.id, roomNumber: 'X1', floor: '1', roomType: '1 Share', capacity: 1, monthlyRent: 1, admissionFee: 1 }) })).status, 404, 'Admin A must not create a room in Branch B.');
    assert.equal((await request('/branches', { method: 'POST', token: authA.accessToken, body: JSON.stringify({ name: 'Extra Branch', address: 'Extra address', phone: '' }) })).status, 409, 'Organization branch limits must be enforced.');
    assert.equal((await request('/rooms', { method: 'POST', token: authA.accessToken, body: JSON.stringify({ branchId: branchA.id, roomNumber: 'A2', floor: '1', roomType: '1 Share', capacity: 1, monthlyRent: 1, admissionFee: 1 }) })).status, 409, 'Organization bed limits must be enforced.');
    assert.equal((await request(`/tenants/${tenantA.id}/move`, { method: 'POST', token: authA.accessToken, body: JSON.stringify({ newRoomId: roomB.id }) })).status, 404, 'A resident must not move into another organization.');
    assert.equal((await request(`/admissions/${applicationB.id}`, { token: authA.accessToken })).status, 404, 'Admin A must not read Admission B.');
    assert.equal((await request(`/payments/${paymentB.id}/link`, { method: 'POST', token: authA.accessToken, body: '{}' })).status, 404, 'Admin A must not open Payment B.');

    await request('/settings', { method: 'POST', token: authA.accessToken, body: JSON.stringify({ key: 'payment_receiver_name', value: 'Hostel A Payee' }) });
    const settingsB = await (await request('/settings', { token: authB.accessToken })).json() as Record<string, string>;
    assert.equal(settingsB.payment_receiver_name, undefined, 'Organization settings must not leak.');
    assert.equal((await request('/super-admin/dashboard', { token: authA.accessToken })).status, 403, 'Hostel Admin must not call Super Admin APIs.');
    assert.equal((await request('/branches', { token: authSuper.accessToken })).status, 403, 'Super Admin must not use hostel CRUD without organization context.');

    const createOrganizationResponse = await request('/super-admin/organizations', { method: 'POST', token: authSuper.accessToken, body: JSON.stringify({ name: 'Hostel C', adminName: 'Admin C', adminEmail: 'c@test.local' }) });
    assert.equal(createOrganizationResponse.status, 201);
    const createdAccount = await createOrganizationResponse.json() as any;
    assert.ok(createdAccount.temporaryPassword && createdAccount.admin.mustChangePassword, 'New administrators must receive a one-time temporary password.');
    const authC = await login('c@test.local', createdAccount.temporaryPassword);
    assert.equal((await request('/branches', { token: authC.accessToken })).status, 403, 'Temporary credentials must not access hostel data before password change.');
    assert.equal((await request('/auth/change-password', { method: 'POST', token: authC.accessToken, body: JSON.stringify({ currentPassword: createdAccount.temporaryPassword, newPassword: 'A-New-Secure-Password!45' }) })).status, 200);
    assert.equal((await request('/branches', { token: authC.accessToken })).status, 200, 'Administrator access must open after the required password change.');

    const suspendResponse = await request(`/super-admin/organizations/${organizationA.id}`, { method: 'PATCH', token: authSuper.accessToken, body: JSON.stringify({ status: 'SUSPENDED' }) });
    assert.equal(suspendResponse.status, 200);
    assert.ok([401, 403].includes((await request('/branches', { token: authA.accessToken })).status), 'Suspension must block an existing access token immediately.');
    assert.ok([401, 403].includes((await request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: authA.refreshToken }) })).status), 'Suspension must block refresh.');

    console.log('Multi-tenant isolation integration test passed.');
  } catch (error) {
    console.error(serverOutput);
    throw error;
  } finally {
    if (server && server.exitCode === null) server.kill();
    await prisma.$disconnect();
    await replSet.stop();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
