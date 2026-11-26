// getRecentWorkouts (D43): the last 28 days of finished workouts, imported ones flagged, and
// every imported workout counted, so the coach can review an import. Invented data only.
import { describe, expect, it, vi } from "vitest";
import {
  getRecentWorkouts,
  recentWorkoutsResult,
  type RecentWorkout,
} from "./recentWorkouts";

const NOW = new Date("2026-11-26T17:00:00Z");

const set = (exerciseName: string, reps: number, weightKg: number | null) => ({
  exerciseName,
  reps,
  weightKg,
});

const WORKOUTS: RecentWorkout[] = [
  {
    source: "hevy-import",
    sets: [set("Bench Press", 5, 80), set("Bench Press", 5, 80)],
  },
  {
    source: "live",
    sets: [set("Back Squat", 5, 100), set("Bench Press", 8, 70)],
  },
  { source: "live", sets: [set("Pull Up", 10, null)] },
  { source: "manual-run", sets: [] },
];

const IMPORTS = {
  count: 412,
  first: new Date("2024-03-14T22:00:00Z"),
  last: new Date("2026-11-20T23:00:00Z"),
};

describe("recentWorkoutsResult (D43)", () => {
  it("counts workouts with imported ones flagged, sets, volume and the most-trained lifts", () => {
    const result = recentWorkoutsResult(WORKOUTS, IMPORTS, "KG", NOW);
    expect(result.name).toBe("getRecentWorkouts");
    expect(result.period).toBe("last 28 days (29 Oct 2026 to 26 Nov 2026)");
    expect(result.lines).toEqual([
      "Finished workouts: 4 (1 imported from Hevy, 3 logged in the app), 1 a week.",
      "Sets: 5. Volume: 1860 kg (weight x reps, weighted sets only).",
      "Most sets: Bench Press 3, Back Squat 1, Pull Up 1.",
      "Imported from Hevy, all time: 412 workouts, 14 Mar 2024 to 20 Nov 2026.",
    ]);
  });

  it("gives volume in pounds for a pound user", () => {
    const result = recentWorkoutsResult(WORKOUTS, IMPORTS, "LB", NOW);
    expect(result.lines[1]).toBe(
      "Sets: 5. Volume: 4101 lb (weight x reps, weighted sets only).",
    );
  });

  it("says when nothing is logged or imported", () => {
    const result = recentWorkoutsResult(
      [],
      { count: 0, first: null, last: null },
      "KG",
      NOW,
    );
    expect(result.lines).toEqual([
      "No finished workouts in this period.",
      "No workouts imported from Hevy.",
    ]);
  });
});

describe("getRecentWorkouts (D43)", () => {
  it("reads only the signed-in user's finished workouts", async () => {
    const findMany = vi.fn(async () => [
      {
        source: "live",
        sets: [{ reps: 5, weightKg: "60", exercise: { name: "Bench Press" } }],
      },
    ]);
    const aggregate = vi.fn(async () => ({
      _count: { _all: 0 },
      _min: { startedAt: null },
      _max: { startedAt: null },
    }));
    const db = { workout: { findMany, aggregate } } as unknown as Parameters<
      typeof getRecentWorkouts
    >[0];

    const result = await getRecentWorkouts(db, "owner", "KG", NOW);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "owner",
          finishedAt: { not: null },
          startedAt: { gte: new Date("2026-10-29T17:00:00Z"), lte: NOW },
        },
      }),
    );
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "owner",
          finishedAt: { not: null },
          source: "hevy-import",
        },
      }),
    );
    expect(result.lines[1]).toBe(
      "Sets: 1. Volume: 300 kg (weight x reps, weighted sets only).",
    );
  });
});
