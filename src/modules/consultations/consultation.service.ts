import { Types } from "mongoose";
import { randomUUID } from "node:crypto";

import { AppointmentModel } from "../../models/Appointment.js";
import { ConsultationJobModel } from "../../models/ConsultationJob.js";
import { DoctorProfileModel } from "../../models/DoctorProfile.js";
import { MedicalHistoryModel } from "../../models/MedicalHistory.js";
import { PatientProfileModel } from "../../models/PatientProfile.js";
import { SummaryLogModel } from "../../models/SummaryLog.js";
import { UserModel } from "../../models/User.js";
import { geminiService } from "../../services/ai/GeminiService.js";
import { sarvamService } from "../../services/ai/SarvamService.js";
import { createAuditLog } from "../../services/audit/audit.service.js";
import { emailService } from "../../services/notifications/EmailService.js";
import { mediaProcessingService } from "../../services/media/MediaProcessingService.js";
import { twilioService } from "../../services/notifications/TwilioService.js";
import { artifactStorageService } from "../../services/storage/ArtifactStorageService.js";
import { s3Service } from "../../services/storage/S3Service.js";
import { ApiError } from "../../utils/ApiError.js";

const activeProcessingJobs = new Set<string>();

export async function createAudioUploadLink(fileName: string, contentType: string) {
  return s3Service.createPrivateUploadUrl(fileName, contentType);
}

export async function getDoctorLiveOpContext(input: { doctorProfileId: string; date?: string }) {
  const requestedDate = input.date ? new Date(input.date) : new Date();
  const dayStart = new Date(requestedDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(requestedDate);
  dayEnd.setHours(23, 59, 59, 999);

  const doctorProfile = await DoctorProfileModel.findOne({
    _id: input.doctorProfileId,
    isDeleted: false,
  }).lean();

  if (!doctorProfile) {
    throw new ApiError(404, "Doctor profile not found");
  }

  const appointmentDocuments = await AppointmentModel.find({
    doctorProfileId: input.doctorProfileId,
    appointmentDate: { $gte: dayStart, $lte: dayEnd },
    isDeleted: false,
  })
    .populate("patientProfileId")
    .sort({ tokenNumber: 1 });

  const populatedPatients = appointmentDocuments
    .map((appointment) => appointment.patientProfileId as unknown as Record<string, unknown> | null)
    .filter((value): value is Record<string, unknown> => Boolean(value && value._id));

  const patientIds = [...new Set(populatedPatients.map((patient) => String(patient._id)))];
  const patientUserIds = [...new Set(populatedPatients.map((patient) => String(patient.userId)).filter(Boolean))];

  const [patientUsers, medicalHistoryDocuments] = await Promise.all([
    UserModel.find({ _id: { $in: patientUserIds }, isDeleted: false }).select("phone").lean(),
    MedicalHistoryModel.find({
      patientProfileId: { $in: patientIds.map((id) => new Types.ObjectId(id)) },
      isDeleted: false,
    })
      .populate("doctorProfileId", "name")
      .sort({ date: -1 })
      .lean(),
  ]);

  const phoneByUserId = new Map(patientUsers.map((user) => [String(user._id), user.phone ?? ""]));
  const historyByPatientId = new Map<string, typeof medicalHistoryDocuments>();

  for (const history of medicalHistoryDocuments) {
    const patientId = String(history.patientProfileId);
    const currentItems = historyByPatientId.get(patientId) ?? [];
    currentItems.push(history);
    historyByPatientId.set(patientId, currentItems);
  }

  return {
    doctorProfile: {
      id: doctorProfile._id.toString(),
      name: doctorProfile.name,
      specialization: doctorProfile.specialization,
      department: doctorProfile.department,
      consultationDuration: doctorProfile.consultationDuration,
      availability: doctorProfile.availability,
    },
    appointments: appointmentDocuments.map((appointment) => {
      const patient = appointment.patientProfileId as unknown as Record<string, unknown> | null;
      const patientId = patient?._id ? String(patient._id) : "";
      return {
        id: appointment._id.toString(),
        patientId,
        patientName: patient?.name ? String(patient.name) : "Unknown Patient",
        tokenNumber: appointment.tokenNumber,
        appointmentDate: appointment.appointmentDate.toISOString().slice(0, 10),
        scheduledSlot: appointment.scheduledSlot ?? "",
        status: appointment.status,
        reasonForVisit: appointment.reasonForVisit,
        phone: patient?.userId ? phoneByUserId.get(String(patient.userId)) ?? "" : "",
      };
    }),
    patients: populatedPatients.map((patient) => ({
      id: String(patient._id),
      name: String(patient.name ?? "Unknown Patient"),
      age: typeof patient.age === "number" ? patient.age : 0,
      gender: String(patient.gender ?? ""),
      bloodGroup: String(patient.bloodGroup ?? ""),
      phone: phoneByUserId.get(String(patient.userId)) ?? "",
      fourKeySummary: {
        chronicConditions: String((patient.fourKeySummary as Record<string, unknown> | undefined)?.chronicConditions ?? ""),
        allergies: String((patient.fourKeySummary as Record<string, unknown> | undefined)?.allergies ?? ""),
        currentMedications: String(
          (patient.fourKeySummary as Record<string, unknown> | undefined)?.currentMedications ?? "",
        ),
        vitals: String((patient.fourKeySummary as Record<string, unknown> | undefined)?.vitals ?? ""),
      },
      history: (historyByPatientId.get(String(patient._id)) ?? []).map((history) => ({
        id: history._id.toString(),
        date: history.date.toISOString().slice(0, 10),
        doctorName:
          typeof history.doctorProfileId === "object" &&
            history.doctorProfileId &&
            "name" in history.doctorProfileId
            ? String(history.doctorProfileId.name ?? "")
            : "",
        department: history.department,
        caseSummary: history.caseSummary,
        transcript: history.rawTranscript,
        prescriptions: history.prescriptions.map((item) => ({
          medicineName: item.medicineName,
          dosage: item.dosage,
          frequency: item.frequency,
          timing: item.timing,
          usageInstructions: item.usageInstructions,
        })),
      })),
    })),
    date: requestedDate.toISOString().slice(0, 10),
  };
}

export async function createConsultationJob(input: {
  appointmentId?: string;
  doctorProfileId?: string;
  patientProfileId?: string;
  patientName?: string;
  doctorName?: string;
  department?: string;
}) {
  const job = await ConsultationJobModel.create({
    jobId: randomUUID(),
    appointmentId: input.appointmentId ?? "",
    doctorProfileId: input.doctorProfileId ?? "",
    patientProfileId: input.patientProfileId ?? "",
    patientName: input.patientName ?? "",
    doctorName: input.doctorName ?? "",
    department: input.department ?? "Outpatient Medicine",
  });

  return job;
}

export async function getConsultationJob(jobId: string) {
  const job = await ConsultationJobModel.findOne({ jobId });
  if (!job) {
    throw new ApiError(404, "Consultation job not found");
  }

  return job;
}

function queueConsultationJob(jobId: string) {
  if (activeProcessingJobs.has(jobId)) {
    return;
  }

  activeProcessingJobs.add(jobId);
  setTimeout(() => {
    void processConsultationJob(jobId).finally(() => {
      activeProcessingJobs.delete(jobId);
    });
  }, 0);
}

async function processConsultationJob(jobId: string) {
  const job = await ConsultationJobModel.findOne({ jobId });
  if (!job) {
    return;
  }

  if (!job.audioArtifactPath) {
    job.status = "FAILED";
    job.errorMessage = "Audio artifact is missing for this consultation job.";
    await job.save();
    return;
  }

  try {
    job.status = "TRANSCRIBING";
    job.errorMessage = "";
    await job.save();

    const preparedInput = await mediaProcessingService.prepareTranscriptionInput({
      filePath: job.audioArtifactPath,
      mimeType: job.audioMimeType || "audio/webm",
    });
    try {
      const audioBuffer = await artifactStorageService.readAudio(preparedInput.filePath);
      const mimeType = preparedInput.mimeType || "audio/webm";

      let transcriptResult: { transcript: string; rawTranscript?: string; sourceLanguage: string; provider: string };

      try {
        console.log(`Job ${jobId}: Starting Sarvam transcription...`);
        transcriptResult = await sarvamService.translateConsultationAudio(preparedInput.filePath);
        console.log(`Job ${jobId}: Sarvam transcription successful`);
      } catch (sarvamError) {
        console.warn(`Job ${jobId}: Sarvam transcription failed, falling back to Gemini:`, sarvamError);
        const transcript = await geminiService.transcribeConsultationAudio(audioBuffer, mimeType);
        transcriptResult = {
          transcript,
          sourceLanguage: "te-IN",
          provider: "gemini",
        };
        console.log(`Job ${jobId}: Gemini fallback transcription successful`);
      }

      job.rawTranscript = transcriptResult.rawTranscript ?? transcriptResult.transcript;
      job.normalizedTranscript = transcriptResult.transcript;
      job.transcriptionProvider = transcriptResult.provider;
      job.sourceLanguages = [transcriptResult.sourceLanguage];
      job.transcriptArtifactPath = await artifactStorageService.saveText(
        job.jobId,
        "transcript",
        transcriptResult.transcript,
      );
      job.status = "TRANSCRIPT_READY";
      await job.save();

      job.status = "SUMMARIZING";
      await job.save();

      const processed = await geminiService.processConsultationTranscript(transcriptResult.transcript);
      job.caseSummary = processed.caseSummary;
      job.summarySections = processed.summarySections;
      job.prescriptionNarrative = processed.prescriptionNarrative;
      job.set("prescriptions", processed.prescriptions);
      job.sourceLanguages = processed.sourceLanguages.length ? processed.sourceLanguages : [transcriptResult.sourceLanguage];
      job.summaryProvider = processed.prescriptionNarrative.startsWith("Fallback summary used")
        ? "fallback"
        : "gemini";
      job.summaryArtifactPath = await artifactStorageService.saveJson(job.jobId, "summary", processed);
      job.status = "COMPLETED";
      await job.save();
    } finally {
      await mediaProcessingService.cleanupPreparedInput(preparedInput.cleanupDirectory);
    }
  } catch (error) {
    job.status = "FAILED";
    job.errorMessage = error instanceof Error ? error.message : "Unknown consultation processing error";
    await job.save();
  }
}

export async function uploadConsultationJobAudio(input: {
  jobId: string;
  fileName: string;
  mimeType: string;
  audioBuffer: Buffer;
}) {
  console.log(`Job ${input.jobId}: Uploading audio...`);
  const job = await getConsultationJob(input.jobId);
  const extension = input.fileName.split(".").pop() || input.mimeType.split("/").pop() || "webm";

  console.log(`Job ${input.jobId}: Saving audio artifact...`);
  const storedPath = await artifactStorageService.saveAudio(job.jobId, `${job.jobId}.${extension}`, input.audioBuffer);
  console.log(`Job ${input.jobId}: Audio saved to ${storedPath}`);

  job.audioFileName = input.fileName;
  job.audioMimeType = input.mimeType;
  job.audioArtifactPath = storedPath;
  job.status = "AUDIO_READY";
  job.errorMessage = "";
  await job.save();

  console.log(`Job ${input.jobId}: Queuing job for processing...`);
  queueConsultationJob(job.jobId);

  return job;
}

export async function processConsultationTranscript(transcript: string) {
  return geminiService.processConsultationTranscript(transcript);
}

export async function processConsultationAudio(audioBuffer: Buffer, mimeType: string) {
  return geminiService.processConsultationAudio(audioBuffer, mimeType);
}

export async function approveConsultationJob(input: {
  jobId: string;
  approvalMode: "button";
  prescriptions?: Array<{
    medicineName: string;
    dosage?: string;
    frequency?: string;
    timing?: string;
  }>;
  manualNotes?: string;
}) {
  const job = await getConsultationJob(input.jobId);

  if (job.status !== "COMPLETED" && job.status !== "APPROVED") {
    throw new ApiError(400, "Consultation job is not ready for approval");
  }

  const cleanedPrescriptions =
    input.prescriptions?.filter((item) => item.medicineName.trim()) ??
    job.prescriptions.filter((item) => item.medicineName.trim());

  if (cleanedPrescriptions.length) {
    job.set("prescriptions", cleanedPrescriptions);
  }

  const canPersistMedicalHistory =
    Types.ObjectId.isValid(job.appointmentId) &&
    Types.ObjectId.isValid(job.doctorProfileId) &&
    Types.ObjectId.isValid(job.patientProfileId);

  if (!canPersistMedicalHistory) {
    throw new ApiError(400, "Consultation is missing linked appointment, doctor, or patient details.");
  }

  let medicalHistory = null;
  try {
    const result = await finalizeConsultation({
      appointmentId: job.appointmentId,
      doctorProfileId: job.doctorProfileId,
      patientProfileId: job.patientProfileId,
      department: job.department || "Outpatient Medicine",
      rawTranscript: job.normalizedTranscript || job.rawTranscript,
      caseSummary: job.caseSummary,
      extractedJson: {
        summarySections: job.summarySections,
        manualNotes: input.manualNotes ?? "",
        sourceLanguages: job.sourceLanguages,
      },
      prescriptions: job.prescriptions.map((item) => ({
        medicineName: item.medicineName,
        dosage: item.dosage,
        frequency: item.frequency,
        timing: item.timing,
      })),
    });
    medicalHistory = result.medicalHistory;
  } catch (error) {
    throw new ApiError(
      500,
      error instanceof Error ? error.message : "Consultation approval could not be finalized in medical history.",
    );
  }

  job.approvedAt = new Date();
  job.approvalMode = input.approvalMode;
  job.status = "APPROVED";
  job.persistedToMedicalHistory = true;
  await job.save();

  return {
    job,
    medicalHistory,
    persistedToMedicalHistory: true,
  };
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
