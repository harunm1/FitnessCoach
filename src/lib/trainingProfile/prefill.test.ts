import { describe, expect, it } from "vitest";
import { DEFAULT_ANSWERS, type QuizAnswers } from "@/lib/onboarding/answers";
import { prefillFromHistory } from "./prefill";
import type { TrainingProfile } from "./types";

const history = (
  overrides: Partial<TrainingProfile> = {},
): TrainingProfile => ({
  workoutCount: 100,
  trainingSince: new Date("2025-03-12T15:00:00Z"),
  workoutsPerWeek: 3,
  usualHour: 18,
  level: "INTERMEDIATE",
  equipment: ["barbell", "dumbbell", "cable", "other"],
  workingWeights: [],
  ...overrides,
});

const saved = (overrides: Partial<QuizAnswers> = {}): QuizAnswers => ({
  ...DEFAULT_ANSWERS,
  level: "BEGINNER",
  ...overrides,
});

describe("prefillFromHistory (D36)", () => {
  it("raises a saved beginner to the level the history shows", () => {
    const { answers, note } = prefillFromHistory(saved(), history());
    expect(answers.level).toBe("INTERMEDIATE");
    expect(note).toMatch(/pre-filled from your 100 logged workouts/i);
    expect(note).toMatch(/change/i);
  });

  it("never lowers the level the user chose", () => {
    const { answers } = prefillFromHistory(
      saved({ level: "EXPERT" }),
      history({ level: "INTERMEDIATE" }),
    );
    expect(answers.level).toBe("EXPERT");
  });

  it("pre-fills a user with no saved level from the history", () => {
    const { answers } = prefillFromHistory(
      { ...DEFAULT_ANSWERS, level: "" },
      history(),
    );
    expect(answers.level).toBe("INTERMEDIATE");
  });

  it("replaces a bodyweight-only default with the quiz equipment the history used", () => {
    const { answers } = prefillFromHistory(saved(), history());
    expect(answers.equipment).toEqual(["barbell", "dumbbell", "cable"]);
  });

  it("adds history equipment to what the user already ticked, keeping theirs", () => {
    const { answers } = prefillFromHistory(
      saved({ equipment: ["machine", "barbell"] }),
      history({ equipment: ["barbell", "dumbbell"] }),
    );
    expect(answers.equipment).toEqual(["machine", "barbell", "dumbbell"]);
  });

  it("keeps the saved equipment when the history shows none the quiz offers", () => {
    const { answers } = prefillFromHistory(
      saved({ equipment: ["dumbbell"] }),
      history({ equipment: ["other", "bands"] }),
    );
    expect(answers.equipment).toEqual(["dumbbell"]);
  });

  it("leaves every other answer as it was", () => {
    const before = saved({ goal: "MUSCLE", daysPerWeek: 4, injuries: "knee" });
    const { answers } = prefillFromHistory(before, history());
    expect(answers).toMatchObject({
      goal: "MUSCLE",
      daysPerWeek: 4,
      injuries: "knee",
      trainingMode: before.trainingMode,
    });
  });

  it("changes nothing for a short history (under 8 workouts)", () => {
    const before = saved();
    const result = prefillFromHistory(before, history({ workoutCount: 7 }));
    expect(result.answers).toEqual(before);
    expect(result.note).toBeNull();
  });

  it("changes nothing without a history", () => {
    const before = saved();
    expect(prefillFromHistory(before, null)).toEqual({
      answers: before,
      note: null,
    });
  });

  it("says nothing when the history changes nothing", () => {
    const before = saved({ level: "INTERMEDIATE", equipment: ["barbell"] });
    const result = prefillFromHistory(
      before,
      history({ equipment: ["barbell"] }),
    );
    expect(result.note).toBeNull();
  });
});
