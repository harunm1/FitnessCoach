import { describe, expect, it } from "vitest";
import {
  findJointSubstitution,
  parseReportedJoints,
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

describe("parseReportedJoints", () => {
  it("parses joints mentioned with pain", () => {
    expect(parseReportedJoints("pain in shoulder and elbow")).toEqual([
      "shoulder",
      "elbow",
    ]);
  });

  it("parses lower back pain", () => {
    expect(parseReportedJoints("lower-back pain")).toEqual(["lower back"]);
  });

  it("does not report a joint from unrelated text", () => {
    expect(parseReportedJoints("the shoulder is fine")).toEqual([]);
  });

  it("ignores explicitly negated pain", () => {
    expect(parseReportedJoints("no shoulder pain")).toEqual([]);
  });
});
