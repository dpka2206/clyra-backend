import { z } from "zod";

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().min(2),
    description: z.string().optional(),
  }),
});

export const onboardDoctorSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().min(8),
    password: z.string().min(8),
    name: z.string().min(2),
    specialization: z.string().min(2),
    department: z.string().min(2),
  }),
});

export const onboardPharmacistSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().min(8),
    password: z.string().min(8),
    name: z.string().min(2),
    pharmacyName: z.string().min(2).optional(),
    licenseNumber: z.string().optional(),
  }),
});
