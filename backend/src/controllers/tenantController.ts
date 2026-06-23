import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { updateRoomOccupancyStatus } from '../utils/occupancy';

export async function getTenants(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { branchId, status, search } = req.query;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        room: {
          branch: { userId },
          ...(branchId ? { id: branchId as string } : {}),
        },
        ...(status ? { status: status as string } : { status: 'ACTIVE' }), // Default to active
        ...(search
          ? {
              OR: [
                { name: { contains: search as string } },
                { phone: { contains: search as string } },
                { room: { roomNumber: { contains: search as string } } },
              ],
            }
          : {}),
      },
      include: {
        room: {
          include: { branch: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(tenants);
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({ error: 'Failed to retrieve tenants' });
  }
}

export async function getTenantById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        room: {
          include: { branch: true },
        },
        payments: {
          orderBy: { dueDate: 'desc' },
        },
        documents: true,
      },
    });

    if (!tenant || tenant.room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Get tenant details error:', error);
    res.status(500).json({ error: 'Failed to retrieve tenant details' });
  }
}

export async function updateTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: req.body, // Validated parameters parsed by Zod in routes
    });

    res.json(updated);
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
}

export async function moveTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { newRoomId } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!newRoomId) return res.status(400).json({ error: 'newRoomId is required' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot move a vacated tenant.' });
    }

    const oldRoomId = tenant.roomId;

    if (oldRoomId === newRoomId) {
      return res.status(400).json({ error: 'Tenant is already in this room.' });
    }

    // Verify space in new room
    const newRoom = await prisma.room.findUnique({
      where: { id: newRoomId },
      include: { tenants: { where: { status: 'ACTIVE' } }, branch: true },
    });

    if (!newRoom || newRoom.branch.userId !== userId) {
      return res.status(404).json({ error: 'Selected room not found' });
    }

    if (newRoom.tenants.length >= newRoom.capacity) {
      return res.status(400).json({ error: 'Selected room is already fully occupied' });
    }

    // Update Tenant Room assignment
    const updated = await prisma.tenant.update({
      where: { id },
      data: { roomId: newRoomId },
    });

    // Update occupancy statuses
    await updateRoomOccupancyStatus(oldRoomId);
    await updateRoomOccupancyStatus(newRoomId);

    // Record activity
    await prisma.notification.create({
      data: {
        title: 'Tenant Room Reallocated',
        message: `Tenant ${tenant.name} was moved from Room ${tenant.room.roomNumber} to Room ${newRoom.roomNumber}.`,
        type: 'ADMISSION_APPROVED',
        userId,
      },
    });

    res.json({ message: 'Tenant successfully relocated', tenant: updated });
  } catch (error) {
    console.error('Move tenant error:', error);
    res.status(500).json({ error: 'Failed to relocate tenant' });
  }
}

export async function vacateTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.status === 'VACATED') {
      return res.status(400).json({ error: 'Tenant has already vacated' });
    }

    // Update tenant status and leaving date
    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        status: 'VACATED',
        leavingDate: new Date(),
      },
    });

    // Update room occupancy status
    await updateRoomOccupancyStatus(tenant.roomId);

    // Notify Owner
    await prisma.notification.create({
      data: {
        title: 'Tenant Vacated',
        message: `Tenant ${tenant.name} has checked out of Room ${tenant.room.roomNumber}.`,
        type: 'TENANT_VACATED',
        userId,
      },
    });

    res.json({ message: 'Tenant vacated successfully', tenant: updated });
  } catch (error) {
    console.error('Vacate tenant error:', error);
    res.status(500).json({ error: 'Failed to vacate tenant' });
  }
}

// Create a rent invoice for a custom number of days (e.g. a tenant staying only 10/15/20 days),
// with an optional discount. Uses a flat 30-day month as the per-day rate basis.
export async function createCustomRentInvoice(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { days, discountAmount = 0, dueDate } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot generate a rent invoice for a vacated tenant.' });
    }

    const perDayRate = tenant.room.monthlyRent / 30;
    const originalAmount = Math.round(perDayRate * days);
    const amount = Math.max(0, originalAmount - discountAmount);

    const payment = await prisma.payment.create({
      data: {
        amount,
        originalAmount,
        discountAmount,
        daysBilled: days,
        status: 'PENDING',
        paymentType: 'RENT',
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        tenantId: tenant.id,
        branchId: tenant.room.branchId,
      },
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Create custom rent invoice error:', error);
    res.status(500).json({ error: 'Failed to create rent invoice' });
  }
}

export async function deleteTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const roomId = tenant.roomId;
    await prisma.tenant.delete({ where: { id } });

    // Recalculate room occupancy status
    await updateRoomOccupancyStatus(roomId);

    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
}
