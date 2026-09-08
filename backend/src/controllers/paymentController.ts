import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { buildUpiPaymentUrl, getSettingValue } from '../utils/upi';
import { ensureCurrentMonthRentInvoice, getCalendarMonthRange, markOverdueRentInvoices } from '../utils/rentBilling';

export async function getPayments(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { branchId, status, paymentType, search, month, year } = req.query;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Restrict to invoices due within a specific calendar month (1-12) / year, so the
  // owner can review collections for any past or future month, not just the current one.
  let dueDateFilter: { gte: Date; lt: Date } | undefined;
  if (year) {
    const yearNum = Number(year);
    const monthNum = month ? Number(month) - 1 : 0;
    const monthSpan = month ? 1 : 12;
    dueDateFilter = {
      gte: new Date(yearNum, monthNum, 1),
      lt: new Date(yearNum, monthNum + monthSpan, 1),
    };
  }

  try {
    await markOverdueRentInvoices(userId);
    const payments = await prisma.payment.findMany({
      where: {
        branch: { userId },
        ...(branchId ? { branchId: branchId as string } : {}),
        ...(status ? { status: status as string } : {}),
        ...(paymentType ? { paymentType: paymentType as string } : {}),
        ...(dueDateFilter ? { dueDate: dueDateFilter } : {}),
        ...(search
          ? {
              OR: [
                { tenant: { name: { contains: search as string } } },
                { tenant: { phone: { contains: search as string } } },
              ],
            }
          : {}),
      },
      include: {
        tenant: {
          include: { room: true },
        },
        admissionApplication: true,
        branch: true,
      },
      orderBy: { dueDate: 'desc' },
    });

    res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
}

// Generate rent invoices automatically for all active tenants for the current month
export async function generateMonthlyRentDues(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const now = new Date();
    const { label: currentMonthLabel } = getCalendarMonthRange(now);

    // Fetch all active tenants owned by user
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'ACTIVE',
        room: {
          branch: { userId },
        },
      },
      include: {
        room: {
          include: { branch: true },
        },
      },
    });

    let generatedCount = 0;
    const skippedTenants: string[] = [];

    for (const tenant of tenants) {
      const result = await ensureCurrentMonthRentInvoice({
        tenantId: tenant.id,
        branchId: tenant.room.branchId,
        monthlyRent: tenant.room.monthlyRent,
        rentDueDay: tenant.room.branch.rentDueDay || 5,
        now,
      });

      if (!result.created) {
        skippedTenants.push(tenant.name);
        continue;
      }

      generatedCount++;
    }

    res.json({
      message: `${currentMonthLabel} advance rent bills are ready. Created ${generatedCount}; already available for ${skippedTenants.length}.`,
      generated: generatedCount,
      skippedCount: skippedTenants.length,
      skippedList: skippedTenants,
    });
  } catch (error) {
    console.error('Generate monthly dues error:', error);
    res.status(500).json({ error: 'Failed to generate monthly rent dues' });
  }
}

// Recalculate a pending RENT invoice's amount based on a custom number of days and discount
export async function customizePaymentAmount(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { days, discountAmount = 0 } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        branch: true,
        tenant: { include: { room: true } },
      },
    });

    if (!payment || payment.branch.userId !== userId) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending invoices can be customized.' });
    }

    if (payment.paymentType !== 'RENT' || !payment.tenant) {
      return res.status(400).json({ error: 'Only rent invoices can be customized.' });
    }

    const perDayRate = payment.tenant.room.monthlyRent / 30;
    const originalAmount = Math.round(perDayRate * days);
    const amount = Math.max(0, originalAmount - discountAmount);

    const updated = await prisma.payment.update({
      where: { id },
      data: { amount, originalAmount, discountAmount, daysBilled: days },
    });

    res.json(updated);
  } catch (error) {
    console.error('Customize payment error:', error);
    res.status(500).json({ error: 'Failed to customize payment' });
  }
}

// Directly edit the amount of a pending or overdue invoice
export async function editPaymentAmount(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { amount } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!payment || payment.branch.userId !== userId) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (payment.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot edit amount of a paid invoice' });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: { amount },
    });

    res.json(updated);
  } catch (error) {
    console.error('Edit payment amount error:', error);
    res.status(500).json({ error: 'Failed to edit payment amount' });
  }
}

// Return the manual UPI payment page for a specific invoice.
export async function getManualPaymentLink(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        tenant: { include: { room: { include: { branch: true } } } },
        admissionApplication: true,
        branch: {
          include: {
            user: {
              include: { settings: true },
            },
          },
        },
      },
    });

    if (!payment || payment.branch.userId !== userId) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (payment.status === 'PAID') {
      return res.status(400).json({ error: 'Invoice has already been paid' });
    }

    const manualPaymentUrl = `${process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`}/pay/${payment.id}`;
    const upiPaymentUrl = buildUpiPaymentUrl({
      upiId: getSettingValue(payment.branch.user.settings, 'payment_upi_id'),
      receiverName: getSettingValue(payment.branch.user.settings, 'payment_receiver_name') || payment.branch.user.name || payment.branch.name,
      amount: payment.amount,
      note: `HostelHub ${payment.paymentType} ${payment.id}`,
    });

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        paymentMethod: 'UPI',
        paymentLinkUrl: upiPaymentUrl || manualPaymentUrl,
      },
    });

    res.json({
      ...updated,
      upiPaymentUrl,
      manualPaymentUrl,
      paymentLinkUrl: upiPaymentUrl || manualPaymentUrl,
    });
  } catch (error) {
    console.error('Get manual payment link error:', error);
    res.status(500).json({ error: 'Failed to prepare manual payment link' });
  }
}

// Simulate sending reminder via console logging & return string template
export async function sendPaymentReminder(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        tenant: true,
        branch: true,
      },
    });

    if (!payment || !payment.tenant || payment.branch.userId !== userId) {
      return res.status(404).json({ error: 'Payment or Tenant record not found' });
    }

    const payUrl = payment.paymentLinkUrl || `${process.env.BACKEND_URL || 'http://localhost:5000'}/pay/${payment.id}`;

    // Format WhatsApp reminder message
    const rentMonth = payment.dueDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const reminderMessage = `Hello ${payment.tenant.name},

Your advance rent for ${rentMonth} is due.
Amount: ₹${payment.amount}
Pay Here: ${payUrl}`;

    console.log(`[WHATSAPP REMINDER SENT TO ${payment.tenant.phone}]`);
    console.log(reminderMessage);

    res.json({
      message: `Reminder template generated. WhatsApp simulated message sent to ${payment.tenant.phone}.`,
      recipient: payment.tenant.name,
      phone: payment.tenant.phone,
      text: reminderMessage,
    });
  } catch (error) {
    console.error('Send payment reminder error:', error);
    res.status(500).json({ error: 'Failed to trigger payment reminder' });
  }
}

export async function processPaymentSuccess(paymentId: string, transactionId: string, method = 'UPI') {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      tenant: { include: { room: true } },
      admissionApplication: { include: { branch: true } },
      branch: true,
    },
  });

  if (!payment) {
    throw new Error('Payment record not found');
  }

  if (payment.status === 'PAID') {
    return payment; // Already processed
  }

  const now = new Date();

  // 1. Update Payment record
  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'PAID',
      paidDate: now,
      transactionId,
      paymentMethod: method,
      receiptUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/receipts/${paymentId}`,
    },
  });

  // 2. If it's Rent: Update tenant paid fields
  if (payment.paymentType === 'RENT' && payment.tenantId) {
    await prisma.tenant.update({
      where: { id: payment.tenantId },
      data: {
        // Mark active
        status: 'ACTIVE',
      },
    });

    // Create Notification for owner
    await prisma.notification.create({
      data: {
        title: 'Rent Payment Received',
        message: `Advance rent of ₹${payment.amount} for ${payment.dueDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} received from ${payment.tenant?.name} (Room ${payment.tenant?.room.roomNumber}).`,
        type: 'RENT_PAYMENT_RECEIVED',
        userId: payment.branch.userId,
      },
    });
  }

  // 3. If it's Admission Fee: Update application payment status
  if (payment.paymentType === 'ADMISSION' && payment.admissionApplicationId) {
    await prisma.admissionApplication.update({
      where: { id: payment.admissionApplicationId },
      data: {
        paymentStatus: 'PAID',
        paymentId: transactionId,
      },
    });

    // Create Notification for owner
    await prisma.notification.create({
      data: {
        title: 'Admission Fee Paid',
        message: `Admission payment of ₹${payment.amount} received from applicant ${payment.admissionApplication?.name}.`,
        type: 'ADMISSION_PAYMENT_RECEIVED',
        userId: payment.branch.userId,
      },
    });
  }

  return updatedPayment;
}

// Manual payment trigger by owner
export async function recordManualPayment(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { paymentMethod, transactionId } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!payment || payment.branch.userId !== userId) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (payment.status === 'PAID') {
      return res.status(400).json({ error: 'Payment has already been marked as PAID' });
    }

    const mockTxnId = transactionId || `manual_${Math.random().toString(36).substring(2, 10)}`;
    const result = await processPaymentSuccess(id, mockTxnId, paymentMethod || 'CASH');

    res.json({
      message: 'Payment recorded manually successfully',
      payment: result,
    });
  } catch (error: any) {
    console.error('Manual payment record error:', error);
    res.status(500).json({ error: error.message || 'Failed to record manual payment' });
  }
}
