import { Schema, model } from "mongoose";

import { USER_ROLES } from "../constants/roles.js";

const userSchema = new Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ email: 1, role: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1, role: 1 }, { unique: true });

export const UserModel = model("User", userSchema);
