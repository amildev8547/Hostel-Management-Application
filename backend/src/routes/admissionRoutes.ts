import { Router, Request, Response, NextFunction } from 'express';
import {
  submitAdmissionApplication,
  getAdmissionApplications,
  getAdmissionApplicationById,
  reviewApplication,
  changeAdmissionFeeStatus,
  deleteAdmissionApplication,
} from '../controllers/admissionController';
import { authenticateJWT } from '../middlewares/auth';
import { admissionFeeStatusSchema, validate, publicAdmissionFormSchema } from '../middlewares/validation';

const router = Router();

const publicSubmissionAttempts = new Map<string, { count: number; resetAt: number }>();
export function limitPublicAdmissionSubmissions(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const current = publicSubmissionAttempts.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + 15 * 60 * 1000 }
    : { ...current, count: current.count + 1 };
  publicSubmissionAttempts.set(key, entry);

  if (publicSubmissionAttempts.size > 10_000) {
    for (const [ip, value] of publicSubmissionAttempts) if (value.resetAt <= now) publicSubmissionAttempts.delete(ip);
  }
  if (entry.count > 5) {
    res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many form submissions. Please wait 15 minutes and try again.' });
  }
  next();
}

// Public apply endpoint (No login required)
router.post('/apply', validate(publicAdmissionFormSchema), submitAdmissionApplication);

// Owner-protected endpoints
router.get('/', authenticateJWT, getAdmissionApplications);
router.get('/:id', authenticateJWT, getAdmissionApplicationById);
router.patch('/:id/fee-status', authenticateJWT, validate(admissionFeeStatusSchema), changeAdmissionFeeStatus);
router.post('/:id/review', authenticateJWT, reviewApplication);
router.delete('/:id', authenticateJWT, deleteAdmissionApplication);

export default router;
