import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

vi.mock("server-only", () => ({}));

import { R2Storage, readR2Config, type R2Config } from "./r2";

const config: R2Config = {
  accountId: "acct123",
  accessKeyId: "test-key-id",
  secretAccessKey: "test-secret",
  bucket: "test-bucket",
};

const env = {
  R2_ACCOUNT_ID: "acct123",
  R2_ACCESS_KEY_ID: "test-key-id",
  R2_SECRET_ACCESS_KEY: "test-secret",
  R2_BUCKET: "test-bucket",
};

// Stops real requests to R2 and records each command the storage sends.
function mockSend() {
  return vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
}

describe("readR2Config", () => {
  it("reads all four settings", () => {
    expect(readR2Config(env)).toEqual(config);
  });

  it("names every missing setting", () => {
    expect(() => readR2Config({ R2_BUCKET: "test-bucket" })).toThrow(
      "Missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
    );
  });

  it("treats an empty value as missing", () => {
    expect(() => readR2Config({ ...env, R2_BUCKET: "" })).toThrow(
      "Missing: R2_BUCKET",
    );
  });

  it("never shows a secret in the error", () => {
    expect(() => readR2Config({ ...env, R2_BUCKET: "" })).not.toThrow(
      "test-secret",
    );
  });
});

describe("R2Storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads to the bucket with the key and content type", async () => {
    const send = mockSend();
    const body = Buffer.from("photo");
    await new R2Storage(config).put("photos/u1/a.webp", body, "image/webp");

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: "photos/u1/a.webp",
      Body: body,
      ContentType: "image/webp",
    });
  });

  it("deletes the key from the bucket", async () => {
    const send = mockSend();
    await new R2Storage(config).delete("photos/u1/a.webp");

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: "photos/u1/a.webp",
    });
  });

  it("passes R2 errors on so the caller can show a message", async () => {
    vi.spyOn(S3Client.prototype, "send").mockRejectedValue(
      new Error("R2 is down"),
    );
    await expect(
      new R2Storage(config).put(
        "photos/u1/a.webp",
        Buffer.from("x"),
        "image/webp",
      ),
    ).rejects.toThrow("R2 is down");
  });

  it("signs a short-lived link on the account's R2 endpoint", async () => {
    const send = mockSend();
    const url = new URL(
      await new R2Storage(config).signedUrl("photos/u1/a.webp", 300),
    );

    // Signing happens locally; nothing is sent to R2.
    expect(send).not.toHaveBeenCalled();
    expect(url.hostname).toMatch(/acct123\.r2\.cloudflarestorage\.com$/);
    expect(`${url.hostname}${url.pathname}`).toContain("test-bucket");
    expect(url.pathname).toMatch(/\/photos\/u1\/a\.webp$/);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(
      /^test-key-id\/\d{8}\/auto\/s3\/aws4_request$/,
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });
});
