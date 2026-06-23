import { Router } from 'express';
import { login, register, forgotPassword, changePassword } from '../controllers/authController';
import { validate, loginSchema, forgotPasswordSchema, changePasswordSchema } from '../middlewares/validation';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/register', register);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/change-password', authenticateJWT, validate(changePasswordSchema), changePassword);

export default router;
