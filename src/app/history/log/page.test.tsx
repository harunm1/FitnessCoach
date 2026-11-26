// Tests for the "Log a past workout" page (D49, #194): the signed-in user's own units, the
// exercise library, and which of the two forms the address picks.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, loadUnitPrefs, findExercises } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  loadUnitPrefs: vi.fn(),
  findExercises: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/units/prefs", () => ({ loadUnitPrefs }));
vi.mock("@/lib/prisma", () => ({
  prisma: { exercise: { findMany: findExercises } },
}));
vi.mock("../avatar", () => ({ navAvatar: vi.fn().mockResolvedValue(null) }));
vi.mock("@/app/history/log/actions", () => ({ logPastStrength: vi.fn() }));
vi.mock("@/app/progress/run/actions", () => ({ logRun: vi.fn() }));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));
import LogPastWorkoutPage from "./page";

const render = async (type?: string | string[]) =>
  renderToStaticMarkup(
    await LogPastWorkoutPage({ searchParams: Promise.resolve({ type }) }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "session-owner", name: "Sam" });
  loadUnitPrefs.mockResolvedValue({ weightUnit: "LB", distanceUnit: "MI" });
  findExercises.mockResolvedValue([
    { id: "bench-press", name: "Bench Press" },
    { id: "squat", name: "Back Squat" },
  ]);
});

describe("/history/log", () => {
  it("shows the strength form by default, with the library and the user's weight unit", async () => {
    const html = await render();
    expect(html).toContain("Log a past workout");
    expect(html).toContain("Bench Press");
    expect(html).toContain("Back Squat");
    expect(html).toContain("Save workout");
    expect(html).not.toContain("Save run");
    expect(findExercises).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" } }),
    );
  });

  it("shows the existing run form, in the user's distance unit, for ?type=run", async () => {
    const html = await render("run");
    expect(html).toContain("Save run");
    expect(html).toContain("Distance (mi)");
    expect(html).not.toContain("Save workout");
    expect(findExercises).not.toHaveBeenCalled();
  });

  it("offers both types as links and marks the one shown", async () => {
    const html = await render("run");
    expect(html).toContain('href="/history/log?type=strength"');
    expect(html).toContain('href="/history/log?type=run"');
    expect(html).toMatch(/aria-current="page"[^>]*>Run</);
  });

  it("falls back to strength for an unknown type and reads the first of a repeated one", async () => {
    expect(await render("swim")).toContain("Save workout");
    expect(await render(["run", "strength"])).toContain("Save run");
  });

  it("reads the signed-in user's units, so another user's settings never apply", async () => {
    await render();
    expect(loadUnitPrefs).toHaveBeenCalledWith("session-owner");
  });

  it("sends a signed-out user to sign in", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render()).rejects.toThrow("NEXT_REDIRECT");
  });
});
