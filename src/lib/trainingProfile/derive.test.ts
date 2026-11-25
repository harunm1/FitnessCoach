import { describe, expect, it } from "vitest";
import { deriveTrainingProfile } from "./derive";
import { NOW, daysAgo, historySet, weeklyStarts } from "./fixtures";

// Monday, Wednesday, Friday at 18:00 UTC.
const MWF = [1, 3, 5];

describe("deriveTrainingProfile (D34, synthetic history)", () => {
  it("reads a nine-month, three-a-week history as intermediate", () => {
    const starts = weeklyStarts(40, MWF, 18);
    const profile = deriveTrainingProfile(starts, [], NOW, "UTC");
    expect(profile.workoutCount).toBe(starts.length);
    expect(profile.trainingSince).toEqual(starts[0]);
    expect(profile.workoutsPerWeek).toBeCloseTo(3, 0);
    expect(profile.usualHour).toBe(18);
    expect(profile.level).toBe("INTERMEDIATE");
  });

  it("reads a three-year, three-a-week history as expert", () => {
    const starts = weeklyStarts(150, MWF, 18);
    expect(deriveTrainingProfile(starts, [], NOW, "UTC").level).toBe("EXPERT");
  });

  it("reads ten weeks of history as beginner", () => {
    const starts = weeklyStarts(10, MWF, 18);
    expect(deriveTrainingProfile(starts, [], NOW, "UTC").level).toBe(
      "BEGINNER",
    );
  });

  it("falls back to beginner after a long lay-off, whatever the old history", () => {
    // Three years of training that stopped four months ago.
    const old = weeklyStarts(150, MWF, 18).filter((s) => s < daysAgo(120));
    const profile = deriveTrainingProfile(old, [], NOW, "UTC");
    expect(profile.level).toBe("BEGINNER");
    expect(profile.workoutsPerWeek).toBe(0);
    expect(profile.usualHour).toBeNull();
  });

  it("is empty for no history", () => {
    expect(deriveTrainingProfile([], [], NOW, "UTC")).toEqual({
      workoutCount: 0,
      trainingSince: null,
      workoutsPerWeek: 0,
      usualHour: null,
      level: "BEGINNER",
      equipment: [],
      workingWeights: [],
    });
  });

  it("lists the equipment used on at least two recent sets, most used first", () => {
    const sets = [
      ...Array.from({ length: 6 }, () => historySet({ equipment: "barbell" })),
      ...Array.from({ length: 3 }, () =>
        historySet({ exerciseId: "curl", equipment: "dumbbell" }),
      ),
      historySet({ exerciseId: "swing", equipment: "kettlebells" }),
      historySet({ exerciseId: "plank", equipment: null }),
      historySet({ equipment: "cable", startedAt: daysAgo(90) }),
      historySet({ equipment: "cable", startedAt: daysAgo(91) }),
    ];
    const profile = deriveTrainingProfile(weeklyStarts(40, MWF, 18), sets, NOW);
    expect(profile.equipment).toEqual(["barbell", "dumbbell"]);
  });

  it("carries the working weights from the recent sets", () => {
    const profile = deriveTrainingProfile(
      weeklyStarts(40, MWF, 18),
      [historySet({ weightKg: 85, reps: 3 })],
      NOW,
    );
    expect(profile.workingWeights).toEqual([
      expect.objectContaining({ exerciseId: "bench", weightKg: 85, reps: 3 }),
    ]);
  });
});
