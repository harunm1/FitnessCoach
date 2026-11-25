import { describe, expect, it } from "vitest";
import exerciseCues from "../../../prisma/data/exercise-cues.json";
import { draftExerciseJointMappings } from "./exerciseJointMappings";
import { JOINTS, type MovementPattern } from "./jointSubstitutions";

describe("draft exercise joint mappings", () => {
  it("covers exactly the 30 curated exercise IDs", () => {
    expect(Object.keys(draftExerciseJointMappings).sort()).toEqual(
      Object.keys(exerciseCues).sort(),
    );
    expect(Object.keys(draftExerciseJointMappings)).toHaveLength(30);
  });

  it("covers all requested movement patterns", () => {
    const patterns: MovementPattern[] = [
      "squat",
      "hinge",
      "lunge",
      "horizontal push",
      "vertical push",
      "horizontal pull",
      "vertical pull",
      "core",
    ];
    expect(
      new Set(
        Object.values(draftExerciseJointMappings).map((entry) => entry.pattern),
      ),
    ).toEqual(new Set(patterns));
  });

  it("contains nonempty, valid, nonduplicated joint labels", () => {
    for (const entry of Object.values(draftExerciseJointMappings)) {
      expect(entry.joints.length).toBeGreaterThan(0);
      expect(new Set(entry.joints).size).toBe(entry.joints.length);
      for (const joint of entry.joints) expect(JOINTS).toContain(joint);
    }
  });
});
