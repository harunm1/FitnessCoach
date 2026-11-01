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

  it("rejects training schedules outside the supported range", () => {
    const result = quizProfileSchema.safeParse({
      ...validProfile,
      daysPerWeek: "8",
    });

    expect(result.success).toBe(false);
  });
});
