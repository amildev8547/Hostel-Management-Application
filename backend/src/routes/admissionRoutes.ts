import { Router } from 'express';
import {
  submitAdmissionApplication,
  getAdmissionApplications,
  getAdmissionApplicationById,
  reviewApplication,
} from '../controllers/admissionController';
import { authenticateJWT } from '../middlewares/auth';
import { validate, publicAdmissionFormSchema } from '../middlewares/validation';

const router = Router();

// Public apply endpoint (No login required)
router.post('/apply', validate(publicAdmissionFormSchema), submitAdmissionApplication);

// Owner-protected endpoints
router.get('/', authenticateJWT, getAdmissionApplications);
router.get('/:id', authenticateJWT, getAdmissionApplicationById);
router.post('/:id/review', authenticateJWT, reviewApplication);

export default router;
