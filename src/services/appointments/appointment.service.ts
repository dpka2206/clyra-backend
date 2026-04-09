import { AppointmentModel } from "../../models/Appointment.js";
import { DoctorProfileModel } from "../../models/DoctorProfile.js";
import { ApiError } from "../../utils/ApiError.js";
import { endOfDay, generateSlots, startOfDay } from "../../utils/slot.js";

export function normalizeAppointmentDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid appointment date");
  }

  date.setHours(9, 0, 0, 0);
  return date;
}

export async function getNextTokenNumber(doctorProfileId: string, appointmentDate: Date) {
  const lastAppointment = await AppointmentModel.findOne({
    doctorProfileId,
    appointmentDate: {
      $gte: startOfDay(appointmentDate),
      $lte: endOfDay(appointmentDate),
    },
    isDeleted: false,
  })
    .sort({ tokenNumber: -1 })
    .select("tokenNumber");

  return (lastAppointment?.tokenNumber ?? 0) + 1;
}

export async function resolveScheduledSlot(
  doctorProfileId: string,
  appointmentDate: Date,
  preferredSlot?: string,
) {
  const doctor = await DoctorProfileModel.findById(doctorProfileId);

  if (!doctor) {
    throw new ApiError(404, "Doctor profile not found");
  }

  const weekday = appointmentDate.toLocaleDateString("en-US", { weekday: "long" });
  const availability = doctor.availability.find((item) => item.day === weekday);

  if (!availability) {
    throw new ApiError(400, "Doctor is not available on the requested date");
  }

  const allSlots = generateSlots(
    availability.startTime,
    availability.endTime,
    doctor.consultationDuration,
  );

  const bookedAppointments = await AppointmentModel.find({
    doctorProfileId,
    appointmentDate: {
      $gte: startOfDay(appointmentDate),
      $lte: endOfDay(appointmentDate),
    },
    isDeleted: false,
    status: { $nin: ["Cancelled", "No-Show"] },
  }).select("scheduledSlot");

  const bookedSlots = new Set(
    bookedAppointments.map((appointment) => appointment.scheduledSlot).filter(Boolean),
  );

  if (preferredSlot && allSlots.includes(preferredSlot) && !bookedSlots.has(preferredSlot)) {
    return preferredSlot;
  }

  const firstAvailable = allSlots.find((slot) => !bookedSlots.has(slot));

  if (!firstAvailable) {
    throw new ApiError(409, "No appointment slot is available for the selected doctor/date");
  }

  return firstAvailable;
}
