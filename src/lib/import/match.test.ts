// Tests for matching imported exercise names to the library (#131): exact, then equipment form and alias.
import { describe, expect, it } from "vitest";
import { matchExercises, normalizeTitle } from "./match";

const library = [
  { id: "bench", name: "Barbell Bench Press - Medium Grip" },
  { id: "dbbench", name: "Dumbbell Bench Press" },
  { id: "squat", name: "Barbell Squat" },
  { id: "facepull", name: "Face Pull" },
  { id: "pullups", name: "Pullups" },
  { id: "curl1", name: "Dumbbell Bicep Curl" },
  { id: "curl2", name: "Dumbbell Bicep Curl" },
];

describe("normalizeTitle", () => {
  it("ignores case, spacing and punctuation spacing", () => {
    expect(normalizeTitle("  Face   PULL ")).toBe("face pull");
  });
});

describe("matchExercises", () => {
  it("matches an exact name ignoring case and spacing", () => {
    const result = matchExercises(["dumbbell bench  press"], library);
    expect(result.matched["dumbbell bench  press"]).toBe("dbbench");
  });

  it("matches Hevy's 'Name (Equipment)' to the library's 'Equipment Name'", () => {
    const result = matchExercises(
      ["Squat (Barbell)", "Bench Press (Dumbbell)"],
      library,
    );
    expect(result.matched["Squat (Barbell)"]).toBe("squat");
    expect(result.matched["Bench Press (Dumbbell)"]).toBe("dbbench");
  });

  it("drops the equipment in brackets when the plain name matches", () => {
    expect(
      matchExercises(["Face Pull (Cable)"], library).matched[
        "Face Pull (Cable)"
      ],
    ).toBe("facepull");
  });

  it("uses the alias list", () => {
    const result = matchExercises(
      ["Bench Press (Barbell)", "Pull Up"],
      library,
    );
    expect(result.matched["Bench Press (Barbell)"]).toBe("bench");
    expect(result.matched["Pull Up"]).toBe("pullups");
  });

  it("lists names it cannot match, and ambiguous ones, as unmatched", () => {
    const result = matchExercises(
      ["Zercher Carry", "Dumbbell Bicep Curl"],
      library,
    );
    expect(result.unmatched).toEqual(["Zercher Carry", "Dumbbell Bicep Curl"]);
    expect(result.matched).toEqual({});
  });

  it("keeps a title like constructor or __proto__ as an ordinary name", () => {
    const result = matchExercises(["constructor", "__proto__"], library);
    expect(result.unmatched).toEqual(["constructor", "__proto__"]);
    expect(Object.keys(result.matched)).toEqual([]);
  });

  it("does not match an equipment variant the library lacks to a different exercise", () => {
    const result = matchExercises(["Bench Press (Smith Machine)"], library);
    expect(result.unmatched).toEqual(["Bench Press (Smith Machine)"]);
  });

  it("lists each title once", () => {
    const result = matchExercises(["Zercher Carry", "Zercher Carry"], library);
    expect(result.unmatched).toEqual(["Zercher Carry"]);
  });
});
