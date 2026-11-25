import { describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";
import {
  DOWNLOAD_LINK_SECONDS,
  downloadResponse,
  linkCarriesAttachment,
} from "./respond";

const NOT_FOUND = 404;
const FOUND = 302;
const OK = 200;
const PARTIAL = 206;
const A_MINUTE = 60;
const KEY = "exports/u1/a.csv";
const NAME = "fitnesscoach-workouts-2026-11-25.csv";
const CSV = "text/csv; charset=utf-8";

async function storageWithFile() {
  const storage = new MemoryStorage();
  await storage.put(KEY, Buffer.from("a,b\r\n"), CSV);
  return storage;
}

describe("downloadResponse", () => {
  it("sends the browser to a short-lived link that asks for an attachment", async () => {
    const response = await downloadResponse({
      storage: await storageWithFile(),
      key: KEY,
      fileName: NAME,
      contentType: CSV,
      probe: async () => true,
    });

    expect(response.status).toBe(FOUND);
    const link = response.headers.get("location") ?? "";
    expect(link).toContain(`expires=${DOWNLOAD_LINK_SECONDS}`);
    expect(decodeURIComponent(link)).toContain(
      `attachment; filename="${NAME}"`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps the link short: a minute", () => {
    expect(DOWNLOAD_LINK_SECONDS).toBe(A_MINUTE);
  });

  it("sends the file itself with the header when the link would not carry it", async () => {
    const response = await downloadResponse({
      storage: await storageWithFile(),
      key: KEY,
      fileName: NAME,
      contentType: CSV,
      probe: async () => false,
    });

    expect(response.status).toBe(OK);
    expect(response.headers.get("content-disposition")).toContain(
      `attachment; filename="${NAME}"`,
    );
    expect(response.headers.get("content-type")).toBe(CSV);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("a,b\r\n");
  });

  it("answers 404 when the stored file is gone", async () => {
    const response = await downloadResponse({
      storage: new MemoryStorage(),
      key: KEY,
      fileName: NAME,
      contentType: CSV,
      probe: async () => false,
    });
    expect(response.status).toBe(NOT_FOUND);
  });
});

describe("linkCarriesAttachment", () => {
  const link = "https://r2.example/exports/u1/a.csv?sig=1";

  it("asks for one byte only", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("a", {
          status: PARTIAL,
          headers: { "content-disposition": "attachment; filename=a.csv" },
        }),
    );
    await linkCarriesAttachment(link, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      link,
      expect.objectContaining({ headers: { Range: "bytes=0-0" } }),
    );
  });

  it("is true when the response says attachment", async () => {
    const result = await linkCarriesAttachment(
      link,
      async () =>
        new Response("a", {
          headers: { "content-disposition": "Attachment; filename=a.csv" },
        }),
    );
    expect(result).toBe(true);
  });

  it("is false when the header is missing or says inline", async () => {
    expect(
      await linkCarriesAttachment(link, async () => new Response("a")),
    ).toBe(false);
    expect(
      await linkCarriesAttachment(
        link,
        async () =>
          new Response("a", { headers: { "content-disposition": "inline" } }),
      ),
    ).toBe(false);
  });

  it("is false when the check fails, so the file is sent by the app", async () => {
    const result = await linkCarriesAttachment(link, async () => {
      throw new Error("TLS handshake failed");
    });
    expect(result).toBe(false);
  });
});
