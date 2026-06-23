import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { uploadFile } from '../services/cloudinary';
import { createPaymentLink } from '../services/razorpay';
import { updateRoomOccupancyStatus } from '../utils/occupancy';

// Public endpoint: Submit application
export async function submitAdmissionApplication(req: Request, res: Response) {
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
  } = req.body;

  try {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return res.status(404).json({ error: 'Selected branch does not exist' });
    }

    // The admission fee is always computed server-side from the branch's actual room
    // pricing — never trust a client-supplied amount, since that would let an applicant
    // pay whatever they want by editing the request.
    const matchingRoom = await prisma.room.findFirst({
      where: { branchId, roomType: preferredRoomType },
      orderBy: { admissionFee: 'asc' },
    });
    const fallbackRoom = matchingRoom
      ? null
      : await prisma.room.findFirst({ where: { branchId }, orderBy: { admissionFee: 'asc' } });
    const amount = matchingRoom?.admissionFee ?? fallbackRoom?.admissionFee ?? 1500;

    // 1. Upload files to S3 / Local storage
    // Use the host the applicant's browser actually used to reach this server, so the
    // stored URL resolves later for the owner too (not just whoever is on localhost).
    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
    const profileUpload = await uploadFile(profilePhoto, 'profile.jpg', 'profile_photos', requestBaseUrl);
    const aadhaarFrontUpload = await uploadFile(aadhaarFront, 'aadhaar_front.jpg', 'aadhaar_documents', requestBaseUrl);
    const aadhaarBackUpload = await uploadFile(aadhaarBack, 'aadhaar_back.jpg', 'aadhaar_documents', requestBaseUrl);

    // 2. Create AdmissionApplication record
    const application = await prisma.admissionApplication.create({
      data: {
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
        joiningDate: new Date(joiningDate),
        leavingDate: leavingDate ? new Date(leavingDate) : null,
        profilePhotoUrl: profileUpload.url,
        aadhaarFrontUrl: aadhaarFrontUpload.url,
        aadhaarBackUrl: aadhaarBackUpload.url,
        notes,
        branchId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
      },
    });

    // 3. Save documents registry
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
    const payment = await prisma.payment.create({
      data: {
        amount,
        status: 'PENDING',
        paymentType: 'ADMISSION',
        dueDate: new Date(),
        admissionApplicationId: application.id,
        branchId,
      },
    });

    // 5. Generate Razorpay payment link
    const payLink = await createPaymentLink({
      paymentId: payment.id,
      amount,
      description: `Admission Fee - ${name} (${branch.name})`,
      customerName: name,
      customerPhone: phone,
      customerEmail: `${phone}@hostelhub.app`,
    });

    // Update payment with link details
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentLinkId: payLink.id,
        paymentLinkUrl: payLink.url,
      },
    });

    res.status(201).json({
      applicationId: application.id,
      paymentId: payment.id,
      paymentLink: payLink.url,
      message: 'Application recorded. Please complete payment using the link.',
    });
  } catch (error) {
    console.error('Submit admission application error:', error);
    res.status(500).json({ error: 'Failed to record admission application' });
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

// Owner endpoint: Approve / Reject
export async function reviewApplication(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { status, roomId } = req.body; // status: APPROVED or REJECTED
  const userId = req.user?.id;

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
      },
    });

    if (!application || application.branch.userId !== userId) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'PENDING') {
      return res.status(400).json({ error: 'This application has already been processed.' });
    }

    if (status === 'APPROVED') {
      if (!roomId) {
        return res.status(400).json({ error: 'Room selection is required for approval.' });
      }

      // Check room availability
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { tenants: { where: { status: 'ACTIVE' } } },
      });

      if (!room || room.branchId !== application.branchId) {
        return res.status(404).json({ error: 'Selected room not found in the preferred branch.' });
      }

      if (room.tenants.length >= room.capacity) {
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
          roomId,
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

      // 5. Update Room occupancy
      await updateRoomOccupancyStatus(roomId);

      // 6. Notify Owner
      await prisma.notification.create({
        data: {
          title: 'Admission Approved',
          message: `Application for ${application.name} was approved. Tenant has been allocated to Room ${room.roomNumber}.`,
          type: 'ADMISSION_APPROVED',
          userId,
        },
      });

      return res.json({ message: 'Application approved. Tenant active.', tenant });
    } else {
      // status === REJECTED
      await prisma.admissionApplication.update({
        where: { id },
        data: { status: 'REJECTED' },
      });

      await prisma.notification.create({
        data: {
          title: 'Admission Rejected',
          message: `Application for ${application.name} was rejected.`,
          type: 'ADMISSION_APPROVED', // Shared status notifications
          userId,
        },
      });

      return res.json({ message: 'Application rejected.' });
    }
  } catch (error) {
    console.error('Review application error:', error);
    res.status(500).json({ error: 'Failed to complete application review' });
  }
}
