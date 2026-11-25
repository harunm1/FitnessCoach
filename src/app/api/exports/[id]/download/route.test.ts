import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";

type Row = { id: string; userId: string; kind: string; r2Key: string };

const { getVerifiedUser, database, storage } = vi.hoisted(() => ({
  getVerifiedUser: vi.fn(),
  database: { dataExport: { findFirst: vi.fn() } },
  storage: { current: undefined as unknown },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: () => storage.current }));

import { GET } from "./route";

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const UNAVAILABLE = 503;
const OK = 200;
const CREATED = new Date("2026-11-25T15:00:00Z");
const MINE: Row = {
  id: "mine",
  userId: "owner",
  kind: "WORKOUT_CSV",
  r2Key: "exports/owner/a.csv",
};
const THEIRS: Row = {
  id: "theirs",
  userId: "someone-else",
  kind: "WORKOUT_CSV",
  r2Key: "exports/someone-else/b.csv",
};
let files: MemoryStorage;

const call = (id: string) =>
  GET(new Request(`http://localhost/api/exports/${id}/download`), {
    params: Promise.resolve({ id }),
  });

beforeEach(async () => {
  vi.clearAllMocks();
  // The signed link answers without an attachment header, so the app sends the file itself.
  vi.stubGlobal("fetch", async () => new Response("a"));
  files = new MemoryStorage();
  storage.current = files;
  await files.put(MINE.r2Key, Buffer.from("mine"), "text/csv");
  await files.put(THEIRS.r2Key, Buffer.from("theirs"), "text/csv");
  getVerifiedUser.mockResolvedValue({ id: "owner" });
  // A table that really filters, so the test checks the outcome, not just the query.
  database.dataExport.findFirst.mockImplementation(
    async ({ where }: { where: { id: string; userId: string } }) => {
      const found = [MINE, THEIRS].find(
        (row) => row.id === where.id && row.userId === where.userId,
      );
      return found ? { ...found, createdAt: CREATED } : null;
    },
  );
});

describe("GET /api/exports/[id]/download", () => {
  it("sends the owner their file as an attachment with a sensible name", async () => {
    const response = await call("mine");
    expect(response.status).toBe(OK);
    expect(response.headers.get("content-disposition")).toContain(
      'filename="fitnesscoach-workouts-2026-11-25.csv"',
    );
    expect(await response.text()).toBe("mine");
  });

  it("answers 404 for another user's export, the same as a missing one", async () => {
    const theirs = await call("theirs");
    const missing = await call("no-such-export");
    expect(theirs.status).toBe(NOT_FOUND);
    expect(missing.status).toBe(NOT_FOUND);
    expect(await theirs.text()).toBe(await missing.text());
  });

  it("never signs or reads another user's file", async () => {
    const sign = vi.spyOn(files, "signedUrl");
    const read = vi.spyOn(files, "get");
    await call("theirs");
    expect(sign).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("looks the row up by the session's user, never one from the request", async () => {
    await call("mine");
    expect(database.dataExport.findFirst.mock.calls[0][0].where).toEqual({
      id: "mine",
      userId: "owner",
    });
  });

  it("answers 401 when nobody is signed in", async () => {
    getVerifiedUser.mockResolvedValue(null);
    const response = await call("mine");
    expect(response.status).toBe(UNAUTHORIZED);
    expect(database.dataExport.findFirst).not.toHaveBeenCalled();
  });

  it("answers 503 without naming the key when storage fails", async () => {
    vi.spyOn(files, "signedUrl").mockRejectedValue(new Error("R2 is down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await call("mine");
    expect(response.status).toBe(UNAVAILABLE);
    expect(await response.text()).not.toContain("exports/");
    log.mockRestore();
  });
});
