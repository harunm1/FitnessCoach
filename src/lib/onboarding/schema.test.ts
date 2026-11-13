import { describe, expect, it } from "vitest";
import { quizProfileSchema } from "./schema";

const validProfile = {
  goal: "STRENGTH",
  level: "BEGINNER",
  daysPerWeek: "3",
  equipment: ["body only", "dumbbell"],
  injuries: "",
};

describe("quizProfileSchema", () => {
  it("parses browser form values into a profile payload", () => {
    expect(quizProfileSchema.parse(validProfile)).toEqual({
      ...validProfile,
      daysPerWeek: 3,
    });
  });

  it("requires at least one equipment option", () => {
    const result = quizProfileSchema.safeParse({
      ...validProfile,
      equipment: [],
    });

    expect(result.success).toBe(false);
  });

  it.each(["1", "7"])(
    "accepts the boundary training schedule %s days",
    (days) => {
      const result = quizProfileSchema.safeParse({
        ...validProfile,
        daysPerWeek: days,
      });

      expect(result.success).toBe(true);
    },
  );

  it.each(["0", "8", "2.5", "not-a-number"])(
    "rejects invalid training schedule %s",
    (days) => {
      const result = quizProfileSchema.safeParse({
        ...validProfile,
        daysPerWeek: days,
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejects unknown goal and experience values", () => {
    expect(
      quizProfileSchema.safeParse({ ...validProfile, goal: "RUN_A_MARATHON" })
        .success,
    ).toBe(false);
    expect(
      quizProfileSchema.safeParse({ ...validProfile, level: "NOVICE" }).success,
    ).toBe(false);
  });

  it("rejects equipment values that are not in the exercise library options", () => {
    const result = quizProfileSchema.safeParse({
      ...validProfile,
      equipment: ["treadmill"],
    });

    expect(result.success).toBe(false);
  });

  it("accepts the exercise library's kettlebells equipment value", () => {
    expect(
      quizProfileSchema.safeParse({
        ...validProfile,
        equipment: ["kettlebells"],
      }).success,
    ).toBe(true);
  });

  it("accepts a 500-character injury note and rejects a longer note", () => {
    const maxLengthResult = quizProfileSchema.safeParse({
      ...validProfile,
      injuries: "a".repeat(500),
    });
    const overLimitResult = quizProfileSchema.safeParse({
      ...validProfile,
      injuries: "a".repeat(501),
    });

    expect(maxLengthResult.success).toBe(true);
    expect(overLimitResult.success).toBe(false);
  });
});
