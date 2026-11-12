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

// Gives each saved photo a fresh, short-lived link. The storage key itself
// never leaves the server.
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
