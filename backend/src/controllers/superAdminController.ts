import { randomBytes } from 'crypto';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth';
import { writeAuditLog } from '../services/audit';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function temporaryPassword() {
  return `Hh!${randomBytes(9).toString('base64url')}`;
}

export async function getPlatformDashboard(_req: AuthenticatedRequest, res: Response) {
  const [organizations, activeOrganizations, suspendedOrganizations, users, branches, rooms, bedTotals, residents] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: 'ACTIVE' } }),
    prisma.organization.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { role: 'HOSTEL_ADMIN' } }),
    prisma.branch.count(), prisma.room.count(), prisma.room.aggregate({ _sum: { capacity: true } }), prisma.tenant.count({ where: { status: 'ACTIVE' } }),
  ]);
  res.json({ organizations, activeOrganizations, suspendedOrganizations, hostelAdmins: users, branches, rooms, beds: bedTotals._sum.capacity || 0, activeResidents: residents });
}

export async function listOrganizations(req: AuthenticatedRequest, res: Response) {
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const organizations = await prisma.organization.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { contactEmail: { contains: search, mode: 'insensitive' } }] } : {}),
    },
    include: {
      users: { where: { role: 'HOSTEL_ADMIN' }, select: { id: true, name: true, email: true, status: true, lastLoginAt: true, mustChangePassword: true } },
      _count: { select: { branches: true, rooms: true, tenants: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(organizations);
}

export async function getOrganization(req: AuthenticatedRequest, res: Response) {
  const organization = await prisma.organization.findUnique({
    where: { id: req.params.id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, status: true, mustChangePassword: true, lastLoginAt: true, createdAt: true } },
      branches: { select: { id: true, name: true, address: true, status: true } },
      _count: { select: { rooms: true, tenants: true, admissionApplications: true, payments: true } },
    },
  });
  if (!organization) return res.status(404).json({ error: 'Hostel organization not found.' });
  res.json(organization);
}

export async function createOrganization(req: AuthenticatedRequest, res: Response) {
  const { name, contactName, contactPhone, contactEmail, plan = 'STANDARD', maxBranches, maxBeds, adminName, adminEmail } = req.body;
  const email = String(adminEmail).trim().toLowerCase();
  const baseSlug = slugify(String(name)) || `hostel-${Date.now()}`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'An account already uses this administrator email.' });
  let slug = baseSlug;
  if (await prisma.organization.findUnique({ where: { slug } })) slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
  const passwordPlain = temporaryPassword();
  const password = await bcrypt.hash(passwordPlain, 12);

  const organization = await prisma.organization.create({
    data: {
      name: String(name).trim(), slug, contactName: String(contactName || '').trim() || undefined,
      contactPhone: String(contactPhone || '').replace(/\D/g, '') || undefined,
      contactEmail: String(contactEmail || '').trim().toLowerCase() || undefined,
      plan, maxBranches, maxBeds, createdByUserId: req.user!.id,
    },
  });
  try {
    const admin = await prisma.user.create({
      data: { name: String(adminName).trim(), email, password, role: 'HOSTEL_ADMIN', status: 'ACTIVE', mustChangePassword: true, organizationId: organization.id },
      select: { id: true, name: true, email: true, role: true, status: true, mustChangePassword: true },
    });
    await writeAuditLog(req, { action: 'ORGANIZATION_CREATED', organizationId: organization.id, entityType: 'Organization', entityId: organization.id, metadata: { adminUserId: admin.id, plan } });
    res.status(201).json({ organization, admin, temporaryPassword: passwordPlain, message: 'Hostel account created. Share the temporary password securely; it is shown only once.' });
  } catch (error) {
    await prisma.organization.delete({ where: { id: organization.id } }).catch(() => undefined);
    throw error;
  }
}

export async function updateOrganization(req: AuthenticatedRequest, res: Response) {
  const current = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: 'Hostel organization not found.' });
  const { name, contactName, contactPhone, contactEmail, status, plan, maxBranches, maxBeds } = req.body;
  const organization = await prisma.organization.update({
    where: { id: current.id },
    data: { name, contactName, contactPhone, contactEmail, status, plan, maxBranches, maxBeds },
  });
  if (status === 'SUSPENDED' || status === 'ARCHIVED') {
    const users = await prisma.user.findMany({ where: { organizationId: current.id }, select: { id: true } });
    const ids = users.map((user) => user.id);
    await Promise.all([
      prisma.user.updateMany({ where: { id: { in: ids } }, data: { tokenVersion: { increment: 1 } } }),
      prisma.session.updateMany({ where: { userId: { in: ids }, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }
  await writeAuditLog(req, { action: `ORGANIZATION_${organization.status}`, organizationId: organization.id, entityType: 'Organization', entityId: organization.id, metadata: { previousStatus: current.status, plan: organization.plan } });
  res.json(organization);
}

export async function createOrganizationAdmin(req: AuthenticatedRequest, res: Response) {
  const organization = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!organization) return res.status(404).json({ error: 'Hostel organization not found.' });
  const email = String(req.body.email).trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'An account already uses this email.' });
  const passwordPlain = temporaryPassword();
  const admin = await prisma.user.create({
    data: { name: String(req.body.name).trim(), email, password: await bcrypt.hash(passwordPlain, 12), role: 'HOSTEL_ADMIN', status: 'ACTIVE', mustChangePassword: true, organizationId: organization.id },
    select: { id: true, name: true, email: true, role: true, status: true, mustChangePassword: true },
  });
  await writeAuditLog(req, { action: 'HOSTEL_ADMIN_CREATED', organizationId: organization.id, entityType: 'User', entityId: admin.id });
  res.status(201).json({ admin, temporaryPassword: passwordPlain, message: 'Administrator created. The temporary password is shown only once.' });
}

export async function resetOrganizationAdmin(req: AuthenticatedRequest, res: Response) {
  const admin = await prisma.user.findFirst({ where: { id: req.params.userId, organizationId: req.params.id, role: 'HOSTEL_ADMIN' } });
  if (!admin) return res.status(404).json({ error: 'Hostel administrator not found.' });
  const passwordPlain = temporaryPassword();
  await prisma.user.update({
    where: { id: admin.id },
    data: { password: await bcrypt.hash(passwordPlain, 12), mustChangePassword: true, status: 'ACTIVE', tokenVersion: { increment: 1 } },
  });
  await prisma.session.updateMany({ where: { userId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await writeAuditLog(req, { action: 'HOSTEL_ADMIN_ACCESS_RESET', organizationId: req.params.id, entityType: 'User', entityId: admin.id });
  res.json({ temporaryPassword: passwordPlain, message: 'Access reset. The temporary password is shown only once.' });
}

export async function updateOrganizationAdminStatus(req: AuthenticatedRequest, res: Response) {
  const admin = await prisma.user.findFirst({ where: { id: req.params.userId, organizationId: req.params.id, role: 'HOSTEL_ADMIN' } });
  if (!admin) return res.status(404).json({ error: 'Hostel administrator not found.' });
  const status = String(req.body.status);
  const updated = await prisma.user.update({ where: { id: admin.id }, data: { status, ...(status === 'SUSPENDED' ? { tokenVersion: { increment: 1 } } : {}) }, select: { id: true, name: true, email: true, status: true } });
  if (status === 'SUSPENDED') await prisma.session.updateMany({ where: { userId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await writeAuditLog(req, { action: `HOSTEL_ADMIN_${status}`, organizationId: req.params.id, entityType: 'User', entityId: admin.id });
  res.json(updated);
}

export async function listAuditLogs(req: AuthenticatedRequest, res: Response) {
  const logs = await prisma.auditLog.findMany({
    where: req.query.organizationId ? { organizationId: String(req.query.organizationId) } : {},
    include: { actor: { select: { id: true, name: true, email: true, role: true } }, organization: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  res.json(logs);
}
