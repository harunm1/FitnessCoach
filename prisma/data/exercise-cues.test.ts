import { describe, expect, it } from "vitest";
import exerciseCues from "./exercise-cues.json";
import exerciseLibrary from "./exercise-cue-library.json";
import { getExerciseCueFields } from "../exerciseCueData";

describe("curated exercise cues", () => {
  it("covers exactly the pinned beginner and intermediate strength exercises", () => {
    expect(Object.keys(exerciseCues).sort()).toEqual(
      exerciseLibrary.map(({ id }) => id).sort(),
    );

    for (const exercise of exerciseLibrary) {
      expect(exercise.category).toBe("strength");
      expect(["BEGINNER", "INTERMEDIATE"]).toContain(exercise.level);
      expect(["barbell", "dumbbell", "body only"]).toContain(
        exercise.equipment,
      );
    }
  });

  it.each(Object.entries(exerciseCues))(
    "%s has 3-5 cues and 2-3 common mistakes",
    (id, entry) => {
      expect(getExerciseCueFields(id)).toEqual(entry);
      expect(entry.cues.length).toBeGreaterThanOrEqual(3);
      expect(entry.cues.length).toBeLessThanOrEqual(5);
      expect(entry.commonMistakes.length).toBeGreaterThanOrEqual(2);
      expect(entry.commonMistakes.length).toBeLessThanOrEqual(3);
      expect([...entry.cues, ...entry.commonMistakes].every(Boolean)).toBe(
        true,
      );
    },
  );

  it("returns no curated fields for an unlisted exercise", () => {
    expect(getExerciseCueFields("Unlisted_Exercise")).toBeUndefined();
  });
});
