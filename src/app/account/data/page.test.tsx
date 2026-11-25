import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, findMany, loadAvatar } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findMany: vi.fn(),
  loadAvatar: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { dataExport: { findMany } } }));
vi.mock("@/lib/photos/avatar", () => ({ loadAvatar }));
vi.mock("./actions", () => ({ createDataExport: vi.fn() }));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));
import DataPage from "./page";

const BYTES = 2048;

async function render() {
  return renderToStaticMarkup(await DataPage());
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "session-owner", name: "Free Demo" });
  loadAvatar.mockResolvedValue(null);
  findMany.mockResolvedValue([]);
});

describe("Your data page", () => {
  it("lists only the signed-in user's exports, newest first", async () => {
    await render();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "session-owner" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("offers the three exports", async () => {
    const html = await render();
    expect(html).toContain("Export workout history (CSV)");
    expect(html).toContain("Export coach conversations (CSV)");
    expect(html).toContain("Make the monthly report (PDF)");
  });

  it("says so when there are no exports yet", async () => {
    expect(await render()).toContain("No exports yet");
  });

  it("gives each past export a Download link to its own route", async () => {
    findMany.mockResolvedValue([
      {
        id: "abc123",
        kind: "WORKOUT_CSV",
        bytes: BYTES,
        createdAt: new Date("2026-11-25T15:00:00Z"),
      },
    ]);
    const html = await render();
    expect(html).toContain('href="/api/exports/abc123/download"');
    expect(html).toContain("Workout history (CSV)");
    expect(html).toContain("2 KB");
    expect(html).toContain("Nov 25, 2026");
  });
});
