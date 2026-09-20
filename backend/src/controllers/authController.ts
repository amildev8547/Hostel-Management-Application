import { createHash, randomBytes } from 'crypto';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth';
import { writeAuditLog } from '../services/audit';

const REFRESH_DAYS = 30;

function accessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
  return secret;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user: any) {
  return {
    id: user.id, email: user.email, name: user.name, role: user.role, status: user.status,
    mustChangePassword: user.mustChangePassword,
    organization: user.organization ? { id: user.organization.id, name: user.organization.name, status: user.organization.status, plan: user.organization.plan } : null,
  };
}

async function createSession(req: AuthenticatedRequest, user: any) {
  const refreshToken = randomBytes(48).toString('hex');
  const session = await prisma.session.create({
    data: {
      refreshTokenHash: hashToken(refreshToken), userId: user.id,
      platform: String(req.body?.platform || 'unknown').slice(0, 40),
      deviceName: String(req.body?.deviceName || '').slice(0, 120) || undefined,
      userAgent: req.get('user-agent')?.slice(0, 500), ipAddress: req.ip,
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
    },
  });
  const accessToken = jwt.sign({ sub: user.id, sid: session.id, ver: user.tokenVersion, type: 'access' }, accessSecret(), { expiresIn: '15m' });
  return { accessToken, refreshToken, expiresIn: 900 };
}

export async function login(req: AuthenticatedRequest, res: Response) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  try {
    const user = await prisma.user.findUnique({ where: { email }, include: { organization: true } });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'This user account is not active.' });
    if (user.role === 'HOSTEL_ADMIN' && (!user.organization || user.organization.status !== 'ACTIVE')) return res.status(403).json({ error: 'This hostel account is not active.' });
    const tokens = await createSession(req, user);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.json({ user: publicUser(user), ...tokens });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Could not sign in.' });
  }
}

export async function refreshSession(req: AuthenticatedRequest, res: Response) {
  const refreshToken = String(req.body.refreshToken || '');
  try {
    const session = await prisma.session.findUnique({ where: { refreshTokenHash: hashToken(refreshToken) }, include: { user: { include: { organization: true } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    const user = session.user;
    if (user.status !== 'ACTIVE' || (user.role === 'HOSTEL_ADMIN' && user.organization?.status !== 'ACTIVE')) {
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return res.status(403).json({ error: 'This account is not active.' });
    }
    const nextRefreshToken = randomBytes(48).toString('hex');
    const updated = await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(nextRefreshToken), lastUsedAt: new Date() } });
    const accessToken = jwt.sign({ sub: user.id, sid: updated.id, ver: user.tokenVersion, type: 'access' }, accessSecret(), { expiresIn: '15m' });
    res.json({ user: publicUser(user), accessToken, refreshToken: nextRefreshToken, expiresIn: 900 });
  } catch (error) {
    console.error('Refresh session error:', error);
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { organization: true } });
  if (!user) return res.status(404).json({ error: 'User account not found.' });
  res.json(publicUser(user));
}

export async function updateMe(req: AuthenticatedRequest, res: Response) {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const currentPassword = String(req.body.currentPassword || '');
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { organization: true } });
  if (!user) return res.status(404).json({ error: 'User account not found.' });
  if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ error: 'Current password is incorrect.' });
  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== user.id) return res.status(409).json({ error: 'Another account already uses this email.' });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { name, email }, include: { organization: true } });
  await writeAuditLog(req, { action: 'USER_PROFILE_UPDATED', entityType: 'User', entityId: user.id });
  res.json(publicUser(updated));
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ error: 'Current password is incorrect.' });
  const password = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password, mustChangePassword: false, passwordChangedAt: new Date() } });
  await prisma.session.updateMany({ where: { userId: user.id, id: { not: req.user!.sessionId } }, data: { revokedAt: new Date() } });
  await writeAuditLog(req, { action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id });
  res.json({ message: 'Password changed. Other signed-in devices were logged out.' });
}

export async function logout(req: AuthenticatedRequest, res: Response) {
  await Promise.all([
    prisma.session.updateMany({ where: { id: req.user!.sessionId, userId: req.user!.id }, data: { revokedAt: new Date() } }),
    prisma.devicePushToken.updateMany({ where: { userId: req.user!.id, sessionId: req.user!.sessionId }, data: { active: false } }),
  ]);
  res.json({ message: 'Signed out.' });
}

export async function logoutAll(req: AuthenticatedRequest, res: Response) {
  await prisma.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 } } });
  await Promise.all([
    prisma.session.updateMany({ where: { userId: req.user!.id }, data: { revokedAt: new Date() } }),
    prisma.devicePushToken.updateMany({ where: { userId: req.user!.id }, data: { active: false } }),
  ]);
  res.json({ message: 'Signed out on all devices.' });
}

export async function listSessions(req: AuthenticatedRequest, res: Response) {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, platform: true, deviceName: true, lastUsedAt: true, createdAt: true, expiresAt: true }, orderBy: { lastUsedAt: 'desc' },
  });
  res.json(sessions.map((session) => ({ ...session, current: session.id === req.user!.sessionId })));
}
