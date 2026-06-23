import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export const branchFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  phone: z.string().min(10, 'Enter a valid 10-digit phone number').max(15),
  googleMapsLocation: z.string().optional(),
  rentDueDay: z.number().min(1, 'Due day must be between 1 and 31').max(31),
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
