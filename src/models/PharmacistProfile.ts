import { Schema, Types, model } from "mongoose";

const pharmacistProfileSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    pharmacyName: { type: String, default: "Hospital Pharmacy", trim: true },
    licenseNumber: { type: String, default: null, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const PharmacistProfileModel = model("PharmacistProfile", pharmacistProfileSchema);
