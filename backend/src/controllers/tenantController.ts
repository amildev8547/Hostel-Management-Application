import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { updateRoomOccupancyStatus } from '../utils/occupancy';
import { ensureCurrentMonthRentInvoice } from '../utils/rentBilling';
import { createOwnerNotification } from '../services/notifications';
import { deleteUploadedFile, UploadedFile, uploadFile } from '../services/cloudinary';
import { writeAuditLog } from '../services/audit';

export async function createExistingTenant(req: AuthenticatedRequest, res: Response) {
  const organizationId = req.user?.organizationId;
  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    branchId, roomId, name, phone, whatsappNumber, joiningDate, address = '',
    guardianName = '', guardianPhone = '', nearestPoliceStation = '', occupation = '',
    workLocation = '', notes = '', leavingDate, profilePhoto, aadhaarFront, aadhaarBack,
    joiningFeeStatus = 'SKIP', currentRentStatus = 'DUE',
  } = req.body;
  const uploads: UploadedFile[] = [];

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { branch: true, tenants: { where: { status: 'ACTIVE' } }, bookings: true },
    });
    if (!room || room.branchId !== branchId || room.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Selected room was not found in this hostel.' });
    }
    const reservedBeds = room.bookings.filter((booking) => booking.status !== 'OCCUPIED').length;
    if (room.tenants.length + reservedBeds >= room.capacity) {
      return res.status(400).json({ error: 'The selected room does not have a free bed.' });
    }

    const duplicate = await prisma.tenant.findFirst({
      where: { phone, status: 'ACTIVE', room: { branchId } },
    });
    if (duplicate) return res.status(409).json({ error: 'An active resident with this phone number already exists in this hostel.' });
    const joinedOn = new Date(joiningDate);
    const today = new Date(); today.setHours(23, 59, 59, 999);
    if (joinedOn > today) return res.status(400).json({ error: 'The joining date cannot be in the future.' });
    if (leavingDate && new Date(leavingDate) < joinedOn) return res.status(400).json({ error: 'Leaving date cannot be before joining date.' });

    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
    const uploadOptional = async (data: string | undefined, fileName: string, folder: string) => {
      if (!data) return undefined;
      const uploaded = await uploadFile(data, fileName, folder, requestBaseUrl);
      uploads.push(uploaded);
      return uploaded;
    };
    const profileUpload = await uploadOptional(profilePhoto, 'profile.jpg', 'profile_photos');
    const aadhaarFrontUpload = await uploadOptional(aadhaarFront, 'aadhaar_front.jpg', 'aadhaar_documents');
    const aadhaarBackUpload = await uploadOptional(aadhaarBack, 'aadhaar_back.jpg', 'aadhaar_documents');

    const tenant = await prisma.tenant.create({
      data: {
        name, phone, whatsappNumber: whatsappNumber || phone, address, guardianName,
        guardianPhone, nearestPoliceStation, occupation, workLocation, notes,
        joiningDate: joinedOn, leavingDate: leavingDate ? new Date(leavingDate) : null,
        profilePhotoUrl: profileUpload?.url, aadhaarFrontUrl: aadhaarFrontUpload?.url,
        aadhaarBackUrl: aadhaarBackUpload?.url, status: 'ACTIVE', organizationId, roomId,
      },
    });

    try {
      const now = new Date();
      if (joiningFeeStatus === 'PAID') {
        await prisma.payment.create({ data: {
          amount: room.admissionFee, status: 'PAID', paymentType: 'ADMISSION', dueDate: joinedOn,
          paidDate: joinedOn, transactionId: `EXISTING-${tenant.id}`,
          organizationId, tenantId: tenant.id, branchId,
        } });
      }
      if (currentRentStatus !== 'SKIP') {
        const result = await ensureCurrentMonthRentInvoice({
          organizationId, tenantId: tenant.id, branchId, monthlyRent: room.monthlyRent, joiningDate: joinedOn, now,
        });
        if (currentRentStatus === 'PAID') {
          await prisma.payment.update({ where: { id: result.payment.id }, data: {
            status: 'PAID', paidDate: now, transactionId: `OPENING-${tenant.id}`,
          } });
        }
      }
      const documentData = [
        profileUpload && { fileName: 'profile.jpg', fileType: 'PROFILE_PHOTO', upload: profileUpload },
        aadhaarFrontUpload && { fileName: 'aadhaar_front.jpg', fileType: 'AADHAAR_FRONT', upload: aadhaarFrontUpload },
        aadhaarBackUpload && { fileName: 'aadhaar_back.jpg', fileType: 'AADHAAR_BACK', upload: aadhaarBackUpload },
      ].filter(Boolean) as { fileName: string; fileType: string; upload: UploadedFile }[];
      await Promise.all(documentData.map((document) => prisma.document.create({ data: {
        fileName: document.fileName, fileType: document.fileType, s3Key: document.upload.key,
        s3Bucket: document.upload.bucket, organizationId, tenantId: tenant.id,
      } })));
      await updateRoomOccupancyStatus(roomId);
      await createOwnerNotification({
        title: 'Existing Resident Added', message: `${name} was added to Room ${room.roomNumber}.`,
        type: 'ADMISSION_APPROVED', organizationId, branchId, tenantId: tenant.id,
      });
    } catch (setupError) {
      await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => undefined);
      throw setupError;
    }

    res.status(201).json({ message: `${name} was added as a resident.`, tenant });
  } catch (error) {
    await Promise.allSettled(uploads.map((upload) => deleteUploadedFile(upload.key, upload.bucket)));
    console.error('Create existing tenant error:', error);
    res.status(500).json({ error: 'Failed to add the existing resident.' });
  }
}

export async function getTenants(req: AuthenticatedRequest, res: Response) {
  const organizationId = req.user?.organizationId;
  const { branchId, status, search } = req.query;

  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        room: {
          branch: { organizationId },
          ...(branchId ? { branchId: branchId as string } : {}),
        },
        ...(status ? { status: status as string } : { status: 'ACTIVE' }), // Default to active
        ...(search
          ? {
              OR: [
                { name: { contains: search as string } },
                { phone: { contains: search as string } },
                { room: { roomNumber: { contains: search as string } } },
              ],
            }
          : {}),
      },
      include: {
        room: {
          include: { branch: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(tenants);
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({ error: 'Failed to retrieve tenants' });
  }
}

export async function getTenantById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        room: {
          include: { branch: true },
        },
        payments: {
          orderBy: { dueDate: 'desc' },
        },
        documents: true,
      },
    });

    if (!tenant || tenant.room.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Get tenant details error:', error);
    res.status(500).json({ error: 'Failed to retrieve tenant details' });
  }
}

export async function updateTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const { profilePhoto, aadhaarFront, aadhaarBack, joiningDate, leavingDate, ...details } = req.body;
    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
    const imageInputs = [
      { data: profilePhoto, fileName: 'profile.jpg', fileType: 'PROFILE_PHOTO', folder: 'profile_photos', urlField: 'profilePhotoUrl' },
      { data: aadhaarFront, fileName: 'aadhaar_front.jpg', fileType: 'AADHAAR_FRONT', folder: 'aadhaar_documents', urlField: 'aadhaarFrontUrl' },
      { data: aadhaarBack, fileName: 'aadhaar_back.jpg', fileType: 'AADHAAR_BACK', folder: 'aadhaar_documents', urlField: 'aadhaarBackUrl' },
    ].filter((image) => !!image.data);
    const newUploads: { image: typeof imageInputs[number]; upload: UploadedFile }[] = [];
    for (const image of imageInputs) {
      newUploads.push({ image, upload: await uploadFile(image.data, image.fileName, image.folder, requestBaseUrl) });
    }
    const oldDocuments = newUploads.length ? await prisma.document.findMany({
      where: { tenantId: id, fileType: { in: newUploads.map(({ image }) => image.fileType) } },
    }) : [];
    const imageUrls = Object.fromEntries(newUploads.map(({ image, upload }) => [image.urlField, upload.url]));

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...details,
        ...(joiningDate ? { joiningDate: new Date(joiningDate) } : {}),
        ...(leavingDate !== undefined ? { leavingDate: leavingDate ? new Date(leavingDate) : null } : {}),
        ...imageUrls,
      },
    });
    for (const { image, upload } of newUploads) {
      await prisma.document.deleteMany({ where: { tenantId: id, fileType: image.fileType } });
      await prisma.document.create({ data: {
        fileName: image.fileName, fileType: image.fileType, s3Key: upload.key,
        s3Bucket: upload.bucket, organizationId, tenantId: id,
      } });
    }
    await Promise.allSettled(oldDocuments.map((document) => deleteUploadedFile(document.s3Key, document.s3Bucket)));

    res.json(updated);
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
}

export async function moveTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { newRoomId } = req.body;
  const organizationId = req.user?.organizationId;

  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
  if (!newRoomId) return res.status(400).json({ error: 'newRoomId is required' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot move a vacated tenant.' });
    }

    const oldRoomId = tenant.roomId;

    if (oldRoomId === newRoomId) {
      return res.status(400).json({ error: 'Tenant is already in this room.' });
    }

    // Verify space in new room
    const newRoom = await prisma.room.findUnique({
      where: { id: newRoomId },
      include: { tenants: { where: { status: 'ACTIVE' } }, bookings: true, branch: true },
    });

    if (!newRoom || newRoom.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Selected room not found' });
    }

    const reservedBeds = newRoom.bookings.filter((booking) => booking.status !== 'OCCUPIED').length;
    if (newRoom.tenants.length + reservedBeds >= newRoom.capacity) {
      return res.status(400).json({ error: 'Selected room is already fully occupied' });
    }

    // Update Tenant Room assignment
    await prisma.booking.deleteMany({ where: { tenantId: id } });
    const updated = await prisma.tenant.update({
      where: { id },
      data: { roomId: newRoomId },
    });

    // Update occupancy statuses
    await updateRoomOccupancyStatus(oldRoomId);
    await updateRoomOccupancyStatus(newRoomId);

    // Record activity
    await createOwnerNotification({
      title: 'Resident Room Changed',
      message: `${tenant.name} was moved from Room ${tenant.room.roomNumber} to Room ${newRoom.roomNumber}.`,
      type: 'ADMISSION_APPROVED',
      organizationId,
      branchId: newRoom.branchId,
      tenantId: id,
    });

    res.json({ message: 'Tenant successfully relocated', tenant: updated });
  } catch (error) {
    console.error('Move tenant error:', error);
    res.status(500).json({ error: 'Failed to relocate tenant' });
  }
}

export async function vacateTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.status === 'VACATED') {
      return res.status(400).json({ error: 'Tenant has already vacated' });
    }

    // Update tenant status and leaving date
    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        status: 'VACATED',
        leavingDate: new Date(),
      },
    });

    await prisma.booking.deleteMany({ where: { tenantId: id } });

    // Update room occupancy status
    await updateRoomOccupancyStatus(tenant.roomId);

    // Notify Owner
    await createOwnerNotification({
      title: 'Resident Moved Out',
      message: `${tenant.name} has moved out of Room ${tenant.room.roomNumber}.`,
      type: 'TENANT_VACATED',
      organizationId,
      branchId: tenant.room.branchId,
      tenantId: id,
    });

    res.json({ message: 'Tenant vacated successfully', tenant: updated });
  } catch (error) {
    console.error('Vacate tenant error:', error);
    res.status(500).json({ error: 'Failed to vacate tenant' });
  }
}

export async function readmitTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { newRoomId } = req.body;
  const organizationId = req.user?.organizationId;

  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
  if (!newRoomId) return res.status(400).json({ error: 'Choose a room for the returning resident.' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    if (tenant.status !== 'VACATED') {
      return res.status(400).json({ error: 'This resident is already active.' });
    }

    const newRoom = await prisma.room.findUnique({
      where: { id: newRoomId },
      include: { tenants: { where: { status: 'ACTIVE' } }, bookings: true, branch: true },
    });
    if (!newRoom || newRoom.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Selected room not found' });
    }

    const reservedBeds = newRoom.bookings.filter((booking) => booking.status !== 'OCCUPIED').length;
    if (newRoom.tenants.length + reservedBeds >= newRoom.capacity) {
      return res.status(400).json({ error: 'The selected room does not have a free place.' });
    }

    const oldRoomId = tenant.roomId;
    await prisma.booking.deleteMany({ where: { tenantId: id } });
    const returningJoiningDate = new Date();
    const claim = await prisma.tenant.updateMany({
      where: { id, status: 'VACATED' },
      data: {
        roomId: newRoomId,
        status: 'ACTIVE',
        joiningDate: returningJoiningDate,
        leavingDate: null,
      },
    });
    if (claim.count !== 1) {
      return res.status(409).json({ error: 'This resident was already admitted again on another device.' });
    }
    const updated = await prisma.tenant.findUnique({ where: { id } });

    if (oldRoomId !== newRoomId) await updateRoomOccupancyStatus(oldRoomId);
    await updateRoomOccupancyStatus(newRoomId);
    await ensureCurrentMonthRentInvoice({
      organizationId,
      tenantId: id,
      branchId: newRoom.branchId,
      monthlyRent: newRoom.monthlyRent,
      joiningDate: returningJoiningDate,
    });

    await createOwnerNotification({
      title: 'Resident Admitted Again',
      message: `${tenant.name} has returned and was assigned to Room ${newRoom.roomNumber}.`,
      type: 'ADMISSION_APPROVED',
      organizationId,
      branchId: newRoom.branchId,
      tenantId: id,
    });

    res.json({ message: 'Resident admitted again using the saved details.', tenant: updated });
  } catch (error) {
    console.error('Readmit tenant error:', error);
    res.status(500).json({ error: 'Failed to admit this resident again' });
  }
}

// Create a rent invoice for a custom number of days (e.g. a tenant staying only 10/15/20 days),
// with an optional discount. Uses a flat 30-day month as the per-day rate basis.
export async function createCustomRentInvoice(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { days, discountAmount = 0, dueDate } = req.body;
  const organizationId = req.user?.organizationId;

  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } } },
    });

    if (!tenant || tenant.room.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot generate a rent invoice for a vacated tenant.' });
    }

    const perDayRate = tenant.room.monthlyRent / 30;
    const originalAmount = Math.round(perDayRate * days);
    const amount = Math.max(0, originalAmount - discountAmount);

    const payment = await prisma.payment.create({
      data: {
        amount,
        originalAmount,
        discountAmount,
        daysBilled: days,
        status: 'PENDING',
        paymentType: 'RENT',
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        organizationId,
        tenantId: tenant.id,
        branchId: tenant.room.branchId,
      },
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Create custom rent invoice error:', error);
    res.status(500).json({ error: 'Failed to create rent invoice' });
  }
}

export async function deleteTenant(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { branch: true } }, documents: true },
    });

    if (!tenant || tenant.room.branch.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const roomId = tenant.roomId;
    const branchId = tenant.room.branchId;
    const relatedApplications = await prisma.admissionApplication.findMany({
      where: { branchId, phone: tenant.phone },
      include: { documents: true },
    });
    const applicationIds = relatedApplications.map((application) => application.id);
    const uploadedDocuments = [
      ...tenant.documents,
      ...relatedApplications.flatMap((application) => application.documents),
    ];

    await prisma.notification.deleteMany({
      where: {
        organizationId,
        OR: [
          { tenantId: id },
          ...(applicationIds.length ? [{ applicationId: { in: applicationIds } }] : []),
        ],
      },
    });
    await prisma.admissionSubmissionGuard.deleteMany({ where: { branchId, phone: tenant.phone } });
    await prisma.booking.deleteMany({ where: { tenantId: id } });
    await prisma.tenant.delete({ where: { id } });
    if (applicationIds.length) {
      await prisma.admissionApplication.deleteMany({ where: { id: { in: applicationIds } } });
    }
    await writeAuditLog(req, { action: 'RESIDENT_DELETED', entityType: 'Tenant', entityId: id, metadata: { branchId } });

    // Recalculate room occupancy status
    await updateRoomOccupancyStatus(roomId);

    const cleanupResults = await Promise.allSettled(
      uploadedDocuments.map((document) => deleteUploadedFile(document.s3Key, document.s3Bucket)),
    );
    for (const result of cleanupResults) {
      if (result.status === 'rejected') console.error('Resident document cleanup error:', result.reason);
    }

    res.json({ message: 'Resident and all related records deleted successfully' });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
}
