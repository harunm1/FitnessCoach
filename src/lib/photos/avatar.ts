import "server-only";
import { getPhotoStorage } from "@/lib/storage";
import { signAvatar, VIEW_LINK_SECONDS } from "./gallery";

// Where profile photos are stored. Only keys in the user's own folder are
// ever deleted, so a web address or someone else's file is never touched.
export function profilePhotoFolder(userId: string) {
  return `profile/${userId}/`;
}

// Each profile photo is kept twice: the round-cropped photo people see,
// and the full original beside it, so the framing can be changed later.
export function originalKeyFor(photoKey: string) {
  return photoKey.replace(/\.webp$/, ".original.webp");
}

export type Avatar = {
  // The profile photo itself.
  url: string;
  // The full original for the photo editor, or null when it can't be edited.
  editUrl: string | null;
};

// Short-lived links to the user's profile photo, or null when they have
// none or storage is unavailable, so pages can fall back to initials.
export async function loadAvatar(userId: string): Promise<Avatar | null> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });
    const image = user?.image ?? null;
    const storage = getPhotoStorage();
    const url = await signAvatar(image, storage);
    if (url === null) return null;
    const editable = image?.startsWith(profilePhotoFolder(userId)) ?? false;
    return {
      url,
      editUrl: editable
        ? await storage.signedUrl(
            originalKeyFor(image ?? ""),
            VIEW_LINK_SECONDS,
          )
        : null,
    };
  } catch {
    return null;
  }
}
