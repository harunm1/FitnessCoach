import { describe, expect, it } from "vitest";
import exerciseCues from "./exercise-cues.json";
import {
  EXERCISE_CUE_IDS,
  getMissingExerciseCueIds,
  getExerciseCueFields,
} from "../exerciseCueData";

describe("curated exercise cues", () => {
  it("contains exactly 30 curated exercise IDs", () => {
    expect(EXERCISE_CUE_IDS).toHaveLength(30);
  });

  it("reports cue IDs absent from the source library", () => {
    expect(
      getMissingExerciseCueIds(["squat", "typo"], ["squat", "row"]),
    ).toEqual(["typo"]);
    expect(getMissingExerciseCueIds(["squat"], ["squat", "row"])).toEqual([]);
  });

  it.each(Object.values(exerciseCues))(
    "has 3-5 cues and 2-3 common mistakes",
    (entry) => {
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

  it.each(["constructor", "toString", "__proto__"])(
    "does not treat inherited key %s as a curated exercise",
    (id) => {
      expect(getExerciseCueFields(id)).toBeUndefined();
    },
  );
});
