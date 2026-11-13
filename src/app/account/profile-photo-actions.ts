"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { originalKeyFor, profilePhotoFolder } from "@/lib/photos/avatar";
import { isOwnProfileKey } from "@/lib/photos/gallery";
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
const CHANGED_ELSEWHERE =
  "Your photo was changed in another tab. Refresh the page and try again.";

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

// Records what failed for whoever runs the app; the user only sees a friendly
// message. Never pass settings or keys from .env here.
function logFailure(step: string, details: Record<string, unknown>) {
  console.error(`[photos] profile ${step}`, details);
}

function photoProblem(
  error: unknown,
  details: Record<string, unknown>,
): ProfilePhotoState {
  // A PhotoError is the user's file; anything else is worth looking into.
  if (!(error instanceof PhotoError)) {
    logFailure("processing failed", { ...details, error });
  }
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

// Saves a new image only if the user's image is still the one this request
// started from. If another tab changed it in between, nothing is saved, so
// neither tab's files are left behind unseen.
async function swapImage(
  userId: string,
  from: string | null,
  to: string | null,
): Promise<boolean> {
  const { prisma } = await import("@/lib/prisma");
  const { count } = await prisma.user.updateMany({
    where: { id: userId, image: from },
    data: { image: to },
  });
  return count === 1;
}

// Deletes a profile photo and its original, but only the user's own files.
// A failure leaves private files behind, never a broken page, so it is
// logged for whoever runs the app.
async function deleteOldPhoto(userId: string, image: string | null) {
  if (!image || !isOwnProfileKey(userId, image)) return;
  try {
    const storage = getPhotoStorage();
    await Promise.all([
      storage.delete(image),
      storage.delete(originalKeyFor(image)),
    ]);
  } catch (error) {
    logFailure("removing old files failed", {
      userId,
      storageKey: image,
      error,
    });
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
    return photoProblem(error, { userId: user.id });
  }

  const key = `${profilePhotoFolder(user.id)}${randomUUID()}.webp`;
  const originalKey = originalKeyFor(key);
  let storage: ReturnType<typeof getPhotoStorage>;
  try {
    storage = getPhotoStorage();
    await storage.put(originalKey, original.body, original.contentType);
    await storage.put(key, photo.body, photo.contentType);
  } catch (error) {
    logFailure("upload: saving to storage failed", {
      userId: user.id,
      storageKey: key,
      error,
    });
    await deleteOldPhoto(user.id, key);
    return { status: "error", message: UNAVAILABLE };
  }

  let previous: string | null;
  try {
    previous = await currentImage(user.id);
    if (!(await swapImage(user.id, previous, key))) {
      // Another tab saved a photo meanwhile; keep theirs, drop ours.
      await deleteOldPhoto(user.id, key);
      return { status: "error", message: CHANGED_ELSEWHERE };
    }
  } catch (error) {
    logFailure("upload: saving the photo failed", {
      userId: user.id,
      storageKey: key,
      error,
    });
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
  // The photo the editor was opened for. The framing was chosen on it, so
  // it must not be applied to a photo saved since in another tab.
  const editing = formData.get("photoKey");

  let image: string | null;
  let source: Buffer | null;
  let storage: ReturnType<typeof getPhotoStorage>;
  try {
    image = await currentImage(user.id);
    if (!image || !isOwnProfileKey(user.id, image)) {
      return { status: "error", message: "There's no photo to edit." };
    }
    if (editing !== image) {
      return { status: "error", message: CHANGED_ELSEWHERE };
    }
    storage = getPhotoStorage();
    source = await storage.get(originalKeyFor(image));
  } catch (error) {
    logFailure("edit: loading the original failed", {
      userId: user.id,
      error,
    });
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
    return photoProblem(error, { userId: user.id, storageKey: image });
  }

  try {
    // Same key, so nothing in the database changes. Links are signed fresh
    // on every page load, so the new framing shows straight away.
    await storage.put(image, photo.body, photo.contentType);
  } catch (error) {
    logFailure("edit: saving to storage failed", {
      userId: user.id,
      storageKey: image,
      error,
    });
    return { status: "error", message: UNAVAILABLE };
  }

  // If another tab replaced the photo meanwhile, this file is no longer
  // used, so remove it rather than leave it behind.
  try {
    if ((await currentImage(user.id)) !== image) {
      await deleteOldPhoto(user.id, image);
      return { status: "error", message: CHANGED_ELSEWHERE };
    }
  } catch (error) {
    logFailure("edit: checking the current photo failed", {
      userId: user.id,
      storageKey: image,
      error,
    });
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
    if (!(await swapImage(user.id, previous, null))) {
      return { status: "error", message: CHANGED_ELSEWHERE };
    }
  } catch (error) {
    logFailure("remove failed", { userId: user.id, error });
    return {
      status: "error",
      message: "Your photo couldn't be removed. Try again.",
    };
  }

  await deleteOldPhoto(user.id, previous);
  refreshPages();
  return { status: "removed" };
}
