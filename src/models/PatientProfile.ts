import { Schema, Types, model } from "mongoose";

const fourKeySummarySchema = new Schema(
  {
    chronicConditions: { type: String, default: "" },
    allergies: { type: String, default: "" },
    currentMedications: { type: String, default: "" },
    vitals: { type: String, default: "" },
  },
  { _id: false },
);

const patientProfileSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    age: { type: Number, min: 0, max: 150, default: null },
    gender: { type: String, default: null },
    bloodGroup: { type: String, default: null },
    fourKeySummary: { type: fourKeySummarySchema, default: () => ({}) },
    latestTranscript: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const PatientProfileModel = model("PatientProfile", patientProfileSchema);
