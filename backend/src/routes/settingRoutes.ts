import { Router } from 'express';
import { getSettings, updateSetting } from '../controllers/settingController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', getSettings);
router.post('/', updateSetting);

export default router;
