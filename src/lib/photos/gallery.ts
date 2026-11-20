import type { PhotoStorage } from "@/lib/storage/types";

// How long a viewing link works. Long enough to look at the page,
// short enough that a copied link soon stops working.
export const VIEW_LINK_SECONDS = 5 * 60;

export type PhotoRow = {
  id: number;
  storageKey: string;
  takenAt: Date;
  weightKg: { toString(): string } | null; // Prisma returns a Decimal
  note: string | null;
};

export type GalleryPhoto = {
  id: number;
  url: string;
  takenAt: Date;
  weightKg: number | null;
  note: string | null;
};

// Gives each saved photo a fresh, short-lived link. The page gets only the
// link: the storage key is part of it, but the link stops working after
// VIEW_LINK_SECONDS.
export function signPhotos(
  rows: PhotoRow[],
  storage: PhotoStorage,
): Promise<GalleryPhoto[]> {
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      url: await storage.signedUrl(row.storageKey, VIEW_LINK_SECONDS),
      takenAt: row.takenAt,
      weightKg: row.weightKg === null ? null : Number(row.weightKg.toString()),
      note: row.note,
    })),
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// True only for a profile photo the app saved in this user's own folder:
// exactly profile/<userId>/<uuid>.webp. Anything else, such as another
// user's key or a path with "..", is refused.
export function isOwnProfileKey(userId: string, key: string): boolean {
  const folder = `profile/${userId}/`;
  if (!userId || !key.startsWith(folder) || !key.endsWith(".webp")) {
    return false;
  }
  return UUID.test(key.slice(folder.length, -".webp".length));
}

// The profile photo link for the page header. Users can change User.image
// themselves through the sign-in library, so only a key in their own folder
// is signed; a full web address (for example from a sign-in provider) is
// used as it is.
export async function signAvatar(
  userId: string,
  image: string | null,
  storage: PhotoStorage,
): Promise<string | null> {
  if (!image) return null;
  if (/^https?:\/\//.test(image)) return image;
  if (!isOwnProfileKey(userId, image)) return null;
  return storage.signedUrl(image, VIEW_LINK_SECONDS);
}
