import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { SarvamAIClient } from "sarvamai";

import { env } from "../../config/env.js";
import { artifactStorageService } from "../storage/ArtifactStorageService.js";

export type SarvamTranscriptResult = {
  transcript: string;
  rawTranscript?: string;
  sourceLanguage: string;
  provider: "sarvam";
};

const SUPPORTED_REGIONAL_LANGUAGE_LABEL = "te-IN/hi-IN";

export class SarvamService {
  private client = env.SARVAM_API_KEY ? new SarvamAIClient({ apiSubscriptionKey: env.SARVAM_API_KEY }) : null;

  private normalizeTranscriptOutput(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return "";
    }

    try {
      const parsed = JSON.parse(trimmedValue) as unknown;
      const extracted = this.collectTranscriptLines(parsed);
      return extracted.length ? extracted.join("\n") : trimmedValue;
    } catch {
      return trimmedValue;
    }
  }

  private collectTranscriptLines(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.collectTranscriptLines(item));
    }

    if (!value || typeof value !== "object") {
      return [];
    }

    const record = value as Record<string, unknown>;
    const transcriptText =
      (typeof record.transcript === "string" && record.transcript.trim()) ||
      (typeof record.text === "string" && record.text.trim()) ||
      (typeof record.translated_text === "string" && record.translated_text.trim()) ||
      (typeof record.translation === "string" && record.translation.trim()) ||
      "";

    if (transcriptText) {
      const speaker =
        (typeof record.speaker_id === "string" && record.speaker_id.trim()) ||
        (typeof record.speaker === "string" && record.speaker.trim()) ||
        "";

      return [speaker ? `${speaker}: ${transcriptText}` : transcriptText];
    }

    return Object.values(record).flatMap((item) => this.collectTranscriptLines(item));
  }

  async translateConsultationAudio(filePath: string): Promise<SarvamTranscriptResult> {
    if (!this.client) {
      throw new Error("SARVAM_API_KEY is required for Sarvam transcription");
    }

    const job = await this.client.speechToTextTranslateJob.createJob({
      prompt:
        "This is an outpatient consultation between a doctor and patient. The speech may be in Telugu, Hindi, or mixed Telugu-Hindi with English medical terms. Translate it into clear English while preserving medicine names, dosage instructions, symptoms, and clinically important meaning.",
      withDiarization: true,
      numSpeakers: 2,
    });

    const outputDirectory = path.join(os.tmpdir(), "medicnct-sarvam", job.jobId);
    await mkdir(outputDirectory, { recursive: true });

    const uploaded = await job.uploadFiles([filePath]);
    if (!uploaded) {
      throw new Error("Sarvam job upload failed");
    }

    await job.start();
    await job.waitUntilComplete(5, 900);

    const fileResults = await job.getFileResults();
    if (!fileResults.successful.length) {
      const reason = fileResults.failed[0]?.error_message || "Sarvam job did not produce a translated transcript";
      throw new Error(reason);
    }

    await job.downloadOutputs(outputDirectory);

    const translatedText = await artifactStorageService.readLatestDownloadedText(outputDirectory);
    const normalizedTranscript = this.normalizeTranscriptOutput(translatedText);
    return {
      transcript: normalizedTranscript,
      rawTranscript: translatedText.trim(),
      sourceLanguage: SUPPORTED_REGIONAL_LANGUAGE_LABEL,
      provider: "sarvam",
    };
  }
}

export const sarvamService = new SarvamService();
