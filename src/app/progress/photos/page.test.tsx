import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";

const { requireUser, findMany, findUnique, storage } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  storage: { get: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: { progressPhoto: { findMany }, user: { findUnique } },
}));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: storage.get }));
vi.mock("./actions", () => ({
  uploadProgressPhoto: vi.fn(),
  deleteProgressPhoto: vi.fn(),
}));
import ProgressPhotosPage, { photosToShow } from "./page";

async function render(show?: string) {
  return renderToStaticMarkup(
    await ProgressPhotosPage({ searchParams: Promise.resolve({ show }) }),
  );
}

const AVATAR =
  "profile/session-owner/0b9c1f0e-5d1a-4c5e-9f7a-2a1b3c4d5e6f.webp";

function photoRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    storageKey: `progress/session-owner/${index + 1}.webp`,
    takenAt: new Date("2026-11-12T17:00:00Z"),
    weightKg: null,
    note: null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  requireUser.mockResolvedValue({ id: "session-owner", name: "Free Demo" });
  findUnique.mockResolvedValue({ image: null });
  storage.get.mockReturnValue(new MemoryStorage());
  findMany.mockResolvedValue([]);
});

describe("progress photos page", () => {
  it("loads only the signed-in user's photos, newest first", async () => {
    await render();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "session-owner" },
        orderBy: { takenAt: "desc" },
      }),
    );
  });

  it("shows each photo through a signed link, with its details", async () => {
    findMany.mockResolvedValue([
      {
        id: 7,
        storageKey: "progress/session-owner/a.webp",
        takenAt: new Date("2026-11-12T17:00:00Z"),
        weightKg: { toString: () => "72.50" },
        note: "Week 4",
      },
    ]);
    const html = await render();
    expect(html).toContain(
      'src="memory://progress/session-owner/a.webp?expires=300"',
    );
    expect(html).toContain("72.5 kg");
    expect(html).toContain("Week 4");
    expect(html).toContain('value="7"');
  });

  it("shows dates in Toronto time", async () => {
    findMany.mockResolvedValue([
      {
        id: 1,
        storageKey: "k",
        // 11 p.m. on 12 November in Toronto, already 13 November in UTC.
        takenAt: new Date("2026-11-13T04:00:00Z"),
        weightKg: null,
        note: null,
      },
    ]);
    const html = await render();
    expect(html).toContain("Nov 12, 2026");
    expect(html).not.toContain("Nov 13, 2026");
  });

  it("shows the signed-in user's name with an icon when there is no profile photo", async () => {
    const html = await render();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "session-owner" },
      select: { image: true },
    });
    expect(html).toContain("Free Demo");
    expect(html).toContain('data-testid="avatar-icon"');
  });

  it("shows the profile photo through a signed link when there is one", async () => {
    findUnique.mockResolvedValue({ image: AVATAR });
    const html = await render();
    expect(html).toContain(`src="memory://${AVATAR}?expires=300"`);
    expect(html).not.toContain('data-testid="avatar-icon"');
  });

  it("won't sign another user's photo saved as this user's image", async () => {
    findUnique.mockResolvedValue({
      image: "profile/someone-else/0b9c1f0e-5d1a-4c5e-9f7a-2a1b3c4d5e6f.webp",
    });
    const html = await render();
    expect(html).not.toContain("someone-else");
    expect(html).toContain('data-testid="avatar-icon"');
  });

  it("shows the first 24 photos and offers more when there are more", async () => {
    findMany.mockResolvedValue(photoRows(25));
    const html = await render();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
    expect(html.match(/<img/g)).toHaveLength(24);
    expect(html).toContain("Show more photos");
    expect(html).toContain('href="/progress/photos?show=48"');
  });

  it("shows more photos after Show more, and no button at the end", async () => {
    findMany.mockResolvedValue(photoRows(30));
    const html = await render("48");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 49 }),
    );
    expect(html.match(/<img/g)).toHaveLength(30);
    expect(html).not.toContain("Show more photos");
  });

  it("labels each delete button with its photo's date", async () => {
    findMany.mockResolvedValue(photoRows(1));
    expect(await render()).toContain(
      'aria-label="Delete photo from Nov 12, 2026"',
    );
  });

  it("tells users how many photos they can keep", async () => {
    expect(await render()).toContain("you can keep up to 1,000 photos");
  });

  it("invites a first photo when there are none", async () => {
    expect(await render()).toContain("No photos yet.");
  });

  it("still offers the upload form when storage is unavailable", async () => {
    findMany.mockResolvedValue([
      {
        id: 1,
        storageKey: "k",
        takenAt: new Date(),
        weightKg: null,
        note: null,
      },
    ]);
    storage.get.mockImplementation(() => {
      throw new Error("Photo storage is not set up. Missing: R2_BUCKET");
    });
    const html = await render();
    expect(html).toContain("Photos can&#x27;t be shown right now.");
    expect(html).not.toContain("R2_BUCKET");
    expect(html).toContain('name="photo"');
    expect(html).toContain("Free Demo");
    expect(html).toContain('data-testid="avatar-icon"');
    expect(console.error).toHaveBeenCalledWith(
      "[photos] gallery: couldn't sign photo links",
      expect.objectContaining({ userId: "session-owner" }),
    );
  });

  it("does not render for a signed-out user", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(render()).rejects.toThrow("redirect:/sign-in");
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("photosToShow", () => {
  it.each([
    [undefined, 24],
    ["48", 48],
    ["abc", 24],
    ["2.5", 24],
    ["-5", 24],
    ["10", 24],
    ["999999", 1000],
    [["72", "96"], 72],
  ])("turns %j into %i", (value, expected) => {
    expect(photosToShow(value)).toBe(expected);
  });
});
