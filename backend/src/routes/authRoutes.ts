import { Router } from 'express';
import { z } from 'zod';
import { changePassword, getMe, listSessions, login, logout, logoutAll, refreshSession, updateMe } from '../controllers/authController';
import { authenticateJWT } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { rateLimit } from '../middlewares/rateLimit';
import { asyncHandler } from '../middlewares/asyncHandler';

const router = Router();
const email = z.string().trim().email().transform((value) => value.toLowerCase());

router.post('/login', rateLimit(15 * 60 * 1000, 10), validate(z.object({ body: z.object({ email, password: z.string().min(8), platform: z.string().optional(), deviceName: z.string().optional() }) })), asyncHandler(login));
router.post('/refresh', rateLimit(15 * 60 * 1000, 30), validate(z.object({ body: z.object({ refreshToken: z.string().min(40) }) })), asyncHandler(refreshSession));
router.use(authenticateJWT);
router.get('/me', asyncHandler(getMe));
router.patch('/me', validate(z.object({ body: z.object({ name: z.string().trim().min(2).max(100), email, currentPassword: z.string().min(8) }) })), asyncHandler(updateMe));
router.post('/change-password', validate(z.object({ body: z.object({ currentPassword: z.string().min(8), newPassword: z.string().min(10).max(128) }).refine((value) => value.currentPassword !== value.newPassword, { message: 'Choose a different new password.', path: ['newPassword'] }) })), asyncHandler(changePassword));
router.post('/logout', asyncHandler(logout));
router.post('/logout-all', asyncHandler(logoutAll));
router.get('/sessions', asyncHandler(listSessions));

export default router;
