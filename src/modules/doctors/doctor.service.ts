import { AppointmentModel } from "../../models/Appointment.js";
import { DoctorProfileModel } from "../../models/DoctorProfile.js";
import { createAuditLog } from "../../services/audit/audit.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { endOfDay, generateSlots, startOfDay } from "../../utils/slot.js";

export async function getDoctorSchedule(doctorProfileId: string, dateInput: string) {
  const doctor = await DoctorProfileModel.findOne({ _id: doctorProfileId, isDeleted: false });

  if (!doctor) {
    throw new ApiError(404, "Doctor profile not found");
  }

  const date = new Date(dateInput);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const availability = doctor.availability.find((entry) => entry.day === weekday);

  if (!availability) {
    return {
      doctor,
      date,
      consultationDuration: doctor.consultationDuration,
      slots: [],
    };
  }

  const allSlots = generateSlots(
    availability.startTime,
    availability.endTime,
    doctor.consultationDuration,
  );

  const appointments = await AppointmentModel.find({
    doctorProfileId,
    appointmentDate: {
      $gte: startOfDay(date),
      $lte: endOfDay(date),
    },
    isDeleted: false,
    status: { $nin: ["Cancelled", "No-Show"] },
  }).select("scheduledSlot tokenNumber status");

  const bookedSlotSet = new Set(
    appointments.map((appointment) => appointment.scheduledSlot).filter(Boolean),
  );

  return {
    doctor,
    date,
    consultationDuration: doctor.consultationDuration,
    slots: allSlots.map((slot) => ({
      time: slot,
      isBooked: bookedSlotSet.has(slot),
    })),
    appointments,
  };
}

export async function getDoctorProfile(doctorProfileId: string) {
  const doctor = await DoctorProfileModel.findOne({ _id: doctorProfileId, isDeleted: false }).populate(
    "userId",
    "email phone role",
  );

  if (!doctor) {
    throw new ApiError(404, "Doctor profile not found");
  }

  return doctor;
}

export async function updateDoctorAvailability(input: {
  actorUserId?: string;
  doctorProfileId: string;
  consultationDuration?: number;
  availability: Array<{ day: string; startTime: string; endTime: string }>;
}) {
  const doctor = await DoctorProfileModel.findOne({
    _id: input.doctorProfileId,
    isDeleted: false,
  });

  if (!doctor) {
    throw new ApiError(404, "Doctor profile not found");
  }

  doctor.set("availability", input.availability);

  if (input.consultationDuration) {
    doctor.consultationDuration = input.consultationDuration;
  }

  await doctor.save();

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: "doctor.availability.update",
    entityType: "DoctorProfile",
    entityId: doctor._id.toString(),
    metadata: {
      consultationDuration: doctor.consultationDuration,
      availability: doctor.availability,
    },
  });

  return doctor;
}
