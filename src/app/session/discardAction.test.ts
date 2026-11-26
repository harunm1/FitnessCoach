// Unit test for the Discard workout action (D47): owner-only, unfinished-only, answers a
// missing, finished or foreign workout with the same 404, and returns to the session landing.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, revalidatePath, redirect, notFound, discardOpenWorkout } =
  vi.hoisted(() => ({
    requireUser: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    discardOpenWorkout: vi.fn(),
  }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/workout/discardWorkout", () => ({ discardOpenWorkout }));
import { discardWorkout } from "./discardAction";

const WORKOUT_ID = 7;
const ABOVE_INT_MAX = 2_147_483_648;
const FRACTION = 1.5;

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "owner" });
});

describe("discardWorkout", () => {
  it("deletes the signed-in user's workout and returns to the landing", async () => {
    discardOpenWorkout.mockResolvedValue(true);
    await expect(discardWorkout(WORKOUT_ID)).rejects.toThrow("NEXT_REDIRECT");
    expect(discardOpenWorkout).toHaveBeenCalledWith(
      expect.anything(),
      "owner",
      WORKOUT_ID,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/session");
    expect(redirect).toHaveBeenCalledWith("/session");
  });

  it("answers 404 when nothing was removed (missing, finished or another user's)", async () => {
    discardOpenWorkout.mockResolvedValue(false);
    await expect(discardWorkout(WORKOUT_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([0, -1, FRACTION, Number.NaN, ABOVE_INT_MAX])(
    "answers 404 for the id %s without touching the database",
    async (id) => {
      await expect(discardWorkout(id)).rejects.toThrow("NEXT_NOT_FOUND");
      expect(discardOpenWorkout).not.toHaveBeenCalled();
    },
  );
});
