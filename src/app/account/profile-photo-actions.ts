"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { originalKeyFor, profilePhotoFolder } from "@/lib/photos/avatar";
import { PhotoError, processPhoto, type CropArea } from "@/lib/photos/process";
import { getPhotoStorage } from "@/lib/storage";

export type ProfilePhotoState = {
  status: "idle" | "saved" | "removed" | "error";
  message?: string;
};

// Profile photos are shown small and round, so a 512 px square is plenty.
const PROFILE_PHOTO_SIDE = 512;
const UNAVAILABLE = "Your photo can't be saved right now. Try again later.";
const BAD_FRAMING = "That framing couldn't be used. Try again.";

const CROP_FIELDS = ["cropLeft", "cropTop", "cropWidth", "cropHeight"] as const;
const cropSchema = z.object({
  cropLeft: z.coerce.number().finite().min(0),
  cropTop: z.coerce.number().finite().min(0),
  cropWidth: z.coerce.number().finite().positive(),
  cropHeight: z.coerce.number().finite().positive(),
});

// The framing chosen in the photo editor. No crop fields means the photo
// was sent without the editor, so the server picks the square itself.
function readCrop(formData: FormData): CropArea | undefined | "invalid" {
  const values = Object.fromEntries(
    CROP_FIELDS.map((name) => [name, formData.get(name)]),
  );
  if (Object.values(values).every((value) => value === null)) return undefined;
  const parsed = cropSchema.safeParse(values);
  if (!parsed.success) return "invalid";
  return {
    left: parsed.data.cropLeft,
    top: parsed.data.cropTop,
    width: parsed.data.cropWidth,
    height: parsed.data.cropHeight,
  };
}

function photoProblem(error: unknown): ProfilePhotoState {
  return {
    status: "error",
    message:
      error instanceof PhotoError
        ? error.message
        : "That photo couldn't be processed. Try another one.",
  };
}

// Pages that show the profile photo.
function refreshPages() {
  revalidatePath("/account");
  revalidatePath("/progress/photos");
}

async function currentImage(userId: string) {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  return user?.image ?? null;
}

// Deletes an old profile photo and its original, but only files in this
// user's folder. A failure leaves private files behind, never a broken page.
async function deleteOldPhoto(userId: string, image: string | null) {
  if (!image?.startsWith(profilePhotoFolder(userId))) return;
  try {
    const storage = getPhotoStorage();
    await Promise.all([
      storage.delete(image),
      storage.delete(originalKeyFor(image)),
    ]);
  } catch {
    // The photo is already replaced or removed for the user.
  }
}

export async function uploadProfilePhoto(
  _previousState: ProfilePhotoState,
  formData: FormData,
): Promise<ProfilePhotoState> {
  // Outside try/catch, so a signed-out user is still redirected to sign in.
  const user = await requireUser();

  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return { status: "error", message: "Choose a photo to upload." };
  }

  const crop = readCrop(formData);
  if (crop === "invalid") {
    return { status: "error", message: BAD_FRAMING };
  }

  // The cropped photo people see, and the full original for editing later.
  let photo: Awaited<ReturnType<typeof processPhoto>>;
  let original: Awaited<ReturnType<typeof processPhoto>>;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    [photo, original] = await Promise.all([
      processPhoto(input, {
        square: true,
        maxSide: PROFILE_PHOTO_SIDE,
        crop,
      }),
      processPhoto(input),
    ]);
  } catch (error) {
    return photoProblem(error);
  }

  const key = `${profilePhotoFolder(user.id)}${randomUUID()}.webp`;
  const originalKey = originalKeyFor(key);
  let storage: ReturnType<typeof getPhotoStorage>;
  try {
    storage = getPhotoStorage();
    await storage.put(originalKey, original.body, original.contentType);
    await storage.put(key, photo.body, photo.contentType);
  } catch {
    await deleteOldPhoto(user.id, key);
    return { status: "error", message: UNAVAILABLE };
  }

  let previous: string | null;
  try {
    previous = await currentImage(user.id);
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.update({
      where: { id: user.id },
      data: { image: key },
    });
  } catch {
    // The old photo is still in place, so remove the new files again.
    await deleteOldPhoto(user.id, key);
    return { status: "error", message: UNAVAILABLE };
  }

  // Only after the new photo is saved, so the user never ends up without one.
  await deleteOldPhoto(user.id, previous);
  refreshPages();
  return { status: "saved" };
}

// Changes the framing of the current profile photo, cropping again from
// its full original so the user can zoom back out or move past the old edges.
export async function editProfilePhoto(
  _previousState: ProfilePhotoState,
  formData: FormData,
): Promise<ProfilePhotoState> {
  const user = await requireUser();

  const crop = readCrop(formData);
  if (crop === undefined || crop === "invalid") {
    return { status: "error", message: BAD_FRAMING };
  }

  let image: string | null;
  let source: Buffer | null;
  let storage: ReturnType<typeof getPhotoStorage>;
  try {
    image = await currentImage(user.id);
    if (!image?.startsWith(profilePhotoFolder(user.id))) {
      return { status: "error", message: "There's no photo to edit." };
    }
    storage = getPhotoStorage();
    source = await storage.get(originalKeyFor(image));
  } catch {
    return { status: "error", message: UNAVAILABLE };
  }
  if (source === null) {
    return {
      status: "error",
      message: "This photo can't be edited. Choose it again to reframe it.",
    };
  }

  let photo: Awaited<ReturnType<typeof processPhoto>>;
  try {
    photo = await processPhoto(source, {
      square: true,
      maxSide: PROFILE_PHOTO_SIDE,
      crop,
    });
  } catch (error) {
    return photoProblem(error);
  }

  try {
    // Same key, so nothing in the database changes. Links are signed fresh
    // on every page load, so the new framing shows straight away.
    await storage.put(image, photo.body, photo.contentType);
  } catch {
    return { status: "error", message: UNAVAILABLE };
  }

  refreshPages();
  return { status: "saved" };
}

export async function removeProfilePhoto(): Promise<ProfilePhotoState> {
  const user = await requireUser();

  let previous: string | null;
  try {
    previous = await currentImage(user.id);
    if (previous === null) return { status: "removed" };
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.update({
      where: { id: user.id },
      data: { image: null },
    });
  } catch {
    return {
      status: "error",
      message: "Your photo couldn't be removed. Try again.",
    };
  }

  await deleteOldPhoto(user.id, previous);
  refreshPages();
  return { status: "removed" };
}
