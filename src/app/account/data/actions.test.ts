import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, revalidatePath, createExport, storage, ExportError } =
  vi.hoisted(() => ({
    requireUser: vi.fn(),
    revalidatePath: vi.fn(),
    createExport: vi.fn(),
    storage: { current: {} },
    // The real class lives in a module that opens the database, so the test uses a twin.
    ExportError: class extends Error {
      constructor(readonly code: string) {
        super(code);
      }
    },
  }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: () => storage.current }));
vi.mock("@/lib/exports/create", () => ({ createExport, ExportError }));

import { createDataExport } from "./actions";

const idle = { status: "idle" as const };

function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => data.append(name, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  requireUser.mockResolvedValue({ id: "session-owner" });
  createExport.mockResolvedValue({ id: "export-1" });
});

describe("createDataExport", () => {
  it("creates the export for the signed-in user and refreshes the page", async () => {
    const result = await createDataExport(idle, form({ kind: "WORKOUT_CSV" }));

    expect(result).toEqual({ status: "created" });
    expect(createExport).toHaveBeenCalledWith("session-owner", "WORKOUT_CSV", {
      storage: storage.current,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/account/data");
  });

  it("takes the user from the session, never from the form", async () => {
    await createDataExport(
      idle,
      form({ kind: "COACH_CSV", userId: "someone-else" }),
    );
    expect(createExport.mock.calls[0][0]).toBe("session-owner");
  });

  it("refuses a kind that is not offered", async () => {
    const result = await createDataExport(idle, form({ kind: "EVERYTHING" }));
    expect(result.status).toBe("error");
    expect(createExport).not.toHaveBeenCalled();
  });

  it("says when too many exports were made this hour", async () => {
    createExport.mockRejectedValue(new ExportError("rate-limited"));
    const result = await createDataExport(idle, form({ kind: "WORKOUT_CSV" }));
    expect(result).toEqual({
      status: "error",
      message: "You've made a lot of exports this hour. Try again later.",
    });
  });

  it("says when the file would be too large", async () => {
    createExport.mockRejectedValue(new ExportError("too-large"));
    const result = await createDataExport(idle, form({ kind: "COACH_CSV" }));
    expect(result.message).toContain("too large");
  });

  it("shows a friendly message and logs the cause when something breaks", async () => {
    createExport.mockRejectedValue(new Error("R2 is down"));
    const result = await createDataExport(idle, form({ kind: "WORKOUT_CSV" }));
    expect(result).toEqual({
      status: "error",
      message: "The export couldn't be made right now. Try again later.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
