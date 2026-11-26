import { describe, expect, it } from "vitest";
import snapshot from "../../../prisma/data/exercise-instructions-snapshot.json";
import { FALLBACK_CUE_IDS } from "../../../prisma/exerciseGuidanceData";
import { DISPLAY_NAME_BY_ID, displayNameFor } from "./displayNames";
import { curatedCues, guidanceForSeed, hasGuidance } from "./guidance";

const curated = { cues: ["Brace"], commonMistakes: ["Rounding"] };

describe("guidanceForSeed", () => {
  it("keeps the curated cues and mistakes when the exercise has them", () => {
    expect(guidanceForSeed({ curated, instructions: ["Step one."] })).toEqual(
      curated,
    );
  });

  it("falls back to the dataset steps, trimmed, with no mistakes", () => {
    expect(
      guidanceForSeed({ instructions: [" Lie down. ", "", "  ", "Press."] }),
    ).toEqual({ cues: ["Lie down.", "Press."], commonMistakes: [] });
  });

  it("uses the written cues only when the dataset has no steps", () => {
    const written = ["Hold the line."];
    expect(
      guidanceForSeed({ instructions: [], fallbackCues: written }).cues,
    ).toEqual(written);
    expect(
      guidanceForSeed({ instructions: ["Step."], fallbackCues: written }).cues,
    ).toEqual(["Step."]);
  });

  it("returns no guidance when nothing is available", () => {
    expect(hasGuidance(guidanceForSeed({ instructions: [] }))).toBe(false);
  });
});

describe("curatedCues", () => {
  it("counts cues as curated only when common mistakes come with them", () => {
    expect(curatedCues(curated)).toEqual(["Brace"]);
    expect(curatedCues({ cues: ["Step."], commonMistakes: [] })).toEqual([]);
  });
});

describe("rows the dataset ships without instructions", () => {
  const withoutSteps = Object.entries(snapshot)
    .filter(([, steps]) => steps.length === 0)
    .map(([id]) => id);

  it("each has written fallback cues, and the fallback lists only such rows", () => {
    expect(withoutSteps.length).toBeGreaterThan(0);
    expect([...FALLBACK_CUE_IDS].sort()).toEqual([...withoutSteps].sort());
  });
});

describe("displayNameFor", () => {
  it("shows the bank's Butt Lift (Bridge) as Glute Bridge", () => {
    expect(displayNameFor("Butt_Lift_Bridge", "Butt Lift (Bridge)")).toBe(
      "Glute Bridge",
    );
  });

  it("leaves every other name, including the hip thrust, as the dataset has it", () => {
    expect(displayNameFor("Barbell_Hip_Thrust", "Barbell Hip Thrust")).toBe(
      "Barbell Hip Thrust",
    );
    expect(displayNameFor("constructor", "Odd")).toBe("Odd");
  });

  it.each(Object.keys(DISPLAY_NAME_BY_ID))(
    "renames %s, which exists in the dataset snapshot",
    (id) => {
      expect(Object.hasOwn(snapshot, id)).toBe(true);
    },
  );
});
