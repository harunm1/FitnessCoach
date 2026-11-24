// Tests for the weight field's hint (#144): Bodyweight only where no equipment is needed.
import { describe, expect, it } from "vitest";
import { weightPlaceholder } from "./weightPlaceholder";

describe("weightPlaceholder", () => {
  it("says Bodyweight for bodyweight exercises and ones with no equipment listed", () => {
    expect(weightPlaceholder("body only")).toBe("Bodyweight");
    expect(weightPlaceholder(null)).toBe("Bodyweight");
  });

  it("asks for a load for exercises that use equipment", () => {
    ["kettlebells", "cable", "barbell", "dumbbell", "machine"].forEach(
      (equipment) => expect(weightPlaceholder(equipment)).toBe("Load in kg"),
    );
  });
  // #144: the dataset (free-exercise-db, checked 24 Nov) also has foam roll, exercise ball,
  // bands and "other"; none of them is a plain kilogram load.
  it("says Bodyweight for foam roll and exercise ball exercises", () => {
    ["foam roll", "exercise ball"].forEach((equipment) =>
      expect(weightPlaceholder(equipment)).toBe("Bodyweight"),
    );
  });

  it("makes the load optional for bands and other equipment", () => {
    ["bands", "other"].forEach((equipment) =>
      expect(weightPlaceholder(equipment)).toBe("Load in kg (optional)"),
    );
  });
});
