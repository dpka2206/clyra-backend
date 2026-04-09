import { Schema, Types, model } from "mongoose";

const prescriptionSchema = new Schema(
  {
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, default: "" },
    frequency: { type: String, default: "" },
    timing: { type: String, default: "" },
    usageInstructions: { type: String, default: "" },
  },
  { _id: false },
);

const medicalHistorySchema = new Schema(
  {
    patientProfileId: {
      type: Types.ObjectId,
      ref: "PatientProfile",
      required: true,
      index: true,
    },
    doctorProfileId: {
      type: Types.ObjectId,
      ref: "DoctorProfile",
      required: true,
      index: true,
    },
    appointmentId: {
      type: Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, default: Date.now },
    department: { type: String, required: true, trim: true },
    rawTranscript: { type: String, default: "" },
    caseSummary: { type: String, default: "" },
    extractedJson: { type: Schema.Types.Mixed, default: null },
    prescriptions: { type: [prescriptionSchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const MedicalHistoryModel = model("MedicalHistory", medicalHistorySchema);
