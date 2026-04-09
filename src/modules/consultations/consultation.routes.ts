import multer from "multer";
import { Router } from "express";

import { env } from "../../config/env.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateRequest } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  finalizeConsultationSchema,
  processConsultationSchema,
  transcriptToJsonSchema,
} from "./consultation.schema.js";
import {
  createAudioUploadLink,
  processConsultationAudio,
  finalizeConsultation,
  processConsultationTranscript,
} from "./consultation.service.js";

export const consultationRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
const consultationGuards =
  env.NODE_ENV === "development" ? [] : [authenticate, authorize(["Doctor", "Admin"])];

consultationRouter.post(
  "/upload-audio",
  ...consultationGuards,
  upload.single("audio"),
  asyncHandler(async (request, response) => {
    const file = request.file;

    if (!file) {
      return response.status(400).json({ message: "Audio file is required" });
    }

    const uploadInfo = await createAudioUploadLink(file.originalname, file.mimetype);

    return response.status(201).json({
      message: "Audio upload prepared",
      upload: uploadInfo,
      receivedFile: {
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      },
    });
  }),
);

consultationRouter.post(
  "/transcript-to-json",
  ...consultationGuards,
  validateRequest(transcriptToJsonSchema),
  asyncHandler(async (request, response) => {
    const extracted = await processConsultationTranscript(request.body.transcript);

    response.json({
      message: "Transcript parsed successfully",
      extracted,
    });
  }),
);

consultationRouter.post(
  "/process-audio",
  ...consultationGuards,
  upload.single("audio"),
  asyncHandler(async (request, response) => {
    const file = request.file;

    if (!file) {
      return response.status(400).json({ message: "Audio file is required" });
    }

    const processed = await processConsultationAudio(file.buffer, file.mimetype);

    return response.json({
      message: "Audio transcription and consultation processing completed successfully",
      processed,
      file: {
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      },
    });
  }),
);

consultationRouter.post(
  "/process",
  ...consultationGuards,
  validateRequest(processConsultationSchema),
  asyncHandler(async (request, response) => {
    const processed = await processConsultationTranscript(request.body.transcript);

    response.json({
      message: "Consultation processed successfully",
      processed,
    });
  }),
);

consultationRouter.post(
  "/finalize",
  authenticate,
  authorize(["Doctor", "Admin"]),
  validateRequest(finalizeConsultationSchema),
  asyncHandler(async (request, response) => {
    const result = await finalizeConsultation({
      actorUserId: request.authUser?.userId,
      ...request.body,
    });

    response.status(201).json({
      message: "Consultation finalized",
      ...result,
    });
  }),
);
