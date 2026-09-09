import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { deleteUploadedFile, UploadedFile, uploadFile } from '../services/cloudinary';
import { updateRoomOccupancyStatus } from '../utils/occupancy';
import { buildUpiPaymentUrl, getSettingValue } from '../utils/upi';
import { ensureCurrentMonthRentInvoice, getCalendarMonthRange } from '../utils/rentBilling';
import { createOwnerNotification } from '../services/notifications';
import { claimAdmissionFormToken } from '../services/admissionFormSecurity';

// Public endpoint: Submit application
export async function submitAdmissionApplication(req: Request, res: Response) {
  let currentStep = 'validating application';
  let claimedBookingId: string | null = null;
  let bookingApplicationCreated = false;
  let submissionGuardId: string | null = null;
  let createdApplicationId: string | null = null;
  const uploadedFiles: UploadedFile[] = [];
  const {
    name,
    phone,
    whatsappNumber,
    address,
    guardianName,
    guardianPhone,
    nearestPoliceStation,
    occupation,
    workLocation,
    preferredRoomType,
    joiningDate,
    leavingDate,
    profilePhoto, // base64
    aadhaarFront, // base64
    aadhaarBack, // base64
    notes,
    branchId,
    bookingToken,
    formToken,
  } = req.body;

  try {
    const booking = bookingToken
      ? await prisma.booking.findUnique({ where: { secureToken: bookingToken }, include: { room: true } })
      : null;
    if (bookingToken && (!booking || booking.status !== 'RESERVED')) {
      return res.status(409).json({ error: 'This booking link is no longer active. Please contact the hostel owner.' });
    }
    const selectedBranchId = booking?.branchId || branchId;
    const selectedName = booking?.name || name;
    const selectedPhone = booking?.phone || phone;

    currentStep = 'checking selected branch';
    const branch = await prisma.branch.findUnique({
      where: { id: selectedBranchId },
      include: {
        user: {
          include: { settings: true },
        },
      },
    });

    if (!branch) {
      return res.status(404).json({ error: 'Selected branch does not exist' });
    }

    currentStep = 'verifying the secure form session';
    const validFormSession = await claimAdmissionFormToken({
      token: formToken,
      branchId: selectedBranchId,
      bookingToken: booking?.secureToken,
    });
    if (!validFormSession) {
      return res.status(409).json({ error: 'This form was already submitted or has expired. Refresh the form to continue.' });
    }

    currentStep = 'checking for an earlier submission';
    const existingApplication = await prisma.admissionApplication.findFirst({
      where: { branchId: selectedBranchId, phone: selectedPhone },
      select: { id: true },
    });
    if (existingApplication) {
      return res.status(409).json({
        error: 'An admission form using this phone number was already submitted for this hostel. Contact the hostel owner if it needs correction.',
      });
    }
    try {
      const guard = await prisma.admissionSubmissionGuard.create({
        data: { branchId: selectedBranchId, phone: selectedPhone },
      });
      submissionGuardId = guard.id;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'An admission form using this phone number was already submitted for this hostel. Contact the hostel owner if it needs correction.' });
      }
      throw error;
    }

    // The admission fee is always computed server-side from the branch's actual room
    // pricing — never trust a client-supplied amount, since that would let an applicant
    // pay whatever they want by editing the request.
    currentStep = 'checking room pricing';
    const matchingRoom = booking?.room || await prisma.room.findFirst({
      where: { branchId: selectedBranchId, roomType: preferredRoomType },
      orderBy: { admissionFee: 'asc' },
    });
    const fallbackRoom = matchingRoom
      ? null
      : await prisma.room.findFirst({ where: { branchId: selectedBranchId }, orderBy: { admissionFee: 'asc' } });
    const amount = matchingRoom?.admissionFee ?? fallbackRoom?.admissionFee ?? 1500;

    if (booking) {
      const claim = await prisma.booking.updateMany({ where: { id: booking.id, status: 'RESERVED' }, data: { status: 'FORM_SUBMITTED' } });
      if (claim.count !== 1) {
        if (submissionGuardId) await prisma.admissionSubmissionGuard.delete({ where: { id: submissionGuardId } });
        submissionGuardId = null;
        return res.status(409).json({ error: 'This booking form has already been submitted.' });
      }
      claimedBookingId = booking.id;
    }

    // 1. Upload files to S3 / Local storage
    // Use the host the applicant's browser actually used to reach this server, so the
    // stored URL resolves later for the owner too (not just whoever is on localhost).
    currentStep = 'uploading documents';
    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
    const profileUpload = await uploadFile(profilePhoto, 'profile.jpg', 'profile_photos', requestBaseUrl);
    uploadedFiles.push(profileUpload);
    const aadhaarFrontUpload = await uploadFile(aadhaarFront, 'aadhaar_front.jpg', 'aadhaar_documents', requestBaseUrl);
    uploadedFiles.push(aadhaarFrontUpload);
    const aadhaarBackUpload = await uploadFile(aadhaarBack, 'aadhaar_back.jpg', 'aadhaar_documents', requestBaseUrl);
    uploadedFiles.push(aadhaarBackUpload);

    // 2. Create AdmissionApplication record
    currentStep = 'saving application';
    const application = await prisma.admissionApplication.create({
      data: {
        name: selectedName,
        phone: selectedPhone,
        whatsappNumber,
        address,
        guardianName,
        guardianPhone,
        nearestPoliceStation,
        occupation,
        workLocation,
        preferredRoomType: booking?.room.roomType || preferredRoomType,
        joiningDate: booking?.expectedJoiningDate || new Date(joiningDate),
        leavingDate: leavingDate ? new Date(leavingDate) : null,
        profilePhotoUrl: profileUpload.url,
        aadhaarFrontUrl: aadhaarFrontUpload.url,
        aadhaarBackUrl: aadhaarBackUpload.url,
        notes,
        branchId: selectedBranchId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
      },
    });

    // 3. Save documents registry
    currentStep = 'saving document records';
    await prisma.document.createMany({
      data: [
        {
          fileName: 'profile.jpg',
          fileType: 'PROFILE_PHOTO',
          s3Key: profileUpload.key,
          s3Bucket: profileUpload.bucket,
          admissionApplicationId: application.id,
        },
        {
          fileName: 'aadhaar_front.jpg',
          fileType: 'AADHAAR_FRONT',
          s3Key: aadhaarFrontUpload.key,
          s3Bucket: aadhaarFrontUpload.bucket,
          admissionApplicationId: application.id,
        },
        {
          fileName: 'aadhaar_back.jpg',
          fileType: 'AADHAAR_BACK',
          s3Key: aadhaarBackUpload.key,
          s3Bucket: aadhaarBackUpload.bucket,
          admissionApplicationId: application.id,
        },
      ],
    });

    // 4. Create internal payment registry
    currentStep = 'creating payment record';
    const payment = await prisma.payment.create({
      data: {
        amount,
        status: 'PENDING',
        paymentType: 'ADMISSION',
        dueDate: new Date(),
        admissionApplicationId: application.id,
        branchId: selectedBranchId,
      },
    });

    currentStep = 'saving manual payment page';
    const manualPaymentUrl = `${requestBaseUrl}/pay/${payment.id}`;
    const upiPaymentUrl = buildUpiPaymentUrl({
      upiId: getSettingValue(branch.user.settings, 'payment_upi_id'),
      receiverName: getSettingValue(branch.user.settings, 'payment_receiver_name') || branch.user.name || branch.name,
      amount,
      note: `HostelHub ADMISSION ${payment.id}`,
    });
    createdApplicationId = application.id;
    if (submissionGuardId) {
      await prisma.admissionSubmissionGuard.update({ where: { id: submissionGuardId }, data: { applicationId: application.id } });
    }
    if (booking) {
      await prisma.booking.update({ where: { id: booking.id }, data: { admissionApplicationId: application.id } });
    }
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentMethod: 'UPI',
        paymentLinkUrl: upiPaymentUrl || manualPaymentUrl,
      },
    });

    await createOwnerNotification({
      title: 'New Admission Form',
      message: `${selectedName} submitted an admission form for ${branch.name}.`,
      type: 'NEW_ADMISSION',
      userId: branch.userId,
      branchId: selectedBranchId,
      applicationId: application.id,
      paymentId: payment.id,
    });
    bookingApplicationCreated = true;

    res.status(201).json({
      applicationId: application.id,
      paymentId: payment.id,
      paymentLink: upiPaymentUrl || manualPaymentUrl,
      upiPaymentLink: upiPaymentUrl,
      manualPaymentLink: manualPaymentUrl,
      message: upiPaymentUrl
        ? 'Application recorded. Opening UPI payment link.'
        : 'Application recorded. Please pay by UPI and share the screenshot on WhatsApp.',
    });
  } catch (error) {
    if (!bookingApplicationCreated && createdApplicationId) {
      await prisma.admissionApplication.deleteMany({ where: { id: createdApplicationId } }).catch(() => undefined);
    }
    if (!bookingApplicationCreated && submissionGuardId) {
      await prisma.admissionSubmissionGuard.deleteMany({ where: { id: submissionGuardId } }).catch(() => undefined);
    }
    if (claimedBookingId && !bookingApplicationCreated) {
      await prisma.booking.updateMany({ where: { id: claimedBookingId, status: 'FORM_SUBMITTED' }, data: { status: 'RESERVED' } }).catch(() => undefined);
    }
    if (!bookingApplicationCreated) {
      await Promise.allSettled(uploadedFiles.map((file) => deleteUploadedFile(file.key, file.bucket)));
    }
    console.error('Submit admission application error:', error);
    res.status(500).json({
      error: `Failed while ${currentStep}. Please try again or contact the hostel owner.`,
    });
  }
}

// Owner endpoint: Get all applications
export async function getAdmissionApplications(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { branchId, status, search } = req.query;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const applications = await prisma.admissionApplication.findMany({
      where: {
        branch: { userId },
        ...(branchId ? { branchId: branchId as string } : {}),
        ...(status ? { status: status as string } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search as string } },
                { phone: { contains: search as string } },
              ],
            }
          : {}),
      },
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(applications);
  } catch (error) {
    console.error('Get admission applications error:', error);
    res.status(500).json({ error: 'Failed to retrieve admission applications' });
  }
}

// Owner endpoint: Get application details by ID
export async function getAdmissionApplicationById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const application = await prisma.admissionApplication.findUnique({
      where: { id },
      include: {
        branch: true,
        payments: true,
        documents: true,
        booking: { include: { room: true } },
      },
    });

    if (!application || application.branch.userId !== userId) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(application);
  } catch (error) {
    console.error('Get application details by ID error:', error);
    res.status(500).json({ error: 'Failed to retrieve application details' });
  }
}

export async function changeAdmissionFeeStatus(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { paymentStatus, paymentMethod = 'CASH' } = req.body;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!['PAID', 'PENDING'].includes(paymentStatus)) {
    return res.status(400).json({ error: 'Payment status must be PAID or PENDING.' });
  }

  try {
    const application = await prisma.admissionApplication.findUnique({
      where: { id },
      include: { branch: true, payments: true },
    });
    if (!application || application.branch.userId !== userId) {
      return res.status(404).json({ error: 'Application not found' });
    }
    let payment = application.payments.find((item) => item.paymentType === 'ADMISSION');
    if (!payment) {
      const room = await prisma.room.findFirst({
        where: { branchId: application.branchId, roomType: application.preferredRoomType },
        orderBy: { admissionFee: 'asc' },
      }) || await prisma.room.findFirst({
        where: { branchId: application.branchId },
        orderBy: { admissionFee: 'asc' },
      });
      payment = await prisma.payment.create({
        data: {
          amount: room?.admissionFee ?? 1500,
          status: 'PENDING',
          paymentType: 'ADMISSION',
          dueDate: application.createdAt,
          admissionApplicationId: application.id,
          branchId: application.branchId,
        },
      });
    }

    if (paymentStatus === 'PAID') {
      const method = ['CASH', 'UPI', 'BANK'].includes(paymentMethod) ? paymentMethod : 'CASH';
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paidDate: new Date(),
          paymentMethod: method,
          transactionId: `MANUAL-${Date.now()}`,
        },
      });
      await prisma.admissionApplication.update({
        where: { id },
        data: { paymentStatus: 'PAID', paymentId: payment.id },
      });
      await createOwnerNotification({
        title: 'Joining Fee Marked Paid',
        message: `Joining fee of ₹${payment.amount} was marked as received from ${application.name}.`,
        type: 'ADMISSION_PAYMENT_RECEIVED',
        userId,
        branchId: application.branchId,
        applicationId: id,
        paymentId: payment.id,
      });
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PENDING',
          paidDate: null,
          paymentMethod: null,
          transactionId: null,
          receiptUrl: null,
        },
      });
      await prisma.admissionApplication.update({
        where: { id },
        data: { paymentStatus: 'PENDING', paymentId: null },
      });
    }

    res.json({ message: paymentStatus === 'PAID' ? 'Joining fee marked as paid.' : 'Joining fee marked as not paid.' });
  } catch (error) {
    console.error('Change joining fee status error:', error);
    res.status(500).json({ error: 'Failed to change the joining fee status' });
  }
}

export async function deleteAdmissionApplication(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const application = await prisma.admissionApplication.findUnique({
      where: { id },
      include: { branch: true, booking: true, documents: true },
    });
    if (!application || application.branch.userId !== userId) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (application.status === 'APPROVED') {
      return res.status(400).json({ error: 'An approved application cannot be deleted here. Use the resident record instead.' });
    }

    const bookedRoomId = application.booking?.roomId;
    await prisma.notification.deleteMany({ where: { userId, applicationId: id } });
    if (application.booking) {
      await prisma.booking.update({
        where: { id: application.booking.id },
        data: { status: 'RESERVED', admissionApplicationId: null },
      });
    }
    await prisma.admissionApplication.delete({ where: { id } });
    const remainingApplication = await prisma.admissionApplication.findFirst({
      where: { branchId: application.branchId, phone: application.phone },
      select: { id: true },
    });
    if (remainingApplication) {
      await prisma.admissionSubmissionGuard.upsert({
        where: { branchId_phone: { branchId: application.branchId, phone: application.phone } },
        update: { applicationId: remainingApplication.id },
        create: {
          branchId: application.branchId,
          phone: application.phone,
          applicationId: remainingApplication.id,
        },
      });
    } else {
      await prisma.admissionSubmissionGuard.deleteMany({ where: { branchId: application.branchId, phone: application.phone } });
    }
    if (bookedRoomId) await updateRoomOccupancyStatus(bookedRoomId);
    const cleanupResults = await Promise.allSettled(
      application.documents.map((document) => deleteUploadedFile(document.s3Key, document.s3Bucket)),
    );
    for (const result of cleanupResults) {
      if (result.status === 'rejected') console.error('Admission document cleanup error:', result.reason);
    }

    res.json({
      message: application.booking
        ? 'Admission application deleted. The reserved place and its secure form link are ready for a corrected submission.'
        : 'Admission application deleted. This phone number can submit a fresh form.',
    });
  } catch (error) {
    console.error('Delete admission application error:', error);
    res.status(500).json({ error: 'Failed to delete the admission application' });
  }
}

// Owner endpoint: Approve / Reject
export async function reviewApplication(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { status, roomId } = req.body; // status: APPROVED or REJECTED
  const userId = req.user?.id;
  let reviewClaimed = false;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (status !== 'APPROVED' && status !== 'REJECTED') {
    return res.status(400).json({ error: 'Invalid status. Must be APPROVED or REJECTED.' });
  }

  try {
    const application = await prisma.admissionApplication.findUnique({
      where: { id },
      include: {
        branch: true,
        documents: true,
        booking: true,
        payments: true,
      },
    });

    if (!application || application.branch.userId !== userId) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'PENDING') {
      return res.status(400).json({ error: 'This application has already been processed.' });
    }

    const joiningFeePaid = application.paymentStatus === 'PAID'
      && application.payments.some((payment) => payment.paymentType === 'ADMISSION' && payment.status === 'PAID');
    if (status === 'APPROVED' && !joiningFeePaid) {
      return res.status(400).json({ error: 'The joining fee must be collected before this admission can be approved.' });
    }

    const claim = await prisma.admissionApplication.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });
    if (claim.count !== 1) {
      return res.status(409).json({ error: 'This application is already being reviewed.' });
    }
    reviewClaimed = true;

    if (status === 'APPROVED') {
      const selectedRoomId = application.booking?.roomId || roomId;
      if (!selectedRoomId) {
        await prisma.admissionApplication.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PENDING' } });
        reviewClaimed = false;
        return res.status(400).json({ error: 'Room selection is required for approval.' });
      }

      // Check room availability
      const room = await prisma.room.findUnique({
        where: { id: selectedRoomId },
        include: { tenants: { where: { status: 'ACTIVE' } }, bookings: true },
      });

      if (!room || room.branchId !== application.branchId) {
        await prisma.admissionApplication.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PENDING' } });
        reviewClaimed = false;
        return res.status(404).json({ error: 'Selected room not found in the preferred branch.' });
      }

      const otherReservations = room.bookings.filter((item) => item.status !== 'OCCUPIED' && item.id !== application.booking?.id).length;
      if (room.tenants.length + otherReservations >= room.capacity) {
        await prisma.admissionApplication.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PENDING' } });
        reviewClaimed = false;
        return res.status(400).json({ error: 'Selected room is fully occupied.' });
      }

      // 1. Create Tenant
      const tenant = await prisma.tenant.create({
        data: {
          name: application.name,
          phone: application.phone,
          whatsappNumber: application.whatsappNumber,
          address: application.address,
          guardianName: application.guardianName,
          guardianPhone: application.guardianPhone,
          nearestPoliceStation: application.nearestPoliceStation,
          occupation: application.occupation,
          workLocation: application.workLocation,
          joiningDate: application.joiningDate,
          leavingDate: application.leavingDate,
          status: 'ACTIVE',
          profilePhotoUrl: application.profilePhotoUrl,
          aadhaarFrontUrl: application.aadhaarFrontUrl,
          aadhaarBackUrl: application.aadhaarBackUrl,
          roomId: selectedRoomId,
        },
      });

      // 2. Link application documents to new Tenant
      await prisma.document.updateMany({
        where: { admissionApplicationId: id },
        data: { tenantId: tenant.id },
      });

      // 3. Link paid payments of application to new Tenant
      await prisma.payment.updateMany({
        where: { admissionApplicationId: id },
        data: { tenantId: tenant.id },
      });

      // 4. Update Application status
      await prisma.admissionApplication.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      if (application.booking) {
        await prisma.booking.update({ where: { id: application.booking.id }, data: { status: 'OCCUPIED', tenantId: tenant.id } });
      }

      // 5. Update Room occupancy
      await updateRoomOccupancyStatus(selectedRoomId);

      // Prepare this resident's advance rent bill for the current month immediately.
      // This is idempotent, so the monthly bulk action will not create a duplicate.
      let rentInvoiceCreated = false;
      try {
        const rentInvoice = await ensureCurrentMonthRentInvoice({
          tenantId: tenant.id,
          branchId: room.branchId,
          monthlyRent: room.monthlyRent,
          joiningDate: tenant.joiningDate,
        });
        rentInvoiceCreated = rentInvoice.created;
      } catch (rentError) {
        console.error('Create current month advance rent invoice error:', rentError);
      }

      // 6. Notify Owner
      await createOwnerNotification({
        title: 'Admission Approved',
        message: `${application.name} was admitted to Room ${room.roomNumber}.`,
        type: 'ADMISSION_APPROVED',
        userId,
        branchId: application.branchId,
        tenantId: tenant.id,
        applicationId: id,
      });

      const rentMonth = getCalendarMonthRange().label;
      return res.json({
        message: rentInvoiceCreated
          ? `Application approved. Resident is active and the ${rentMonth} advance rent bill is ready.`
          : 'Application approved. Resident is active.',
        tenant,
      });
    } else {
      // status === REJECTED
      await prisma.admissionApplication.update({
        where: { id },
        data: { status: 'REJECTED' },
      });

      if (application.booking) {
        await prisma.booking.delete({ where: { id: application.booking.id } });
        await updateRoomOccupancyStatus(application.booking.roomId);
      }

      await createOwnerNotification({
        title: 'Admission Not Accepted',
        message: `${application.name}'s admission request was not accepted.`,
        type: 'ADMISSION_APPROVED',
        userId,
        branchId: application.branchId,
        applicationId: id,
      });

      return res.json({ message: 'Application rejected.' });
    }
  } catch (error) {
    if (reviewClaimed) {
      await prisma.admissionApplication.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PENDING' } }).catch(() => undefined);
    }
    console.error('Review application error:', error);
    res.status(500).json({ error: 'Failed to complete application review' });
  }
}
