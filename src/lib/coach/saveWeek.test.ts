import { describe, expect, it } from "vitest";
import { buildHybridWeek, type HybridProfile } from "./hybridWeek";
import { weekToPlanData } from "./saveWeek";
import type { LibraryExercise } from "./verify";

const library: LibraryExercise[] = [
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
].map((m) => ({
  id: m.replace(" ", "_"),
  equipment: "body only",
  primaryMuscles: [m],
  secondaryMuscles: [],
}));

const profile: HybridProfile = {
  daysPerWeek: 5,
  goal: "GENERAL_FITNESS",
  trainingMode: "BOTH",
  equipment: [],
  avoidMuscles: [],
  activityLevel: "ACTIVE",
  lastWeekKm: 20,
  easyPaceSecPerKm: 360,
};

type DayInput = {
  dayIndex: number;
  kind: string;
  exercises?: { create: { order: number }[] };
  run?: { create: { type: string; distanceKm: number } };
};

describe("weekToPlanData", () => {
  const week = buildHybridWeek(profile, library);
  const data = weekToPlanData("user-1", week, "DEFAULT");
  const days = (data.days as { create: DayInput[] }).create;

  it("makes one active plan for the user with every day in order", () => {
    expect(data).toMatchObject({
      userId: "user-1",
      name: week.name,
      source: "DEFAULT",
      active: true,
    });
    expect(days.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("gives strength days ordered exercises and run days one run", () => {
    expect(days.map((d) => d.kind)).toEqual([
      "STRENGTH",
      "RUN",
      "STRENGTH",
      "RUN",
      "STRENGTH",
    ]);
    for (const d of days) {
      if (d.kind === "RUN") {
        expect(d.exercises).toBeUndefined();
        expect(d.run?.create.distanceKm).toBeGreaterThan(0);
      } else {
        expect(d.run).toBeUndefined();
        expect(d.exercises?.create.map((e) => e.order)).toEqual(
          d.exercises?.create.map((_, i) => i),
        );
      }
    }
    expect(days.at(-2)?.run?.create.type).toBe("LONG");
  });
});
