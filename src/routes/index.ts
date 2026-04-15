import { Router } from "express";

import { adminRouter } from "../modules/admin/admin.routes.js";
import { appointmentRouter } from "../modules/appointments/appointment.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { consultationRouter } from "../modules/consultations/consultation.routes.js";
import { doctorRouter } from "../modules/doctors/doctor.routes.js";
import { intakeRouter } from "../modules/intake/intake.routes.js";
import { patientRouter } from "../modules/patients/patient.routes.js";
import { pharmacyRouter } from "../modules/pharmacy/pharmacy.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "clyra-backend",
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use("/admin", adminRouter);
apiRouter.use("/appointments", appointmentRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/doctors", doctorRouter);
apiRouter.use("/intake", intakeRouter);
apiRouter.use("/patients", patientRouter);
apiRouter.use("/consultations", consultationRouter);
apiRouter.use("/pharmacy", pharmacyRouter);
