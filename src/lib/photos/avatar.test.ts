import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";

const { findUnique, storage } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  storage: { get: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: storage.get }));
import { loadAvatar, originalKeyFor, profilePhotoFolder } from "./avatar";

const KEY = "profile/u1/0b9c1f0e-5d1a-4c5e-9f7a-2a1b3c4d5e6f.webp";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  storage.get.mockReturnValue(new MemoryStorage());
});

describe("loadAvatar", () => {
  it("signs the photo and its original for editing", async () => {
    findUnique.mockResolvedValue({ image: KEY });
    expect(await loadAvatar("u1")).toEqual({
      url: `memory://${KEY}?expires=300`,
      editUrl: `memory://${KEY.replace(".webp", ".original.webp")}?expires=300`,
      editKey: KEY,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { image: true },
    });
  });

  it("shows a web address as it is, without an editor", async () => {
    findUnique.mockResolvedValue({ image: "https://example.com/me.png" });
    expect(await loadAvatar("u1")).toEqual({
      url: "https://example.com/me.png",
      editUrl: null,
      editKey: null,
    });
  });

  it.each([
    [
      "another user's photo",
      "profile/u2/0b9c1f0e-5d1a-4c5e-9f7a-2a1b3c4d5e6f.webp",
    ],
    ["a path that climbs out of the folder", "profile/u1/../u2/x.webp"],
  ])("shows nothing for %s", async (_name, image) => {
    findUnique.mockResolvedValue({ image });
    expect(await loadAvatar("u1")).toBeNull();
  });

  it("returns null when the user has no profile photo", async () => {
    findUnique.mockResolvedValue({ image: null });
    expect(await loadAvatar("u1")).toBeNull();
  });

  it("returns null instead of failing when storage is unavailable", async () => {
    findUnique.mockResolvedValue({ image: KEY });
    storage.get.mockImplementation(() => {
      throw new Error("Missing: R2_BUCKET");
    });
    expect(await loadAvatar("u1")).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "[photos] profile: couldn't load the photo",
      expect.objectContaining({ userId: "u1" }),
    );
  });

  it("returns null instead of failing when the database is unavailable", async () => {
    findUnique.mockRejectedValue(new Error("connection refused"));
    expect(await loadAvatar("u1")).toBeNull();
  });
});

describe("profilePhotoFolder", () => {
  it("keeps each user's profile photos in their own folder", () => {
    expect(profilePhotoFolder("u1")).toBe("profile/u1/");
  });
});

describe("originalKeyFor", () => {
  it("keeps the original beside the photo", () => {
    expect(originalKeyFor("profile/u1/abc.webp")).toBe(
      "profile/u1/abc.original.webp",
    );
  });
});
