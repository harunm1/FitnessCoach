import { describe, expect, it } from "vitest";
import { coachSummaryLines, progressLine } from "./summary";
import type { TrainingProfile } from "./types";

const profile = (
  overrides: Partial<TrainingProfile> = {},
): TrainingProfile => ({
  workoutCount: 120,
  trainingSince: new Date("2025-03-12T15:00:00Z"),
  workoutsPerWeek: 3,
  usualHour: 18,
  level: "INTERMEDIATE",
  equipment: ["barbell"],
  workingWeights: [
    {
      exerciseId: "bench",
      exerciseName: "Bench Press",
      weightKg: 80,
      reps: 5,
      e1rmKg: 93.33,
    },
  ],
  ...overrides,
});

describe("progressLine (D36)", () => {
  it("names the month, the weekly rate and the usual time", () => {
    expect(progressLine(profile())).toBe(
      "Training since March 2025, 3 workouts a week, usually around 6 pm.",
    );
  });

  it("says one workout in the singular and keeps a decimal rate", () => {
    expect(progressLine(profile({ workoutsPerWeek: 1 }))).toContain(
      "1 workout a week",
    );
    expect(progressLine(profile({ workoutsPerWeek: 2.5 }))).toContain(
      "2.5 workouts a week",
    );
  });

  it("writes the hour on a 12-hour clock", () => {
    expect(progressLine(profile({ usualHour: 7 }))).toContain("around 7 am");
    expect(progressLine(profile({ usualHour: 0 }))).toContain("around 12 am");
    expect(progressLine(profile({ usualHour: 12 }))).toContain("around 12 pm");
  });

  it("leaves the time out when it is not known", () => {
    expect(progressLine(profile({ usualHour: null }))).toBe(
      "Training since March 2025, 3 workouts a week.",
    );
  });

  it("is null with no history", () => {
    expect(
      progressLine(profile({ workoutCount: 0, trainingSince: null })),
    ).toBeNull();
  });
});

describe("coachSummaryLines (D36)", () => {
  it("summarises the history and the working weights in the user's unit", () => {
    const lines = coachSummaryLines(profile(), "KG");
    expect(lines[0]).toBe(
      "Training since March 2025, 3 workouts a week, usually around 6 pm. History suggests an intermediate level.",
    );
    expect(lines[1]).toContain("Bench Press 80 kg x 5 (estimated 1RM 93 kg)");
  });

  it("converts to pounds", () => {
    const lines = coachSummaryLines(profile(), "LB");
    expect(lines[1]).toContain(
      "Bench Press 176.5 lb x 5 (estimated 1RM 206 lb)",
    );
  });

  it("lists at most six lifts", () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      exerciseId: `e${index}`,
      exerciseName: `Lift ${index}`,
      weightKg: 50,
      reps: 5,
      e1rmKg: 60 - index,
    }));
    const lines = coachSummaryLines(profile({ workingWeights: many }), "KG");
    // The headline, then one short line per lift.
    expect(lines).toHaveLength(7);
    expect(lines[6]).toContain("Lift 5");
    expect(lines.join("\n")).not.toContain("Lift 6");
  });

  it("sends no dates, ids or raw rows", () => {
    const text = coachSummaryLines(profile(), "KG").join("\n");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toContain("bench\n");
  });

  it("is empty with no history", () => {
    expect(
      coachSummaryLines(
        profile({ workoutCount: 0, trainingSince: null, workingWeights: [] }),
        "KG",
      ),
    ).toEqual([]);
  });

  it("leaves the weights line out when there are none", () => {
    expect(
      coachSummaryLines(profile({ workingWeights: [] }), "KG"),
    ).toHaveLength(1);
  });
});
