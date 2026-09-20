import { Router } from 'express';
import {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
} from '../controllers/roomController';
import { authenticateJWT, requireOrganization } from '../middlewares/auth';
import { validate, roomSchema } from '../middlewares/validation';

const router = Router();

router.use(authenticateJWT, requireOrganization);

router.post('/', validate(roomSchema), createRoom);
router.get('/', getRooms);
router.get('/:id', getRoomById);
router.put('/:id', validate(roomSchema), updateRoom);
router.delete('/:id', deleteRoom);

export default router;
