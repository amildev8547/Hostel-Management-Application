import prisma from '../config/db';

export async function updateRoomOccupancyStatus(roomId: string): Promise<string> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { tenants: { where: { status: 'ACTIVE' } } },
  });

  if (!room) {
    throw new Error('Room not found');
  }

  const occupiedBeds = room.tenants.length;
  let newStatus = room.status;

  if (room.status !== 'MAINTENANCE' || occupiedBeds > 0) {
    if (occupiedBeds === 0) {
      newStatus = 'AVAILABLE';
    } else if (occupiedBeds < room.capacity) {
      newStatus = 'PARTIAL';
    } else {
      newStatus = 'FULL';
    }
  }

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
  vacantBeds: number;
  occupancyPercentage: number;
  thisMonthPaid: number;
  pendingPayments: number;
  overduePayments: number;
}

export async function calculateBranchMetrics(branchId: string): Promise<BranchMetrics> {
  const rooms = await prisma.room.findMany({
    where: { branchId },
    include: { tenants: { where: { status: 'ACTIVE' } } },
  });

  let totalRooms = rooms.length;
  let vacantRooms = 0;
  let partialRooms = 0;
  let occupiedRooms = 0;
  let totalBeds = 0;
  let occupiedBeds = 0;

  rooms.forEach((room) => {
    totalBeds += room.capacity;
    occupiedBeds += room.tenants.length;

    if (room.status === 'AVAILABLE') vacantRooms++;
    else if (room.status === 'PARTIAL') partialRooms++;
    else if (room.status === 'FULL') occupiedRooms++;
    else if (room.status === 'MAINTENANCE') {
      // In maintenance counts towards rooms but depends on active tenant status
      if (room.tenants.length === 0) vacantRooms++;
      else if (room.tenants.length < room.capacity) partialRooms++;
      else occupiedRooms++;
    }
  });

  const vacantBeds = totalBeds - occupiedBeds;
  const occupancyPercentage = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Payments calculations
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const payments = await prisma.payment.findMany({
    where: {
      branchId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
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
    vacantBeds,
    occupancyPercentage,
    thisMonthPaid,
    pendingPayments,
    overduePayments,
  };
}
