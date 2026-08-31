import { Request, Response, NextFunction } from 'express';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

async function getSingleOwnerUser() {
  const email = (process.env.SINGLE_OWNER_EMAIL || 'owner@hostelhub.com').toLowerCase();
  const name = process.env.SINGLE_OWNER_NAME || 'Amil Dev';

  const existingOwner = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
  });

  if (existingOwner) {
    return existingOwner;
  }

  const password = await bcrypt.hash(process.env.SINGLE_OWNER_PASSWORD || 'owner123', 10);

  return prisma.user.create({
    data: {
      email,
      password,
      name,
      role: 'OWNER',
    },
  });
}

export async function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-for-hostelhub';

    try {
      const user = jwt.verify(token, secret);
      req.user = user as { id: string; email: string; role: string };
      return next();
    } catch (error) {
      console.warn('Ignoring invalid JWT because single-owner mode is enabled.');
    }
  }

  try {
    const owner = await getSingleOwnerUser();
    req.user = {
      id: owner.id,
      email: owner.email,
      role: owner.role,
    };
    next();
  } catch (error) {
    console.error('Single-owner authentication error:', error);
    res.status(500).json({ error: 'Failed to load single-owner account' });
  }
}
