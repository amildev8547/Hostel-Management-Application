import { createHash, randomBytes } from 'crypto';
import prisma from '../config/db';

const FORM_TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueAdmissionFormToken(branchId: string, bookingToken?: string) {
  const now = new Date();
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { organizationId: true, organization: { select: { status: true } } } });
  if (!branch?.organizationId || branch.organization?.status !== 'ACTIVE') throw new Error('This hostel account is not active');
  await prisma.admissionFormToken.deleteMany({ where: { expiresAt: { lt: now } } });
  const token = randomBytes(32).toString('hex');
  await prisma.admissionFormToken.create({
    data: {
      tokenHash: hashToken(token),
      organizationId: branch.organizationId,
      branchId,
      bookingToken: bookingToken || null,
      expiresAt: new Date(now.getTime() + FORM_TOKEN_LIFETIME_MS),
      usedAt: null,
    },
  });
  return token;
}

export async function claimAdmissionFormToken(input: { token: string; branchId: string; bookingToken?: string }) {
  if (!/^[a-f0-9]{64}$/i.test(input.token)) return false;
  const claimed = await prisma.admissionFormToken.updateMany({
    where: {
      tokenHash: hashToken(input.token),
      branchId: input.branchId,
      expiresAt: { gt: new Date() },
      AND: [
        {
          OR: [
            { usedAt: null },
            { usedAt: { isSet: false } },
          ],
        },
        input.bookingToken
          ? { bookingToken: input.bookingToken }
          : {
              OR: [
                { bookingToken: null },
                { bookingToken: { isSet: false } },
              ],
            },
      ],
    },
    data: { usedAt: new Date() },
  });
  return claimed.count === 1;
}
