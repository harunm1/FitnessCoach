// Tests for the spelling-tolerant exercise name key (live feedback 24 Nov, item 9): two
// names that differ only in case, hyphens, spacing, a plural or a known typo share a key.
import { describe, expect, it } from "vitest";
import { matchKey } from "./matchKey";

describe("matchKey", () => {
  it("ignores case, hyphens, slashes and extra spacing", () => {
    expect(matchKey("  Pull-Up ")).toBe(matchKey("pull   up"));
    expect(matchKey("Barbell Bench Press - Medium Grip")).toBe(
      matchKey("barbell bench press medium grip"),
    );
  });

  it("treats a plural like the singular", () => {
    expect(matchKey("Leg Extensions")).toBe(matchKey("Leg Extension"));
    expect(matchKey("Weighted Crunches")).toBe(matchKey("Weighted Crunch"));
    expect(matchKey("Hammer Curls")).toBe(matchKey("Hammer Curl"));
  });

  it("joins a spaced word to its closed form", () => {
    expect(matchKey("Push Up")).toBe(matchKey("Pushups"));
    expect(matchKey("Skull Crusher")).toBe(matchKey("Skullcrusher"));
  });

  it("repairs the typos Hevy exports contain", () => {
    expect(matchKey("Dumbell Row")).toBe(matchKey("Dumbbell Row"));
    expect(matchKey("Palloff Press")).toBe(matchKey("Pallof Press"));
  });

  it("keeps different exercises apart", () => {
    expect(matchKey("Bench Press")).not.toBe(matchKey("Leg Press"));
    expect(matchKey("Press")).not.toBe(matchKey("Pres"));
  });
});

describe("matchKey short words", () => {
  it("reads 'Step Ups' as 'Step Up' but leaves a two-letter word alone", () => {
    expect(matchKey("Dumbbell Step Ups")).toBe(matchKey("Dumbbell Step Up"));
    expect(matchKey("Pull Up")).toBe("pullup");
  });
});
