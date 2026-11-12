import { describe, expect, it } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";
import { signPhotos, VIEW_LINK_SECONDS, type PhotoRow } from "./gallery";

const row: PhotoRow = {
  id: 1,
  storageKey: "progress/u1/a.webp",
  takenAt: new Date("2026-11-12T17:00:00Z"),
  weightKg: { toString: () => "72.50" },
  note: "Week 4",
};

describe("signPhotos", () => {
  it("gives each photo a link that expires after five minutes", async () => {
    expect(VIEW_LINK_SECONDS).toBe(300);
    const [photo] = await signPhotos([row], new MemoryStorage());
    expect(photo.url).toBe("memory://progress/u1/a.webp?expires=300");
  });

  it("keeps the details and turns the weight into a number", async () => {
    const [photo] = await signPhotos([row], new MemoryStorage());
    expect(photo).toEqual({
      id: 1,
      url: expect.any(String),
      takenAt: row.takenAt,
      weightKg: 72.5,
      note: "Week 4",
    });
  });

  it("does not send the storage key to the page", async () => {
    const [photo] = await signPhotos([row], new MemoryStorage());
    expect(photo).not.toHaveProperty("storageKey");
  });

  it("leaves a missing weight or note empty", async () => {
    const [photo] = await signPhotos(
      [{ ...row, weightKg: null, note: null }],
      new MemoryStorage(),
    );
    expect(photo.weightKg).toBeNull();
    expect(photo.note).toBeNull();
  });

  it("keeps the order it was given", async () => {
    const photos = await signPhotos(
      [
        { ...row, id: 2, storageKey: "b" },
        { ...row, id: 1, storageKey: "a" },
      ],
      new MemoryStorage(),
    );
    expect(photos.map((p) => p.id)).toEqual([2, 1]);
  });

  it("returns nothing when there are no photos", async () => {
    expect(await signPhotos([], new MemoryStorage())).toEqual([]);
  });
});
