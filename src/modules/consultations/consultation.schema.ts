import { z } from "zod";

const prescriptionSchema = z.object({
  medicineName: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  timing: z.string().optional(),
});

export const createConsultationJobSchema = z.object({
  body: z.object({
    appointmentId: z.string().optional(),
    doctorProfileId: z.string().optional(),
    patientProfileId: z.string().optional(),
    patientName: z.string().optional(),
    doctorName: z.string().optional(),
    department: z.string().min(2).default("Outpatient Medicine"),
  }),
});

export const consultationJobParamsSchema = z.object({
  params: z.object({
    jobId: z.string().min(1),
  }),
});

export const liveOpContextQuerySchema = z.object({
  query: z.object({
    doctorProfileId: z.string().min(1),
    date: z.string().optional(),
  }),
});

export const approveConsultationJobSchema = z.object({
  params: z.object({
    jobId: z.string().min(1),
  }),
  body: z.object({
    approvalMode: z.enum(["button"]).default("button"),
    prescriptions: z.array(prescriptionSchema).optional(),
    manualNotes: z.string().optional(),
  }),
});

export const transcriptToJsonSchema = z.object({
  body: z.object({
    transcript: z.string().min(10),
  }),
});

export const processConsultationSchema = z.object({
  body: z.object({
    transcript: z.string().min(10),
  }),
});

export const finalizeConsultationSchema = z.object({
  body: z.object({
    appointmentId: z.string().min(1),
    doctorProfileId: z.string().min(1),
    patientProfileId: z.string().min(1),
    department: z.string().min(2),
    rawTranscript: z.string().min(10),
    caseSummary: z.string().min(3),
    extractedJson: z.unknown().optional(),
    prescriptions: z.array(prescriptionSchema),
    approvedFourKeySummary: z
      .object({
        chronicConditions: z.string().optional(),
        allergies: z.string().optional(),
        currentMedications: z.string().optional(),
        vitals: z.string().optional(),
      })
      .optional(),
  }),
});
