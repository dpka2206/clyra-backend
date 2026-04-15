import { FilterQuery, Types } from "mongoose";

import { PatientProfileModel } from "../../models/PatientProfile.js";
import { UserModel } from "../../models/User.js";
import { createAuditLog } from "../../services/audit/audit.service.js";
import { ApiError } from "../../utils/ApiError.js";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchPatients(input: { search?: string; limit?: number }) {
  const limit = input.limit ?? 20;
  const search = input.search?.trim();

  const patientFilter: FilterQuery<(typeof PatientProfileModel)["schema"]["obj"]> = {
    isDeleted: false,
  };

  if (search) {
    patientFilter.name = { $regex: escapeRegex(search), $options: "i" };
  }

  const profiles = await PatientProfileModel.find(patientFilter)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const userIds = profiles.map((profile) => profile.userId).filter(Boolean);
  const users = await UserModel.find({
    _id: { $in: userIds },
    isDeleted: false,
  })
    .select("phone email")
    .lean();

  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return profiles
    .map((profile) => {
      const user = usersById.get(String(profile.userId));
      return {
        id: profile._id.toString(),
        name: profile.name,
        age: profile.age ?? 0,
        gender: profile.gender ?? "",
        bloodGroup: profile.bloodGroup ?? "",
        phone: user?.phone ?? "",
        email: user?.email ?? "",
        fourKeySummary: {
          chronicConditions: profile.fourKeySummary?.chronicConditions ?? "",
          allergies: profile.fourKeySummary?.allergies ?? "",
          currentMedications: profile.fourKeySummary?.currentMedications ?? "",
          vitals: profile.fourKeySummary?.vitals ?? "",
        },
      };
    })
    .filter((patient) => {
      if (!search) {
        return true;
      }

      const normalizedSearch = search.toLowerCase();
      return (
        patient.name.toLowerCase().includes(normalizedSearch) ||
        patient.phone.toLowerCase().includes(normalizedSearch) ||
        patient.email.toLowerCase().includes(normalizedSearch)
      );
    });
}

export async function createPatient(input: {
  actorUserId?: string;
  name: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
}) {
  const phone = input.phone?.trim();
  const email = input.email?.trim().toLowerCase();

  if (!phone && !email) {
    throw new ApiError(400, "Patient phone or email is required");
  }

  const existingUser = await UserModel.findOne({
    role: "Patient",
    isDeleted: false,
    $or: [{ phone }, { email }],
  });

  if (existingUser) {
    const existingProfile = await PatientProfileModel.findOne({
      userId: new Types.ObjectId(existingUser._id),
      isDeleted: false,
    });

    if (existingProfile) {
      throw new ApiError(409, "Patient already exists with that phone or email");
    }
  }

  const user =
    existingUser ??
    (await UserModel.create({
      phone: phone ?? `pending-${Date.now()}`,
      email,
      role: "Patient",
      passwordHash: null,
    }));

  const patientProfile = await PatientProfileModel.create({
    userId: user._id,
    name: input.name.trim(),
    age: input.age ?? null,
    gender: input.gender?.trim() || null,
    bloodGroup: input.bloodGroup?.trim() || null,
  });

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: "patient.create",
    entityType: "PatientProfile",
    entityId: patientProfile._id.toString(),
    metadata: {
      patientName: patientProfile.name,
      phone: user.phone,
      email: user.email,
    },
  });

  return {
    id: patientProfile._id.toString(),
    name: patientProfile.name,
    age: patientProfile.age ?? 0,
    gender: patientProfile.gender ?? "",
    bloodGroup: patientProfile.bloodGroup ?? "",
    phone: user.phone ?? "",
    email: user.email ?? "",
    fourKeySummary: {
      chronicConditions: patientProfile.fourKeySummary?.chronicConditions ?? "",
      allergies: patientProfile.fourKeySummary?.allergies ?? "",
      currentMedications: patientProfile.fourKeySummary?.currentMedications ?? "",
      vitals: patientProfile.fourKeySummary?.vitals ?? "",
    },
  };
}
