import { Router } from 'express';
import { deleteNotification, getNotifications, markAsRead, registerPushToken } from '../controllers/notificationController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', getNotifications);
router.post('/push-token', registerPushToken);
router.post('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
