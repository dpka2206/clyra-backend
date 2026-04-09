import { Schema, Types, model } from "mongoose";

const fourKeySnapshotSchema = new Schema(
  {
    chronicConditions: { type: String, default: "" },
    allergies: { type: String, default: "" },
    currentMedications: { type: String, default: "" },
    vitals: { type: String, default: "" },
  },
  { _id: false },
);

const summaryLogSchema = new Schema(
  {
    patientProfileId: {
      type: Types.ObjectId,
      ref: "PatientProfile",
      required: true,
      index: true,
    },
    previousSummary: {
      type: fourKeySnapshotSchema,
      required: true,
    },
    nextSummary: {
      type: fourKeySnapshotSchema,
      required: true,
    },
    source: { type: String, default: "consultation_finalize", trim: true },
    updatedByUserId: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
  },
  { timestamps: true },
);

export const SummaryLogModel = model("SummaryLog", summaryLogSchema);
