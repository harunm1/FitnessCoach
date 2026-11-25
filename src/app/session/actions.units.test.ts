import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, revalidatePath, redirect, database } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  database: {
    workout: { findFirst: vi.fn(), update: vi.fn() },
    setLog: { upsert: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
import { logSet, saveRunMetrics } from "./actions";

const idle = { status: "idle" as const, message: "" };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

const openWorkout = {
  id: 9,
  planDay: { exercises: [{ sets: 3 }] },
  sets: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "session-owner" });
  database.workout.findFirst.mockResolvedValue(openWorkout);
  database.setLog.upsert.mockResolvedValue({});
  database.workout.update.mockResolvedValue({});
});

describe("logSet units", () => {
  it("converts pounds typed under a pound label to kilograms before saving", async () => {
    await expect(
      logSet(
        "ex1",
        idle,
        form({ setNumber: "1", reps: "5", weightKg: "135", weightUnit: "LB" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(
      database.setLog.upsert.mock.calls[0][0].create.weightKg.toString(),
    ).toBe("61.23");
  });

  it("saves kilograms as typed when the form says nothing", async () => {
    await expect(
      logSet("ex1", idle, form({ setNumber: "1", reps: "5", weightKg: "60" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(
      database.setLog.upsert.mock.calls[0][0].create.weightKg.toString(),
    ).toBe("60");
  });

  it("refuses a unit that is not kg or lb", async () => {
    const result = await logSet(
      "ex1",
      idle,
      form({ setNumber: "1", reps: "5", weightKg: "60", weightUnit: "stone" }),
    );
    expect(result.status).toBe("error");
    expect(database.setLog.upsert).not.toHaveBeenCalled();
  });
});

describe("saveRunMetrics units", () => {
  it("converts miles typed under a mile label to kilometres before saving", async () => {
    await expect(
      saveRunMetrics(
        idle,
        form({
          distanceKm: "3.1",
          distanceUnit: "MI",
          durationMinutes: "30",
          durationSeconds: "0",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(
      database.workout.update.mock.calls[0][0].data.distanceKm.toString(),
    ).toBe("4.99");
  });

  it("keeps a stored 10 km when the pre-filled miles are saved unchanged", async () => {
    await expect(
      saveRunMetrics(
        idle,
        form({
          distanceKm: "6.2137",
          distanceUnit: "MI",
          durationMinutes: "50",
          durationSeconds: "0",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(
      database.workout.update.mock.calls[0][0].data.distanceKm.toString(),
    ).toBe("10");
  });

  it("refuses a unit that is not km or mi", async () => {
    const result = await saveRunMetrics(
      idle,
      form({
        distanceKm: "5",
        distanceUnit: "ly",
        durationMinutes: "30",
        durationSeconds: "0",
      }),
    );
    expect(result.status).toBe("error");
    expect(database.workout.update).not.toHaveBeenCalled();
  });
});
