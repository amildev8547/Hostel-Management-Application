import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { updateRoomOccupancyStatus } from '../utils/occupancy';
import { ensureCurrentMonthRentInvoice } from '../utils/rentBilling';
import { createOwnerNotification } from '../services/notifications';

export async function getTenants(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { branchId, status, search } = req.query;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        room: {
          branch: { userId },
          ...(branchId ? { branchId: branchId as string } : {}),
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
      include: { tenants: { where: { status: 'ACTIVE' } }, bookings: true, branch: true },
    });

    if (!newRoom || newRoom.branch.userId !== userId) {
      return res.status(404).json({ error: 'Selected room not found' });
    }

    const reservedBeds = newRoom.bookings.filter((booking) => booking.status !== 'OCCUPIED').length;
    if (newRoom.tenants.length + reservedBeds >= newRoom.capacity) {
      return res.status(400).json({ error: 'Selected room is already fully occupied' });
    }

    // Update Tenant Room assignment
    await prisma.booking.deleteMany({ where: { tenantId: id } });
    const updated = await prisma.tenant.update({
      where: { id },
      data: { roomId: newRoomId },
    });

    // Update occupancy statuses
    await updateRoomOccupancyStatus(oldRoomId);
    await updateRoomOccupancyStatus(newRoomId);

    // Record activity
    await createOwnerNotification({
      title: 'Resident Room Changed',
      message: `${tenant.name} was moved from Room ${tenant.room.roomNumber} to Room ${newRoom.roomNumber}.`,
      type: 'ADMISSION_APPROVED',
      userId,
      branchId: newRoom.branchId,
      tenantId: id,
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

    await prisma.booking.deleteMany({ where: { tenantId: id } });

    // Update room occupancy status
    await updateRoomOccupancyStatus(tenant.roomId);

    // Notify Owner
    await createOwnerNotification({
      title: 'Resident Moved Out',
      message: `${tenant.name} has moved out of Room ${tenant.room.roomNumber}.`,
      type: 'TENANT_VACATED',
      userId,
      branchId: tenant.room.branchId,
      tenantId: id,
    });

    res.json({ message: 'Tenant vacated successfully', tenant: updated });
  } catch (error) {
    console.error('Vacate tenant error:', error);
    res.status(500).json({ error: 'Failed to vacate tenant' });
  }
}

export async function readmitTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { newRoomId } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!newRoomId) return res.status(400).json({ error: 'Choose a room for the returning resident.' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.userId !== userId) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    if (tenant.status !== 'VACATED') {
      return res.status(400).json({ error: 'This resident is already active.' });
    }

    const newRoom = await prisma.room.findUnique({
      where: { id: newRoomId },
      include: { tenants: { where: { status: 'ACTIVE' } }, bookings: true, branch: true },
    });
    if (!newRoom || newRoom.branch.userId !== userId) {
      return res.status(404).json({ error: 'Selected room not found' });
    }

    const reservedBeds = newRoom.bookings.filter((booking) => booking.status !== 'OCCUPIED').length;
    if (newRoom.tenants.length + reservedBeds >= newRoom.capacity) {
      return res.status(400).json({ error: 'The selected room does not have a free place.' });
    }

    const oldRoomId = tenant.roomId;
    await prisma.booking.deleteMany({ where: { tenantId: id } });
    const returningJoiningDate = new Date();
    const claim = await prisma.tenant.updateMany({
      where: { id, status: 'VACATED' },
      data: {
        roomId: newRoomId,
        status: 'ACTIVE',
        joiningDate: returningJoiningDate,
        leavingDate: null,
      },
    });
    if (claim.count !== 1) {
      return res.status(409).json({ error: 'This resident was already admitted again on another device.' });
    }
    const updated = await prisma.tenant.findUnique({ where: { id } });

    if (oldRoomId !== newRoomId) await updateRoomOccupancyStatus(oldRoomId);
    await updateRoomOccupancyStatus(newRoomId);
    await ensureCurrentMonthRentInvoice({
      tenantId: id,
      branchId: newRoom.branchId,
      monthlyRent: newRoom.monthlyRent,
      joiningDate: returningJoiningDate,
    });

    await createOwnerNotification({
      title: 'Resident Admitted Again',
      message: `${tenant.name} has returned and was assigned to Room ${newRoom.roomNumber}.`,
      type: 'ADMISSION_APPROVED',
      userId,
      branchId: newRoom.branchId,
      tenantId: id,
    });

    res.json({ message: 'Resident admitted again using the saved details.', tenant: updated });
  } catch (error) {
    console.error('Readmit tenant error:', error);
    res.status(500).json({ error: 'Failed to admit this resident again' });
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
    await prisma.booking.deleteMany({ where: { tenantId: id } });
    await prisma.tenant.delete({ where: { id } });

    // Recalculate room occupancy status
    await updateRoomOccupancyStatus(roomId);

    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
}
