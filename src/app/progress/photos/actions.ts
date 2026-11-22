"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { MAX_PHOTOS_PER_USER } from "@/lib/photos/limits";
import { PhotoError, processPhoto } from "@/lib/photos/process";
import { getPhotoStorage } from "@/lib/storage";

export type PhotoActionState = {
  status: "idle" | "saved" | "deleted" | "error";
  message?: string;
};

const PHOTOS_PATH = "/progress/photos";
const UNAVAILABLE = "Photos can't be saved right now. Try again later.";
const NOT_FOUND = "That photo couldn't be found.";

const weightMessage = "Enter a weight between 20 and 400 kg.";
const detailsSchema = z.object({
  weightKg: z.coerce
    .number({ error: weightMessage })
    .min(20, weightMessage)
    .max(400, weightMessage)
    .optional(),
  note: z.string().max(300, "Keep the note to 300 characters.").optional(),
});

const photoIdSchema = z.coerce.number().int().positive();

// Records what failed for whoever runs the app; the user only sees a friendly
// message. Never pass settings or keys from .env here.
function logFailure(step: string, details: Record<string, unknown>) {
  console.error(`[photos] ${step}`, details);
}

// A blank form field means "not given".
function optionalText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export async function uploadProgressPhoto(
  _previousState: PhotoActionState,
  formData: FormData,
): Promise<PhotoActionState> {
  // Outside try/catch, so a signed-out user is still redirected to sign in.
  const user = await requireUser();

  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return { status: "error", message: "Choose a photo to upload." };
  }

  const details = detailsSchema.safeParse({
    weightKg: optionalText(formData.get("weightKg")),
    note: optionalText(formData.get("note")),
  });
  if (!details.success) {
    return {
      status: "error",
      message: details.error.issues[0]?.message ?? "Check the photo details.",
    };
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    // Counted before saving, so two uploads at the same moment can go a photo
    // or two past the cap. That's harmless at this scale and avoids locking.
    const saved = await prisma.progressPhoto.count({
      where: { userId: user.id },
    });
    if (saved >= MAX_PHOTOS_PER_USER) {
      return {
        status: "error",
        message: `You can keep up to ${MAX_PHOTOS_PER_USER.toLocaleString("en-CA")} photos. Delete some to add more.`,
      };
    }
  } catch (error) {
    logFailure("upload: couldn't count photos", { userId: user.id, error });
    return { status: "error", message: UNAVAILABLE };
  }

  let photo: Awaited<ReturnType<typeof processPhoto>>;
  try {
    photo = await processPhoto(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    // A PhotoError is the user's file; anything else is worth looking into.
    if (!(error instanceof PhotoError)) {
      logFailure("upload: processing failed", { userId: user.id, error });
    }
    return {
      status: "error",
      message:
        error instanceof PhotoError
          ? error.message
          : "That photo couldn't be processed. Try another one.",
    };
  }

  // A random name, so keys can't be guessed and never clash.
  const storageKey = `progress/${user.id}/${randomUUID()}.webp`;
  let storage: ReturnType<typeof getPhotoStorage>;
  try {
    storage = getPhotoStorage();
    await storage.put(storageKey, photo.body, photo.contentType);
  } catch (error) {
    logFailure("upload: saving to storage failed", {
      userId: user.id,
      storageKey,
      error,
    });
    return { status: "error", message: UNAVAILABLE };
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.progressPhoto.create({
      data: {
        userId: user.id,
        storageKey,
        weightKg: details.data.weightKg,
        note: details.data.note,
      },
    });
  } catch (error) {
    logFailure("upload: saving the photo row failed", {
      userId: user.id,
      storageKey,
      error,
    });
    // Without a row nobody can reach the file, so remove it again.
    await storage.delete(storageKey).catch((cleanupError: unknown) => {
      logFailure("upload: removing the unsaved file failed", {
        userId: user.id,
        storageKey,
        error: cleanupError,
      });
    });
    return { status: "error", message: UNAVAILABLE };
  }

  revalidatePath(PHOTOS_PATH);
  return { status: "saved" };
}

export async function deleteProgressPhoto(
  _previousState: PhotoActionState,
  formData: FormData,
): Promise<PhotoActionState> {
  const user = await requireUser();

  const photoId = photoIdSchema.safeParse(formData.get("photoId"));
  if (!photoId.success) {
    return { status: "error", message: NOT_FOUND };
  }

  let storageKey: string | undefined;
  try {
    const { prisma } = await import("@/lib/prisma");
    // Only the owner's photos match, so nobody can delete someone else's.
    const photo = await prisma.progressPhoto.findFirst({
      where: { id: photoId.data, userId: user.id },
      select: { id: true, storageKey: true },
    });
    if (!photo) {
      return { status: "error", message: NOT_FOUND };
    }
    storageKey = photo.storageKey;

    // The file goes first. If that fails, the row stays, the photo stays in
    // the gallery and the user can try again, so no file is left behind
    // unseen. Deleting a file that's already gone succeeds, so a retry after
    // a database failure finishes the job.
    await getPhotoStorage().delete(photo.storageKey);
    await prisma.progressPhoto.delete({ where: { id: photo.id } });
  } catch (error) {
    logFailure("delete failed", {
      userId: user.id,
      photoId: photoId.data,
      storageKey,
      error,
    });
    return {
      status: "error",
      message: "That photo couldn't be deleted. Try again.",
    };
  }

  revalidatePath(PHOTOS_PATH);
  return { status: "deleted" };
}
