// Tests for the import page (#131): signed-in only, and it explains where to get the file.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, database } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  database: { user: { findUnique: vi.fn() } },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/storage", () => ({
  getPhotoStorage: () => {
    throw new Error("no storage in this test");
  },
}));
vi.mock("@/components/import/ImportForm", () => ({
  ImportForm: () => <form data-testid="import-form" />,
}));
import ImportPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "user-1", name: "Free Demo" });
  database.user.findUnique.mockResolvedValue({ image: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ImportPage", () => {
  it("sends a signed-out visitor to sign in", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(ImportPage()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("shows the heading, the export steps, the form and the Import nav link as current", async () => {
    const html = renderToStaticMarkup(await ImportPage());
    expect(html).toContain("Import workouts");
    expect(html).toContain("Export Workouts");
    expect(html).toContain("import-form");
    expect(html).toContain('aria-current="page"');
  });

  it("still renders when the photo storage is not set up", async () => {
    database.user.findUnique.mockResolvedValue({ image: "avatar-key" });
    const html = renderToStaticMarkup(await ImportPage());
    expect(html).toContain("Import workouts");
  });
});
