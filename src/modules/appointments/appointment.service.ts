import { AppointmentModel } from "../../models/Appointment.js";
import { DoctorProfileModel } from "../../models/DoctorProfile.js";
import { PatientProfileModel } from "../../models/PatientProfile.js";
import {
  getNextTokenNumber,
  normalizeAppointmentDate,
  resolveScheduledSlot,
} from "../../services/appointments/appointment.service.js";
import { createAuditLog } from "../../services/audit/audit.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { endOfDay, startOfDay } from "../../utils/slot.js";

export async function createAppointment(input: {
  actorUserId?: string;
  doctorProfileId: string;
  patientProfileId: string;
  appointmentDate: string;
  reasonForVisit: string;
  preferredSlot?: string;
}) {
  const appointmentDate = normalizeAppointmentDate(input.appointmentDate);

  const [doctor, patient] = await Promise.all([
    DoctorProfileModel.findOne({ _id: input.doctorProfileId, isDeleted: false }),
    PatientProfileModel.findOne({ _id: input.patientProfileId, isDeleted: false }),
  ]);

  if (!doctor) {
    throw new ApiError(404, "Doctor profile not found");
  }

  if (!patient) {
    throw new ApiError(404, "Patient profile not found");
  }

  const existingAppointment = await AppointmentModel.findOne({
    doctorProfileId: input.doctorProfileId,
    patientProfileId: input.patientProfileId,
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
    input.preferredSlot,
  );
  const tokenNumber = await getNextTokenNumber(input.doctorProfileId, appointmentDate);

  const appointment = await AppointmentModel.create({
    doctorProfileId: input.doctorProfileId,
    patientProfileId: input.patientProfileId,
    tokenNumber,
    appointmentDate,
    scheduledSlot,
    status: "Waiting",
    reasonForVisit: input.reasonForVisit,
    intakeSource: "manual",
  });

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: "appointment.create",
    entityType: "Appointment",
    entityId: appointment._id.toString(),
    metadata: { tokenNumber, scheduledSlot },
  });

  return appointment;
}

export async function getTodayOpList(doctorProfileId: string, dateInput: string) {
  const date = normalizeAppointmentDate(dateInput);

  return AppointmentModel.find({
    doctorProfileId,
    appointmentDate: { $gte: startOfDay(date), $lte: endOfDay(date) },
    isDeleted: false,
  })
    .populate("patientProfileId")
    .sort({ tokenNumber: 1 });
}

export async function getWeeklyAppointments(doctorProfileId: string, startDateInput: string) {
  const startDate = normalizeAppointmentDate(startDateInput);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return AppointmentModel.find({
    doctorProfileId,
    appointmentDate: {
      $gte: startDate,
      $lte: endDate,
    },
    isDeleted: false,
  })
    .populate("patientProfileId")
    .sort({ appointmentDate: 1, tokenNumber: 1 });
}

export async function loadNextPatient(doctorProfileId: string, dateInput: string) {
  const appointments = await getTodayOpList(doctorProfileId, dateInput);
  return (
    appointments.find((appointment) => appointment.status === "Waiting" || appointment.status === "Scheduled") ??
    null
  );
}

export async function updateAppointmentStatus(input: {
  actorUserId?: string;
  appointmentId: string;
  status: string;
}) {
  const appointment = await AppointmentModel.findOne({
    _id: input.appointmentId,
    isDeleted: false,
  });

  if (!appointment) {
    throw new ApiError(404, "Appointment not found");
  }

  appointment.status = input.status as typeof appointment.status;
  await appointment.save();

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: "appointment.status.update",
    entityType: "Appointment",
    entityId: appointment._id.toString(),
    metadata: { status: input.status },
  });

  return appointment;
}
