import { Router } from 'express';
import {
  getPayments,
  generateMonthlyRentDues,
  getManualPaymentLink,
  sendPaymentReminder,
  recordManualPayment,
  customizePaymentAmount,
  editPaymentAmount,
} from '../controllers/paymentController';
import { authenticateJWT } from '../middlewares/auth';
import { validate, customRentSchema } from '../middlewares/validation';

const router = Router();

// Authenticated owner endpoints
router.get('/', authenticateJWT, getPayments);
router.post('/generate-dues', authenticateJWT, generateMonthlyRentDues);
router.post('/:id/link', authenticateJWT, getManualPaymentLink);
router.post('/:id/reminder', authenticateJWT, sendPaymentReminder);
router.post('/:id/record-pay', authenticateJWT, recordManualPayment);
router.put('/:id/customize', authenticateJWT, validate(customRentSchema), customizePaymentAmount);
router.put('/:id/edit-amount', authenticateJWT, editPaymentAmount);

export default router;
