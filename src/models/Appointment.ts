import { Schema, Types, model } from "mongoose";

import { APPOINTMENT_STATUSES } from "../constants/roles.js";

const appointmentSchema = new Schema(
  {
    doctorProfileId: {
      type: Types.ObjectId,
      ref: "DoctorProfile",
      required: true,
      index: true,
    },
    patientProfileId: {
      type: Types.ObjectId,
      ref: "PatientProfile",
      required: true,
      index: true,
    },
    tokenNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    appointmentDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: "Scheduled",
      index: true,
    },
    reasonForVisit: {
      type: String,
      required: true,
      trim: true,
    },
    intakeSource: {
      type: String,
      default: "phone_call",
    },
    intakeTranscript: {
      type: String,
      default: null,
    },
    intakeStructuredData: {
      type: Schema.Types.Mixed,
      default: null,
    },
    scheduledSlot: {
      type: String,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

appointmentSchema.index({ doctorProfileId: 1, appointmentDate: 1, tokenNumber: 1 }, { unique: true });
appointmentSchema.index({ doctorProfileId: 1, patientProfileId: 1, appointmentDate: 1 }, { unique: true });

export const AppointmentModel = model("Appointment", appointmentSchema);
