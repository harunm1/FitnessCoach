// The coach adapts a template (D38). Any bad output, a provider failure or a timeout
// falls back to the template (fitted by rule) with a plain note, never an error.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { CategorisedExercise } from "@/lib/coach/verify";
import { ProviderError } from "@/lib/coach/providers";
import { getTemplate } from "./templates";
import { adaptTemplate, buildAdaptPrompt, FALLBACK_NOTE } from "./adapt";
import { fitChanges } from "./fit";
import { closestTemplate } from "./closest";
import { deloadVariant, DELOAD_LOAD_PERCENT } from "./deload";
import { PROGRAM_TEMPLATES } from "./templates";

const library: CategorisedExercise[] = JSON.parse(
  readFileSync("eval/fixtures-library.json", "utf8"),
);
const template = getTemplate("full-body-3-beginner")!;
const profile = {
  daysPerWeek: 3,
  equipment: ["barbell", "dumbbell"],
  avoidMuscles: [],
  level: "BEGINNER" as const,
};
const about = { goal: "STRENGTH", injuries: "", units: "LB" as const };

const goodReply = {
  changes: [
    {
      op: "swap",
      day: 1,
      slot: 1,
      exercise: "Dumbbell Bench Press",
      reason: "Easier to set up alone",
    },
    {
      op: "reps",
      day: 2,
      slot: 1,
      reps: 10,
      reason: "Lighter on the shoulders",
    },
  ],
};

describe("adaptTemplate", () => {
  it("returns the coach's changes when they pass the guardrails", async () => {
    const result = await adaptTemplate(
      async () => goodReply,
      template,
      profile,
      library,
      about,
    );
    expect(result.source).toBe("COACH");
    expect(result.note).toBeUndefined();
    expect(result.changes.map((c) => [c.op, c.day, c.slot])).toEqual([
      ["swap", 0, 0],
      ["reps", 1, 0],
    ]);
  });

  it.each([
    ["invalid JSON shape", async () => ({ nope: true })],
    [
      "a change that breaks a guardrail",
      async () => ({
        changes: [
          { op: "sets", day: 1, slot: 1, sets: 6, reason: "more" },
          { op: "reps", day: 1, slot: 1, reps: 30, reason: "more" },
        ],
      }),
    ],
    [
      "an exercise the user has no equipment for",
      async () => ({
        changes: [
          { op: "swap", day: 1, slot: 1, exercise: "Leg Press", reason: "x" },
        ],
      }),
    ],
    [
      "a provider error",
      async () => {
        throw new ProviderError("rate limited", "groq");
      },
    ],
    [
      "a thrown parse error",
      async () => {
        throw new SyntaxError("Unexpected token");
      },
    ],
  ])("falls back to the template on %s", async (_label, model) => {
    const result = await adaptTemplate(
      model,
      template,
      profile,
      library,
      about,
    );
    expect(result.source).toBe("TEMPLATE");
    expect(result.note).toBe(FALLBACK_NOTE);
    expect(result.changes.filter((c) => c.source === "coach")).toEqual([]);
  });

  it("falls back at once when the model does not answer in time", async () => {
    vi.useFakeTimers();
    try {
      const never = () => new Promise<unknown>(() => {});
      const pending = adaptTemplate(never, template, profile, library, about, {
        timeoutMs: 5000,
      });
      await vi.advanceTimersByTimeAsync(5000);
      const result = await pending;
      expect(result.source).toBe("TEMPLATE");
      expect(result.note).toBe(FALLBACK_NOTE);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the rule-fitted swaps when it falls back", async () => {
    const dumbbellsOnly = { ...profile, equipment: ["dumbbell"] };
    const result = await adaptTemplate(
      async () => ({ nope: true }),
      template,
      dumbbellsOnly,
      library,
      about,
    );
    expect(result.source).toBe("TEMPLATE");
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.every((c) => c.source === "rule")).toBe(true);
  });

  it("puts the template, the profile and the rules in the prompt", () => {
    const prompt = buildAdaptPrompt(template, profile, library, about, []);
    expect(prompt).toContain("Day 1 (Full body A, MON)");
    expect(prompt).toContain("1. Barbell Squat: 3 x 8");
    expect(prompt).toContain("8 to 12");
    expect(prompt).toContain("barbell, dumbbell");
    expect(prompt).toContain('"changes"');
  });

  it("tells the model a day at the minimum cannot lose an exercise", () => {
    const prompt = buildAdaptPrompt(template, profile, library, about, []);
    expect(prompt).toContain(
      "Never remove an exercise from a day that has only",
    );
  });
});

describe("fitChanges", () => {
  it("proposes nothing when the user has everything the template needs", () => {
    expect(fitChanges(template, profile, library)).toEqual([]);
  });

  it("swaps every barbell lift for one on the same muscle the user can do", () => {
    const changes = fitChanges(
      template,
      { ...profile, equipment: ["dumbbell"] },
      library,
    );
    const byId = new Map(library.map((e) => [e.id, e]));
    for (const change of changes) {
      expect(change.op).toBe("swap");
      if (change.op !== "swap") continue;
      const original = byId.get(
        template.days[change.day].exercises[change.slot].exerciseId,
      )!;
      const replacement = byId.get(change.exerciseId)!;
      expect(original.equipment).toBe("barbell");
      expect(["dumbbell", "body only", null]).toContain(replacement.equipment);
      expect(replacement.primaryMuscles[0]).toBe(original.primaryMuscles[0]);
      expect(change.reason).toMatch(/barbell/);
    }
    expect(changes.length).toBe(
      template.days
        .flatMap((d) => d.exercises)
        .filter((s) => byId.get(s.exerciseId)!.equipment === "barbell").length,
    );
  });
});

describe("fitChanges and level", () => {
  // The fixture has no levels; give the handstand push-up the expert level it has in
  // free-exercise-db and add a beginner shoulder exercise after it in library order.
  const levelled = [
    ...library.map((e) =>
      e.id === "Handstand_Push-Ups" ? { ...e, level: "EXPERT" } : e,
    ),
    {
      id: "Test_Pike_Press",
      name: "Test Pike Press",
      category: "strength",
      equipment: "body only",
      primaryMuscles: ["shoulders"],
      secondaryMuscles: [],
      level: "BEGINNER",
    },
  ];

  it("never swaps in an exercise above the user's level", () => {
    const changes = fitChanges(
      template,
      { ...profile, equipment: ["body only"], level: "BEGINNER" },
      levelled,
    );
    const ids = changes.flatMap((c) => (c.op === "swap" ? [c.exerciseId] : []));
    expect(ids).not.toContain("Handstand_Push-Ups");
    expect(ids).toContain("Test_Pike_Press");
  });
});

describe("closestTemplate", () => {
  it("matches days first, then level, then goal", () => {
    expect(
      closestTemplate({ daysPerWeek: 3, level: "BEGINNER", goal: "STRENGTH" })
        .id,
    ).toBe("full-body-3-beginner");
    expect(
      closestTemplate({ daysPerWeek: 3, level: "INTERMEDIATE", goal: "MUSCLE" })
        .id,
    ).toBe("hypertrophy-split-3");
    expect(
      closestTemplate({ daysPerWeek: 4, level: "BEGINNER", goal: "MUSCLE" }).id,
    ).toBe("upper-lower-4");
    // 5 days is as far from 4 as from 6: the tie goes to the earlier template, fewer days.
    expect(
      closestTemplate({ daysPerWeek: 5, level: "EXPERT", goal: "MUSCLE" }).id,
    ).toBe("upper-lower-4");
    expect(
      closestTemplate({ daysPerWeek: 6, level: "BEGINNER", goal: "STRENGTH" })
        .id,
    ).toBe("push-pull-legs-6");
    expect(
      closestTemplate({ daysPerWeek: 1, level: "BEGINNER", goal: "FAT_LOSS" })
        .id,
    ).toBe("full-body-3-beginner");
  });
});

describe("deloadVariant", () => {
  it.each(PROGRAM_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s has a deload with the same exercises, about half the sets and a lighter load",
    (_id, t) => {
      const deload = deloadVariant(t);
      expect(deload.loadPercent).toBe(DELOAD_LOAD_PERCENT);
      expect(deload.loadPercent).toBeLessThan(100);
      deload.days.forEach((day, i) => {
        const original = t.days[i];
        expect(day.weekdays).toEqual(original.weekdays);
        expect(day.exercises.map((s) => s.exerciseId)).toEqual(
          original.exercises.map((s) => s.exerciseId),
        );
        day.exercises.forEach((slot, j) => {
          expect(slot.sets).toBe(Math.ceil(original.exercises[j].sets / 2));
          expect(slot.reps).toBe(original.exercises[j].reps);
        });
      });
    },
  );
});
