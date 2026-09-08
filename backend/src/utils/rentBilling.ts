import prisma from '../config/db';

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

export async function ensureCurrentMonthRentInvoice(input: {
  tenantId: string;
  branchId: string;
  monthlyRent: number;
  rentDueDay: number;
  now?: Date;
}) {
  const now = input.now || new Date();
  const { start, nextStart } = getCalendarMonthRange(now);
  const existing = await prisma.payment.findFirst({
    where: {
      tenantId: input.tenantId,
      paymentType: 'RENT',
      dueDate: { gte: start, lt: nextStart },
    },
  });

  if (existing) return { payment: existing, created: false };

  const dueDate = getRentDueDate(now, input.rentDueDay);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
