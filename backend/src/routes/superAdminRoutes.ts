import { Router } from 'express';
import { z } from 'zod';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { asyncHandler } from '../middlewares/asyncHandler';
import {
  createOrganization, createOrganizationAdmin, getOrganization, getPlatformDashboard, listAuditLogs,
  listOrganizations, resetOrganizationAdmin, updateOrganization, updateOrganizationAdminStatus,
} from '../controllers/superAdminController';

const router = Router();
router.use(authenticateJWT, requireRole('SUPER_ADMIN'));

const organizationBody = z.object({
  name: z.string().trim().min(2).max(120), contactName: z.string().trim().max(100).optional(),
  contactPhone: z.string().trim().max(20).optional(), contactEmail: z.string().trim().email().optional().or(z.literal('')),
  plan: z.enum(['FREE', 'STANDARD', 'PREMIUM']).optional(), maxBranches: z.number().int().positive().optional(), maxBeds: z.number().int().positive().optional(),
  adminName: z.string().trim().min(2).max(100), adminEmail: z.string().trim().email(),
});

router.get('/dashboard', asyncHandler(getPlatformDashboard));
router.get('/organizations', asyncHandler(listOrganizations));
router.post('/organizations', validate(z.object({ body: organizationBody })), asyncHandler(createOrganization));
router.get('/organizations/:id', asyncHandler(getOrganization));
router.patch('/organizations/:id', validate(z.object({ body: z.object({
  name: z.string().trim().min(2).max(120).optional(), contactName: z.string().max(100).optional(), contactPhone: z.string().max(20).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')), status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  plan: z.enum(['FREE', 'STANDARD', 'PREMIUM']).optional(), maxBranches: z.number().int().positive().nullable().optional(), maxBeds: z.number().int().positive().nullable().optional(),
}) })), asyncHandler(updateOrganization));
router.post('/organizations/:id/admins', validate(z.object({ body: z.object({ name: z.string().trim().min(2), email: z.string().trim().email() }) })), asyncHandler(createOrganizationAdmin));
router.post('/organizations/:id/admins/:userId/reset-access', asyncHandler(resetOrganizationAdmin));
router.patch('/organizations/:id/admins/:userId/status', validate(z.object({ body: z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }) })), asyncHandler(updateOrganizationAdminStatus));
router.get('/audit-logs', asyncHandler(listAuditLogs));

export default router;
