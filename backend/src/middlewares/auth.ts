import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'HOSTEL_ADMIN';
  organizationId: string | null;
  organizationName: string | null;
  mustChangePassword: boolean;
  sessionId: string;
  tokenVersion: number;
};

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

type AccessTokenPayload = { sub: string; sid: string; ver: number; type: 'access' };

function accessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
  return secret;
}

export async function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = jwt.verify(authHeader.slice(7), accessSecret()) as AccessTokenPayload;
    if (payload.type !== 'access' || !payload.sub || !payload.sid) throw new Error('Invalid token type');
    const [user, session] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.sub }, include: { organization: true } }),
      prisma.session.findUnique({ where: { id: payload.sid } }),
    ]);
    const now = new Date();
    if (!user || !session || session.userId !== user.id || session.revokedAt || session.expiresAt <= now) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'This user account is not active.' });
    if (payload.ver !== user.tokenVersion) return res.status(401).json({ error: 'Session revoked. Please sign in again.' });
    if (user.role === 'HOSTEL_ADMIN' && (!user.organizationId || !user.organization || user.organization.status !== 'ACTIVE')) {
      return res.status(403).json({ error: 'This hostel account is not active.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AuthUser['role'],
      organizationId: user.organizationId,
      organizationName: user.organization?.name || null,
      mustChangePassword: user.mustChangePassword,
      sessionId: session.id,
      tokenVersion: user.tokenVersion,
    };
    return next();
  } catch (error) {
    if (error instanceof Error && error.message.includes('JWT_ACCESS_SECRET')) return next(error);
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.mustChangePassword) return res.status(403).json({ error: 'Create a new password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to do this.' });
    return next();
  };
}

export function requireOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.mustChangePassword) return res.status(403).json({ error: 'Create a new password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
  if (req.user.role !== 'HOSTEL_ADMIN' || !req.user.organizationId) {
    return res.status(403).json({ error: 'A hostel administrator account is required.' });
  }
  return next();
}

export function getOrganizationId(req: AuthenticatedRequest): string {
  if (!req.user?.organizationId) throw new Error('Organization context is missing');
  return req.user.organizationId;
}
