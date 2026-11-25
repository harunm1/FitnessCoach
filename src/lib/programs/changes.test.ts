// The coach's adaptation is a list of changes against the template (D38); the user
// accepts or reverts each one.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CategorisedExercise } from "@/lib/coach/verify";
import { getTemplate } from "./templates";
import { applyChanges, type Change } from "./changes";
import { parseCoachChanges } from "./parseChanges";

const library: CategorisedExercise[] = JSON.parse(
  readFileSync("eval/fixtures-library.json", "utf8"),
);
const template = getTemplate("full-body-3-beginner")!;

const swap: Change = {
  id: "c1",
  source: "coach",
  op: "swap",
  day: 0,
  slot: 0,
  exerciseId: "Dumbbell_Squat",
  reason: "Easier to learn than the barbell squat",
};
const sets: Change = {
  id: "c2",
  source: "coach",
  op: "sets",
  day: 1,
  slot: 1,
  sets: 2,
  reason: "Shoulders are sore",
};
const remove: Change = {
  id: "c3",
  source: "coach",
  op: "remove",
  day: 2,
  slot: 3,
  reason: "Not needed",
};

describe("applyChanges", () => {
  it("returns the template unchanged when nothing is accepted", () => {
    const { plan, problems } = applyChanges(template, [swap, sets], new Set());
    expect(problems).toEqual([]);
    expect(plan.days[0].exercises[0].exerciseId).toBe("Barbell_Squat");
    expect(plan.days[1].exercises[1].sets).toBe(3);
  });

  it("applies every accepted change", () => {
    const { plan } = applyChanges(
      template,
      [swap, sets, remove],
      new Set(["c1", "c2", "c3"]),
    );
    expect(plan.days[0].exercises[0].exerciseId).toBe("Dumbbell_Squat");
    expect(plan.days[1].exercises[1].sets).toBe(2);
    expect(plan.days[2].exercises.map((s) => s.exerciseId)).not.toContain(
      "Hanging_Leg_Raise",
    );
  });

  it("reverts one change and keeps the others", () => {
    const { plan } = applyChanges(
      template,
      [swap, sets],
      new Set(["c2"]), // c1 reverted
    );
    expect(plan.days[0].exercises[0].exerciseId).toBe("Barbell_Squat");
    expect(plan.days[1].exercises[1].sets).toBe(2);
  });

  it("keeps the other fields of a swapped slot", () => {
    const { plan } = applyChanges(template, [swap], new Set(["c1"]));
    expect(plan.days[0].exercises[0]).toEqual({
      ...template.days[0].exercises[0],
      exerciseId: "Dumbbell_Squat",
    });
  });

  it("reports a change aimed at a slot that does not exist", () => {
    const { problems } = applyChanges(
      template,
      [{ ...sets, day: 9 }],
      new Set(["c2"]),
    );
    expect(problems.join()).toMatch(/no slot 2 on day 10/);
  });

  it("does not modify the template", () => {
    const before = JSON.stringify(template);
    applyChanges(template, [swap, sets, remove], new Set(["c1", "c2", "c3"]));
    expect(JSON.stringify(template)).toBe(before);
  });
});

describe("parseCoachChanges", () => {
  it("parses the model's reply and maps exercise names to ids", () => {
    const parsed = parseCoachChanges(
      {
        changes: [
          {
            op: "swap",
            day: 1,
            slot: 1,
            exercise: "Dumbbell squat",
            reason: "No barbell at home",
          },
          { op: "reps", day: 2, slot: 2, reps: 10, reason: "Higher reps" },
        ],
      },
      library,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.changes).toEqual([
      {
        id: "coach-1",
        source: "coach",
        op: "swap",
        day: 0,
        slot: 0,
        exerciseId: "Dumbbell_Squat",
        reason: "No barbell at home",
      },
      {
        id: "coach-2",
        source: "coach",
        op: "reps",
        day: 1,
        slot: 1,
        reps: 10,
        reason: "Higher reps",
      },
    ]);
  });

  it("keeps an unknown exercise name as written, for the guardrails to reject", () => {
    const parsed = parseCoachChanges(
      {
        changes: [
          { op: "swap", day: 1, slot: 1, exercise: "Moon Press", reason: "x" },
        ],
      },
      library,
    );
    expect(parsed.ok && parsed.changes[0]).toMatchObject({
      exerciseId: "Moon Press",
    });
  });

  it.each([
    ["not an object", "hello"],
    ["no changes list", { plan: {} }],
    [
      "an unknown op",
      { changes: [{ op: "add", day: 1, slot: 0, reason: "x" }] },
    ],
    [
      "a change without a reason",
      { changes: [{ op: "sets", day: 1, slot: 0, sets: 3 }] },
    ],
    [
      "a day number below 1",
      { changes: [{ op: "remove", day: 0, slot: 1, reason: "x" }] },
    ],
    [
      "sets that are not a whole number",
      { changes: [{ op: "sets", day: 1, slot: 0, sets: 2.5, reason: "x" }] },
    ],
  ])("rejects %s", (_label, raw) => {
    expect(parseCoachChanges(raw, library).ok).toBe(false);
  });
});
