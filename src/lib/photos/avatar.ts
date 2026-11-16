import "server-only";
import { getPhotoStorage } from "@/lib/storage";
import { isOwnProfileKey, signAvatar, VIEW_LINK_SECONDS } from "./gallery";

// Where profile photos are stored. Only keys that isOwnProfileKey accepts
// are ever signed, edited or deleted, so a web address or someone else's
// file is never touched.
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
  // Which photo the editor is for. The edit is refused if the photo has
  // changed since (for example in another tab), so the framing chosen for
  // one photo is never applied to another.
  editKey: string | null;
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
    const url = await signAvatar(userId, image, storage);
    if (url === null || image === null) return null;
    if (!isOwnProfileKey(userId, image)) {
      return { url, editUrl: null, editKey: null };
    }
    return {
      url,
      editUrl: await storage.signedUrl(
        originalKeyFor(image),
        VIEW_LINK_SECONDS,
      ),
      editKey: image,
    };
  } catch (error) {
    console.error("[photos] profile: couldn't load the photo", {
      userId,
      error,
    });
    return null;
  }
}
