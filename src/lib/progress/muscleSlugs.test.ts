import { describe, expect, it } from "vitest";
import { MUSCLE_SLUGS, slugsFor } from "./muscleSlugs";

// The 17 primary and secondary muscle names in the seeded exercise library.
const LIBRARY_MUSCLES = [
  "abdominals",
  "abductors",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "middle back",
  "neck",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
];

describe("MUSCLE_SLUGS", () => {
  it("has a diagram region for every library muscle", () => {
    const missing = LIBRARY_MUSCLES.filter((m) => !MUSCLE_SLUGS[m]);
    expect(missing).toEqual([]);
  });
});

describe("slugsFor", () => {
  it("maps muscles to regions without duplicates", () => {
    expect(slugsFor(["lats", "middle back", "biceps"])).toEqual([
      "upper-back",
      "biceps",
    ]);
  });

  it("skips names it does not know", () => {
    expect(slugsFor(["tail"])).toEqual([]);
  });
});
