import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-hostelhub';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
}

export async function register(req: Request, res: Response) {
  const { email, password, name } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: passwordHash,
        name,
        role: 'OWNER',
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: newPasswordHash },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error while changing password' });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // For security, don't disclose that the user does not exist
      return res.json({ message: 'If the email exists, a password reset link has been sent.' });
    }

    // Simulate sending password reset email
    console.log(`[FORGOT PASSWORD] Generated reset token for ${email}`);
    const resetLink = `${process.env.BACKEND_URL || 'http://localhost:5000'}/reset-password?token=${Math.random().toString(36).substring(2)}`;
    console.log(`[FORGOT PASSWORD] Simulated Link: ${resetLink}`);

    res.json({
      message: 'If the email exists, a password reset link has been sent.',
      debugLink: resetLink, // Handy for testing local development!
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error during forgot password request' });
  }
}
