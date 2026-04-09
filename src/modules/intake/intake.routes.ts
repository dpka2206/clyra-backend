import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateRequest } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { phoneIntakeSchema } from "./intake.schema.js";
import { createAppointmentFromPhoneIntake } from "./intake.service.js";

export const intakeRouter = Router();

intakeRouter.post(
  "/appointments/from-call",
  authenticate,
  authorize(["Admin", "Doctor"]),
  validateRequest(phoneIntakeSchema),
  asyncHandler(async (request, response) => {
    const result = await createAppointmentFromPhoneIntake(request.body);

    response.status(201).json({
      message: "Appointment scheduled from phone intake",
      ...result,
    });
  }),
);
