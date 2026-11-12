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

beforeEach(() => {
  vi.clearAllMocks();
  storage.get.mockReturnValue(new MemoryStorage());
});

describe("loadAvatar", () => {
  it("signs the photo and its original for editing", async () => {
    findUnique.mockResolvedValue({ image: "profile/u1/me.webp" });
    expect(await loadAvatar("u1")).toEqual({
      url: "memory://profile/u1/me.webp?expires=300",
      editUrl: "memory://profile/u1/me.original.webp?expires=300",
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
    });
  });

  it("returns null when the user has no profile photo", async () => {
    findUnique.mockResolvedValue({ image: null });
    expect(await loadAvatar("u1")).toBeNull();
  });

  it("returns null instead of failing when storage is unavailable", async () => {
    findUnique.mockResolvedValue({ image: "profile/u1/me.webp" });
    storage.get.mockImplementation(() => {
      throw new Error("Missing: R2_BUCKET");
    });
    expect(await loadAvatar("u1")).toBeNull();
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
