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

export const branchSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    address: z.string().min(5, 'Address must be at least 5 characters'),
    phone: z.string().optional(),
    googleMapsLocation: z.string().optional(),
    rentDueDay: z.number().min(1).max(31).optional(),
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
  }),
});

export const bookingSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
    branchId: z.string().min(1, 'Hostel branch is required'),
    roomId: z.string().min(1, 'Room is required'),
    expectedJoiningDate: z.string().refine(isValidDateString, { message: 'Choose a valid joining date' }),
    notes: z.string().max(1000).optional(),
  }),
});

// Joining date may be backdated by at most this many days (covers tenants who already
// moved in and are filling the form late), but no further back than that, and never
// blocks genuine past admissions beyond the grace window.
const JOINING_DATE_GRACE_DAYS = 7;

function isValidDateString(val: string) {
  return !isNaN(Date.parse(val));
}

const admissionImageSchema = z
  .string()
  .min(100, 'A valid image is required')
  .max(8_000_000, 'Image is too large')
  .regex(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i, 'Only JPG, PNG or WEBP images are allowed');

export const publicAdmissionFormSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
      phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
      whatsappNumber: z.string().regex(/^\d{10}$/, 'WhatsApp number must be exactly 10 digits'),
      address: z.string().trim().min(5, 'Address must be at least 5 characters').max(1000),
      guardianName: z.string().trim().min(2, 'Guardian name is required').max(100),
      guardianPhone: z.string().regex(/^\d{10}$/, 'Guardian phone must be exactly 10 digits'),
      nearestPoliceStation: z.string().trim().min(2, 'Nearest police station is required').max(200),
      occupation: z.string().trim().min(2, 'Occupation is required').max(200),
      workLocation: z.string().trim().min(2, 'Work location is required').max(300),
      preferredRoomType: z.string().trim().min(1, 'Preferred room type is required').max(100),
      joiningDate: z.string().refine(isValidDateString, { message: 'Invalid joining date format' }),
      leavingDate: z.string().optional().refine((val) => !val || isValidDateString(val), {
        message: 'Invalid expected leaving date format',
      }),
      profilePhoto: admissionImageSchema,
      aadhaarFront: admissionImageSchema,
      aadhaarBack: admissionImageSchema,
      notes: z.string().trim().max(2000).optional(),
      branchId: z.string().min(1, 'Branch is required'),
      bookingToken: z.string().optional(),
      formToken: z.string().regex(/^[a-f0-9]{64}$/i, 'Refresh the form and try again'),
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

export const admissionFeeStatusSchema = z.object({
  body: z.object({
    paymentStatus: z.enum(['PAID', 'PENDING']),
    paymentMethod: z.enum(['CASH', 'UPI', 'BANK']).optional(),
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
