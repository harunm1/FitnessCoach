"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/progress/dates";
import { parseWeightEntry } from "@/lib/progress/weight";
import {
  WEIGHT_UNIT_MESSAGE,
  readWeightUnit,
  weightFieldToKg,
} from "@/lib/units/input";

export type WeightActionState =
  | { status: "idle" }
  | { status: "saved"; date: string }
  | { status: "error"; message: string; values?: WeightFormValues };

// What the user typed, sent back with an error so the form can show it again
// (React resets a form after every action).
export type WeightFormValues = { date: string; weightKg: string; note: string };

const PROGRESS_PATH = "/progress";
const UNAVAILABLE = "Your weight couldn't be saved right now. Try again.";

// A form field that is missing or a file counts as not given.
function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

// Saves one weigh-in for the signed-in user (D24, #16). The user comes from
// the session, never the form, and logging a day again replaces that day.
export async function logBodyWeight(
  _previousState: WeightActionState,
  formData: FormData,
): Promise<WeightActionState> {
  // Outside try/catch, so a signed-out user is still redirected to sign in.
  const user = await requireUser();

  const fields = {
    date: text(formData.get("date")),
    weightKg: text(formData.get("weightKg")),
    note: text(formData.get("note")),
  };
  const values: WeightFormValues = {
    date: fields.date ?? "",
    weightKg: fields.weightKg ?? "",
    note: fields.note ?? "",
  };
  const unit = readWeightUnit(formData);
  if (!unit) {
    return { status: "error", message: WEIGHT_UNIT_MESSAGE, values };
  }
  // Typed in the unit the form showed; checked and stored in kg (D29).
  const parsed = parseWeightEntry(
    { ...fields, weightKg: weightFieldToKg(fields.weightKg, unit) },
    dayKey(new Date()),
    unit,
  );
  if (!parsed.ok) {
    return { status: "error", message: parsed.message, values };
  }

  const { date, weightKg, note } = parsed.value;
  // A Postgres date column: midnight UTC names the day without a time zone shift.
  const day = new Date(`${date}T00:00:00Z`);
  try {
    await prisma.bodyWeight.upsert({
      where: { userId_date: { userId: user.id, date: day } },
      create: { userId: user.id, date: day, weightKg, note },
      update: { weightKg, note },
    });
  } catch (error) {
    console.error("[weight] saving failed", { userId: user.id, date, error });
    return { status: "error", message: UNAVAILABLE, values };
  }

  revalidatePath(PROGRESS_PATH);
  return { status: "saved", date };
}
