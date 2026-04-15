import multer from "multer";
import { Router } from "express";

import { env } from "../../config/env.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateRequest } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  approveConsultationJobSchema,
  consultationJobParamsSchema,
  createConsultationJobSchema,
  finalizeConsultationSchema,
  liveOpContextQuerySchema,
  processConsultationSchema,
  transcriptToJsonSchema,
} from "./consultation.schema.js";
import {
  approveConsultationJob,
  createConsultationJob,
  createAudioUploadLink,
  processConsultationAudio,
  finalizeConsultation,
  getDoctorLiveOpContext,
  getConsultationJob,
  processConsultationTranscript,
  uploadConsultationJobAudio,
} from "./consultation.service.js";

export const consultationRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
const consultationGuards =
  env.NODE_ENV === "development" ? [] : [authenticate, authorize(["Doctor", "Admin"])];

consultationRouter.post(
  "/jobs",
  ...consultationGuards,
  validateRequest(createConsultationJobSchema),
  asyncHandler(async (request, response) => {
    console.log("POST /consultations/jobs - Request Body:", JSON.stringify(request.body, null, 2));
    const job = await createConsultationJob(request.body);
    console.log("POST /consultations/jobs - Job Created:", job.jobId);
    response.status(201).json({
      message: "Consultation job created",
      job,
    });
  }),
);

consultationRouter.get(
  "/live-op-context",
  ...consultationGuards,
  validateRequest(liveOpContextQuerySchema),
  asyncHandler(async (request, response) => {
    response.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    const doctorProfileId = Array.isArray(request.query.doctorProfileId)
      ? request.query.doctorProfileId[0]
      : request.query.doctorProfileId;
    const date = Array.isArray(request.query.date) ? request.query.date[0] : request.query.date;

    const context = await getDoctorLiveOpContext({
      doctorProfileId: doctorProfileId as string,
      date: date as string | undefined,
    });

    response.json({
      message: "Live OP context fetched",
      ...context,
    });
  }),
);

consultationRouter.get(
  "/jobs/:jobId",
  ...consultationGuards,
  validateRequest(consultationJobParamsSchema),
  asyncHandler(async (request, response) => {
    response.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    const jobId = Array.isArray(request.params.jobId) ? request.params.jobId[0] : request.params.jobId;
    const job = await getConsultationJob(jobId);
    response.json({
      message: "Consultation job fetched",
      job,
    });
  }),
);

consultationRouter.post(
  "/jobs/:jobId/audio",
  ...consultationGuards,
  validateRequest(consultationJobParamsSchema),
  upload.single("audio"),
  asyncHandler(async (request, response) => {
    const file = request.file;
    const jobId = Array.isArray(request.params.jobId) ? request.params.jobId[0] : request.params.jobId;

    console.log(`POST /consultations/jobs/${jobId}/audio - File:`, file ? file.originalname : "MISSING");

    if (!file) {
      console.error(`POST /consultations/jobs/${jobId}/audio - Error: Audio file is required`);
      return response.status(400).json({ message: "Audio file is required" });
    }

    try {
      const job = await uploadConsultationJobAudio({
        jobId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        audioBuffer: file.buffer,
      });

      const finishedInline = ["COMPLETED", "APPROVED", "FAILED"].includes(job.status);
      console.log(
        `POST /consultations/jobs/${jobId}/audio - Success: Audio uploaded${finishedInline ? " and processed inline" : " and processing started"}`,
      );
      return response.status(finishedInline ? 200 : 202).json({
        message: finishedInline
          ? "Consultation audio uploaded and processing finished"
          : "Consultation audio received and processing started",
        job,
      });
    } catch (error) {
      console.error(`POST /consultations/jobs/${jobId}/audio - Error:`, error);
      return response.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
);

consultationRouter.post(
  "/jobs/:jobId/approve",
  ...consultationGuards,
  validateRequest(approveConsultationJobSchema),
  asyncHandler(async (request, response) => {
    const jobId = Array.isArray(request.params.jobId) ? request.params.jobId[0] : request.params.jobId;
    const result = await approveConsultationJob({
      jobId,
      approvalMode: request.body.approvalMode,
      prescriptions: request.body.prescriptions,
      manualNotes: request.body.manualNotes,
    });

    return response.status(200).json({
      message: "Consultation approved and saved",
      ...result,
    });
  }),
);

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
