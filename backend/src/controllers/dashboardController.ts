import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';

export async function getHomeDashboard(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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
          },
        },
      },
    });

    const totalBranches = branches.length;
    let totalRooms = 0;
    let totalCapacity = 0;
    let occupiedBeds = 0;

    branches.forEach((branch) => {
      totalRooms += branch.rooms.length;
      branch.rooms.forEach((room) => {
        totalCapacity += room.capacity;
        occupiedBeds += room.tenants.length;
      });
    });

    const vacantBeds = totalCapacity - occupiedBeds;
    const occupancyPercentage = totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 100) : 0;

    // 2. Fetch payments for current month to compute collection metrics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const branchIds = branches.map((b) => b.id);

    const payments = await prisma.payment.findMany({
      where: {
        branchId: { in: branchIds },
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
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
    });
  } catch (error) {
    console.error('Home dashboard metrics error:', error);
    res.status(500).json({ error: 'Failed to load home dashboard metrics' });
  }
}
