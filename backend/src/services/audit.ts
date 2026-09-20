import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';

type AuditInput = {
  action: string;
  organizationId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(req: AuthenticatedRequest, input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorUserId: req.user?.id,
      organizationId: input.organizationId ?? req.user?.organizationId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as any,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 500),
    },
  });
}
