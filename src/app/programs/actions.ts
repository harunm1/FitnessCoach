"use server";
// Program templates (D38). adaptProgram asks the coach to adapt a template and always
// answers: the coach's changes, or the template fitted by rule with a plain note.
// saveProgram re-checks the user's accepted changes on the server and saves the result
// as the active plan, or saves nothing and says why.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { coachModel } from "@/lib/coach/providers";
import type { PlanModel } from "@/lib/coach/generatePlan";
import { savePlanData } from "@/lib/coach/saveWeek";
import {
  ADAPT_TIMEOUT_MS,
  adaptTemplate,
  type Adaptation,
} from "@/lib/programs/adapt";
import { applyChanges, changeListSchema } from "@/lib/programs/changes";
import { loadProgramContext } from "@/lib/programs/context";
import { checkProgram } from "@/lib/programs/guardrails";
import { programToPlanData } from "@/lib/programs/save";
import { getTemplate } from "@/lib/programs/templates";
import { WEEKDAYS } from "@/lib/programs/templateSchema";

const NO_QUIZ =
  "Take the quiz first, so the coach knows your days and equipment.";
const NO_TEMPLATE = "That template does not exist.";

export type AdaptResult =
  | { status: "ok"; adaptation: Adaptation; names: Record<string, string> }
  | { status: "error"; message: string };

export type SaveResult =
  { status: "ok"; planId: number } | { status: "error"; message: string };

// No key, or a bad COACH_PROVIDER, is one more reason to serve the template.
function programModel(): PlanModel {
  try {
    return coachModel(process.env, { retries: 0, timeoutMs: ADAPT_TIMEOUT_MS });
  } catch (error) {
    return async () => {
      throw error;
    };
  }
}

export async function adaptProgram(templateId: string): Promise<AdaptResult> {
  const user = await requireUser();
  const template = getTemplate(templateId);
  if (!template) return { status: "error", message: NO_TEMPLATE };
  const ctx = await loadProgramContext(user.id);
  if (!ctx) return { status: "error", message: NO_QUIZ };
  const adaptation = await adaptTemplate(
    programModel(),
    template,
    ctx.profile,
    ctx.library,
    ctx.about,
  );
  // Names for every exercise the review shows: the template's and any swapped in.
  const shown = new Set([
    ...template.days.flatMap((d) => d.exercises.map((s) => s.exerciseId)),
    ...adaptation.changes.flatMap((c) =>
      c.op === "swap" ? [c.exerciseId] : [],
    ),
  ]);
  const names = Object.fromEntries(
    ctx.library
      .filter((e) => shown.has(e.id))
      .map((e) => [e.id, e.name ?? e.id]),
  );
  return { status: "ok", adaptation, names };
}

// Caps on untrusted input sizes, far above anything the page sends.
const MAX_ID = 80;
const MAX_CHANGE_ID = 40;
const MAX_ACCEPTED = 200;

const saveInputSchema = z.object({
  templateId: z.string().min(1).max(MAX_ID),
  changes: changeListSchema,
  accepted: z.array(z.string().min(1).max(MAX_CHANGE_ID)).max(MAX_ACCEPTED),
  weekdays: z.array(z.array(z.enum(WEEKDAYS)).min(1).max(WEEKDAYS.length)),
});
export type SaveProgramInput = z.infer<typeof saveInputSchema>;

export async function saveProgram(
  input: SaveProgramInput,
): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = saveInputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "That program could not be read." };
  }
  const { templateId, changes, accepted, weekdays } = parsed.data;
  const template = getTemplate(templateId);
  if (!template) return { status: "error", message: NO_TEMPLATE };
  const ctx = await loadProgramContext(user.id);
  if (!ctx) return { status: "error", message: NO_QUIZ };

  const allDays = weekdays.flat();
  if (
    weekdays.length !== template.days.length ||
    new Set(allDays).size !== allDays.length
  ) {
    return {
      status: "error",
      message: "Give each training day its own weekday.",
    };
  }
  const { plan, problems } = applyChanges(template, changes, new Set(accepted));
  const library = new Map(ctx.library.map((e) => [e.id, e]));
  const all = [
    ...problems,
    ...checkProgram(plan, { template, library, profile: ctx.profile }),
  ];
  if (all.length > 0) {
    return {
      status: "error",
      message: `This program cannot be saved yet: ${all.join("; ")}.`,
    };
  }
  const { planId } = await savePlanData(
    prisma,
    user.id,
    programToPlanData(user.id, template, plan, weekdays),
  );
  revalidatePath("/programs");
  revalidatePath("/session");
  return { status: "ok", planId };
}
