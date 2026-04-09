import { z } from "zod";

import { APPOINTMENT_STATUSES } from "../../constants/roles.js";

export const createAppointmentSchema = z.object({
  body: z.object({
    doctorProfileId: z.string().min(1),
    patientProfileId: z.string().min(1),
    appointmentDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    reasonForVisit: z.string().min(3),
    preferredSlot: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }),
});

export const doctorDateQuerySchema = z.object({
  query: z.object({
    doctorProfileId: z.string().min(1),
    date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  }),
});

export const weeklyQuerySchema = z.object({
  query: z.object({
    doctorProfileId: z.string().min(1),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  }),
});

export const updateStatusSchema = z.object({
  params: z.object({
    appointmentId: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(APPOINTMENT_STATUSES),
  }),
});
