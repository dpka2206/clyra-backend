import { Types } from "mongoose";

import { AppointmentModel } from "../../models/Appointment.js";
import { MedicalHistoryModel } from "../../models/MedicalHistory.js";
import { PatientProfileModel } from "../../models/PatientProfile.js";
import { SummaryLogModel } from "../../models/SummaryLog.js";
import { UserModel } from "../../models/User.js";
import { geminiService } from "../../services/ai/GeminiService.js";
import { createAuditLog } from "../../services/audit/audit.service.js";
import { emailService } from "../../services/notifications/EmailService.js";
import { twilioService } from "../../services/notifications/TwilioService.js";
import { s3Service } from "../../services/storage/S3Service.js";
import { ApiError } from "../../utils/ApiError.js";

export async function createAudioUploadLink(fileName: string, contentType: string) {
  return s3Service.createPrivateUploadUrl(fileName, contentType);
}

export async function processConsultationTranscript(transcript: string) {
  return geminiService.processConsultationTranscript(transcript);
}

export async function processConsultationAudio(audioBuffer: Buffer, mimeType: string) {
  return geminiService.processConsultationAudio(audioBuffer, mimeType);
}

export async function finalizeConsultation(input: {
  actorUserId?: string;
  appointmentId: string;
  doctorProfileId: string;
  patientProfileId: string;
  department: string;
  rawTranscript: string;
  caseSummary: string;
  extractedJson?: unknown;
  prescriptions: Array<{
    medicineName: string;
    dosage?: string;
    frequency?: string;
    timing?: string;
  }>;
  approvedFourKeySummary?: {
    chronicConditions?: string;
    allergies?: string;
    currentMedications?: string;
    vitals?: string;
  };
}) {
  const [appointment, patient] = await Promise.all([
    AppointmentModel.findOne({ _id: input.appointmentId, isDeleted: false }),
    PatientProfileModel.findOne({ _id: input.patientProfileId, isDeleted: false }),
  ]);

  if (!appointment) {
    throw new ApiError(404, "Appointment not found");
  }

  if (!patient) {
    throw new ApiError(404, "Patient profile not found");
  }

  const medicalHistory = await MedicalHistoryModel.create({
    patientProfileId: new Types.ObjectId(input.patientProfileId),
    doctorProfileId: new Types.ObjectId(input.doctorProfileId),
    appointmentId: new Types.ObjectId(input.appointmentId),
    department: input.department,
    rawTranscript: input.rawTranscript,
    caseSummary: input.caseSummary,
    extractedJson: input.extractedJson ?? null,
    prescriptions: input.prescriptions,
  });

  const previousSummary = {
    chronicConditions: patient.fourKeySummary?.chronicConditions ?? "",
    allergies: patient.fourKeySummary?.allergies ?? "",
    currentMedications: patient.fourKeySummary?.currentMedications ?? "",
    vitals: patient.fourKeySummary?.vitals ?? "",
  };

  const nextSummary = {
    chronicConditions:
      input.approvedFourKeySummary?.chronicConditions ?? previousSummary.chronicConditions,
    allergies: input.approvedFourKeySummary?.allergies ?? previousSummary.allergies,
    currentMedications:
      input.approvedFourKeySummary?.currentMedications ?? previousSummary.currentMedications,
    vitals: input.approvedFourKeySummary?.vitals ?? previousSummary.vitals,
  };

  patient.fourKeySummary = nextSummary;
  patient.latestTranscript = input.rawTranscript;
  await patient.save();

  await SummaryLogModel.create({
    patientProfileId: patient._id,
    previousSummary,
    nextSummary,
    updatedByUserId: input.actorUserId ? new Types.ObjectId(input.actorUserId) : undefined,
  });

  appointment.status = "Completed";
  await appointment.save();

  const patientUser = await UserModel.findById(patient.userId);
  const notificationMessage = `Your consultation summary is finalized. Token ${appointment.tokenNumber} prescriptions are ready for pharmacy review.`;

  let notificationResult: unknown = null;
  if (patientUser?.phone) {
    notificationResult = await twilioService.sendSms(patientUser.phone, notificationMessage);
  } else if (patientUser?.email) {
    notificationResult = await emailService.sendEmail(
      patientUser.email,
      "Consultation finalized",
      notificationMessage,
    );
  }

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: "consultation.finalize",
    entityType: "MedicalHistory",
    entityId: medicalHistory._id.toString(),
    metadata: { appointmentId: input.appointmentId, notificationResult },
  });

  return {
    medicalHistory,
    appointment,
    patient,
    notificationResult,
  };
}
