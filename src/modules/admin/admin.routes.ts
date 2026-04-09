import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateRequest } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createDepartmentSchema,
  onboardDoctorSchema,
  onboardPharmacistSchema,
} from "./admin.schema.js";
import {
  createDepartment,
  listAuditLogs,
  listDepartments,
  onboardDoctor,
  onboardPharmacist,
} from "./admin.service.js";

export const adminRouter = Router();

adminRouter.use(authenticate, authorize(["Admin"]));

adminRouter.get(
  "/departments",
  asyncHandler(async (_request, response) => {
    response.json({ departments: await listDepartments() });
  }),
);

adminRouter.post(
  "/departments",
  validateRequest(createDepartmentSchema),
  asyncHandler(async (request, response) => {
    const department = await createDepartment({
      actorUserId: request.authUser?.userId,
      ...request.body,
    });
    response.status(201).json({ department });
  }),
);

adminRouter.post(
  "/doctors",
  validateRequest(onboardDoctorSchema),
  asyncHandler(async (request, response) => {
    const user = await onboardDoctor({
      actorUserId: request.authUser?.userId,
      ...request.body,
    });
    response.status(201).json({ userId: user._id, role: user.role });
  }),
);

adminRouter.post(
  "/pharmacists",
  validateRequest(onboardPharmacistSchema),
  asyncHandler(async (request, response) => {
    const user = await onboardPharmacist({
      actorUserId: request.authUser?.userId,
      ...request.body,
    });
    response.status(201).json({ userId: user._id, role: user.role });
  }),
);

adminRouter.get(
  "/audit-logs",
  asyncHandler(async (_request, response) => {
    response.json({ logs: await listAuditLogs() });
  }),
);
