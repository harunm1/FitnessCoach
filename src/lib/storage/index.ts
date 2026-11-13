import "server-only";
import { R2Storage, readR2Config } from "./r2";
import type { PhotoStorage } from "./types";

export type { PhotoStorage } from "./types";

let storage: PhotoStorage | undefined;

// The app's photo storage, created on first use. Pages that never touch
// photos (and CI) don't need the R2 settings.
export function getPhotoStorage(): PhotoStorage {
  storage ??= new R2Storage(readR2Config());
  return storage;
}
