import { MedicalHistoryModel } from "../../models/MedicalHistory.js";
import { AppointmentModel } from "../../models/Appointment.js";
import { PatientProfileModel } from "../../models/PatientProfile.js";
import { UserModel } from "../../models/User.js";
import { createAuditLog } from "../../services/audit/audit.service.js";
import { emailService } from "../../services/notifications/EmailService.js";
import { twilioService } from "../../services/notifications/TwilioService.js";
import { ApiError } from "../../utils/ApiError.js";
import { endOfDay, startOfDay } from "../../utils/slot.js";

export async function searchPrescription(tokenNumber: string, dateInput: string) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid date");
  }

  const appointment = await AppointmentModel.findOne({
    tokenNumber: Number(tokenNumber),
    appointmentDate: {
      $gte: startOfDay(date),
      $lte: endOfDay(date),
    },
    isDeleted: false,
  });

  if (!appointment) {
    throw new ApiError(404, "Appointment not found for token/date");
  }

  const medicalHistory = await MedicalHistoryModel.findOne({
    appointmentId: appointment._id,
    isDeleted: false,
  })
    .populate("patientProfileId")
    .populate("doctorProfileId");

  if (!medicalHistory) {
    throw new ApiError(404, "Prescription record not found");
  }

  return {
    appointment,
    medicalHistory,
  };
}

export async function updateUsageInstructions(input: {
  actorUserId?: string;
  medicalHistoryId: string;
  usageInstructions: string;
}) {
  const medicalHistory = await MedicalHistoryModel.findOne({
    _id: input.medicalHistoryId,
    isDeleted: false,
  }).populate("patientProfileId");

  if (!medicalHistory) {
    throw new ApiError(404, "Medical history not found");
  }

  for (const prescription of medicalHistory.prescriptions) {
    prescription.usageInstructions = input.usageInstructions;
  }

  await medicalHistory.save();

  const patientProfileId = String(
    (medicalHistory.patientProfileId as { _id?: unknown })?._id ?? medicalHistory.patientProfileId,
  );
  const patientProfile = await PatientProfileModel.findById(patientProfileId);
  const patientUser = patientProfile ? await UserModel.findById(patientProfile.userId) : null;

  const notificationText = `Pharmacy instructions updated: ${input.usageInstructions}`;
  let notificationResult: unknown = null;

  if (patientUser?.phone) {
    notificationResult = await twilioService.sendSms(patientUser.phone, notificationText);
  } else if (patientUser?.email) {
    notificationResult = await emailService.sendEmail(
      patientUser.email,
      "Updated medicine instructions",
      notificationText,
    );
  }

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: "pharmacy.usage.update",
    entityType: "MedicalHistory",
    entityId: medicalHistory._id.toString(),
    metadata: { usageInstructions: input.usageInstructions, notificationResult },
  });

  return { medicalHistory, notificationResult };
}
