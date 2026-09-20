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
import { authenticateJWT, requireOrganization } from '../middlewares/auth';
import { validate, customRentSchema } from '../middlewares/validation';

const router = Router();

router.use(authenticateJWT, requireOrganization);
router.get('/', getPayments);
router.post('/generate-dues', generateMonthlyRentDues);
router.post('/:id/link', getManualPaymentLink);
router.post('/:id/reminder', sendPaymentReminder);
router.post('/:id/record-pay', recordManualPayment);
router.put('/:id/customize', validate(customRentSchema), customizePaymentAmount);
router.put('/:id/edit-amount', editPaymentAmount);

export default router;
