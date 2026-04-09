import { Schema, Types, model } from "mongoose";

const availabilitySchema = new Schema(
  {
    day: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const doctorProfileSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    profilePic: { type: String, default: null },
    consultationDuration: { type: Number, default: 15, min: 5, max: 120 },
    availability: { type: [availabilitySchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const DoctorProfileModel = model("DoctorProfile", doctorProfileSchema);
