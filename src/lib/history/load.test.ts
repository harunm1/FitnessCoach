import { beforeEach, describe, expect, it, vi } from "vitest";

const { workout, setLog } = vi.hoisted(() => ({
  workout: { findMany: vi.fn(), findFirst: vi.fn() },
  setLog: { findMany: vi.fn(), groupBy: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { workout, setLog } }));
import {
  EXERCISE_SET_LIMIT,
  loadExerciseHistory,
  loadHistoryPage,
  loadWorkoutDetail,
} from "./load";
import { PAGE_SIZE } from "./params";

const decimal = (value: string) => ({ toString: () => value });
const start = new Date("2026-11-08T17:00:00Z");
const end = new Date("2026-11-08T17:50:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  workout.findMany.mockResolvedValue([]);
  workout.findFirst.mockResolvedValue(null);
  setLog.findMany.mockResolvedValue([]);
  setLog.groupBy.mockResolvedValue([]);
});

describe("loadHistoryPage", () => {
  it("reads only this user's finished workouts, newest first, one page at a time", async () => {
    await loadHistoryPage("session-owner", 3);
    expect(workout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "session-owner", finishedAt: { not: null } },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        skip: 2 * PAGE_SIZE,
        take: PAGE_SIZE + 1,
      }),
    );
  });

  it("leaves a workout open for 18 hours untimed instead of showing 1120 minutes (B1)", async () => {
    const longEnd = new Date(start.getTime() + 1120 * 60_000);
    workout.findMany.mockResolvedValue([
      {
        id: 3,
        startedAt: start,
        finishedAt: longEnd,
        source: "live",
        notes: null,
        distanceKm: null,
        durationSeconds: null,
        planDay: { name: "Lower body" },
        _count: { sets: 0 },
      },
      {
        id: 2,
        startedAt: start,
        finishedAt: longEnd,
        source: "manual-run",
        notes: null,
        distanceKm: decimal("5.00"),
        durationSeconds: 1800,
        planDay: { name: "Easy run" },
        _count: { sets: 0 },
      },
    ]);
    const page = await loadHistoryPage("session-owner", 1);
    expect(page.rows.map((r) => r.minutes)).toEqual([null, 30]);
  });

  it("counts sets in the query instead of loading them", async () => {
    await loadHistoryPage("session-owner", 1);
    const { select } = workout.findMany.mock.calls[0][0];
    expect(select._count).toEqual({ select: { sets: true } });
    expect(select.sets).toBeUndefined();
  });

  it("turns rows into list entries and says whether a next page exists", async () => {
    const row = (id: number, extra: object = {}) => ({
      id,
      startedAt: start,
      finishedAt: end,
      source: "live",
      notes: null,
      distanceKm: null,
      durationSeconds: null,
      planDay: { name: "Push" },
      _count: { sets: 12 },
      ...extra,
    });
    workout.findMany.mockResolvedValue([
      row(9),
      row(8, { source: "hevy-import", notes: "Leg day", planDay: null }),
      ...Array.from({ length: PAGE_SIZE - 1 }, (_, i) => row(7 - i)),
    ]);
    const page = await loadHistoryPage("session-owner", 1);
    expect(page.hasNext).toBe(true);
    expect(page.rows).toHaveLength(PAGE_SIZE);
    expect(page.rows[0]).toEqual({
      id: 9,
      name: "Push",
      startedAt: start,
      minutes: 50,
      sets: 12,
      imported: false,
    });
    expect(page.rows[1]).toMatchObject({ name: "Leg day", imported: true });
  });

  it("has no next page when the extra row is missing", async () => {
    expect((await loadHistoryPage("session-owner", 1)).hasNext).toBe(false);
  });
});

describe("loadWorkoutDetail", () => {
  it("looks the workout up by id and owner together, finished only", async () => {
    await loadWorkoutDetail("session-owner", 41);
    expect(workout.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 41, userId: "session-owner", finishedAt: { not: null } },
      }),
    );
  });

  it("breaks ties in logged time by row id, so imported sets keep the file's order", async () => {
    await loadWorkoutDetail("session-owner", 41);
    const { select } = workout.findFirst.mock.calls[0][0];
    expect(select.sets.orderBy).toEqual([
      { loggedAt: "asc" },
      { setNumber: "asc" },
      { id: "asc" },
    ]);
  });

  it("returns null when the user does not own it (the page answers 404)", async () => {
    expect(await loadWorkoutDetail("someone-else", 41)).toBeNull();
  });

  it("groups sets by exercise in logged order, with reps, kg, RPE and the run", async () => {
    workout.findFirst.mockResolvedValue({
      id: 41,
      startedAt: start,
      finishedAt: end,
      source: "live",
      notes: "Felt strong",
      distanceKm: decimal("5.00"),
      durationSeconds: 1800,
      planDay: { name: "Push" },
      run: { rpe: 7 },
      sets: [
        {
          setNumber: 2,
          reps: 8,
          weightKg: decimal("62.50"),
          rpe: 9,
          exercise: { id: "Bench", name: "Bench Press" },
        },
        {
          setNumber: 1,
          reps: 12,
          weightKg: null,
          rpe: null,
          exercise: { id: "Pushups", name: "Push-up" },
        },
        {
          setNumber: 1,
          reps: 10,
          weightKg: decimal("60.00"),
          rpe: null,
          exercise: { id: "Bench", name: "Bench Press" },
        },
      ],
    });
    expect(await loadWorkoutDetail("session-owner", 41)).toEqual({
      id: 41,
      name: "Push",
      startedAt: start,
      // The run's own recorded 30 minutes, not the 50 between Start and Finish (B1).
      minutes: 30,
      imported: false,
      notes: "Felt strong",
      run: { distanceKm: 5, seconds: 1800, rpe: 7 },
      // 10 x 60 + 8 x 62.5 (the push-up set has no weight).
      volumeKg: 1100,
      recordExerciseIds: [],
      exercises: [
        {
          id: "Bench",
          name: "Bench Press",
          sets: [
            { setNumber: 1, reps: 10, weightKg: 60, rpe: null },
            { setNumber: 2, reps: 8, weightKg: 62.5, rpe: 9 },
          ],
        },
        {
          id: "Pushups",
          name: "Push-up",
          sets: [{ setNumber: 1, reps: 12, weightKg: null, rpe: null }],
        },
      ],
    });
  });

  // Live bug L5: a record is a top weight above everything this user lifted in earlier
  // workouts, so the lookup is by user, before this workout's start.
  it("marks an exercise as a record when its top weight beats the earlier best", async () => {
    workout.findFirst.mockResolvedValue({
      id: 41,
      startedAt: start,
      finishedAt: end,
      source: "live",
      notes: null,
      distanceKm: null,
      durationSeconds: null,
      planDay: { name: "Push" },
      run: null,
      sets: [
        {
          setNumber: 1,
          reps: 5,
          weightKg: decimal("70.00"),
          rpe: null,
          exercise: { id: "Bench", name: "Bench Press" },
        },
        {
          setNumber: 1,
          reps: 5,
          weightKg: decimal("50.00"),
          rpe: null,
          exercise: { id: "Row", name: "Row" },
        },
      ],
    });
    setLog.groupBy.mockResolvedValue([
      { exerciseId: "Bench", _max: { weightKg: decimal("65.00") } },
      { exerciseId: "Row", _max: { weightKg: decimal("55.00") } },
    ]);
    const detail = await loadWorkoutDetail("session-owner", 41);
    expect(detail?.recordExerciseIds).toEqual(["Bench"]);
    expect(setLog.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["exerciseId"],
        where: {
          exerciseId: { in: ["Bench", "Row"] },
          workout: {
            userId: "session-owner",
            finishedAt: { not: null },
            startedAt: { lt: start },
          },
        },
      }),
    );
  });

  it("shows an imported workout's title as its name, not as notes", async () => {
    workout.findFirst.mockResolvedValue({
      id: 7,
      startedAt: start,
      finishedAt: end,
      source: "hevy-import",
      notes: "Leg day",
      distanceKm: null,
      durationSeconds: null,
      planDay: null,
      run: null,
      sets: [],
    });
    expect(await loadWorkoutDetail("session-owner", 7)).toMatchObject({
      name: "Leg day",
      notes: null,
      imported: true,
      run: null,
    });
  });
});

describe("loadExerciseHistory", () => {
  it("reads one exercise's sets from this user's finished workouts only", async () => {
    await loadExerciseHistory("session-owner", "Bench");
    expect(setLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          exerciseId: "Bench",
          workout: { userId: "session-owner", finishedAt: { not: null } },
        },
        take: EXERCISE_SET_LIMIT + 1,
      }),
    );
  });

  it("orders sets newest workout first with a stable tie-break", async () => {
    await loadExerciseHistory("session-owner", "Bench");
    expect(setLog.findMany.mock.calls[0][0].orderBy).toEqual([
      { workout: { startedAt: "desc" } },
      { workoutId: "desc" },
      { setNumber: "asc" },
      { id: "asc" },
    ]);
  });

  it("drops a workout cut by the set limit and says older ones are hidden", async () => {
    const at = (day: number) => new Date(Date.UTC(2026, 10, day, 17));
    const rows = Array.from({ length: EXERCISE_SET_LIMIT + 1 }, (_, i) => ({
      setNumber: (i % 2) + 1,
      reps: 5,
      weightKg: decimal("60.00"),
      rpe: null,
      // Two sets a workout.
      workout: { id: 1000 - Math.floor(i / 2), startedAt: at(1) },
      exercise: { name: "Bench Press" },
    }));
    // The last three sets read belong to workout 1; the third is past the limit.
    rows[EXERCISE_SET_LIMIT - 2].workout = { id: 1, startedAt: at(1) };
    rows[EXERCISE_SET_LIMIT - 1].workout = { id: 1, startedAt: at(1) };
    rows[EXERCISE_SET_LIMIT].workout = { id: 1, startedAt: at(1) };
    setLog.findMany.mockResolvedValue(rows);
    const history = await loadExerciseHistory("session-owner", "Bench");
    expect(history?.olderHidden).toBe(true);
    expect(history?.workouts.map((entry) => entry.workoutId)).not.toContain(1);
    expect(history?.workouts.every((entry) => entry.sets.length === 2)).toBe(
      true,
    );
  });

  it("hides nothing when the user has exactly the limit of sets", async () => {
    const rows = Array.from({ length: EXERCISE_SET_LIMIT }, (_, i) => ({
      setNumber: 1,
      reps: 5,
      weightKg: decimal("60.00"),
      rpe: null,
      workout: { id: EXERCISE_SET_LIMIT - i, startedAt: start },
      exercise: { name: "Bench Press" },
    }));
    setLog.findMany.mockResolvedValue(rows);
    const history = await loadExerciseHistory("session-owner", "Bench");
    expect(history?.olderHidden).toBe(false);
    expect(history?.workouts).toHaveLength(EXERCISE_SET_LIMIT);
  });

  it("keeps a single workout cut by the limit, and still says sets are hidden", async () => {
    const rows = Array.from({ length: EXERCISE_SET_LIMIT + 1 }, (_, i) => ({
      setNumber: i + 1,
      reps: 5,
      weightKg: decimal("60.00"),
      rpe: null,
      workout: { id: 7, startedAt: start },
      exercise: { name: "Bench Press" },
    }));
    setLog.findMany.mockResolvedValue(rows);
    const history = await loadExerciseHistory("session-owner", "Bench");
    expect(history?.olderHidden).toBe(true);
    expect(history?.workouts[0].sets).toHaveLength(EXERCISE_SET_LIMIT);
  });

  it("returns null when the user never logged it (the page answers 404)", async () => {
    expect(await loadExerciseHistory("session-owner", "Bench")).toBeNull();
  });

  it("groups the sets by workout, newest workout first", async () => {
    const older = new Date("2026-11-01T17:00:00Z");
    const set = (
      workoutId: number,
      at: Date,
      setNumber: number,
      kg: string,
    ) => ({
      setNumber,
      reps: 5,
      weightKg: decimal(kg),
      rpe: null,
      workout: { id: workoutId, startedAt: at },
      exercise: { name: "Bench Press" },
    });
    setLog.findMany.mockResolvedValue([
      set(41, start, 1, "60.00"),
      set(41, start, 2, "65.00"),
      set(30, older, 1, "55.00"),
    ]);
    expect(await loadExerciseHistory("session-owner", "Bench")).toEqual({
      id: "Bench",
      name: "Bench Press",
      olderHidden: false,
      workouts: [
        {
          workoutId: 41,
          startedAt: start,
          sets: [
            { setNumber: 1, reps: 5, weightKg: 60, rpe: null },
            { setNumber: 2, reps: 5, weightKg: 65, rpe: null },
          ],
        },
        {
          workoutId: 30,
          startedAt: older,
          sets: [{ setNumber: 1, reps: 5, weightKg: 55, rpe: null }],
        },
      ],
    });
  });
});
