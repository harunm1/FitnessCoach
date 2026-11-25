"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createExport, ExportError } from "@/lib/exports/create";
import { getPhotoStorage } from "@/lib/storage";

export type ExportActionState = {
  status: "idle" | "created" | "error";
  message?: string;
};

const DATA_PATH = "/account/data";
const UNAVAILABLE = "The export couldn't be made right now. Try again later.";

// The kinds a button on the page can ask for.
const kindSchema = z.enum(["WORKOUT_CSV", "COACH_CSV"]);

const MESSAGES = {
  "rate-limited": "You've made a lot of exports this hour. Try again later.",
  "too-large": "That export is too large to make. Contact the team.",
  unsupported: UNAVAILABLE,
} as const;

export async function createDataExport(
  _previousState: ExportActionState,
  formData: FormData,
): Promise<ExportActionState> {
  // Outside try/catch, so a signed-out user is still redirected to sign in.
  const user = await requireUser();

  const kind = kindSchema.safeParse(formData.get("kind"));
  if (!kind.success) {
    return { status: "error", message: "Choose an export to make." };
  }

  try {
    await createExport(user.id, kind.data, { storage: getPhotoStorage() });
  } catch (error) {
    if (error instanceof ExportError) {
      return { status: "error", message: MESSAGES[error.code] };
    }
    console.error("[exports] create failed", {
      userId: user.id,
      kind: kind.data,
      error,
    });
    return { status: "error", message: UNAVAILABLE };
  }

  revalidatePath(DATA_PATH);
  return { status: "created" };
}
