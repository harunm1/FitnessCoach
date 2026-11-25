// Seed integrity for the program templates (D38). Every template must load through
// its schema, name only exercises that exist in free-exercise-db (checked against the
// copy in eval/fixtures-library.json), and already pass the guardrails unadapted.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CategorisedExercise } from "@/lib/coach/verify";
import { MIN_EXERCISES_PER_DAY, WEEKDAYS } from "./templateSchema";
import { PROGRAM_TEMPLATES, getTemplate } from "./templates";
import { checkProgram, templateToPlan } from "./guardrails";

const library: CategorisedExercise[] = JSON.parse(
  readFileSync("eval/fixtures-library.json", "utf8"),
);
const byId = new Map(library.map((e) => [e.id, e]));

// Names of published programs we must not copy (D38: generic structures only).
const PROTECTED_NAMES = [
  /starting strength/i,
  /stronglifts/i,
  /5\s*\/\s*3\s*\/\s*1/,
  /wendler/i,
  /\bphul\b/i,
  /\bphat\b/i,
  /gzcl/i,
  /nsuns/i,
  /madcow/i,
  /texas method/i,
  /reddit/i,
  /greyskull/i,
];

describe("program templates", () => {
  it("ships the four generic structures", () => {
    expect(PROTECTED_NAMES.length).toBeGreaterThan(0);
    expect(PROGRAM_TEMPLATES.map((t) => [t.daysPerWeek, t.level])).toEqual([
      [3, "BEGINNER"],
      [4, "INTERMEDIATE"],
      [6, "INTERMEDIATE"],
      [3, "INTERMEDIATE"],
    ]);
  });

  it("has unique ids and a positive version", () => {
    const ids = PROGRAM_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of PROGRAM_TEMPLATES) expect(t.version).toBeGreaterThan(0);
  });

  it("finds a template by id and returns undefined for an unknown id", () => {
    const first = PROGRAM_TEMPLATES[0];
    expect(getTemplate(first.id)).toBe(first);
    expect(getTemplate("no-such-template")).toBeUndefined();
  });

  it.each(PROGRAM_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s names only free-exercise-db exercises that need its listed equipment",
    (_id, template) => {
      for (const day of template.days) {
        for (const slot of day.exercises) {
          const exercise = byId.get(slot.exerciseId);
          expect(exercise, slot.exerciseId).toBeDefined();
          expect(exercise!.category).toBe("strength");
          const kit = exercise!.equipment;
          if (kit && kit !== "body only") {
            expect(template.equipment, slot.exerciseId).toContain(kit);
          }
        }
      }
    },
  );

  it.each(PROGRAM_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s has at least 4 exercises on every day and none twice on a day",
    (_id, template) => {
      for (const day of template.days) {
        expect(day.exercises.length).toBeGreaterThanOrEqual(
          MIN_EXERCISES_PER_DAY,
        );
        const ids = day.exercises.map((s) => s.exerciseId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    },
  );

  it.each(PROGRAM_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s suggests one distinct weekday per training day",
    (_id, template) => {
      const all = template.days.flatMap((d) => d.weekdays);
      expect(all.length).toBe(template.daysPerWeek);
      expect(new Set(all).size).toBe(all.length);
      for (const w of all) expect(WEEKDAYS).toContain(w);
      expect(template.days.length).toBeLessThanOrEqual(template.daysPerWeek);
    },
  );

  it.each(PROGRAM_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s offers a deload every 6 to 8 weeks and carries its own progression rule",
    (_id, template) => {
      expect(template.deloadEveryWeeks).toBeGreaterThanOrEqual(6);
      expect(template.deloadEveryWeeks).toBeLessThanOrEqual(8);
      expect(template.progression.rule.length).toBeGreaterThan(20);
      expect(template.progression.loadStepPercent).toBeGreaterThanOrEqual(2);
      expect(template.progression.loadStepPercent).toBeLessThanOrEqual(10);
    },
  );

  it.each(PROGRAM_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s passes the guardrails unadapted",
    (_id, template) => {
      const problems = checkProgram(templateToPlan(template), {
        template,
        library: byId,
        profile: {
          daysPerWeek: template.daysPerWeek,
          equipment: template.equipment,
          avoidMuscles: [],
        },
      });
      expect(problems).toEqual([]);
    },
  );

  it.each(PROGRAM_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s uses no published program's name",
    (_id, template) => {
      const text = JSON.stringify(template);
      for (const name of PROTECTED_NAMES) expect(text).not.toMatch(name);
    },
  );
});
