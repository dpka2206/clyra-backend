import { Types } from "mongoose";

import { DoctorProfileModel } from "../../models/DoctorProfile.js";
import { AppointmentModel } from "../../models/Appointment.js";
import { PatientProfileModel } from "../../models/PatientProfile.js";
import { UserModel } from "../../models/User.js";
import {
  getNextTokenNumber,
  normalizeAppointmentDate,
  resolveScheduledSlot,
} from "../../services/appointments/appointment.service.js";
import { geminiService } from "../../services/ai/GeminiService.js";
import { ApiError } from "../../utils/ApiError.js";
import { endOfDay, startOfDay } from "../../utils/slot.js";

type PhoneIntakeInput = {
  doctorProfileId: string;
  appointmentDate: string;
  transcript: string;
  fallbackPatient?: {
    name?: string;
    phone?: string;
    email?: string;
    age?: number;
    gender?: string;
  };
  reasonForVisit?: string;
  preferredSlot?: string;
};

async function findOrCreatePatient(
  extracted: Awaited<ReturnType<typeof geminiService.extractAppointmentIntake>>,
  transcript: string,
  fallbackPatient?: PhoneIntakeInput["fallbackPatient"],
) {
  const patientPayload = {
    ...fallbackPatient,
    ...extracted.patient,
  };

  const phone = patientPayload.phone?.trim();
  const email = patientPayload.email?.trim().toLowerCase();
  const name = patientPayload.name?.trim();

  if (!phone && !email) {
    throw new ApiError(400, "Patient phone or email is required for phone intake");
  }

  let user = await UserModel.findOne({
    role: "Patient",
    $or: [{ phone }, { email }],
    isDeleted: false,
  });

  if (!user) {
    user = await UserModel.create({
      phone: phone ?? `pending-${Date.now()}`,
      email,
      role: "Patient",
      passwordHash: null,
    });
  }

  let patientProfile = await PatientProfileModel.findOne({
    userId: new Types.ObjectId(user._id),
    isDeleted: false,
  });

  if (!patientProfile) {
    patientProfile = await PatientProfileModel.create({
      userId: user._id,
      name: name ?? "Phone Intake Patient",
      age: patientPayload.age ?? null,
      gender: patientPayload.gender ?? null,
      latestTranscript: transcript,
      fourKeySummary: extracted.fourKeySummary ?? {},
    });
  } else {
    patientProfile.name = name ?? patientProfile.name;
    patientProfile.age = patientPayload.age ?? patientProfile.age;
    patientProfile.gender = patientPayload.gender ?? patientProfile.gender;
    patientProfile.latestTranscript = transcript;
    patientProfile.fourKeySummary = {
      chronicConditions:
        extracted.fourKeySummary?.chronicConditions ??
        patientProfile.fourKeySummary?.chronicConditions ??
        "",
      allergies:
        extracted.fourKeySummary?.allergies ?? patientProfile.fourKeySummary?.allergies ?? "",
      currentMedications:
        extracted.fourKeySummary?.currentMedications ??
        patientProfile.fourKeySummary?.currentMedications ??
        "",
      vitals: extracted.fourKeySummary?.vitals ?? patientProfile.fourKeySummary?.vitals ?? "",
    };
    await patientProfile.save();
  }

  return { user, patientProfile };
}

export async function createAppointmentFromPhoneIntake(input: PhoneIntakeInput) {
  const doctor = await DoctorProfileModel.findOne({
    _id: input.doctorProfileId,
    isDeleted: false,
  });

  if (!doctor) {
    throw new ApiError(404, "Doctor profile not found");
  }

  const extracted = await geminiService.extractAppointmentIntake(input.transcript);
  const appointmentDate = normalizeAppointmentDate(input.appointmentDate);
  const { patientProfile } = await findOrCreatePatient(
    extracted,
    input.transcript,
    input.fallbackPatient,
  );

  const existingAppointment = await AppointmentModel.findOne({
    doctorProfileId: input.doctorProfileId,
    patientProfileId: patientProfile._id,
    appointmentDate: {
      $gte: startOfDay(appointmentDate),
      $lte: endOfDay(appointmentDate),
    },
    isDeleted: false,
  });

  if (existingAppointment) {
    throw new ApiError(409, "Patient already has an appointment with this doctor on that date");
  }

  const scheduledSlot = await resolveScheduledSlot(
    input.doctorProfileId,
    appointmentDate,
    input.preferredSlot ?? extracted.visit.preferredSlot,
  );
  const tokenNumber = await getNextTokenNumber(input.doctorProfileId, appointmentDate);
  const reasonForVisit =
    input.reasonForVisit ?? extracted.visit.reasonForVisit ?? "General consultation";

  const appointment = await AppointmentModel.create({
    doctorProfileId: doctor._id,
    patientProfileId: patientProfile._id,
    tokenNumber,
    appointmentDate,
    scheduledSlot,
    status: "Scheduled",
    reasonForVisit,
    intakeTranscript: input.transcript,
    intakeStructuredData: extracted,
  });

  return {
    appointment,
    extracted,
    patientProfile,
    confirmation: {
      tokenNumber,
      scheduledSlot,
      doctorName: doctor.name,
      department: doctor.department,
      appointmentDate,
    },
  };
}
