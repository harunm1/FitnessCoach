// Unit tests for the "Log a past workout" Server Action (D49, #194), with the database and
// the session mocked: who the workout belongs to, what is refused, what is written.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, revalidatePath, database } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  database: {
    exercise: { findMany: vi.fn() },
    workout: { create: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { logPastStrength } from "./actions";

const idle = { status: "idle" as const };
// 15:00 UTC on 26 Nov is 10:00 in Toronto, the same day.
const NOW = new Date("2026-11-26T15:00:00Z");

const ENTRY = {
  date: "2026-11-24",
  minutes: "50",
  note: "Felt strong",
  exercises: [
    {
      exerciseId: "bench-press",
      sets: [
        { reps: "8", weight: "60" },
        { reps: "6", weight: "62.5" },
      ],
    },
    { exerciseId: "push-up", sets: [{ reps: "15", weight: "" }] },
  ],
};

function form(entry: unknown, extra: Record<string, string> = {}) {
  const data = new FormData();
  data.append(
    "entry",
    typeof entry === "string" ? entry : JSON.stringify(entry),
  );
  Object.entries(extra).forEach(([name, value]) => data.append(name, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  requireUser.mockResolvedValue({ id: "session-owner" });
  database.exercise.findMany.mockResolvedValue([
    { id: "bench-press" },
    { id: "push-up" },
  ]);
  database.workout.create.mockResolvedValue({ id: 41 });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("logPastStrength", () => {
  it("saves one finished workout for the signed-in user and numbers the sets", async () => {
    const state = await logPastStrength(idle, form(ENTRY));

    expect(state).toEqual({
      status: "saved",
      date: "2026-11-24",
      exercises: 2,
      sets: 3,
    });
    expect(database.workout.create).toHaveBeenCalledTimes(1);
    const { data } = database.workout.create.mock.calls[0][0];
    expect(data.userId).toBe("session-owner");
    expect(data.source).toBe("manual-strength");
    expect(data.startedAt).toEqual(new Date("2026-11-24T17:00:00Z"));
    expect(data.finishedAt).toEqual(new Date("2026-11-24T17:50:00Z"));
    expect(data.durationSeconds).toBe(3000);
    expect(data.notes).toBe("Felt strong");
    expect(data.sets.create).toEqual([
      expect.objectContaining({
        exerciseId: "bench-press",
        setNumber: 1,
        reps: 8,
        weightKg: 60,
      }),
      expect.objectContaining({
        exerciseId: "bench-press",
        setNumber: 2,
        reps: 6,
        weightKg: 62.5,
      }),
      expect.objectContaining({
        exerciseId: "push-up",
        setNumber: 1,
        reps: 15,
        weightKg: null,
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/history");
    expect(revalidatePath).toHaveBeenCalledWith("/progress");
  });

  it("takes the owner from the session, never from the form", async () => {
    await logPastStrength(idle, form(ENTRY, { userId: "someone-else" }));
    expect(database.workout.create.mock.calls[0][0].data.userId).toBe(
      "session-owner",
    );
  });

  it("saves a workout with no minutes as not timed", async () => {
    await logPastStrength(idle, form({ ...ENTRY, minutes: "" }));
    const { data } = database.workout.create.mock.calls[0][0];
    expect(data.durationSeconds).toBeNull();
    expect(data.finishedAt).toEqual(data.startedAt);
  });

  it("converts pounds typed in the form to kilograms", async () => {
    await logPastStrength(idle, form(ENTRY, { weightUnit: "LB" }));
    const { data } = database.workout.create.mock.calls[0][0];
    expect(data.sets.create[0].weightKg).toBeCloseTo(27.22, 1);
  });

  it("refuses a day that has not happened yet and writes nothing", async () => {
    const state = await logPastStrength(
      idle,
      form({ ...ENTRY, date: "2026-11-27" }),
    );
    expect(state).toEqual({
      status: "error",
      message: "That day hasn't happened yet.",
    });
    expect(database.workout.create).not.toHaveBeenCalled();
  });

  it("refuses an exercise that is not in the library", async () => {
    database.exercise.findMany.mockResolvedValue([{ id: "bench-press" }]);
    const state = await logPastStrength(idle, form(ENTRY));
    expect(state).toEqual({
      status: "error",
      message: "Choose each exercise from the list.",
    });
    expect(database.workout.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown weight unit and an unreadable entry", async () => {
    expect(
      (await logPastStrength(idle, form(ENTRY, { weightUnit: "stone" })))
        .status,
    ).toBe("error");
    expect(await logPastStrength(idle, form("{not json"))).toEqual({
      status: "error",
      message: "Your workout couldn't be read. Try again.",
    });
    expect(await logPastStrength(idle, new FormData())).toEqual({
      status: "error",
      message: "Your workout couldn't be read. Try again.",
    });
    expect(database.workout.create).not.toHaveBeenCalled();
  });

  it("says so, and logs the cause, when the database fails", async () => {
    database.workout.create.mockRejectedValue(new Error("db down"));
    const state = await logPastStrength(idle, form(ENTRY));
    expect(state).toEqual({
      status: "error",
      message: "Your workout couldn't be saved right now. Try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("sends a signed-out user to sign in before reading anything", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(logPastStrength(idle, form(ENTRY))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(database.workout.create).not.toHaveBeenCalled();
  });
});
