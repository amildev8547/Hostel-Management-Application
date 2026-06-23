import { Router } from 'express';
import {
  getTenants,
  getTenantById,
  updateTenant,
  moveTenant,
  vacateTenant,
  deleteTenant,
  createCustomRentInvoice,
} from '../controllers/tenantController';
import { authenticateJWT } from '../middlewares/auth';
import { validate, tenantEditSchema, customRentSchema } from '../middlewares/validation';

const router = Router();

router.use(authenticateJWT);

router.get('/', getTenants);
router.get('/:id', getTenantById);
router.put('/:id', validate(tenantEditSchema), updateTenant);
router.post('/:id/move', moveTenant);
router.post('/:id/vacate', vacateTenant);
router.post('/:id/rent', validate(customRentSchema), createCustomRentInvoice);
router.delete('/:id', deleteTenant);

export default router;
