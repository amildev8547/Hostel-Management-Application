import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth';
import { validate, bookingSchema } from '../middlewares/validation';
import { cancelBooking, createBooking, getBooking, getRoomBeds, listBookings } from '../controllers/bookingController';

const router = Router();
router.use(authenticateJWT);
router.get('/', listBookings);
router.post('/', validate(bookingSchema), createBooking);
router.get('/rooms/:roomId/beds', getRoomBeds);
router.get('/:id', getBooking);
router.delete('/:id', cancelBooking);
export default router;
