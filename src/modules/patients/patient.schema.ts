import { z } from "zod";

export const patientSearchSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  }),
});

export const createPatientSchema = z.object({
  body: z
    .object({
      name: z.string().min(2),
      phone: z.string().min(8).optional(),
      email: z.string().email().optional(),
      age: z.number().int().min(0).max(150).optional(),
      gender: z.string().optional(),
      bloodGroup: z.string().optional(),
    })
    .refine((value) => Boolean(value.phone || value.email), {
      message: "Patient phone or email is required",
      path: ["phone"],
    }),
});
