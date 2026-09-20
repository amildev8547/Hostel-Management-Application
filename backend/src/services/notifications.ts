import prisma from '../config/db';

type OrganizationNotificationInput = {
  title: string;
  message: string;
  type: string;
  organizationId: string;
  branchId?: string | null;
  tenantId?: string | null;
  applicationId?: string | null;
  paymentId?: string | null;
  notificationId?: string;
};

async function sendPushToUser(input: OrganizationNotificationInput & { userId: string }) {
  const alertsSetting = await prisma.setting.findFirst({ where: { userId: input.userId, key: 'notification_alerts_enabled' } });
  if (alertsSetting?.value === 'false') return;
  const devices = await prisma.devicePushToken.findMany({ where: { userId: input.userId, active: true } });
  if (!devices.length) return;

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(devices.map((device) => ({
      to: device.token,
      title: input.title,
      body: input.message,
      sound: 'default',
      priority: 'high',
      channelId: 'hostelhub-important',
      data: {
        type: input.type,
        branchId: input.branchId,
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        paymentId: input.paymentId,
        notificationId: input.notificationId,
      },
    }))),
  });

  if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
  const result: any = await response.json();
  const tickets = Array.isArray(result?.data) ? result.data : [];
  const invalidTokens = devices
    .filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered')
    .map((device) => device.token);
  if (invalidTokens.length) {
    await prisma.devicePushToken.updateMany({ where: { token: { in: invalidTokens } }, data: { active: false } });
  }
}

export async function createOwnerNotification(input: OrganizationNotificationInput) {
  const users = await prisma.user.findMany({
    where: { organizationId: input.organizationId, role: 'HOSTEL_ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });
  const notifications = await Promise.all(users.map((user) => prisma.notification.create({
    data: {
      title: input.title, message: input.message, type: input.type, organizationId: input.organizationId,
      userId: user.id, branchId: input.branchId, tenantId: input.tenantId,
      applicationId: input.applicationId, paymentId: input.paymentId,
    },
  })));
  notifications.forEach((notification, index) => {
    void sendPushToUser({ ...input, userId: users[index].id, notificationId: notification.id })
      .catch((error) => console.error('Send hostel administrator push notification error:', error));
  });
  return notifications[0] || null;
}
