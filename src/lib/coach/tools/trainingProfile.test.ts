// getTrainingProfile and getExerciseHistory (D43): the D36 training profile split into the two
// tool results the coach reads, each with its period. Invented data only.
import { describe, expect, it } from "vitest";
import type { TrainingProfile } from "@/lib/trainingProfile/types";
import { profileResults } from "./trainingProfile";

const NOW = new Date("2026-11-26T17:00:00Z");

const PROFILE: TrainingProfile = {
  workoutCount: 412,
  trainingSince: new Date("2024-03-14T22:00:00Z"),
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
      e1rmKg: 93.3,
    },
  ],
};

describe("profileResults (D43)", () => {
  it("gives the profile and the working weights as two results with their periods", () => {
    const [profile, lifts] = profileResults(PROFILE, "KG", NOW);
    expect(profile.name).toBe("getTrainingProfile");
    expect(profile.period).toBe(
      "every finished workout, imported or logged; the weekly rate is over the last 8 weeks",
    );
    expect(profile.lines).toEqual([
      "Finished workouts, all time: 412.",
      "Training since March 2024, 3 workouts a week, usually around 6 pm. History suggests an intermediate level.",
    ]);
    expect(lifts.name).toBe("getExerciseHistory");
    expect(lifts.period).toBe("last 8 weeks (1 Oct 2026 to 26 Nov 2026)");
    expect(lifts.lines).toEqual([
      "Bench Press 80 kg x 5 (estimated 1RM 93 kg)",
    ]);
  });

  it("says so when there is no history", () => {
    const [profile, lifts] = profileResults(
      {
        ...PROFILE,
        workoutCount: 0,
        trainingSince: null,
        workoutsPerWeek: 0,
        usualHour: null,
        level: "BEGINNER",
        workingWeights: [],
      },
      "KG",
      NOW,
    );
    expect(profile.lines).toEqual(["No finished workouts yet."]);
    expect(lifts.lines).toEqual(["No weighted sets in this period."]);
  });
});
