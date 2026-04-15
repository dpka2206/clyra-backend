import { Schema, model } from "mongoose";

const prescriptionSchema = new Schema(
  {
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, default: "" },
    frequency: { type: String, default: "" },
    timing: { type: String, default: "" },
  },
  { _id: false },
);

const summarySectionsSchema = new Schema(
  {
    presentingComplaints: { type: String, default: "" },
    clinicalFindings: { type: String, default: "" },
    assessmentAndAdvice: { type: String, default: "" },
    medicinesPrescribed: { type: String, default: "" },
  },
  { _id: false },
);

const consultationJobSchema = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    appointmentId: { type: String, default: "" },
    doctorProfileId: { type: String, default: "" },
    patientProfileId: { type: String, default: "" },
    patientName: { type: String, default: "" },
    doctorName: { type: String, default: "" },
    department: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "CREATED",
        "AUDIO_READY",
        "TRANSCRIBING",
        "TRANSCRIPT_READY",
        "SUMMARIZING",
        "COMPLETED",
        "FAILED",
        "APPROVED",
      ],
      default: "CREATED",
      index: true,
    },
    audioFileName: { type: String, default: "" },
    audioMimeType: { type: String, default: "" },
    audioArtifactPath: { type: String, default: "" },
    transcriptArtifactPath: { type: String, default: "" },
    summaryArtifactPath: { type: String, default: "" },
    rawTranscript: { type: String, default: "" },
    normalizedTranscript: { type: String, default: "" },
    caseSummary: { type: String, default: "" },
    summarySections: { type: summarySectionsSchema, default: () => ({}) },
    sourceLanguages: { type: [String], default: [] },
    prescriptionNarrative: { type: String, default: "" },
    prescriptions: { type: [prescriptionSchema], default: [] },
    transcriptionProvider: { type: String, default: "" },
    summaryProvider: { type: String, default: "" },
    errorMessage: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    approvalMode: { type: String, default: "" },
    persistedToMedicalHistory: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const ConsultationJobModel = model("ConsultationJob", consultationJobSchema);
