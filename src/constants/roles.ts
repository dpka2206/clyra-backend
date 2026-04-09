export const USER_ROLES = ["Doctor", "Patient", "Pharmacist", "Admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const APPOINTMENT_STATUSES = [
  "Scheduled",
  "Waiting",
  "In-Progress",
  "Completed",
  "Cancelled",
  "No-Show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
