import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PhotoStorage } from "./types";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

const SETTINGS = {
  accountId: "R2_ACCOUNT_ID",
  accessKeyId: "R2_ACCESS_KEY_ID",
  secretAccessKey: "R2_SECRET_ACCESS_KEY",
  bucket: "R2_BUCKET",
} as const;

// Reads the R2 settings from .env and names any that are missing,
// so a setup mistake gives a clear message instead of a vague R2 error.
export function readR2Config(
  env: Record<string, string | undefined> = process.env,
): R2Config {
  const missing = Object.values(SETTINGS).filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Photo storage is not set up. Missing: ${missing.join(", ")}`,
    );
  }
  return {
    accountId: env[SETTINGS.accountId] ?? "",
    accessKeyId: env[SETTINGS.accessKeyId] ?? "",
    secretAccessKey: env[SETTINGS.secretAccessKey] ?? "",
    bucket: env[SETTINGS.bucket] ?? "",
  };
}

// Stores photos in a private Cloudflare R2 bucket through R2's S3-compatible API.
export class R2Storage implements PhotoStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
