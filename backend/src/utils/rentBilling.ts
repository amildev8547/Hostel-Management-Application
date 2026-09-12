import prisma from '../config/db';

type RentInvoiceResult = Awaited<ReturnType<typeof ensureCurrentMonthRentInvoiceUnlocked>>;
const rentInvoiceLocks = new Map<string, Promise<RentInvoiceResult>>();

export function getCalendarMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  return {
    start: new Date(year, month, 1),
    nextStart: new Date(year, month + 1, 1),
    label: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  };
}

export function getRentDueDate(date: Date, requestedDay: number) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(Math.max(Math.trunc(requestedDay || 5), 1), lastDay);
  return new Date(year, month, safeDay);
}

type CurrentMonthRentInput = {
  tenantId: string;
  branchId: string;
  monthlyRent: number;
  joiningDate: Date;
  now?: Date;
};

async function ensureCurrentMonthRentInvoiceUnlocked(input: CurrentMonthRentInput) {
  const now = input.now || new Date();
  const { start, nextStart } = getCalendarMonthRange(now);
  const existing = await prisma.payment.findFirst({
    where: {
      tenantId: input.tenantId,
      paymentType: 'RENT',
      dueDate: { gte: start, lt: nextStart },
    },
  });

  const joiningDay = new Date(input.joiningDate).getDate();
  const dueDate = getRentDueDate(now, joiningDay);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (existing) {
    if (existing.status !== 'PAID' && existing.daysBilled == null) {
      const status = dueDate < today ? 'OVERDUE' : 'PENDING';
      const payment = await prisma.payment.update({ where: { id: existing.id }, data: { dueDate, status } });
      return { payment, created: false };
    }
    return { payment: existing, created: false };
  }

  const payment = await prisma.payment.create({
    data: {
      amount: input.monthlyRent,
      status: dueDate < today ? 'OVERDUE' : 'PENDING',
      paymentType: 'RENT',
      dueDate,
      tenantId: input.tenantId,
      branchId: input.branchId,
    },
  });

  return { payment, created: true };
}

export async function ensureCurrentMonthRentInvoice(input: CurrentMonthRentInput) {
  const now = input.now || new Date();
  const { start } = getCalendarMonthRange(now);
  const lockKey = `${input.tenantId}:${start.getFullYear()}-${start.getMonth()}`;
  const activeLock = rentInvoiceLocks.get(lockKey);
  if (activeLock) return activeLock;

  const task = ensureCurrentMonthRentInvoiceUnlocked({ ...input, now });
  rentInvoiceLocks.set(lockKey, task);
  try {
    return await task;
  } finally {
    if (rentInvoiceLocks.get(lockKey) === task) rentInvoiceLocks.delete(lockKey);
  }
}

export async function ensureCurrentMonthRentInvoicesForOwner(input: {
  userId: string;
  branchId?: string;
  now?: Date;
}) {
  const now = input.now || new Date();
  const tenants = await prisma.tenant.findMany({
    where: {
      status: 'ACTIVE',
      room: {
        branch: { userId: input.userId },
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
    },
    include: { room: true },
  });

  let generatedCount = 0;
  const skippedTenants: string[] = [];
  // Process a small batch concurrently so a hostel with many residents does not
  // make the dashboard wait for two serial database calls per person.
  const batchSize = 10;
  for (let index = 0; index < tenants.length; index += batchSize) {
    const tenantBatch = tenants.slice(index, index + batchSize);
    const results = await Promise.all(tenantBatch.map((tenant) => ensureCurrentMonthRentInvoice({
      tenantId: tenant.id,
      branchId: tenant.room.branchId,
      monthlyRent: tenant.room.monthlyRent,
      joiningDate: tenant.joiningDate,
      now,
    })));
    results.forEach((result, resultIndex) => {
      if (result.created) generatedCount += 1;
      else skippedTenants.push(tenantBatch[resultIndex].name);
    });
  }

  return { generatedCount, skippedTenants };
}

export async function syncCurrentMonthRentDueDates(input: { userId?: string; branchId?: string; now?: Date }) {
  const now = input.now || new Date();
  const { start, nextStart } = getCalendarMonthRange(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const payments = await prisma.payment.findMany({
    where: {
      paymentType: 'RENT',
      status: { in: ['PENDING', 'OVERDUE'] },
      daysBilled: null,
      tenantId: { not: null },
      dueDate: { gte: start, lt: nextStart },
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.userId ? { branch: { userId: input.userId } } : {}),
    },
    include: { tenant: { select: { joiningDate: true } } },
  });

  await Promise.all(
    payments.map((payment) => {
      if (!payment.tenant) return Promise.resolve(payment);
      const dueDate = getRentDueDate(now, new Date(payment.tenant.joiningDate).getDate());
      return prisma.payment.update({
        where: { id: payment.id },
        data: { dueDate, status: dueDate < today ? 'OVERDUE' : 'PENDING' },
      });
    }),
  );
}

export async function markOverdueRentInvoices(userId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return prisma.payment.updateMany({
    where: {
      branch: { userId },
      paymentType: 'RENT',
      status: 'PENDING',
      dueDate: { lt: today },
    },
    data: { status: 'OVERDUE' },
  });
}
