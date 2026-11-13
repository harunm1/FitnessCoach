import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";
import type { ProgressWorkout } from "@/lib/progress/types";

const { requireUser, loadFinishedWorkouts, database, storage } = vi.hoisted(
  () => ({
    requireUser: vi.fn(),
    loadFinishedWorkouts: vi.fn(),
    database: {
      user: { findUnique: vi.fn() },
      progressPhoto: { findMany: vi.fn(), count: vi.fn() },
    },
    storage: { get: vi.fn() },
  }),
);
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/progress/load", () => ({ loadFinishedWorkouts }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: storage.get }));
import ProgressPage from "./page";

function workout(
  startedAt: string,
  overrides: Partial<ProgressWorkout> = {},
): ProgressWorkout {
  const start = new Date(startedAt);
  return {
    id: start.getTime(),
    startedAt: start,
    finishedAt: new Date(start.getTime() + 50 * 60000),
    dayName: "Push",
    planDays: 2,
    distanceKm: null,
    runSeconds: null,
    sets: [
      {
        exerciseName: "Bench Press",
        category: "strength",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps"],
        setNumber: 1,
        reps: 10,
        weightKg: 40,
      },
    ],
    ...overrides,
  };
}

async function render(params: { month?: string; day?: string } = {}) {
  return renderToStaticMarkup(
    await ProgressPage({ searchParams: Promise.resolve(params) }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Thursday 12 November 2026, midday in Toronto.
  vi.useFakeTimers({ now: new Date("2026-11-12T17:00:00Z"), toFake: ["Date"] });
  requireUser.mockResolvedValue({ id: "session-owner", name: "Free Demo" });
  loadFinishedWorkouts.mockResolvedValue([]);
  database.user.findUnique.mockResolvedValue({ image: null });
  database.progressPhoto.findMany.mockResolvedValue([]);
  database.progressPhoto.count.mockResolvedValue(0);
  storage.get.mockReturnValue(new MemoryStorage());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("progress page", () => {
  it("loads only the signed-in user's data", async () => {
    await render();
    expect(loadFinishedWorkouts).toHaveBeenCalledWith(
      "session-owner",
      expect.any(Date),
    );
    expect(database.progressPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "session-owner" },
        orderBy: { takenAt: "desc" },
        take: 3,
      }),
    );
    expect(database.progressPhoto.count).toHaveBeenCalledWith({
      where: { userId: "session-owner" },
    });
  });

  it("shows the user's name and invites a first workout", async () => {
    const html = await render();
    expect(html).toContain("Free Demo");
    expect(html).toContain("No finished workouts yet.");
    expect(html).toContain("0 weeks");
  });

  it("counts streaks across weeks", async () => {
    loadFinishedWorkouts.mockResolvedValue([
      workout("2026-11-03T17:00:00Z"),
      workout("2026-11-05T17:00:00Z"),
      workout("2026-11-10T17:00:00Z"),
    ]);
    const html = await render();
    // Last week met the goal of 2; this week has 1 so far and can't break it.
    expect(html).toContain("2 weeks");
    expect(html).toContain("1 week<");
  });

  it("takes the goal from the last workout with a plan", async () => {
    loadFinishedWorkouts.mockResolvedValue([
      workout("2026-11-03T17:00:00Z", { planDays: 3 }),
      // A free session without a plan must not lower the goal to zero.
      workout("2026-11-05T17:00:00Z", { planDays: 0, dayName: null }),
    ]);
    const html = await render();
    // Two workouts against a goal of 3: no goal week, but an active week.
    expect(html).toMatch(/Goal streak<\/p><p[^>]*>0 weeks/);
    expect(html).toMatch(/Active streak<\/p><p[^>]*>1 week</);
  });

  it("opens on the latest workout's month and day", async () => {
    loadFinishedWorkouts.mockResolvedValue([
      workout("2026-10-20T17:00:00Z"),
      workout("2026-10-28T17:00:00Z"),
    ]);
    const html = await render();
    expect(html).toContain("October 2026");
    expect(html).toContain("Wednesday, October 28");
    expect(html).toContain("Muscles worked in October 2026");
  });

  it("shows the month and day from the link", async () => {
    loadFinishedWorkouts.mockResolvedValue([
      workout("2026-10-20T17:00:00Z", { dayName: "Legs" }),
      workout("2026-11-10T17:00:00Z"),
    ]);
    const html = await render({ month: "2026-10", day: "2026-10-20" });
    expect(html).toContain("Tuesday, October 20");
    expect(html).toContain("Legs");
  });

  it("ignores a linked day from another month", async () => {
    loadFinishedWorkouts.mockResolvedValue([workout("2026-11-10T17:00:00Z")]);
    const html = await render({ month: "2026-11", day: "2026-10-01" });
    expect(html).toContain("Tuesday, November 10");
    expect(html).not.toContain("Thursday, October 1");
  });

  it("counts only the month on screen for muscles", async () => {
    loadFinishedWorkouts.mockResolvedValue([
      workout("2026-10-20T17:00:00Z", {
        sets: [
          {
            exerciseName: "Squat",
            category: "strength",
            primaryMuscles: ["quadriceps"],
            secondaryMuscles: [],
            setNumber: 1,
            reps: 5,
            weightKg: 60,
          },
        ],
      }),
      workout("2026-11-10T17:00:00Z"),
    ]);
    const html = await render({ month: "2026-11" });
    expect(html).toContain(">chest<");
    expect(html).not.toContain(">quadriceps<");
    expect(html).toContain("1 of 1 · 100%");
  });

  it("shows the newest photos through signed links", async () => {
    database.progressPhoto.findMany.mockResolvedValue([
      {
        id: 9,
        storageKey: "progress/session-owner/new.webp",
        takenAt: new Date("2026-11-11T17:00:00Z"),
        weightKg: null,
        note: null,
      },
    ]);
    database.progressPhoto.count.mockResolvedValue(5);
    const html = await render();
    expect(html).toContain(
      'src="memory://progress/session-owner/new.webp?expires=300"',
    );
    expect(html).toContain("See all (5)");
  });

  it("still shows progress when photo storage is unavailable", async () => {
    storage.get.mockImplementation(() => {
      throw new Error("Missing: R2_BUCKET");
    });
    loadFinishedWorkouts.mockResolvedValue([workout("2026-11-10T17:00:00Z")]);
    const html = await render();
    expect(html).toContain("Photos can&#x27;t be shown right now.");
    expect(html).not.toContain("R2_BUCKET");
    expect(html).toContain("Muscles worked in November 2026");
  });

  it("does not render for a signed-out user", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(render()).rejects.toThrow("redirect:/sign-in");
    expect(loadFinishedWorkouts).not.toHaveBeenCalled();
  });
});
