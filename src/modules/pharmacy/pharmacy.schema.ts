import { z } from "zod";

export const searchPrescriptionSchema = z.object({
  query: z.object({
    tokenNumber: z.string().min(1),
    date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  }),
});

export const updateUsageSchema = z.object({
  params: z.object({
    medicalHistoryId: z.string().min(1),
  }),
  body: z.object({
    usageInstructions: z.string().min(2),
  }),
});
