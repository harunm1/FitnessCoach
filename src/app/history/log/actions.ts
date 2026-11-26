"use server";

// The "Log a past workout" Server Action for strength (D49, #194). The form sends its
// exercises and sets as one JSON field, so a workout of many sets is one action, one
// check and one write. The user comes from the session, never the form. A run is logged by
// the existing Progress action (D27), which this page reuses.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/progress/dates";
import { parsePastStrength } from "@/lib/workout/pastStrength";
import { savePastStrength } from "@/lib/workout/savePastStrength";
import { WEIGHT_UNIT_MESSAGE, readWeightUnit } from "@/lib/units/input";

export type PastStrengthState =
  | { status: "idle" }
  | {
      status: "saved";
      date: string;
      exercises: number;
      sets: number;
    }
  | { status: "error"; message: string };

const UNREADABLE = "Your workout couldn't be read. Try again.";
const UNAVAILABLE = "Your workout couldn't be saved right now. Try again.";
const UNKNOWN_EXERCISE = "Choose each exercise from the list.";

// The form's JSON, or undefined when it is missing or not JSON.
function readEntry(formData: FormData): unknown {
  const text = formData.get("entry");
  if (typeof text !== "string") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function logPastStrength(
  _previous: PastStrengthState,
  formData: FormData,
): Promise<PastStrengthState> {
  // Outside try/catch, so a signed-out user is still redirected to sign in.
  const user = await requireUser();

  const unit = readWeightUnit(formData);
  if (!unit) return { status: "error", message: WEIGHT_UNIT_MESSAGE };
  const raw = readEntry(formData);
  if (raw === undefined) return { status: "error", message: UNREADABLE };
  const parsed = parsePastStrength(raw, dayKey(new Date()), unit);
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const entry = parsed.value;
  try {
    const ids = entry.exercises.map((exercise) => exercise.exerciseId);
    const known = await prisma.exercise.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (known.length !== ids.length) {
      return { status: "error", message: UNKNOWN_EXERCISE };
    }
    await savePastStrength(user.id, entry);
  } catch (error) {
    // The user sees a plain message; the log keeps the cause.
    console.error("[past-workout] saving failed", {
      userId: user.id,
      date: entry.date,
      error,
    });
    return { status: "error", message: UNAVAILABLE };
  }

  revalidatePath("/history");
  revalidatePath("/progress");
  return {
    status: "saved",
    date: entry.date,
    exercises: entry.exercises.length,
    sets: entry.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0,
    ),
  };
}
