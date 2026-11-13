import { describe, expect, it } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";
import {
  isOwnProfileKey,
  signAvatar,
  signPhotos,
  VIEW_LINK_SECONDS,
  type PhotoRow,
} from "./gallery";

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

  it("sends only the expiring link, not the key as its own field", async () => {
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

const KEY = "profile/u1/0b9c1f0e-5d1a-4c5e-9f7a-2a1b3c4d5e6f.webp";

describe("isOwnProfileKey", () => {
  it("accepts a profile photo in the user's own folder", () => {
    expect(isOwnProfileKey("u1", KEY)).toBe(true);
  });

  it.each([
    ["another user's photo", "u2", KEY],
    ["a user id that only starts the same", "u", KEY],
    ["a progress photo", "u1", KEY.replace("profile/", "progress/")],
    ["a path that climbs out of the folder", "u1", "profile/u1/../u2/x.webp"],
    [
      "a nested folder",
      "u1",
      "profile/u1/x/0b9c1f0e-5d1a-4c5e-9f7a-2a1b3c4d5e6f.webp",
    ],
    ["a name that isn't a random id", "u1", "profile/u1/me.webp"],
    ["the full-size original", "u1", KEY.replace(".webp", ".original.webp")],
    ["another file type", "u1", KEY.replace(".webp", ".png")],
    [
      "an empty user id",
      "",
      "profile//0b9c1f0e-5d1a-4c5e-9f7a-2a1b3c4d5e6f.webp",
    ],
  ])("refuses %s", (_name, userId, key) => {
    expect(isOwnProfileKey(userId, key)).toBe(false);
  });
});

describe("signAvatar", () => {
  it("has no link when the user has no profile photo", async () => {
    expect(await signAvatar("u1", null, new MemoryStorage())).toBeNull();
    expect(await signAvatar("u1", "", new MemoryStorage())).toBeNull();
  });

  it("signs the user's own profile photo like a progress photo", async () => {
    expect(await signAvatar("u1", KEY, new MemoryStorage())).toBe(
      `memory://${KEY}?expires=300`,
    );
  });

  it("refuses to sign another user's photo set as the image", async () => {
    expect(await signAvatar("u2", KEY, new MemoryStorage())).toBeNull();
    expect(
      await signAvatar("u1", "progress/u2/a.webp", new MemoryStorage()),
    ).toBeNull();
  });

  it("uses a full web address as it is", async () => {
    const url = "https://example.com/me.png";
    expect(await signAvatar("u1", url, new MemoryStorage())).toBe(url);
  });
});
