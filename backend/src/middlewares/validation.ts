import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(500).json({ error: 'Internal validation server error' });
    }
  };
};

import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});

export const branchSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    address: z.string().min(5, 'Address must be at least 5 characters'),
    phone: z.string().min(10, 'Phone must be at least 10 digits'),
    googleMapsLocation: z.string().optional(),
    rentDueDay: z.number().min(1).max(31).default(5),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  }),
});

export const roomSchema = z.object({
  body: z.object({
    roomNumber: z.string().min(1, 'Room number is required'),
    floor: z.string().min(1, 'Floor number is required'),
    roomType: z.string().min(1, 'Room type is required'),
    capacity: z.number().int().min(1, 'Capacity must be at least 1'),
    monthlyRent: z.number().min(0, 'Monthly rent must be positive'),
    admissionFee: z.number().min(0, 'Admission fee must be positive'),
    status: z.enum(['AVAILABLE', 'PARTIAL', 'FULL', 'MAINTENANCE']).default('AVAILABLE'),
  }),
});

// Joining date may be backdated by at most this many days (covers tenants who already
// moved in and are filling the form late), but no further back than that, and never
// blocks genuine past admissions beyond the grace window.
const JOINING_DATE_GRACE_DAYS = 7;

function isValidDateString(val: string) {
  return !isNaN(Date.parse(val));
}

export const publicAdmissionFormSchema = z.object({
  body: z
    .object({
      name: z.string().min(2, 'Full name must be at least 2 characters'),
      phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
      whatsappNumber: z.string().regex(/^\d{10}$/, 'WhatsApp number must be exactly 10 digits'),
      address: z.string().min(5, 'Address must be at least 5 characters'),
      guardianName: z.string().min(2, 'Guardian name is required'),
      guardianPhone: z.string().regex(/^\d{10}$/, 'Guardian phone must be exactly 10 digits'),
      nearestPoliceStation: z.string().min(2, 'Nearest police station is required'),
      occupation: z.string().min(2, 'Occupation is required'),
      workLocation: z.string().min(2, 'Work location is required'),
      preferredRoomType: z.string().min(1, 'Preferred room type is required'),
      joiningDate: z.string().refine(isValidDateString, { message: 'Invalid joining date format' }),
      leavingDate: z.string().optional().refine((val) => !val || isValidDateString(val), {
        message: 'Invalid expected leaving date format',
      }),
      profilePhoto: z.string().min(10, 'Profile photo base64 is required'),
      aadhaarFront: z.string().min(10, 'Aadhaar front base64 is required'),
      aadhaarBack: z.string().min(10, 'Aadhaar back base64 is required'),
      notes: z.string().optional(),
      // Admission fee is computed server-side from room pricing; client value (if sent) is ignored.
      amount: z.number().optional(),
    })
    .superRefine((data, ctx) => {
      const earliestAllowed = new Date();
      earliestAllowed.setHours(0, 0, 0, 0);
      earliestAllowed.setDate(earliestAllowed.getDate() - JOINING_DATE_GRACE_DAYS);

      const joining = new Date(data.joiningDate);
      if (isValidDateString(data.joiningDate) && joining < earliestAllowed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['joiningDate'],
          message: `Joining date cannot be more than ${JOINING_DATE_GRACE_DAYS} days in the past`,
        });
      }

      if (data.leavingDate && isValidDateString(data.leavingDate) && isValidDateString(data.joiningDate)) {
        const leaving = new Date(data.leavingDate);
        if (leaving < joining) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['leavingDate'],
            message: 'Leaving date cannot be before the joining date',
          });
        }
      }
    }),
});

export const customRentSchema = z.object({
  body: z.object({
    days: z.number().int().min(1, 'Days must be at least 1').max(31, 'Days cannot exceed 31'),
    discountAmount: z.number().min(0, 'Discount cannot be negative').default(0),
    dueDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid due date format',
    }),
  }),
});

export const tenantEditSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(10).optional(),
    whatsappNumber: z.string().min(10).optional(),
    address: z.string().min(5).optional(),
    guardianName: z.string().min(2).optional(),
    guardianPhone: z.string().min(10).optional(),
    nearestPoliceStation: z.string().optional(),
    occupation: z.string().optional(),
    workLocation: z.string().optional(),
    status: z.enum(['ACTIVE', 'VACATED']).optional(),
  }),
});
