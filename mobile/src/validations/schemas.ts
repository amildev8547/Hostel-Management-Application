import { z } from 'zod';

export const branchFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const roomFormSchema = z.object({
  roomNumber: z.string().min(1, 'Room number is required'),
  floor: z.string().min(1, 'Floor/Level is required'),
  roomType: z.string().min(1, 'Select sharing type'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  monthlyRent: z.number().min(0, 'Monthly rent must be a positive number'),
  admissionFee: z.number().min(0, 'Admission fee must be a positive number'),
  status: z.enum(['AVAILABLE', 'PARTIAL', 'FULL', 'MAINTENANCE']).default('AVAILABLE'),
});
