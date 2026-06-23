import { Router } from 'express';
import {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
  getBranchDashboard,
} from '../controllers/branchController';
import { authenticateJWT } from '../middlewares/auth';
import { validate, branchSchema } from '../middlewares/validation';

const router = Router();

router.use(authenticateJWT);

router.post('/', validate(branchSchema), createBranch);
router.get('/', getBranches);
router.get('/:id', getBranchById);
router.put('/:id', validate(branchSchema), updateBranch);
router.delete('/:id', deleteBranch);
router.get('/:id/dashboard', getBranchDashboard);

export default router;
