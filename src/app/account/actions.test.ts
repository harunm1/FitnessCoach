import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, activateTrial, revalidatePath, database } = vi.hoisted(
  () => ({
    requireUser: vi.fn(),
    activateTrial: vi.fn(),
    revalidatePath: vi.fn(),
    database: {},
  }),
);
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/auth/trial", () => ({ activateTrial }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { startTrial } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "session-owner" });
  activateTrial.mockResolvedValue(true);
});

describe("start trial server action", () => {
  it("uses only the session owner even with forged client state", async () => {
    const forgedState = {
      status: "idle" as const,
      userId: "victim",
      tier: "ADMIN",
      trialEndsAt: "2099-01-01",
    };
    expect(await Reflect.apply(startTrial, null, [forgedState])).toEqual({
      status: "started",
    });
    expect(activateTrial).toHaveBeenCalledWith(database, "session-owner");
    expect(revalidatePath).toHaveBeenCalledWith("/account");
  });

  it("does not write for a signed-out caller or swallow a login redirect", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(startTrial()).rejects.toThrow("redirect:/sign-in");
    expect(activateTrial).not.toHaveBeenCalled();
  });

  it("handles repeat activation and database failure without exposing internals", async () => {
    activateTrial.mockResolvedValueOnce(false);
    expect(await startTrial()).toEqual({ status: "unavailable" });
    activateTrial.mockRejectedValueOnce(
      new Error("private connection details"),
    );
    expect(await startTrial()).toEqual({ status: "error" });
  });
});
