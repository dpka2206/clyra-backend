import { DepartmentModel } from "../../models/Department.js";
import { PharmacistProfileModel } from "../../models/PharmacistProfile.js";
import { registerUser } from "../auth/auth.service.js";
import { createAuditLog } from "../../services/audit/audit.service.js";
import { AuditLogModel } from "../../models/AuditLog.js";

export async function createDepartment(input: {
  actorUserId?: string;
  name: string;
  code: string;
  description?: string;
}) {
  const department = await DepartmentModel.create({
    name: input.name,
    code: input.code,
    description: input.description ?? "",
  });

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: "department.create",
    entityType: "Department",
    entityId: department._id.toString(),
    metadata: { name: department.name, code: department.code },
  });

  return department;
}

export async function listDepartments() {
  return DepartmentModel.find({ isDeleted: false }).sort({ name: 1 });
}

export async function onboardDoctor(input: {
  actorUserId?: string;
  email?: string;
  phone: string;
  password: string;
  name: string;
  specialization: string;
  department: string;
}) {
  const user = await registerUser({
    email: input.email,
    phone: input.phone,
    password: input.password,
    role: "Doctor",
    profile: {
      name: input.name,
      specialization: input.specialization,
      department: input.department,
    },
  });

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: "doctor.onboard",
    entityType: "User",
    entityId: user._id.toString(),
  });

  return user;
}

export async function onboardPharmacist(input: {
  actorUserId?: string;
  email?: string;
  phone: string;
  password: string;
  name: string;
  pharmacyName?: string;
  licenseNumber?: string;
}) {
  const user = await registerUser({
    email: input.email,
    phone: input.phone,
    password: input.password,
    role: "Pharmacist",
    profile: {
      name: input.name,
    },
  });

  await PharmacistProfileModel.findOneAndUpdate(
    { userId: user._id },
    {
      pharmacyName: input.pharmacyName ?? "Hospital Pharmacy",
      licenseNumber: input.licenseNumber ?? null,
    },
  );

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: "pharmacist.onboard",
    entityType: "User",
    entityId: user._id.toString(),
  });

  return user;
}

export async function listAuditLogs() {
  return AuditLogModel.find().sort({ createdAt: -1 }).limit(200);
}
