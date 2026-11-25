"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { dayKey } from "@/lib/progress/dates";
import { parseRunEntry } from "@/lib/progress/runEntry";
import { planDayForRun } from "@/lib/progress/runPlanDay";
import { loadPlanForRun, saveRun } from "@/lib/progress/saveRun";
import { pace } from "@/lib/progress/view";

// What the user typed, sent back with an error so the form can show it again
// (React resets a form after every action).
export type RunFormValues = {
  date: string;
  distanceKm: string;
  duration: string;
  effort: string;
  note: string;
};

export type RunActionState =
  | { status: "idle" }
  | {
      status: "saved";
      date: string;
      distanceKm: number;
      pace: string | null;
      planDayName: string | null; // the plan day this run completed
    }
  | { status: "error"; message: string; values?: RunFormValues };

const UNAVAILABLE = "Your run couldn't be saved right now. Try again.";

// A form field that is missing or a file counts as not given.
function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

// Logs one run for the signed-in user (D25). The user comes from the session,
// never the form. When the active plan's next day is a run day, the run
// completes it, as a finished session would.
export async function logRun(
  _previousState: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  // Outside try/catch, so a signed-out user is still redirected to sign in.
  const user = await requireUser();

  const fields = {
    date: text(formData.get("date")),
    distanceKm: text(formData.get("distanceKm")),
    duration: text(formData.get("duration")),
    effort: text(formData.get("effort")),
    note: text(formData.get("note")),
  };
  const values: RunFormValues = {
    date: fields.date ?? "",
    distanceKm: fields.distanceKm ?? "",
    duration: fields.duration ?? "",
    effort: fields.effort ?? "",
    note: fields.note ?? "",
  };
  const parsed = parseRunEntry(fields, dayKey(new Date()));
  if (!parsed.ok) {
    return { status: "error", message: parsed.message, values };
  }

  const run = parsed.value;
  let planDayName: string | null;
  try {
    const plan = await loadPlanForRun(user.id);
    const planDay = planDayForRun(plan, run.date);
    await saveRun(user.id, run, planDay);
    planDayName = planDay
      ? (plan?.dayNames.get(planDay.planDayId) ?? null)
      : null;
  } catch (error) {
    console.error("[run] saving failed", {
      userId: user.id,
      date: run.date,
      error,
    });
    return { status: "error", message: UNAVAILABLE, values };
  }

  revalidatePath("/progress");
  // A completed plan day moves the session screen on to the next day.
  revalidatePath("/session");
  return {
    status: "saved",
    date: run.date,
    distanceKm: run.distanceKm,
    pace: pace(run.distanceKm, run.durationSec),
    planDayName,
  };
}
