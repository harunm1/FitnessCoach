// Parsing the coach's reply into changes (D38). Server only in practice: it maps
// exercise names with the plan path's normaliseName, which lives beside the providers.
import { z } from "zod";
import { LIMITS } from "@/lib/coach/schema";
import { normaliseName } from "@/lib/coach/generatePlan";
import type { LibraryExercise } from "@/lib/coach/verify";
import { MAX_CHANGES, MAX_REASON, type Change } from "./changes";

// The model's reply. Day and slot are 1-based, as the prompt numbers them; sets and
// reps are only shape-checked here, the guardrails judge the numbers.
const position = {
  day: z.number().int().min(1),
  slot: z.number().int().min(1),
  reason: z.string().trim().min(1).max(MAX_REASON),
};
const coachChangeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("swap"), exercise: z.string().min(1), ...position }),
  z.object({
    op: z.literal("sets"),
    sets: z.number().int().min(LIMITS.sets.min),
    ...position,
  }),
  z.object({
    op: z.literal("reps"),
    reps: z.number().int().min(LIMITS.reps.min),
    ...position,
  }),
  z.object({ op: z.literal("remove"), ...position }),
]);
export const coachReplySchema = z.object({
  changes: z.array(coachChangeSchema).max(MAX_CHANGES),
});

export type ParsedChanges =
  { ok: true; changes: Change[] } | { ok: false; problems: string[] };

// Names to ids as the plan path does (generatePlan.normaliseName); an unknown name is
// kept as written so the guardrails reject it by name.
export function parseCoachChanges(
  raw: unknown,
  library: LibraryExercise[],
): ParsedChanges {
  const parsed = coachReplySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "reply"}: ${i.message}`,
      ),
    };
  }
  const idByName = new Map(
    library.map((e) => [normaliseName(e.name ?? e.id), e.id]),
  );
  const changes = parsed.data.changes.map((c, i): Change => {
    const target = {
      id: `coach-${i + 1}`,
      source: "coach" as const,
      day: c.day - 1,
      slot: c.slot - 1,
      reason: c.reason,
    };
    switch (c.op) {
      case "swap":
        return {
          ...target,
          op: "swap",
          exerciseId: idByName.get(normaliseName(c.exercise)) ?? c.exercise,
        };
      case "sets":
        return { ...target, op: "sets", sets: c.sets };
      case "reps":
        return { ...target, op: "reps", reps: c.reps };
      case "remove":
        return { ...target, op: "remove" };
    }
  });
  return { ok: true, changes };
}
