import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";

const { requireUser, findMany, storage } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findMany: vi.fn(),
  storage: { get: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { progressPhoto: { findMany } } }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: storage.get }));
vi.mock("./actions", () => ({
  uploadProgressPhoto: vi.fn(),
  deleteProgressPhoto: vi.fn(),
}));
import ProgressPhotosPage from "./page";

async function render() {
  return renderToStaticMarkup(await ProgressPhotosPage());
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "session-owner" });
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
  });

  it("does not render for a signed-out user", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(render()).rejects.toThrow("redirect:/sign-in");
    expect(findMany).not.toHaveBeenCalled();
  });
});
