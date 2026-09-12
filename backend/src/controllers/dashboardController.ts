import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { ensureCurrentMonthRentInvoicesForOwner, getCalendarMonthRange, markOverdueRentInvoices, syncCurrentMonthRentDueDates } from '../utils/rentBilling';

type ResidentMovementMonth = { month: number; year: number; joined: number; left: number };

export function buildResidentMovementHistory(now: Date, joinedDates: Date[], leavingDates: Date[]): ResidentMovementMonth[] {
  const history = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return { month: date.getMonth() + 1, year: date.getFullYear(), joined: 0, left: 0 };
  });
  const byMonth = new Map(history.map((item) => [`${item.year}-${item.month}`, item]));
  joinedDates.forEach((date) => {
    const item = byMonth.get(`${date.getFullYear()}-${date.getMonth() + 1}`);
    if (item) item.joined += 1;
  });
  leavingDates.forEach((date) => {
    const item = byMonth.get(`${date.getFullYear()}-${date.getMonth() + 1}`);
    if (item) item.left += 1;
  });
  return history;
}

export async function getHomeDashboard(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const now = new Date();
  const activityMonth = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const activityYear = req.query.year ? Number(req.query.year) : now.getFullYear();

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!Number.isInteger(activityMonth) || activityMonth < 1 || activityMonth > 12 || !Number.isInteger(activityYear) || activityYear < 2000 || activityYear > 2200) {
    return res.status(400).json({ error: 'Choose a valid month and year.' });
  }

  try {
    // 1. Fetch all branches owned by user
    const branches = await prisma.branch.findMany({
      where: { userId },
      include: {
        rooms: {
          include: {
            tenants: {
              where: { status: 'ACTIVE' },
            },
            bookings: true,
          },
        },
      },
    });

    const totalBranches = branches.length;
    let totalRooms = 0;
    let totalCapacity = 0;
    let occupiedBeds = 0;
    let reservedBeds = 0;

    branches.forEach((branch) => {
      totalRooms += branch.rooms.length;
      branch.rooms.forEach((room) => {
        totalCapacity += room.capacity;
        occupiedBeds += room.tenants.length;
        reservedBeds += room.bookings.filter((booking) => booking.status !== 'OCCUPIED').length;
      });
    });

    const vacantBeds = Math.max(0, totalCapacity - occupiedBeds - reservedBeds);
    const occupancyPercentage = totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 100) : 0;

    // 2. Fetch payments for current month to compute collection metrics
    const { start: startOfMonth, nextStart } = getCalendarMonthRange(now);

    const branchIds = branches.map((b) => b.id);

    // Rent bills are prepared automatically while the home/payment data refreshes.
    // The owner no longer needs a separate "create bills" action in the app.
    await ensureCurrentMonthRentInvoicesForOwner({ userId, now });
    await syncCurrentMonthRentDueDates({ userId, now });
    await markOverdueRentInvoices(userId);
    const payments = await prisma.payment.findMany({
      where: {
        branchId: { in: branchIds },
        paymentType: 'RENT',
        dueDate: {
          gte: startOfMonth,
          lt: nextStart,
        },
      },
    });

    let monthlyCollection = 0;
    let pendingCollection = 0;
    let overdueCollection = 0;

    payments.forEach((payment) => {
      if (payment.status === 'PAID') {
        monthlyCollection += payment.amount;
      } else if (payment.status === 'PENDING') {
        pendingCollection += payment.amount;
      } else if (payment.status === 'OVERDUE') {
        overdueCollection += payment.amount;
      }
    });

    // 3. Pending admissions count
    const pendingAdmissions = await prisma.admissionApplication.count({
      where: {
        branchId: { in: branchIds },
        status: 'PENDING',
      },
    });

    const activityStart = new Date(activityYear, activityMonth - 1, 1);
    const activityEnd = new Date(activityYear, activityMonth, 1);
    const [residentsJoined, residentsLeft] = await Promise.all([
      prisma.tenant.count({
        where: {
          joiningDate: { gte: activityStart, lt: activityEnd },
          room: { branch: { userId } },
        },
      }),
      prisma.tenant.count({
        where: {
          status: 'VACATED',
          leavingDate: { gte: activityStart, lt: activityEnd },
          room: { branch: { userId } },
        },
      }),
    ]);

    // Build a single, compact history payload for the scrollable home chart.
    // Keep the timeline chronological; the mobile chart opens at the right-hand,
    // latest-month end and lets the user scroll left through older months.
    const historyStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const historyEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [joinedHistory, leftHistory] = await Promise.all([
      prisma.tenant.findMany({
        where: {
          joiningDate: { gte: historyStart, lt: historyEnd },
          room: { branch: { userId } },
        },
        select: { joiningDate: true },
      }),
      prisma.tenant.findMany({
        where: {
          status: 'VACATED',
          leavingDate: { gte: historyStart, lt: historyEnd },
          room: { branch: { userId } },
        },
        select: { leavingDate: true },
      }),
    ]);
    const movementHistory = buildResidentMovementHistory(
      now,
      joinedHistory.map(({ joiningDate }) => joiningDate),
      leftHistory.flatMap(({ leavingDate }) => leavingDate ? [leavingDate] : []),
    );

    // 4. Recent activities
    // - New Admissions (recent 5 applications)
    const recentAdmissions = await prisma.admissionApplication.findMany({
      where: { branchId: { in: branchIds } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { branch: true },
    });

    // - Payments Received (recent 5 PAID payments)
    const recentPayments = await prisma.payment.findMany({
      where: {
        branchId: { in: branchIds },
        status: 'PAID',
      },
      take: 5,
      orderBy: { paidDate: 'desc' },
      include: {
        tenant: true,
        branch: true,
      },
    });

    // - Room Allocations (recent 5 active tenants)
    const recentAllocations = await prisma.tenant.findMany({
      where: {
        room: { branchId: { in: branchIds } },
        status: 'ACTIVE',
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        room: { include: { branch: true } },
      },
    });

    res.json({
      metrics: {
        totalBranches,
        totalRooms,
        totalCapacity,
        occupiedBeds,
        reservedBeds,
        vacantBeds,
        occupancyPercentage,
        monthlyCollection,
        pendingCollection,
        overdueCollection,
        pendingAdmissions,
      },
      recentActivities: {
        recentAdmissions,
        recentPayments,
        recentAllocations,
      },
      residentMovement: {
        month: activityMonth,
        year: activityYear,
        joined: residentsJoined,
        left: residentsLeft,
      },
      residentMovementHistory: movementHistory,
    });
  } catch (error) {
    console.error('Home dashboard metrics error:', error);
    res.status(500).json({ error: 'Failed to load home dashboard metrics' });
  }
}
