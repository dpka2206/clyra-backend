import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";

import { env } from "../../config/env.js";
import type { UserRole } from "../../constants/roles.js";
import { DoctorProfileModel } from "../../models/DoctorProfile.js";
import { PharmacistProfileModel } from "../../models/PharmacistProfile.js";
import { PatientProfileModel } from "../../models/PatientProfile.js";
import { RefreshSessionModel } from "../../models/RefreshSession.js";
import { UserModel } from "../../models/User.js";
import { ApiError } from "../../utils/ApiError.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";

type RegisterInput = {
  email?: string;
  phone: string;
  password: string;
  role: UserRole;
  profile?: {
    name: string;
    specialization?: string;
    department?: string;
  };
};

export async function registerUser(input: RegisterInput) {
  const existingUser = await UserModel.findOne({
    $or: [{ email: input.email }, { phone: input.phone }],
    role: input.role,
    isDeleted: false,
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists for this role");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await UserModel.create({
    email: input.email,
    phone: input.phone,
    passwordHash,
    role: input.role,
  });

  if (input.role === "Doctor" && input.profile) {
    await DoctorProfileModel.create({
      userId: user._id,
      name: input.profile.name,
      specialization: input.profile.specialization ?? "General Medicine",
      department: input.profile.department ?? "General",
    });
  }

  if (input.role === "Patient") {
    await PatientProfileModel.create({
      userId: user._id,
      name: input.profile?.name ?? "New Patient",
    });
  }

  if (input.role === "Pharmacist") {
    await PharmacistProfileModel.create({
      userId: user._id,
      name: input.profile?.name ?? "Pharmacist",
    });
  }

  return user;
}

export async function loginUser(input: { email?: string; phone?: string; password: string }) {
  const query = input.email ? { email: input.email } : { phone: input.phone };
  const user = await UserModel.findOne({ ...query, isDeleted: false });

  if (!user?.passwordHash) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isMatch = await bcrypt.compare(input.password, user.passwordHash);

  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  return createSessionTokens({
    userId: user._id.toString(),
    role: user.role as UserRole,
  });
}

export async function createSessionTokens(payload: { userId: string; role: UserRole }) {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await RefreshSessionModel.create({
    userId: new Types.ObjectId(payload.userId),
    tokenId: sessionId,
    expiresAt,
  });

  return {
    accessToken: signAccessToken({ ...payload, sessionId }),
    refreshToken: signRefreshToken({ ...payload, sessionId }),
    sessionId,
  };
}

export async function refreshUserSession(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  if (!payload.sessionId) {
    throw new ApiError(401, "Refresh session missing");
  }

  const session = await RefreshSessionModel.findOne({
    tokenId: payload.sessionId,
    userId: new Types.ObjectId(payload.userId),
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    throw new ApiError(401, "Refresh session is invalid or expired");
  }

  session.isRevoked = true;
  await session.save();

  return createSessionTokens({
    userId: payload.userId,
    role: payload.role,
  });
}

export async function logoutUser(sessionId?: string) {
  if (!sessionId) {
    return;
  }

  await RefreshSessionModel.findOneAndUpdate({ tokenId: sessionId }, { isRevoked: true });
}

export async function logoutUserByRefreshToken(refreshToken?: string) {
  if (!refreshToken) {
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    await logoutUser(payload.sessionId);
  } catch {
    return;
  }
}

export async function getCurrentUser(userId: string) {
  const user = await UserModel.findOne({ _id: userId, isDeleted: false }).select("-passwordHash");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
}
