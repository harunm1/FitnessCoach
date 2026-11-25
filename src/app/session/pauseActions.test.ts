// Tests for pausing and resuming the workout clock, and for the active duration stored at
// Finish (D37). The user comes from the session, the open workout is the user's own, and a
// backdated idle pause can neither reach before the running stretch nor into the future.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, revalidatePath, redirect, database } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  database: {
    workout: { findFirst: vi.fn(), updateMany: vi.fn() },
    setLog: { findFirst: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
import { finishWorkout } from "./actions";
import { pauseWorkoutClock, resumeWorkoutClock } from "./pauseActions";

const NOW = Date.parse("2026-11-25T18:00:00.000Z");
const MINUTE_MS = 60_000;
const STARTED = NOW - 50 * MINUTE_MS;
const TEN_MINUTES_AGO = NOW - 10 * MINUTE_MS;
const THIRTY_SECONDS_AGO = NOW - 30_000;
const TWENTY_MINUTES_AGO = NOW - 20 * MINUTE_MS;
const FUTURE = NOW + 30 * MINUTE_MS;
const BANKED = 120;
const TEN_MINUTE_SECONDS = 600;
const FORTY_MINUTE_SECONDS = 2400;
const FIFTY_MINUTE_SECONDS = 3000;
const THIRTY_SECONDS = 30;
const FORTY_MINUTES_AGO = NOW - 40 * MINUTE_MS;
const OPEN_ID = 77;

type OpenWorkout = {
  id: number;
  activeBankedSeconds: number;
  activeSince: Date | null;
  durationSeconds: number | null;
};

function open(overrides: Partial<OpenWorkout> = {}): OpenWorkout {
  return {
    id: OPEN_ID,
    activeBankedSeconds: 0,
    activeSince: new Date(STARTED),
    durationSeconds: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  requireUser.mockResolvedValue({ id: "session-owner" });
  database.workout.findFirst.mockResolvedValue(open());
  database.workout.updateMany.mockResolvedValue({ count: 1 });
  database.setLog.findFirst.mockResolvedValue(null);
});

describe("pauseWorkoutClock", () => {
  it("banks the active time and stops the clock at the requested last activity", async () => {
    const result = await pauseWorkoutClock(
      new Date(TEN_MINUTES_AGO).toISOString(),
    );
    expect(result).toEqual({
      status: "ok",
      bankedSeconds: FORTY_MINUTE_SECONDS,
      activeSinceIso: null,
    });
    const update = database.workout.updateMany.mock.calls[0][0];
    expect(update.data).toEqual({
      activeBankedSeconds: FORTY_MINUTE_SECONDS,
      activeSince: null,
    });
    // The clock holds its own state; a re-render would remount it and lose the idle notice.
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("only touches the signed-in user's open workout", async () => {
    await pauseWorkoutClock(new Date(TEN_MINUTES_AGO).toISOString());
    expect(database.workout.findFirst.mock.calls[0][0].where).toMatchObject({
      userId: "session-owner",
      finishedAt: null,
    });
    // Compare and set on the stretch that was read, so two tabs pausing together bank once.
    expect(database.workout.updateMany.mock.calls[0][0].where).toMatchObject({
      id: OPEN_ID,
      userId: "session-owner",
      finishedAt: null,
      activeSince: new Date(STARTED),
    });
  });

  it("refuses a pause time before the newest logged set (another device logged it)", async () => {
    database.setLog.findFirst.mockResolvedValue({
      loggedAt: new Date(TWENTY_MINUTES_AGO),
    });
    const result = await pauseWorkoutClock(new Date(STARTED).toISOString());
    expect(result).toMatchObject({
      status: "ok",
      bankedSeconds: FORTY_MINUTE_SECONDS - TEN_MINUTE_SECONDS,
    });
  });

  it("cannot pause in the future", async () => {
    const result = await pauseWorkoutClock(new Date(FUTURE).toISOString());
    expect(result).toMatchObject({
      status: "ok",
      bankedSeconds: FIFTY_MINUTE_SECONDS,
    });
  });

  it("rejects a time that is not an ISO date and changes nothing", async () => {
    const result = await pauseWorkoutClock("not a date");
    expect(result.status).toBe("error");
    expect(database.workout.updateMany).not.toHaveBeenCalled();
  });

  it("is a no-op for an already paused workout and reports its state", async () => {
    database.workout.findFirst.mockResolvedValue(
      open({ activeBankedSeconds: BANKED, activeSince: null }),
    );
    const result = await pauseWorkoutClock(
      new Date(TEN_MINUTES_AGO).toISOString(),
    );
    expect(result).toEqual({
      status: "ok",
      bankedSeconds: BANKED,
      activeSinceIso: null,
    });
    expect(database.workout.updateMany).not.toHaveBeenCalled();
  });

  it("reports the current state when another tab paused first (compare and set)", async () => {
    database.workout.updateMany.mockResolvedValue({ count: 0 });
    database.workout.findFirst
      .mockResolvedValueOnce(open())
      .mockResolvedValueOnce(
        open({ activeBankedSeconds: BANKED, activeSince: null }),
      );
    const result = await pauseWorkoutClock(
      new Date(TEN_MINUTES_AGO).toISOString(),
    );
    expect(result).toEqual({
      status: "ok",
      bankedSeconds: BANKED,
      activeSinceIso: null,
    });
  });

  it("says so when there is no open workout", async () => {
    database.workout.findFirst.mockResolvedValue(null);
    const result = await pauseWorkoutClock(
      new Date(TEN_MINUTES_AGO).toISOString(),
    );
    expect(result.status).toBe("error");
    expect(database.workout.updateMany).not.toHaveBeenCalled();
  });
});

describe("resumeWorkoutClock", () => {
  const paused = () => open({ activeBankedSeconds: BANKED, activeSince: null });

  it("starts a new running stretch now and keeps the banked time", async () => {
    database.workout.findFirst.mockResolvedValue(paused());
    const result = await resumeWorkoutClock();
    expect(result).toEqual({
      status: "ok",
      bankedSeconds: BANKED,
      activeSinceIso: new Date(NOW).toISOString(),
    });
    expect(database.workout.updateMany.mock.calls[0][0].where).toMatchObject({
      id: OPEN_ID,
      userId: "session-owner",
      finishedAt: null,
      activeSince: null,
    });
  });

  it("is a no-op for a workout that is already running", async () => {
    const result = await resumeWorkoutClock();
    expect(result).toMatchObject({ status: "ok", bankedSeconds: 0 });
    expect(database.workout.updateMany).not.toHaveBeenCalled();
  });
});

describe("finishWorkout stores the active time", () => {
  async function finish() {
    await expect(finishWorkout()).rejects.toThrow("NEXT_REDIRECT");
    return database.workout.updateMany.mock.calls[0][0];
  }

  it("saves the active seconds as the duration, banked time included", async () => {
    database.workout.findFirst.mockResolvedValue(
      open({
        activeBankedSeconds: FORTY_MINUTE_SECONDS,
        activeSince: new Date(THIRTY_SECONDS_AGO),
      }),
    );
    database.setLog.findFirst.mockResolvedValue({
      loggedAt: new Date(THIRTY_SECONDS_AGO),
    });
    const update = await finish();
    expect(update.data).toMatchObject({
      finishedAt: new Date(NOW),
      activeSince: null,
      durationSeconds: FORTY_MINUTE_SECONDS + THIRTY_SECONDS,
      activeBankedSeconds: FORTY_MINUTE_SECONDS + THIRTY_SECONDS,
    });
  });

  it("a workout left running for hours ends at its last set, not at Finish", async () => {
    // Started 50 minutes ago, last set 40 minutes ago: 10 minutes of workout.
    database.setLog.findFirst.mockResolvedValue({
      loggedAt: new Date(FORTY_MINUTES_AGO),
    });
    const update = await finish();
    expect(update.data.durationSeconds).toBe(TEN_MINUTE_SECONDS);
  });

  it("finishing while paused keeps exactly the banked time", async () => {
    database.workout.findFirst.mockResolvedValue(
      open({ activeBankedSeconds: FORTY_MINUTE_SECONDS, activeSince: null }),
    );
    const update = await finish();
    expect(update.data.durationSeconds).toBe(FORTY_MINUTE_SECONDS);
  });

  it("only finishes the stretch it read (a pause from another tab in between wins)", async () => {
    const update = await finish();
    expect(update.where).toMatchObject({
      id: OPEN_ID,
      userId: "session-owner",
      finishedAt: null,
      activeSince: new Date(STARTED),
    });
  });

  it("tries once more when another tab changed the clock between the read and the write", async () => {
    database.workout.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    database.workout.findFirst
      .mockResolvedValueOnce(open())
      .mockResolvedValueOnce(
        open({ activeBankedSeconds: FORTY_MINUTE_SECONDS, activeSince: null }),
      );
    await expect(finishWorkout()).rejects.toThrow("NEXT_REDIRECT");
    expect(database.workout.updateMany).toHaveBeenCalledTimes(2);
    expect(
      database.workout.updateMany.mock.calls[1][0].data.durationSeconds,
    ).toBe(FORTY_MINUTE_SECONDS);
  });

  it("keeps a run's own recorded time", async () => {
    database.workout.findFirst.mockResolvedValue(
      open({ durationSeconds: TEN_MINUTE_SECONDS }),
    );
    const update = await finish();
    expect(update.data).not.toHaveProperty("durationSeconds");
    expect(update.data.finishedAt).toEqual(new Date(NOW));
  });
});
