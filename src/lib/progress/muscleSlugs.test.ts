import { describe, expect, it } from "vitest";
import { MUSCLE_SLUGS, regionLabels, slugsFor } from "./muscleSlugs";

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

describe("regionLabels", () => {
  const labels = regionLabels(
    [
      { muscle: "chest", workouts: 2, share: 2 / 3 },
      { muscle: "lats", workouts: 2, share: 2 / 3 },
      { muscle: "middle back", workouts: 1, share: 1 / 3 },
    ],
    3,
    "November 2026",
  );

  it("gives a worked muscle its workouts and share", () => {
    expect(labels.chest).toBe("Chest · 2 of 3 workouts (67%)");
  });

  it("names each muscle in a region drawn for two", () => {
    expect(labels["upper-back"]).toBe(
      "Upper back · lats 2 of 3 (67%) · middle back 1 of 3 (33%)",
    );
  });

  it("says when a muscle wasn't worked in the period", () => {
    expect(labels.biceps).toBe("Biceps · not worked in November 2026");
  });

  it("labels every region our muscles map to, and nothing else", () => {
    expect(Object.keys(labels).sort()).toEqual(
      [...new Set(Object.values(MUSCLE_SLUGS))].sort(),
    );
    expect(labels.head).toBeUndefined();
  });
});
