import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateRequest } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { searchPrescriptionSchema, updateUsageSchema } from "./pharmacy.schema.js";
import { searchPrescription, updateUsageInstructions } from "./pharmacy.service.js";

export const pharmacyRouter = Router();

pharmacyRouter.use(authenticate, authorize(["Pharmacist", "Admin"]));

pharmacyRouter.get(
  "/prescriptions/search",
  validateRequest(searchPrescriptionSchema),
  asyncHandler(async (request, response) => {
    const tokenNumber = Array.isArray(request.query.tokenNumber)
      ? request.query.tokenNumber[0]
      : request.query.tokenNumber;
    const date = Array.isArray(request.query.date) ? request.query.date[0] : request.query.date;

    response.json(await searchPrescription(tokenNumber as string, date as string));
  }),
);

pharmacyRouter.patch(
  "/prescriptions/:medicalHistoryId/usage",
  validateRequest(updateUsageSchema),
  asyncHandler(async (request, response) => {
    const medicalHistoryId = Array.isArray(request.params.medicalHistoryId)
      ? request.params.medicalHistoryId[0]
      : request.params.medicalHistoryId;
    response.json(
      await updateUsageInstructions({
        actorUserId: request.authUser?.userId,
        medicalHistoryId,
        usageInstructions: request.body.usageInstructions,
      }),
    );
  }),
);
