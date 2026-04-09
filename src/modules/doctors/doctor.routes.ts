import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateRequest } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { doctorScheduleSchema, updateAvailabilitySchema } from "./doctor.schema.js";
import { getDoctorProfile, getDoctorSchedule, updateDoctorAvailability } from "./doctor.service.js";

export const doctorRouter = Router();

doctorRouter.get(
  "/:doctorProfileId/profile",
  authenticate,
  authorize(["Doctor", "Admin"]),
  asyncHandler(async (request, response) => {
    const doctorProfileId = Array.isArray(request.params.doctorProfileId)
      ? request.params.doctorProfileId[0]
      : request.params.doctorProfileId;

    response.json({
      doctor: await getDoctorProfile(doctorProfileId),
    });
  }),
);

doctorRouter.get(
  "/:doctorProfileId/schedule",
  authenticate,
  authorize(["Doctor", "Admin"]),
  validateRequest(doctorScheduleSchema),
  asyncHandler(async (request, response) => {
    const date = Array.isArray(request.query.date) ? request.query.date[0] : request.query.date;
    const doctorProfileId = Array.isArray(request.params.doctorProfileId)
      ? request.params.doctorProfileId[0]
      : request.params.doctorProfileId;
    const schedule = await getDoctorSchedule(
      doctorProfileId,
      date as string,
    );

    response.json(schedule);
  }),
);

doctorRouter.post(
  "/availability",
  authenticate,
  authorize(["Doctor", "Admin"]),
  validateRequest(updateAvailabilitySchema),
  asyncHandler(async (request, response) => {
    const doctor = await updateDoctorAvailability({
      actorUserId: request.authUser?.userId,
      ...request.body,
    });

    response.json({
      message: "Doctor availability updated",
      doctor,
    });
  }),
);
