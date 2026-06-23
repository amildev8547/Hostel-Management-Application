import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { updateRoomOccupancyStatus } from '../utils/occupancy';

export async function createRoom(req: AuthenticatedRequest, res: Response) {
  const { branchId, roomNumber, floor, roomType, capacity, monthlyRent, admissionFee, status } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Confirm branch belongs to owner
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.userId !== userId) {
      return res.status(404).json({ error: 'Branch not found or unauthorized' });
    }

    const room = await prisma.room.create({
      data: {
        roomNumber,
        floor,
        roomType,
        capacity,
        monthlyRent,
        admissionFee,
        status: status || 'AVAILABLE',
        branchId,
      },
    });

    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
}

export async function getRooms(req: AuthenticatedRequest, res: Response) {
  const { branchId } = req.query;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!branchId) return res.status(400).json({ error: 'branchId is required' });

  try {
    // Confirm branch belongs to owner
    const branch = await prisma.branch.findUnique({
      where: { id: branchId as string },
    });

    if (!branch || branch.userId !== userId) {
      return res.status(404).json({ error: 'Branch not found or unauthorized' });
    }

    const rooms = await prisma.room.findMany({
      where: { branchId: branchId as string },
      include: {
        tenants: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { roomNumber: 'asc' },
    });

    // Map to include vacancy metrics in response
    const results = rooms.map((room) => {
      const occupied = room.tenants.length;
      return {
        ...room,
        occupied,
        vacant: room.capacity - occupied,
      };
    });

    res.json(results);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to retrieve rooms' });
  }
}

export async function getRoomById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        branch: true,
        tenants: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!room || room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Fetch payments associated with active tenants of this room
    const tenantIds = room.tenants.map((t) => t.id);
    const payments = await prisma.payment.findMany({
      where: { tenantId: { in: tenantIds } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const occupied = room.tenants.length;
    res.json({
      ...room,
      occupied,
      vacant: room.capacity - occupied,
      occupancyPercentage: room.capacity > 0 ? Math.round((occupied / room.capacity) * 100) : 0,
      paymentHistory: payments,
    });
  } catch (error) {
    console.error('Get room by ID error:', error);
    res.status(500).json({ error: 'Failed to retrieve room details' });
  }
}

export async function updateRoom(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { roomNumber, floor, roomType, capacity, monthlyRent, admissionFee, status } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const room = await prisma.room.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!room || room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const updated = await prisma.room.update({
      where: { id },
      data: {
        roomNumber,
        floor,
        roomType,
        capacity,
        monthlyRent,
        admissionFee,
        status,
      },
    });

    // Recalculate room occupancy status since capacity or status might have changed
    await updateRoomOccupancyStatus(id);

    res.json(updated);
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
}

export async function deleteRoom(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const room = await prisma.room.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!room || room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if room has active tenants before deletion
    const activeTenantsCount = await prisma.tenant.count({
      where: { roomId: id, status: 'ACTIVE' },
    });

    if (activeTenantsCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete room with active tenants. Vacate or move them first.',
      });
    }

    await prisma.room.delete({ where: { id } });
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
}
