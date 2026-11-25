import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, revalidatePath, database } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  database: {
    plan: { findFirst: vi.fn() },
    workout: { create: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { logRun } from "./actions";

const idle = { status: "idle" as const };
// 15:00 UTC on 24 Nov is 10:00 in Toronto, the same day.
const NOW = new Date("2026-11-24T15:00:00Z");
const RUN = {
  date: "2026-11-23",
  distanceKm: "5.2",
  duration: "0:31:12",
  effort: "6",
  note: "Easy loop",
};

// An active plan whose next day (one workout done) is an easy run.
const activePlan = {
  id: 7,
  createdAt: new Date("2026-11-20T14:00:00Z"),
  days: [
    { id: 70, kind: "STRENGTH", name: "Push", run: null },
    { id: 71, kind: "RUN", name: "Easy run", run: { type: "EASY" } },
  ],
  workouts: [],
  _count: { workouts: 1 },
};

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

let logged: ReturnType<typeof vi.spyOn>;

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  requireUser.mockResolvedValue({ id: "session-owner" });
  database.plan.findFirst.mockResolvedValue(null);
  database.workout.create.mockResolvedValue({ id: 1 });
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("logRun", () => {
  it("saves a finished run workout with its RunLog for the signed-in user", async () => {
    const result = await logRun(idle, form(RUN));
    expect(result).toEqual({
      status: "saved",
      date: "2026-11-23",
      distanceKm: 5.2,
      pace: "6:00 /km",
      planDayName: null,
    });
    const startedAt = new Date("2026-11-23T17:00:00Z");
    expect(database.workout.create).toHaveBeenCalledWith({
      data: {
        userId: "session-owner",
        planId: null,
        planDayId: null,
        source: "manual-run",
        startedAt,
        finishedAt: new Date(startedAt.getTime() + 1872 * 1000),
        distanceKm: 5.2,
        durationSeconds: 1872,
        notes: "Easy loop",
        run: {
          create: { type: null, distanceKm: 5.2, durationSec: 1872, rpe: 6 },
        },
      },
      select: { id: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/progress");
    expect(revalidatePath).toHaveBeenCalledWith("/session");
  });

  it("looks up only the signed-in user's active plan", async () => {
    await logRun(idle, form({ ...RUN, userId: "someone-else" }));
    expect(database.plan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "session-owner", active: true },
      }),
    );
    expect(database.workout.create.mock.calls[0][0].data.userId).toBe(
      "session-owner",
    );
  });

  it("marks the plan's next run day done by attaching the run to it", async () => {
    database.plan.findFirst.mockResolvedValue(activePlan);
    const result = await logRun(idle, form(RUN));
    expect(result).toMatchObject({ status: "saved", planDayName: "Easy run" });
    expect(database.workout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planId: 7,
          planDayId: 71,
          run: { create: expect.objectContaining({ type: "EASY" }) },
        }),
      }),
    );
  });

  it("leaves the plan day alone while a session is open on the plan", async () => {
    database.plan.findFirst.mockResolvedValue({
      ...activePlan,
      workouts: [{ id: 99 }],
    });
    const result = await logRun(idle, form(RUN));
    expect(result).toMatchObject({ status: "saved", planDayName: null });
    expect(database.workout.create.mock.calls[0][0].data).toMatchObject({
      planId: null,
      planDayId: null,
    });
  });

  it("leaves the plan day alone for a run from before the plan was made", async () => {
    database.plan.findFirst.mockResolvedValue(activePlan);
    await logRun(idle, form({ ...RUN, date: "2026-11-19" }));
    expect(database.workout.create.mock.calls[0][0].data.planDayId).toBeNull();
  });

  it("sends back what was typed with the reason, and saves nothing", async () => {
    const result = await logRun(idle, form({ ...RUN, duration: "31" }));
    expect(result).toEqual({
      status: "error",
      message: "Enter the time as h:mm:ss, for example 0:32:15.",
      values: { ...RUN, duration: "31" },
    });
    expect(database.workout.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a day after today in Toronto", async () => {
    const result = await logRun(idle, form({ ...RUN, date: "2026-11-25" }));
    expect(result).toMatchObject({
      status: "error",
      message: "That day hasn't happened yet.",
    });
  });

  it("says the run couldn't be saved when the database fails, and logs why", async () => {
    database.workout.create.mockRejectedValue(new Error("connection lost"));
    const result = await logRun(idle, form(RUN));
    expect(result).toEqual({
      status: "error",
      message: "Your run couldn't be saved right now. Try again.",
      values: RUN,
    });
    expect(logged).toHaveBeenCalledWith(
      "[run] saving failed",
      expect.objectContaining({ userId: "session-owner" }),
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("treats a missing field or a file as not given", async () => {
    const data = form({ ...RUN });
    data.delete("distanceKm");
    data.append("distanceKm", new File(["5"], "run.txt"));
    const result = await logRun(idle, data);
    expect(result).toMatchObject({
      status: "error",
      message: "Enter a distance between 0.1 and 300 km.",
    });
  });

  it("lets a signed-out user be redirected", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(logRun(idle, form(RUN))).rejects.toThrow("NEXT_REDIRECT");
    expect(database.workout.create).not.toHaveBeenCalled();
  });
});

describe("logRun units", () => {
  it("converts miles typed under a mile label to kilometres and shows the pace per mile", async () => {
    const result = await logRun(
      idle,
      form({
        ...RUN,
        distanceKm: "3.1",
        distanceUnit: "MI",
        duration: "0:30:00",
      }),
    );
    expect(result).toMatchObject({
      status: "saved",
      distanceKm: 4.99,
      pace: "9:41 /mi",
    });
    expect(database.workout.create.mock.calls[0][0].data.distanceKm).toBe(4.99);
  });

  it("refuses a unit that is not km or mi", async () => {
    const result = await logRun(idle, form({ ...RUN, distanceUnit: "ly" }));
    expect(result.status).toBe("error");
    expect(database.workout.create).not.toHaveBeenCalled();
  });
});
