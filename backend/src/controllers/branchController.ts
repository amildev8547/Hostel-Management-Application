import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { calculateBranchMetrics } from '../utils/occupancy';

export async function createBranch(req: AuthenticatedRequest, res: Response) {
  const { name, address, phone, googleMapsLocation, rentDueDay, status } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const branch = await prisma.branch.create({
      data: {
        name,
        address,
        phone,
        googleMapsLocation,
        rentDueDay,
        status: status || 'ACTIVE',
        userId,
      },
    });
    res.status(201).json(branch);
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
}

export async function getBranches(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { search } = req.query;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const branches = await prisma.branch.findMany({
      where: {
        userId,
        ...(search
          ? {
              OR: [
                { name: { contains: search as string } },
                { address: { contains: search as string } },
              ],
            }
          : {}),
      },
      include: {
        rooms: {
          include: {
            tenants: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute basic statistics inline for lists
    const branchList = await Promise.all(
      branches.map(async (branch) => {
        let totalRooms = branch.rooms.length;
        let totalBeds = 0;
        let occupiedBeds = 0;

        branch.rooms.forEach((room) => {
          totalBeds += room.capacity;
          occupiedBeds += room.tenants.length;
        });

        // Compute unpaid payments for this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const unpaidPayments = await prisma.payment.findMany({
          where: {
            branchId: branch.id,
            status: { in: ['PENDING', 'OVERDUE'] },
            createdAt: { gte: startOfMonth, lte: endOfMonth },
          },
        });

        const pendingPaymentAmount = unpaidPayments.reduce((sum, p) => sum + p.amount, 0);

        return {
          id: branch.id,
          name: branch.name,
          address: branch.address,
          phone: branch.phone,
          status: branch.status,
          totalRooms,
          totalBeds,
          vacantBeds: totalBeds - occupiedBeds,
          occupancyPercentage: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
          pendingPayments: pendingPaymentAmount,
        };
      })
    );

    res.json(branchList);
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ error: 'Failed to retrieve branches' });
  }
}

export async function getBranchById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const branch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!branch || branch.userId !== userId) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    res.json(branch);
  } catch (error) {
    console.error('Get branch by ID error:', error);
    res.status(500).json({ error: 'Failed to retrieve branch details' });
  }
}

export async function updateBranch(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { name, address, phone, googleMapsLocation, rentDueDay, status } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const checkBranch = await prisma.branch.findUnique({ where: { id } });

    if (!checkBranch || checkBranch.userId !== userId) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        name,
        address,
        phone,
        googleMapsLocation,
        rentDueDay,
        status,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ error: 'Failed to update branch' });
  }
}

export async function deleteBranch(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const checkBranch = await prisma.branch.findUnique({ where: { id } });

    if (!checkBranch || checkBranch.userId !== userId) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    await prisma.branch.delete({ where: { id } });
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ error: 'Failed to delete branch' });
  }
}

export async function getBranchDashboard(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const branch = await prisma.branch.findUnique({ where: { id } });

    if (!branch || branch.userId !== userId) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    const metrics = await calculateBranchMetrics(id);

    // Get recent admissions for this branch
    const recentAdmissions = await prisma.admissionApplication.findMany({
      where: { branchId: id },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      branch,
      metrics,
      recentAdmissions,
    });
  } catch (error) {
    console.error('Branch dashboard metrics error:', error);
    res.status(500).json({ error: 'Failed to load branch metrics' });
  }
}
