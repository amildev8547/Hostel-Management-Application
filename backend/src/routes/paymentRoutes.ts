import { Router } from 'express';
import {
  getPayments,
  generateMonthlyRentDues,
  triggerPaymentLink,
  sendPaymentReminder,
  handleCallback,
  handleWebhook,
  simulateWebhook,
  recordManualPayment,
  customizePaymentAmount,
  editPaymentAmount,
} from '../controllers/paymentController';
import { authenticateJWT } from '../middlewares/auth';
import { validate, customRentSchema } from '../middlewares/validation';

const router = Router();

// Public / webhook endpoints
router.get('/callback', handleCallback);
router.post('/webhook', handleWebhook);
router.post('/simulate-webhook/:paymentId', simulateWebhook);
router.get('/simulate-webhook/:paymentId', simulateWebhook); // Allow GET for quick browser testing!

// Authenticated owner endpoints
router.get('/', authenticateJWT, getPayments);
router.post('/generate-dues', authenticateJWT, generateMonthlyRentDues);
router.post('/:id/link', authenticateJWT, triggerPaymentLink);
router.post('/:id/reminder', authenticateJWT, sendPaymentReminder);
router.post('/:id/record-pay', authenticateJWT, recordManualPayment);
router.put('/:id/customize', authenticateJWT, validate(customRentSchema), customizePaymentAmount);
router.put('/:id/edit-amount', authenticateJWT, editPaymentAmount);

export default router;
