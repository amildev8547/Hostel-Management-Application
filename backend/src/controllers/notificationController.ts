import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';

// Computes live, point-in-time alerts (today's vacating tenants, rent due today, rent overdue).
// These are not persisted Notification rows — they reflect current data state, so they
// automatically disappear once the underlying condition is resolved (vacated / paid).
async function getLiveAlerts(userId: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const [vacatingToday, dueTodayPayments, overduePayments] = await Promise.all([
    prisma.tenant.findMany({
      where: {
        status: 'ACTIVE',
        leavingDate: { gte: startOfToday, lt: endOfToday },
        room: { branch: { userId } },
      },
      include: { room: { include: { branch: true } } },
    }),
    prisma.payment.findMany({
      where: {
        branch: { userId },
        paymentType: 'RENT',
        status: 'PENDING',
        dueDate: { gte: startOfToday, lt: endOfToday },
      },
      include: { tenant: { include: { room: true } }, branch: true },
    }),
    prisma.payment.findMany({
      where: {
        branch: { userId },
        paymentType: 'RENT',
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lt: startOfToday },
      },
      include: { tenant: { include: { room: true } }, branch: true },
    }),
  ]);

  const overdueAlerts = overduePayments.map((p) => ({
    id: `alert-overdue-${p.id}`,
    type: 'RENT_OVERDUE',
    title: 'Rent Overdue',
    message: `${p.tenant?.name || 'Tenant'} (Room ${p.tenant?.room?.roomNumber}, ${p.branch.name}) has an overdue rent of ₹${p.amount}, due ${p.dueDate.toLocaleDateString('en-IN')}.`,
    isRead: false,
    isLive: true,
    createdAt: p.dueDate,
    paymentId: p.id,
    tenantId: p.tenantId,
  }));

  const dueTodayAlerts = dueTodayPayments.map((p) => ({
    id: `alert-duetoday-${p.id}`,
    type: 'RENT_DUE_TODAY',
    title: 'Rent Due Today',
    message: `${p.tenant?.name || 'Tenant'} (Room ${p.tenant?.room?.roomNumber}, ${p.branch.name}) has rent of ₹${p.amount} due today.`,
    isRead: false,
    isLive: true,
    createdAt: now,
    paymentId: p.id,
    tenantId: p.tenantId,
  }));

  const vacatingAlerts = vacatingToday.map((t) => ({
    id: `alert-vacate-${t.id}`,
    type: 'TENANT_VACATING_TODAY',
    title: 'Tenant Vacating Today',
    message: `${t.name} (Room ${t.room.roomNumber}, ${t.room.branch.name}) is scheduled to vacate today.`,
    isRead: false,
    isLive: true,
    createdAt: now,
    tenantId: t.id,
  }));

  // Most urgent first: overdue rent, then due today, then today's checkouts.
  return [...overdueAlerts, ...dueTodayAlerts, ...vacatingAlerts];
}

export async function getNotifications(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const alertsSetting = await prisma.setting.findFirst({
      where: { userId, key: 'notification_alerts_enabled' },
    });
    // Alerts are on by default until the owner explicitly turns them off in Settings.
    const alertsEnabled = alertsSetting ? alertsSetting.value === 'true' : true;

    if (!alertsEnabled) {
      return res.json({ notifications: [], unreadCount: 0, alertsEnabled: false });
    }

    const [notifications, unreadCount, liveAlerts] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
      getLiveAlerts(userId),
    ]);

    res.json({
      notifications: [...liveAlerts, ...notifications],
      unreadCount: unreadCount + liveAlerts.length,
      alertsEnabled: true,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
}

export async function markAsRead(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (id === 'all') {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return res.json({ message: 'All notifications marked as read' });
    }

    // Live alerts (today's vacating tenants, rent due/overdue) are computed on the fly and
    // aren't persisted rows, so there's nothing to mark read — they resolve on their own.
    if (id.startsWith('alert-')) {
      return res.json({ message: 'Live alert acknowledged' });
    }

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
}
