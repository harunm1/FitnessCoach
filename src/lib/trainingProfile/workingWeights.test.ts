import { describe, expect, it } from "vitest";
import { NOW, daysAgo, historySet } from "./fixtures";
import { estimatedOneRepMax, workingWeights } from "./workingWeights";

describe("estimatedOneRepMax (Epley, D36)", () => {
  it("is weight x (1 + reps / 30)", () => {
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
    expect(estimatedOneRepMax(85, 3)).toBeCloseTo(93.5, 2);
  });

  it("is the weight itself for a single", () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
  });
});

describe("workingWeights (D36)", () => {
  it("picks, per exercise, the set with the highest estimated 1RM", () => {
    const result = workingWeights(
      [
        historySet({ reps: 5, weightKg: 80 }), // 93.33
        historySet({ reps: 3, weightKg: 85 }), // 93.5
        historySet({ reps: 1, weightKg: 90 }), // 90
      ],
      NOW,
    );
    expect(result).toEqual([
      {
        exerciseId: "bench",
        exerciseName: "Bench Press",
        weightKg: 85,
        reps: 3,
        e1rmKg: 93.5,
      },
    ]);
  });

  it("ignores sets over 10 reps, under 1 kg, without a weight, and older than 8 weeks", () => {
    const result = workingWeights(
      [
        historySet({ reps: 12, weightKg: 100 }),
        historySet({ reps: 5, weightKg: 0.5 }),
        historySet({ reps: 5, weightKg: null }),
        historySet({ reps: 5, weightKg: 120, startedAt: daysAgo(57) }),
        historySet({ reps: 5, weightKg: 60, startedAt: daysAgo(55) }),
      ],
      NOW,
    );
    expect(result.map((w) => w.weightKg)).toEqual([60]);
  });

  it("keeps exercises apart and lists the highest estimated 1RM first", () => {
    const result = workingWeights(
      [
        historySet({ exerciseId: "curl", exerciseName: "Curl", weightKg: 20 }),
        historySet({
          exerciseId: "squat",
          exerciseName: "Squat",
          weightKg: 120,
        }),
        historySet({ exerciseId: "bench", weightKg: 80 }),
      ],
      NOW,
    );
    expect(result.map((w) => w.exerciseId)).toEqual(["squat", "bench", "curl"]);
  });

  it("breaks a tie toward the newer set", () => {
    const result = workingWeights(
      [
        historySet({ reps: 5, weightKg: 80, startedAt: daysAgo(20) }),
        historySet({ reps: 5, weightKg: 80, startedAt: daysAgo(3) }),
      ],
      NOW,
    );
    expect(result).toHaveLength(1);
  });

  it("gives nothing for no sets", () => {
    expect(workingWeights([], NOW)).toEqual([]);
  });
});
