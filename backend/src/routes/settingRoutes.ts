import { Router } from 'express';
import { getSettings, updateSetting } from '../controllers/settingController';
import { authenticateJWT, requireOrganization } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT, requireOrganization);

router.get('/', getSettings);
router.post('/', updateSetting);

export default router;
