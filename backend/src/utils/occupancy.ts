import prisma from '../config/db';
import { syncCurrentMonthRentDueDates } from './rentBilling';

export async function updateRoomOccupancyStatus(roomId: string): Promise<string> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { tenants: { where: { status: 'ACTIVE' } }, bookings: true },
  });

  if (!room) {
    throw new Error('Room not found');
  }

  const occupiedBeds = room.tenants.length;
  const reservedBeds = room.bookings.filter((booking) => booking.status !== 'OCCUPIED').length;
  const unavailableBeds = occupiedBeds + reservedBeds;
  const newStatus = unavailableBeds === 0
    ? 'AVAILABLE'
    : unavailableBeds < room.capacity
      ? 'PARTIAL'
      : 'FULL';

  await prisma.room.update({
    where: { id: roomId },
    data: { status: newStatus },
  });

  return newStatus;
}

export interface BranchMetrics {
  totalRooms: number;
  vacantRooms: number;
  partialRooms: number;
  occupiedRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  vacantBeds: number;
  occupancyPercentage: number;
  thisMonthPaid: number;
  pendingPayments: number;
  overduePayments: number;
}

export async function calculateBranchMetrics(branchId: string): Promise<BranchMetrics> {
  const rooms = await prisma.room.findMany({
    where: { branchId },
    include: { tenants: { where: { status: 'ACTIVE' } }, bookings: true },
  });

  let totalRooms = rooms.length;
  let vacantRooms = 0;
  let partialRooms = 0;
  let occupiedRooms = 0;
  let totalBeds = 0;
  let occupiedBeds = 0;
  let reservedBeds = 0;

  rooms.forEach((room) => {
    totalBeds += room.capacity;
    occupiedBeds += room.tenants.length;
    const roomReserved = room.bookings.filter((booking) => booking.status !== 'OCCUPIED').length;
    reservedBeds += roomReserved;
    const unavailableBeds = room.tenants.length + roomReserved;

    if (unavailableBeds === 0) vacantRooms++;
    else if (unavailableBeds < room.capacity) partialRooms++;
    else occupiedRooms++;
  });

  const vacantBeds = Math.max(0, totalBeds - occupiedBeds - reservedBeds);
  const occupancyPercentage = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Payments calculations
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  await syncCurrentMonthRentDueDates({ branchId, now });
  await prisma.payment.updateMany({
    where: {
      branchId,
      paymentType: 'RENT',
      status: 'PENDING',
      dueDate: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
    },
    data: { status: 'OVERDUE' },
  });

  const payments = await prisma.payment.findMany({
    where: {
      branchId,
      paymentType: 'RENT',
      dueDate: {
        gte: startOfMonth,
        lt: nextMonth,
      },
    },
  });

  let thisMonthPaid = 0;
  let pendingPayments = 0;
  let overduePayments = 0;

  payments.forEach((payment) => {
    if (payment.status === 'PAID') {
      thisMonthPaid += payment.amount;
    } else if (payment.status === 'PENDING') {
      pendingPayments += payment.amount;
    } else if (payment.status === 'OVERDUE') {
      overduePayments += payment.amount;
    }
  });

  return {
    totalRooms,
    vacantRooms,
    partialRooms,
    occupiedRooms,
    totalBeds,
    occupiedBeds,
    reservedBeds,
    vacantBeds,
    occupancyPercentage,
    thisMonthPaid,
    pendingPayments,
    overduePayments,
  };
}
