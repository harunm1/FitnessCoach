// The demo cache names exercises as the coach wrote them; the live library holds the
// names the seed stores (displayNameFor), so a renamed exercise must be renamed in the
// cache too, or namesToIds keeps the old name and the verifier rejects the plan (#193).
import { describe, expect, it } from "vitest";
import { DEMO_PLAN_CACHE } from "@/lib/coach/demoPlans";
import { displayNameFor } from "./displayNames";
import { loadFixtureLibrary } from "./starterPlanIds";

type Reply = { days?: { exercises?: { exercise?: string }[] }[] };

const seededNames = new Set(
  loadFixtureLibrary().map((e) => displayNameFor(e.id, e.name ?? e.id)),
);

const cachedNames = [
  ...new Set(
    DEMO_PLAN_CACHE.plans.flatMap(({ reply }) =>
      ((reply as Reply).days ?? []).flatMap((day) =>
        (day.exercises ?? []).map((e) => e.exercise ?? ""),
      ),
    ),
  ),
].sort();

describe("demo plan cache names (#193)", () => {
  it("has exercise names to check", () => {
    expect(cachedNames.length).toBeGreaterThan(0);
  });

  it.each(cachedNames)("%s is a name the seed stores", (name) => {
    expect(seededNames.has(name)).toBe(true);
  });
});
