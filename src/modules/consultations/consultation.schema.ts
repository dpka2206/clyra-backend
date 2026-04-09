import { z } from "zod";

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
    prescriptions: z.array(
      z.object({
        medicineName: z.string().min(1),
        dosage: z.string().optional(),
        frequency: z.string().optional(),
        timing: z.string().optional(),
      }),
    ),
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
