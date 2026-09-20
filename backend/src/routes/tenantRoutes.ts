import { Router } from 'express';
import {
  getTenants,
  getTenantById,
  updateTenant,
  moveTenant,
  vacateTenant,
  deleteTenant,
  createCustomRentInvoice,
  readmitTenant,
  createExistingTenant,
} from '../controllers/tenantController';
import { authenticateJWT, requireOrganization } from '../middlewares/auth';
import { validate, tenantEditSchema, customRentSchema, existingTenantSchema } from '../middlewares/validation';

const router = Router();

router.use(authenticateJWT, requireOrganization);

router.get('/', getTenants);
router.post('/existing', validate(existingTenantSchema), createExistingTenant);
router.get('/:id', getTenantById);
router.put('/:id', validate(tenantEditSchema), updateTenant);
router.post('/:id/move', moveTenant);
router.post('/:id/vacate', vacateTenant);
router.post('/:id/readmit', readmitTenant);
router.post('/:id/rent', validate(customRentSchema), createCustomRentInvoice);
router.delete('/:id', deleteTenant);

export default router;
