import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";
import type { ProgressWorkout } from "@/lib/progress/types";

const {
  requireUser,
  loadFinishedWorkouts,
  loadTrainingProfile,
  database,
  storage,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  loadFinishedWorkouts: vi.fn(),
  loadTrainingProfile: vi.fn(),
  database: {
    user: { findUnique: vi.fn() },
    profile: { findUnique: vi.fn() },
    progressPhoto: { findMany: vi.fn(), count: vi.fn() },
    bodyWeight: { findMany: vi.fn() },
    workout: { findMany: vi.fn() },
  },
  storage: { get: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/progress/load", () => ({ loadFinishedWorkouts }));
vi.mock("@/lib/trainingProfile/load", () => ({ loadTrainingProfile }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: storage.get }));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));
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
    imported: false,
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
  database.user.findUnique.mockResolvedValue({
    image: null,
    weightUnit: "KG",
    distanceUnit: "KM",
  });
  // The weekly goal an imported week is judged against when no plan applies (D34).
  database.profile.findUnique.mockResolvedValue({ daysPerWeek: 2 });
  loadTrainingProfile.mockResolvedValue({
    workoutCount: 0,
    trainingSince: null,
    workoutsPerWeek: 0,
    usualHour: null,
    level: "BEGINNER",
    equipment: [],
    workingWeights: [],
  });
  database.progressPhoto.findMany.mockResolvedValue([]);
  database.progressPhoto.count.mockResolvedValue(0);
  database.bodyWeight.findMany.mockResolvedValue([]);
  database.workout.findMany.mockResolvedValue([]);
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

  it("follows the saved theme and offers to switch it", async () => {
    const html = await render();
    // On the server the saved choice isn't known yet, so it follows the system.
    expect(html).toContain('data-theme="system"');
    expect(html).toContain('aria-label="Switch to dark mode"');
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

  it("labels imported workouts and counts them in the streaks (D34)", async () => {
    loadFinishedWorkouts.mockResolvedValue([
      workout("2026-11-03T17:00:00Z", {
        imported: true,
        planDays: 0,
        dayName: "Push Day",
      }),
      workout("2026-11-05T17:00:00Z", {
        imported: true,
        planDays: 0,
        dayName: "Pull Day",
      }),
      workout("2026-11-10T17:00:00Z", {
        imported: true,
        planDays: 0,
        dayName: "Leg Day",
      }),
    ]);
    const html = await render();
    expect(html).toContain("3 imported sessions");
    expect(html).toContain("includes imported history");
    expect(html).not.toContain("not counted in the streaks");
    expect(html).toContain("Imported");
    // Last week has 2 sessions, this week 1: two active weeks.
    expect(html).toMatch(/Active streak<\/p><p[^>]*>2 weeks/);
    // The goal is the profile's 2 a week: last week met it, this week is still open.
    expect(html).toMatch(/Goal streak<\/p><p[^>]*>1 week</);
  });

  it("shows the training profile line when there is a history (D34)", async () => {
    loadTrainingProfile.mockResolvedValue({
      workoutCount: 120,
      trainingSince: new Date("2025-03-12T15:00:00Z"),
      workoutsPerWeek: 3,
      usualHour: 18,
      level: "INTERMEDIATE",
      equipment: ["barbell"],
      workingWeights: [],
    });
    loadFinishedWorkouts.mockResolvedValue([workout("2026-11-10T17:00:00Z")]);
    const html = await render();
    expect(html).toContain(
      "Training since March 2025, 3 workouts a week, usually around 6 pm.",
    );
    expect(loadTrainingProfile).toHaveBeenCalledWith(
      expect.anything(),
      "session-owner",
      expect.any(Date),
    );
  });

  it("shows no training line without a history", async () => {
    expect(await render()).not.toContain("Training since");
  });

  it("shows a run logged by hand without a made-up start time, in h:mm:ss (D27)", async () => {
    loadFinishedWorkouts.mockResolvedValue([
      workout("2026-11-10T17:00:00Z", {
        manual: true,
        dayName: null,
        distanceKm: 21.1,
        runSeconds: 7530,
        sets: [],
      }),
    ]);
    const html = await render({ month: "2026-11", day: "2026-11-10" });
    expect(html).toContain("Run: 21.1 km in 2:05:30");
    expect(html).not.toContain("12:00 PM");
  });

  it("shows no imported line when nothing was imported", async () => {
    loadFinishedWorkouts.mockResolvedValue([workout("2026-11-10T17:00:00Z")]);
    expect(await render()).not.toContain("imported session");
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

  it("shows the nav bar with Progress as the current page", async () => {
    const html = await render();
    expect(html).toContain('<nav aria-label="Main"');
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/progress"/);
  });

  it("still shows progress when photo storage is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    storage.get.mockImplementation(() => {
      throw new Error("Missing: R2_BUCKET");
    });
    loadFinishedWorkouts.mockResolvedValue([workout("2026-11-10T17:00:00Z")]);
    const html = await render();
    expect(html).toContain("Photos can&#x27;t be shown right now.");
    expect(html).not.toContain("R2_BUCKET");
    expect(html).toContain("Muscles worked in November 2026");
    expect(console.error).toHaveBeenCalledWith(
      "[photos] progress: couldn't sign photo links",
      expect.objectContaining({ userId: "session-owner" }),
    );
  });

  it("shows the signed-in user's last year of body weight, with the form (D24)", async () => {
    database.bodyWeight.findMany.mockResolvedValue([
      {
        date: new Date("2026-11-10T00:00:00Z"),
        weightKg: { toString: () => "81.50" },
        note: null,
      },
    ]);
    const html = await render();
    expect(database.bodyWeight.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "session-owner",
          date: { gte: new Date("2025-11-12T00:00:00Z") },
        },
      }),
    );
    expect(html).toContain("Body weight");
    expect(html).toContain("Latest: 81.5 kg on Nov 10, 2026");
    expect(html).toContain('max="2026-11-12"');
  });

  it("offers the run form and lists the signed-in user's latest runs (D27)", async () => {
    database.workout.findMany.mockResolvedValue([
      {
        id: 3,
        startedAt: new Date("2026-11-11T17:00:00Z"),
        distanceKm: { toString: () => "5.20" },
        durationSeconds: 1872,
        notes: "Easy loop",
        source: "manual-run",
        planDay: { name: "Easy run" },
        run: { rpe: 6 },
      },
    ]);
    const html = await render();
    expect(database.workout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "session-owner" }),
      }),
    );
    expect(html).toContain("Log a run");
    expect(html).toContain('name="duration"');
    expect(html).toContain("5.2 km");
    expect(html).toContain("6:00 /km");
    expect(html).toContain("Easy loop");
  });

  it("shows body weight, runs and pace in the user's chosen pounds and miles (D30)", async () => {
    database.user.findUnique.mockResolvedValue({
      image: null,
      weightUnit: "LB",
      distanceUnit: "MI",
    });
    database.bodyWeight.findMany.mockResolvedValue([
      {
        date: new Date("2026-11-10T00:00:00Z"),
        weightKg: { toString: () => "81.65" },
        note: null,
      },
    ]);
    database.workout.findMany.mockResolvedValue([
      {
        id: 3,
        startedAt: new Date("2026-11-11T17:00:00Z"),
        distanceKm: { toString: () => "5.20" },
        durationSeconds: 1872,
        notes: null,
        source: "manual-run",
        planDay: null,
        run: { rpe: 6 },
      },
    ]);
    const html = await render();
    expect(html).toContain("Latest: 180 lb on Nov 10, 2026");
    expect(html).toContain("3.23 mi");
    expect(html).toContain("9:39 /mi");
    expect(html).toContain("Weight (lb)");
    expect(html).toContain("Distance (mi)");
    expect(html).not.toContain("81.65 kg");
    expect(html).not.toContain("5.2 km");
  });

  it("does not render for a signed-out user", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(render()).rejects.toThrow("redirect:/sign-in");
    expect(loadFinishedWorkouts).not.toHaveBeenCalled();
  });
});
