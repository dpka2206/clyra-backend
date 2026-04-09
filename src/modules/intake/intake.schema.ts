import { z } from "zod";

export const phoneIntakeSchema = z.object({
  body: z.object({
    doctorProfileId: z.string().min(1),
    appointmentDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    transcript: z.string().min(10),
    fallbackPatient: z
      .object({
        name: z.string().min(2).optional(),
        phone: z.string().min(8).optional(),
        email: z.string().email().optional(),
        age: z.number().int().min(0).max(150).optional(),
        gender: z.string().optional(),
      })
      .optional(),
    reasonForVisit: z.string().min(3).optional(),
    preferredSlot: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }),
});
