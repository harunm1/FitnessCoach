import { describe, expect, it } from "vitest";
import {
  findJointSubstitution,
  type ExerciseJointMapping,
} from "./jointSubstitutions";

const mapping: Record<string, ExerciseJointMapping> = {
  original: { pattern: "horizontal push", joints: ["shoulder", "elbow"] },
  unsafe: { pattern: "horizontal push", joints: ["shoulder"] },
  wrongPattern: { pattern: "squat", joints: ["knee"] },
  alternative: { pattern: "horizontal push", joints: ["elbow"] },
};

describe("findJointSubstitution", () => {
  it("selects a mapped alternative with the same pattern and no reported joints", () => {
    expect(
      findJointSubstitution(
        "original",
        ["unknown", "unsafe", "wrongPattern", "alternative"],
        ["shoulder"],
        mapping,
      ),
    ).toBe("alternative");
  });

  it("does not select an exercise loading any of multiple reported joints", () => {
    expect(
      findJointSubstitution(
        "original",
        ["unsafe", "alternative"],
        ["shoulder", "elbow"],
        mapping,
      ),
    ).toBeUndefined();
  });

  it("does not infer safety from missing or inherited mapping entries", () => {
    expect(
      findJointSubstitution(
        "original",
        ["unknown", "constructor"],
        ["shoulder"],
        mapping,
      ),
    ).toBeUndefined();
    expect(
      findJointSubstitution("unknown", ["alternative"], ["shoulder"], mapping),
    ).toBeUndefined();
  });

  it("does not replace an exercise that does not load a reported joint", () => {
    expect(
      findJointSubstitution("original", ["alternative"], ["knee"], mapping),
    ).toBeUndefined();
  });
});
