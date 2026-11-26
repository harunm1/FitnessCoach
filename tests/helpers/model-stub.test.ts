// The stub's prompt reading, against the real prompt builder, so a change to the prompt breaks this test and not the browser run.
import { describe, expect, it } from "vitest";
import { buildPlanPrompt } from "../../src/lib/coach/generatePlan";
import { verifyPlan } from "../../src/lib/coach/verify";
import { namesToIds } from "../../src/lib/coach/generatePlan";
import { parsePrompt, planFromPrompt } from "./model-stub";

const library = ["Push Up", "Air Squat", "Plank", "Lunge", "Pull Up"].map(
  (name, i) => ({
    id: `id-${i}`,
    name,
    category: "strength",
    equipment: "body only",
    primaryMuscles: [i % 2 ? "quadriceps" : "chest"],
    secondaryMuscles: [],
  }),
);
const profile = { daysPerWeek: 3, equipment: [], avoidMuscles: [] };

describe("model stub", () => {
  it("reads the days and every offered name from the real prompt", () => {
    const { days, names } = parsePrompt(buildPlanPrompt(profile, library));
    expect(days).toBe(3);
    expect(names.sort()).toEqual(library.map((e) => e.name).sort());
  });

  it("answers with a plan the verifier passes", () => {
    const raw = planFromPrompt(buildPlanPrompt(profile, library));
    const byId = new Map(library.map((e) => [e.id, e]));
    const result = verifyPlan(namesToIds(raw, library), profile, byId);
    expect(result.ok).toBe(true);
  });
});
