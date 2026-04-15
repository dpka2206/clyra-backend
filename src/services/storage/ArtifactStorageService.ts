import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class ArtifactStorageService {
  private rootDirectory = process.env.VERCEL
    ? path.join(os.tmpdir(), "consultation-jobs")
    : path.resolve(process.cwd(), ".runtime-artifacts", "consultation-jobs");

  private async ensureJobDirectory(jobId: string) {
    const jobDirectory = path.join(this.rootDirectory, jobId);
    await mkdir(jobDirectory, { recursive: true });
    return jobDirectory;
  }

  async saveAudio(jobId: string, fileName: string, buffer: Buffer) {
    const jobDirectory = await this.ensureJobDirectory(jobId);
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(jobDirectory, `${Date.now()}-${safeFileName || "consultation-audio.webm"}`);
    await writeFile(filePath, buffer);
    return filePath;
  }

  async saveText(jobId: string, prefix: string, value: string) {
    const jobDirectory = await this.ensureJobDirectory(jobId);
    const filePath = path.join(jobDirectory, `${prefix}-${randomUUID()}.txt`);
    await writeFile(filePath, value, "utf8");
    return filePath;
  }

  async saveJson(jobId: string, prefix: string, value: unknown) {
    const jobDirectory = await this.ensureJobDirectory(jobId);
    const filePath = path.join(jobDirectory, `${prefix}-${randomUUID()}.json`);
    await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
    return filePath;
  }

  async readAudio(filePath: string) {
    return readFile(filePath);
  }

  async readText(filePath: string) {
    return readFile(filePath, "utf8");
  }

  async readLatestDownloadedText(directoryPath: string) {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => path.join(directoryPath, entry.name)).sort();

    if (!files.length) {
      throw new Error(`No downloaded artifact files found in ${directoryPath}`);
    }

    return this.readText(files[files.length - 1]);
  }
}

export const artifactStorageService = new ArtifactStorageService();
