import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";

type Row = { id: number; userId: string; storageKey: string };

const { getVerifiedUser, database, storage } = vi.hoisted(() => ({
  getVerifiedUser: vi.fn(),
  database: { progressPhoto: { findFirst: vi.fn() } },
  storage: { current: undefined as unknown },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: () => storage.current }));

import { GET } from "./route";

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const OK = 200;
const MY_PHOTO = 7;
const THEIR_PHOTO = 8;
const TAKEN = new Date("2026-11-25T03:30:00Z"); // 24 Nov in Toronto
const MINE: Row = {
  id: MY_PHOTO,
  userId: "owner",
  storageKey: "progress/owner/a.webp",
};
const THEIRS: Row = {
  id: THEIR_PHOTO,
  userId: "someone-else",
  storageKey: "progress/someone-else/b.webp",
};
let files: MemoryStorage;

const call = (id: string) =>
  GET(new Request(`http://localhost/api/photos/${id}/download`), {
    params: Promise.resolve({ id }),
  });

beforeEach(async () => {
  vi.clearAllMocks();
  // The signed link answers without an attachment header, so the app sends the file itself.
  vi.stubGlobal("fetch", async () => new Response("a"));
  files = new MemoryStorage();
  storage.current = files;
  await files.put(MINE.storageKey, Buffer.from("mine"), "image/webp");
  await files.put(THEIRS.storageKey, Buffer.from("theirs"), "image/webp");
  getVerifiedUser.mockResolvedValue({ id: "owner" });
  database.progressPhoto.findFirst.mockImplementation(
    async ({ where }: { where: { id: number; userId: string } }) => {
      const found = [MINE, THEIRS].find(
        (row) => row.id === where.id && row.userId === where.userId,
      );
      return found ? { ...found, takenAt: TAKEN } : null;
    },
  );
});

describe("GET /api/photos/[id]/download", () => {
  it("sends the owner the photo as an attachment named by the day it was taken", async () => {
    const response = await call(String(MY_PHOTO));
    expect(response.status).toBe(OK);
    expect(response.headers.get("content-disposition")).toContain(
      'filename="progress-photo-2026-11-24.webp"',
    );
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(await response.text()).toBe("mine");
  });

  it("answers 404 for another user's photo, the same as a missing one", async () => {
    const theirs = await call(String(THEIR_PHOTO));
    const missing = await call("999");
    expect(theirs.status).toBe(NOT_FOUND);
    expect(missing.status).toBe(NOT_FOUND);
    expect(await theirs.text()).toBe(await missing.text());
  });

  it("never signs or reads another user's photo", async () => {
    const sign = vi.spyOn(files, "signedUrl");
    await call(String(THEIR_PHOTO));
    expect(sign).not.toHaveBeenCalled();
  });

  it("answers 404 for an id that is not a number, without a query", async () => {
    const response = await call("7; DROP TABLE");
    expect(response.status).toBe(NOT_FOUND);
    expect(database.progressPhoto.findFirst).not.toHaveBeenCalled();
  });

  it("answers 404 for an id too big for the database, not 503", async () => {
    const response = await call("99999999999");
    expect(response.status).toBe(NOT_FOUND);
    expect(database.progressPhoto.findFirst).not.toHaveBeenCalled();
  });

  it("answers 401 when nobody is signed in", async () => {
    getVerifiedUser.mockResolvedValue(null);
    expect((await call(String(MY_PHOTO))).status).toBe(UNAUTHORIZED);
    expect(database.progressPhoto.findFirst).not.toHaveBeenCalled();
  });
});
