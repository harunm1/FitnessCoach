"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
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

  let photo: Awaited<ReturnType<typeof processPhoto>>;
  try {
    photo = await processPhoto(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
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
  } catch {
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
  } catch {
    // Without a row nobody can reach the file, so remove it again.
    await storage.delete(storageKey).catch(() => undefined);
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

    await prisma.progressPhoto.delete({ where: { id: photo.id } });
    // The row is gone, so the photo is already hidden. If removing the file
    // fails, the user still sees it deleted; the file stays private in R2.
    await getPhotoStorage()
      .delete(photo.storageKey)
      .catch(() => undefined);
  } catch {
    return {
      status: "error",
      message: "That photo couldn't be deleted. Try again.",
    };
  }

  revalidatePath(PHOTOS_PATH);
  return { status: "deleted" };
}
