// A program is a template plus a list of changes (D38). The coach proposes changes,
// rules propose swaps for missing equipment, and the user accepts or reverts each one.
// Changes point at the template's own day and slot, so accepting or reverting one never
// moves another.
import { z } from "zod";
import type { PlanInput } from "@/lib/coach/schema";
import { templateToPlan } from "./guardrails";
import type { ProgramTemplate } from "./templateSchema";

export const MAX_CHANGES = 20;
export const MAX_REASON = 160;

type Target = {
  id: string;
  source: "rule" | "coach";
  day: number;
  slot: number;
  reason: string;
};

export type Change = Target &
  (
    | { op: "swap"; exerciseId: string }
    | { op: "sets"; sets: number }
    | { op: "reps"; reps: number }
    | { op: "remove" }
  );

// A change list coming back from the browser on save. It is the user's own plan, but
// still untrusted input: the shape is checked here and every number and exercise by the
// guardrails before anything is written.
const target = {
  id: z.string().min(1).max(40),
  source: z.enum(["rule", "coach"]),
  day: z.number().int().min(0),
  slot: z.number().int().min(0),
  reason: z
    .string()
    .min(1)
    .max(MAX_REASON * 2),
};
export const changeListSchema = z
  .array(
    z.discriminatedUnion("op", [
      z.object({
        op: z.literal("swap"),
        exerciseId: z.string().min(1).max(120),
        ...target,
      }),
      z.object({ op: z.literal("sets"), sets: z.number().int(), ...target }),
      z.object({ op: z.literal("reps"), reps: z.number().int(), ...target }),
      z.object({ op: z.literal("remove"), ...target }),
    ]),
  )
  .max(MAX_CHANGES * 3);

// The template with the accepted changes applied, in list order (a coach change after a
// rule swap on the same slot wins). Removals are applied last, so slot numbers keep
// pointing at the template while the others apply.
export function applyChanges(
  template: ProgramTemplate,
  changes: readonly Change[],
  accepted: ReadonlySet<string>,
): { plan: PlanInput; problems: string[] } {
  const plan = templateToPlan(template); // a fresh copy; the template is not touched
  const removed = new Set<string>();
  const problems: string[] = [];
  changes
    .filter((c) => accepted.has(c.id))
    .forEach((change) => {
      const slot = plan.days[change.day]?.exercises[change.slot];
      if (!slot) {
        problems.push(
          `${change.id}: no slot ${change.slot + 1} on day ${change.day + 1}`,
        );
        return;
      }
      if (change.op === "swap") slot.exerciseId = change.exerciseId;
      if (change.op === "sets") slot.sets = change.sets;
      if (change.op === "reps") slot.reps = change.reps;
      if (change.op === "remove") removed.add(`${change.day}:${change.slot}`);
    });
  return {
    plan: {
      ...plan,
      days: plan.days.map((day, d) => ({
        ...day,
        exercises: day.exercises.filter((_, s) => !removed.has(`${d}:${s}`)),
      })),
    },
    problems,
  };
}
