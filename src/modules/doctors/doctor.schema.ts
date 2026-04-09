import { z } from "zod";

export const doctorScheduleSchema = z.object({
  params: z.object({
    doctorProfileId: z.string().min(1),
  }),
  query: z.object({
    date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  }),
});

export const updateAvailabilitySchema = z.object({
  body: z.object({
    doctorProfileId: z.string().min(1),
    consultationDuration: z.number().int().min(5).max(120).optional(),
    availability: z.array(
      z.object({
        day: z.string().min(3),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    ),
  }),
});
