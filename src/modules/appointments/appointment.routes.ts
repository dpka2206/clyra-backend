import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateRequest } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createAppointmentSchema,
  doctorDateQuerySchema,
  updateStatusSchema,
  weeklyQuerySchema,
} from "./appointment.schema.js";
import {
  createAppointment,
  getTodayOpList,
  getWeeklyAppointments,
  loadNextPatient,
  updateAppointmentStatus,
} from "./appointment.service.js";

export const appointmentRouter = Router();

appointmentRouter.post(
  "/",
  authenticate,
  authorize(["Admin", "Doctor"]),
  validateRequest(createAppointmentSchema),
  asyncHandler(async (request, response) => {
    const appointment = await createAppointment({
      actorUserId: request.authUser?.userId,
      ...request.body,
    });

    response.status(201).json({ appointment });
  }),
);

appointmentRouter.get(
  "/today",
  authenticate,
  authorize(["Doctor", "Admin"]),
  validateRequest(doctorDateQuerySchema),
  asyncHandler(async (request, response) => {
    const doctorProfileId = Array.isArray(request.query.doctorProfileId)
      ? request.query.doctorProfileId[0]
      : request.query.doctorProfileId;
    const date = Array.isArray(request.query.date) ? request.query.date[0] : request.query.date;

    response.json({
      appointments: await getTodayOpList(doctorProfileId as string, date as string),
    });
  }),
);

appointmentRouter.get(
  "/weekly",
  authenticate,
  authorize(["Doctor", "Admin"]),
  validateRequest(weeklyQuerySchema),
  asyncHandler(async (request, response) => {
    const doctorProfileId = Array.isArray(request.query.doctorProfileId)
      ? request.query.doctorProfileId[0]
      : request.query.doctorProfileId;
    const startDate = Array.isArray(request.query.startDate)
      ? request.query.startDate[0]
      : request.query.startDate;

    response.json({
      appointments: await getWeeklyAppointments(doctorProfileId as string, startDate as string),
    });
  }),
);

appointmentRouter.get(
  "/next",
  authenticate,
  authorize(["Doctor", "Admin"]),
  validateRequest(doctorDateQuerySchema),
  asyncHandler(async (request, response) => {
    const doctorProfileId = Array.isArray(request.query.doctorProfileId)
      ? request.query.doctorProfileId[0]
      : request.query.doctorProfileId;
    const date = Array.isArray(request.query.date) ? request.query.date[0] : request.query.date;

    response.json({
      appointment: await loadNextPatient(doctorProfileId as string, date as string),
    });
  }),
);

appointmentRouter.patch(
  "/:appointmentId/status",
  authenticate,
  authorize(["Doctor", "Admin"]),
  validateRequest(updateStatusSchema),
  asyncHandler(async (request, response) => {
    const appointmentId = Array.isArray(request.params.appointmentId)
      ? request.params.appointmentId[0]
      : request.params.appointmentId;
    const appointment = await updateAppointmentStatus({
      actorUserId: request.authUser?.userId,
      appointmentId,
      status: request.body.status,
    });

    response.json({ appointment });
  }),
);
