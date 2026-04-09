import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

import { env } from "../../config/env.js";

export class S3Service {
  private client =
    env.AWS_S3_BUCKET && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? new S3Client({
          region: env.AWS_REGION,
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        })
      : null;

  async createPrivateUploadUrl(fileName: string, contentType: string) {
    const key = `consultations/${randomUUID()}-${fileName}`;

    if (!this.client || !env.AWS_S3_BUCKET) {
      return {
        provider: "mock",
        key,
        uploadUrl: `mock://${key}`,
      };
    }

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 60 * 10 });

    return {
      provider: "s3",
      key,
      uploadUrl,
    };
  }
}

export const s3Service = new S3Service();
