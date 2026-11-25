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

  it("parses back alone as lower back", () => {
    expect(parseReportedJoints("back pain")).toEqual(["lower back"]);
  });

  it.each([
    "I want to come back from injury",
    "hurts when i go back to work",
    "I back squat heavy and have a problem with my schedule",
  ])(
    "does not report lower-back pain from unrelated back wording: %s",
    (text) => {
      expect(parseReportedJoints(text)).toEqual([]);
    },
  );

  it.each([
    ["my knee is injured", "knee"],
    ["painful knee", "knee"],
    ["knee is hurting", "knee"],
    ["strained lower back", "lower back"],
    ["tweaked my back", "lower back"],
  ])("recognizes symptom wording: %s", (text, joint) => {
    expect(parseReportedJoints(text)).toEqual([joint]);
  });

  it.each([
    "I have no pain, my knee is fine",
    "no pain in my knee",
    "my knee has no pain",
  ])("does not report negated symptoms: %s", (text) => {
    expect(parseReportedJoints(text)).toEqual([]);
  });

  it("recognizes a later positive report of the same joint", () => {
    expect(
      parseReportedJoints("no knee pain but my knee is hurting now"),
    ).toEqual(["knee"]);
  });

  it("parses common plural joint names", () => {
    expect(parseReportedJoints("my knees hurt and my sore shoulders")).toEqual([
      "knee",
      "shoulder",
    ]);
  });

  it.each(["knee", "hip", "shoulder", "elbow", "wrist", "ankle"])(
    "recognizes plural %s reports",
    (joint) => {
      expect(parseReportedJoints(`my ${joint}s hurt`)).toEqual([joint]);
    },
  );

  it.each(["pain in my back", "my back is hurting", "sore back"])(
    "keeps explicit back pain reports: %s",
    (text) => {
      expect(parseReportedJoints(text)).toEqual(["lower back"]);
    },
  );

  it("does not report a joint from unrelated text", () => {
    expect(parseReportedJoints("the shoulder is fine")).toEqual([]);
  });

  it("ignores explicitly negated pain", () => {
    expect(parseReportedJoints("no shoulder pain")).toEqual([]);
  });

  it("does not carry a negation across a but-clause", () => {
    expect(parseReportedJoints("no knee pain but my shoulder hurts")).toEqual([
      "shoulder",
    ]);
  });
});
