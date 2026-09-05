import { randomBytes } from 'crypto';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { updateRoomOccupancyStatus } from '../utils/occupancy';

export async function getRoomBedAvailability(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      tenants: { where: { status: 'ACTIVE' }, select: { id: true } },
      bookings: { select: { id: true, bedNumber: true, status: true, name: true, tenantId: true } },
    },
  });
  if (!room) return null;

  const beds = Array.from({ length: room.capacity }, (_, index) => ({
    bedNumber: index + 1,
    status: 'AVAILABLE' as 'AVAILABLE' | 'RESERVED' | 'OCCUPIED',
    bookingId: undefined as string | undefined,
    personName: undefined as string | undefined,
  }));

  room.bookings.forEach((booking) => {
    const bed = beds[booking.bedNumber - 1];
    if (!bed) return;
    bed.status = booking.status === 'OCCUPIED' ? 'OCCUPIED' : 'RESERVED';
    bed.bookingId = booking.id;
    bed.personName = booking.name;
  });

  const tenantsWithBooking = new Set(room.bookings.filter((booking) => booking.tenantId).map((booking) => booking.tenantId));
  const legacyTenantCount = room.tenants.filter((tenant) => !tenantsWithBooking.has(tenant.id)).length;
  beds.filter((bed) => bed.status === 'AVAILABLE').slice(0, legacyTenantCount).forEach((bed) => {
    bed.status = 'OCCUPIED';
  });

  return { room, beds, availableBeds: beds.filter((bed) => bed.status === 'AVAILABLE').length };
}

export async function listBookings(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId, status: { in: ['RESERVED', 'FORM_SUBMITTED'] } },
      include: { branch: true, room: true, admissionApplication: { select: { id: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bookings);
  } catch (error) {
    console.error('List bookings error:', error);
    res.status(500).json({ error: 'Could not load bookings' });
  }
}

export async function createBooking(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, phone, branchId, roomId, expectedJoiningDate, notes } = req.body;
  try {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.userId !== userId) return res.status(404).json({ error: 'Hostel branch not found' });
    const availability = await getRoomBedAvailability(roomId);
    if (!availability || availability.room.branchId !== branchId) return res.status(404).json({ error: 'Room not found in this branch' });
    if (availability.room.status === 'MAINTENANCE') return res.status(400).json({ error: 'This room is not currently usable' });
    const availableBeds = availability.beds.filter((bed) => bed.status === 'AVAILABLE');
    if (availableBeds.length === 0) return res.status(409).json({ error: 'This room has no available beds. Please choose another room.' });

    let booking: any = null;
    for (const bed of availableBeds) {
      try {
        booking = await prisma.booking.create({
          data: {
            name: name.trim(), phone, branchId, roomId, bedNumber: bed.bedNumber,
            expectedJoiningDate: new Date(expectedJoiningDate), notes: notes?.trim() || null,
            secureToken: randomBytes(32).toString('hex'), userId,
          },
          include: { branch: true, room: true },
        });
        break;
      } catch (error: any) {
        if (error?.code !== 'P2002') throw error;
      }
    }
    if (!booking) return res.status(409).json({ error: 'The last available bed was just reserved. Please choose another room.' });
    await updateRoomOccupancyStatus(roomId);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.status(201).json({ ...booking, admissionFormUrl: `${baseUrl}/book/${booking.secureToken}` });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'The last available bed was just reserved. Please choose another room.' });
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Could not create the booking' });
  }
}

export async function getBooking(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { branch: true, room: true, admissionApplication: true },
  });
  if (!booking || booking.userId !== userId) return res.status(404).json({ error: 'Booking not found' });
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({ ...booking, admissionFormUrl: `${baseUrl}/book/${booking.secureToken}` });
}

export async function cancelBooking(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { admissionApplication: true } });
    if (!booking || booking.userId !== userId) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'OCCUPIED') return res.status(400).json({ error: 'This booking is already an active admission and cannot be cancelled here' });
    if (booking.admissionApplication?.status === 'PENDING') {
      await prisma.admissionApplication.update({ where: { id: booking.admissionApplication.id }, data: { status: 'REJECTED' } });
    }
    await prisma.booking.delete({ where: { id: booking.id } });
    await updateRoomOccupancyStatus(booking.roomId);
    res.json({ message: 'Booking cancelled. The bed is available again.' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Could not cancel the booking' });
  }
}

export async function getRoomBeds(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const availability = await getRoomBedAvailability(req.params.roomId);
  if (!availability || availability.room.branchId !== req.query.branchId) return res.status(404).json({ error: 'Room not found' });
  const branch = await prisma.branch.findUnique({ where: { id: availability.room.branchId } });
  if (!branch || branch.userId !== userId) return res.status(404).json({ error: 'Room not found' });
  res.json({ beds: availability.beds, availableBeds: availability.availableBeds });
}
