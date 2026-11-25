"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { parseDistanceUnit, parseWeightUnit } from "@/lib/units/convert";

export type UnitPrefsState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

// The kg/lb switch on the session screen (D30): changes the weight unit alone, so the user does
// not leave the workout. Called from the browser with the unit as a plain string.
export async function setWeightUnit(unit: string): Promise<UnitPrefsState> {
  const user = await requireUser();
  const weightUnit = parseWeightUnit(unit);
  if (!weightUnit) {
    return { status: "error", message: "Choose kg or lb." };
  }
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { weightUnit },
    });
  } catch (error) {
    console.error("[units] switching failed", { userId: user.id, error });
    return {
      status: "error",
      message: "Your unit couldn't be changed. Try again.",
    };
  }
  revalidatePath("/", "layout");
  return { status: "saved" };
}

// Saves the display units for the signed-in user (D30). The user comes from the session,
// never the form. Stored values stay kg and km, so only what is shown changes.
export async function saveUnitPrefs(
  _previousState: UnitPrefsState,
  formData: FormData,
): Promise<UnitPrefsState> {
  const user = await requireUser();
  const weightUnit = parseWeightUnit(formData.get("weightUnit"));
  const distanceUnit = parseDistanceUnit(formData.get("distanceUnit"));
  if (!weightUnit || !distanceUnit) {
    return {
      status: "error",
      message: "Choose a weight unit and a distance unit.",
    };
  }
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { weightUnit, distanceUnit },
    });
  } catch (error) {
    console.error("[units] saving failed", { userId: user.id, error });
    return {
      status: "error",
      message: "Your units couldn't be saved. Try again.",
    };
  }
  // Every page that shows a weight or a distance reads the setting.
  revalidatePath("/", "layout");
  return { status: "saved" };
}
