import { describe, expect, it } from "vitest";
import { buildMonthlyReport, type ReportSet } from "./summary";

const BENCH = "bench";
const SQUAT = "squat";
const RUN = "jog";
const LIGHT = 60;
const HEAVY = 100;
const NEW_BEST = 110;
const OLD_BEST = 105;
const REPS_LOW = 3;
const REPS_MID = 5;
const REPS_HIGH = 8;
const SESSIONS = 4;
const TWO = 2;

function set(overrides: Partial<ReportSet> = {}): ReportSet {
  return {
    exerciseId: BENCH,
    exerciseName: "Bench Press",
    primaryMuscles: ["chest"],
    weightKg: LIGHT,
    reps: REPS_MID,
    ...overrides,
  };
}

const build = (sets: ReportSet[], priorBestKg: Record<string, number> = {}) =>
  buildMonthlyReport({
    month: "2026-11",
    sessions: SESSIONS,
    sets,
    priorBestKg,
  });

describe("buildMonthlyReport", () => {
  it("carries the month and the number of sessions", () => {
    expect(build([])).toMatchObject({
      month: "2026-11",
      sessions: SESSIONS,
      totalSets: 0,
      muscles: [],
      personalBests: [],
    });
  });

  it("counts every set, with or without a muscle", () => {
    const report = build([set(), set(), set({ primaryMuscles: [] })]);
    expect(report.totalSets).toBe(REPS_LOW);
  });

  it("adds up sets and volume (weight times reps) per primary muscle", () => {
    const report = build([
      set({ weightKg: LIGHT, reps: REPS_MID }),
      set({ weightKg: HEAVY, reps: REPS_LOW }),
    ]);
    expect(report.muscles).toEqual([
      {
        muscle: "chest",
        sets: TWO,
        volumeKg: LIGHT * REPS_MID + HEAVY * REPS_LOW,
      },
    ]);
  });

  it("gives each primary muscle of a set the whole set", () => {
    const report = build([
      set({ primaryMuscles: ["chest", "triceps"], weightKg: HEAVY, reps: 1 }),
    ]);
    expect(report.muscles.map((m) => [m.muscle, m.sets, m.volumeKg])).toEqual([
      ["chest", 1, HEAVY],
      ["triceps", 1, HEAVY],
    ]);
  });

  it("counts a bodyweight set with no volume", () => {
    const report = build([set({ weightKg: null })]);
    expect(report.muscles[0]).toMatchObject({ sets: 1, volumeKg: 0 });
  });

  it("lists the muscle with the most volume first, ties by name", () => {
    const report = build([
      set({ primaryMuscles: ["calves"], weightKg: LIGHT, reps: 1 }),
      set({ primaryMuscles: ["abs"], weightKg: LIGHT, reps: 1 }),
      set({ primaryMuscles: ["quads"], weightKg: HEAVY, reps: REPS_MID }),
    ]);
    expect(report.muscles.map((m) => m.muscle)).toEqual([
      "quads",
      "abs",
      "calves",
    ]);
  });

  describe("personal bests", () => {
    it("is a best when the month's heaviest set beats everything before it", () => {
      const report = build(
        [
          set({ weightKg: NEW_BEST, reps: REPS_LOW }),
          set({ weightKg: NEW_BEST, reps: REPS_HIGH }),
          set({ weightKg: LIGHT }),
        ],
        { [BENCH]: OLD_BEST },
      );
      expect(report.personalBests).toEqual([
        {
          exerciseName: "Bench Press",
          weightKg: NEW_BEST,
          reps: REPS_HIGH,
          previousKg: OLD_BEST,
        },
      ]);
    });

    it("is not a best when it only ties the old best", () => {
      expect(
        build([set({ weightKg: OLD_BEST })], { [BENCH]: OLD_BEST })
          .personalBests,
      ).toEqual([]);
    });

    it("is not a best when there is no earlier history to beat", () => {
      expect(build([set({ weightKg: NEW_BEST })]).personalBests).toEqual([]);
    });

    it("ignores bodyweight sets and lists the bests by exercise name", () => {
      const report = build(
        [
          set({ exerciseId: SQUAT, exerciseName: "Squat", weightKg: NEW_BEST }),
          set({ weightKg: NEW_BEST }),
          set({ exerciseId: RUN, exerciseName: "Jog", weightKg: null }),
        ],
        { [BENCH]: OLD_BEST, [SQUAT]: OLD_BEST, [RUN]: 1 },
      );
      expect(report.personalBests.map((best) => best.exerciseName)).toEqual([
        "Bench Press",
        "Squat",
      ]);
    });
  });
});
