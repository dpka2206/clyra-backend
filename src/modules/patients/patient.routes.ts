import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateRequest } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createPatientSchema, patientSearchSchema } from "./patient.schema.js";
import { createPatient, searchPatients } from "./patient.service.js";

export const patientRouter = Router();

patientRouter.use(authenticate, authorize(["Doctor", "Admin"]));

patientRouter.get(
  "/",
  validateRequest(patientSearchSchema),
  asyncHandler(async (request, response) => {
    const search = Array.isArray(request.query.search) ? request.query.search[0] : request.query.search;
    const limit = Array.isArray(request.query.limit) ? request.query.limit[0] : request.query.limit;

    response.json({
      patients: await searchPatients({
        search: search as string | undefined,
        limit: limit ? Number(limit) : undefined,
      }),
    });
  }),
);

patientRouter.post(
  "/",
  validateRequest(createPatientSchema),
  asyncHandler(async (request, response) => {
    const patient = await createPatient({
      actorUserId: request.authUser?.userId,
      ...request.body,
    });

    response.status(201).json({
      message: "Patient created successfully",
      patient,
    });
  }),
);
