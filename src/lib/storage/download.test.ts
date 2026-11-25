import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "./memory";
import { R2Storage } from "./r2";

vi.mock("server-only", () => ({}));

const config = {
  accountId: "acct",
  accessKeyId: "key",
  secretAccessKey: "secret",
  bucket: "test-bucket",
};
const DOWNLOAD_SECONDS = 60;
const VIEW_SECONDS = 300;
const DISPOSITION = 'attachment; filename="a.csv"';

afterEach(() => vi.restoreAllMocks());

describe("R2Storage downloads", () => {
  it("stores the disposition on the file when one is given", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never);
    await new R2Storage(config).put(
      "exports/u/a.csv",
      Buffer.from("x"),
      "text/csv",
      {
        contentDisposition: DISPOSITION,
      },
    );
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({ ContentDisposition: DISPOSITION });
  });

  it("stores no disposition when none is given (photos stay as they were)", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never);
    await new R2Storage(config).put("p/a.webp", Buffer.from("x"), "image/webp");
    expect(send.mock.calls[0][0].input).not.toHaveProperty(
      "ContentDisposition",
    );
  });

  it("asks for an attachment in the signed link", async () => {
    const url = new URL(
      await new R2Storage(config).signedUrl(
        "exports/u/a.csv",
        DOWNLOAD_SECONDS,
        {
          contentDisposition: DISPOSITION,
        },
      ),
    );
    expect(url.searchParams.get("response-content-disposition")).toBe(
      DISPOSITION,
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
  });

  it("signs a plain viewing link without a disposition", async () => {
    const url = new URL(
      await new R2Storage(config).signedUrl("p/a.webp", VIEW_SECONDS),
    );
    expect(url.searchParams.has("response-content-disposition")).toBe(false);
  });
});

describe("MemoryStorage downloads", () => {
  it("remembers the disposition it was given", async () => {
    const storage = new MemoryStorage();
    await storage.put("exports/u/a.csv", Buffer.from("x"), "text/csv", {
      contentDisposition: DISPOSITION,
    });
    expect(storage.files.get("exports/u/a.csv")?.contentDisposition).toBe(
      DISPOSITION,
    );
  });

  it("puts the requested disposition in the link", async () => {
    const link = await new MemoryStorage().signedUrl("k", DOWNLOAD_SECONDS, {
      contentDisposition: DISPOSITION,
    });
    expect(link).toContain("expires=60");
    expect(link).toContain(`disposition=${encodeURIComponent(DISPOSITION)}`);
  });
});
