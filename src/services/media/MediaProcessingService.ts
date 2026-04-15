import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class MediaProcessingService {
  async prepareTranscriptionInput(input: { filePath: string; mimeType: string }) {
    if (!input.mimeType.startsWith("video/")) {
      return {
        filePath: input.filePath,
        mimeType: input.mimeType,
        cleanupDirectory: null as string | null,
      };
    }

    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "medicnct-media-"));
    const outputPath = path.join(tempDirectory, "extracted-audio.wav");

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      input.filePath,
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      outputPath,
    ]);

    return {
      filePath: outputPath,
      mimeType: "audio/wav",
      cleanupDirectory: tempDirectory,
    };
  }

  async cleanupPreparedInput(cleanupDirectory: string | null) {
    if (!cleanupDirectory) {
      return;
    }

    await rm(cleanupDirectory, { recursive: true, force: true });
  }
}

export const mediaProcessingService = new MediaProcessingService();
