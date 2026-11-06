import { describe, expect, it } from "vitest";
import { buildHybridWeek, interleave, splitDays } from "./hybridWeek";
import { verifyPlan, type LibraryExercise } from "./verify";
import { verifyRunningPlan } from "./verifyRunning";
import type { HybridProfile } from "./hybridWeek";

// One body-only exercise per muscle the starter splits ask for.
const MUSCLES = [
  "quadriceps",
  "chest",
  "middle back",
  "shoulders",
  "triceps",
  "hamstrings",
  "glutes",
  "abdominals",
  "lats",
  "biceps",
];
const library: LibraryExercise[] = MUSCLES.map((m) => ({
  id: m.replace(" ", "_"),
  equipment: "body only",
  primaryMuscles: [m],
  secondaryMuscles: [],
}));

const base: HybridProfile = {
  daysPerWeek: 5,
  goal: "GENERAL_FITNESS",
  trainingMode: "BOTH",
  equipment: [],
  avoidMuscles: [],
  activityLevel: "ACTIVE",
  lastWeekKm: 20,
  easyPaceSecPerKm: 360,
};

describe("splitDays", () => {
  it.each([
    // days, goal, mode, strength, run
    [5, "STRENGTH", "BOTH", 3, 2],
    [5, "MUSCLE", "BOTH", 3, 2],
    [5, "FAT_LOSS", "BOTH", 2, 3],
    [6, "FAT_LOSS", "BOTH", 2, 4],
    [4, "GENERAL_FITNESS", "BOTH", 2, 2],
    [5, "GENERAL_FITNESS", "BOTH", 3, 2],
    [7, "MUSCLE", "BOTH", 5, 2],
    [4, "STRENGTH", "GYM", 4, 0],
    [2, "GENERAL_FITNESS", "RUNNING", 0, 2],
    [3, "GENERAL_FITNESS", "RUNNING", 1, 2],
    [5, "FAT_LOSS", "RUNNING", 2, 3],
    [7, "GENERAL_FITNESS", "RUNNING", 2, 5],
    [2, "STRENGTH", "BOTH", 1, 1],
    [2, "MUSCLE", "BOTH", 1, 1],
    [1, "FAT_LOSS", "BOTH", 0, 1],
    [1, "STRENGTH", "BOTH", 1, 0],
  ] as const)(
    "%i days, %s, %s: %i strength and %i run",
    (days, goal, mode, strengthDays, runDays) => {
      expect(splitDays(days, goal, mode)).toEqual({ strengthDays, runDays });
    },
  );

  it("never gives more than five run days or more days than asked", () => {
    for (const mode of ["GYM", "RUNNING", "BOTH"] as const)
      for (const goal of [
        "STRENGTH",
        "MUSCLE",
        "FAT_LOSS",
        "GENERAL_FITNESS",
      ] as const)
        for (let days = 1; days <= 7; days++) {
          const s = splitDays(days, goal, mode);
          expect(s.runDays).toBeLessThanOrEqual(5);
          expect(s.strengthDays + s.runDays).toBe(days);
          // A hybrid week of two or more days always has at least one of each.
          if (mode === "BOTH" && days >= 2) {
            expect(s.strengthDays).toBeGreaterThanOrEqual(1);
            expect(s.runDays).toBeGreaterThanOrEqual(1);
          }
        }
  });
});

describe("buildHybridWeek", () => {
  it("passes both verifiers for every goal, mode and day count", () => {
    for (const trainingMode of ["GYM", "RUNNING", "BOTH"] as const)
      for (const goal of [
        "STRENGTH",
        "MUSCLE",
        "FAT_LOSS",
        "GENERAL_FITNESS",
      ] as const)
        for (let daysPerWeek = 1; daysPerWeek <= 7; daysPerWeek++) {
          const profile = { ...base, goal, trainingMode, daysPerWeek };
          const week = buildHybridWeek(profile, library);
          const strength = week.days.filter((d) => d.kind === "STRENGTH");
          const runs = week.days.filter((d) => d.kind === "RUN");
          expect(week.days.length).toBeLessThanOrEqual(daysPerWeek);
          if (strength.length > 0) {
            const plan = { name: week.name, days: strength };
            const result = verifyPlan(
              plan,
              { ...profile, daysPerWeek: strength.length },
              new Map(library.map((e) => [e.id, e])),
            );
            expect(result.ok).toBe(true);
          }
          if (runs.length > 0) {
            const result = verifyRunningPlan(
              { name: week.name, days: runs },
              { ...profile, runDaysPerWeek: runs.length },
            );
            expect(result.ok).toBe(true);
          }
        }
  });

  it("alternates a 3 and 2 week and keeps the long run last among runs", () => {
    const week = buildHybridWeek(base, library);
    expect(week.name).toBe("3 strength and 2 run days");
    expect(week.days.map((d) => d.kind)).toEqual([
      "STRENGTH",
      "RUN",
      "STRENGTH",
      "RUN",
      "STRENGTH",
    ]);
    const runs = week.days.filter((d) => d.kind === "RUN");
    expect(runs.at(-1)).toMatchObject({ run: { type: "LONG" } });
  });

  it("gives a fat-loss runner two strength days for injury prevention", () => {
    const week = buildHybridWeek(
      { ...base, goal: "FAT_LOSS", daysPerWeek: 6 },
      library,
    );
    expect(week.days.filter((d) => d.kind === "STRENGTH")).toHaveLength(2);
  });
});

describe("interleave", () => {
  it("spreads the shorter list through the longer one", () => {
    expect(interleave(["S", "S"], ["R", "R", "R", "R"]).join("")).toBe(
      "RSRRSR",
    );
  });
});
