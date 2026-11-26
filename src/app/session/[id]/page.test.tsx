import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, redirect, loadOpenWorkout, loadWorkingWeightsFor } =
  vi.hoisted(() => ({
    requireUser: vi.fn(),
    redirect: vi.fn((to: string) => {
      throw new Error(`redirect:${to}`);
    }),
    loadOpenWorkout: vi.fn(),
    loadWorkingWeightsFor: vi.fn(),
  }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/workout/loadOpenWorkout", () => ({ loadOpenWorkout }));
vi.mock("@/lib/trainingProfile/load", () => ({ loadWorkingWeightsFor }));
vi.mock("@/lib/units/prefs", () => ({
  loadUnitPrefs: vi
    .fn()
    .mockResolvedValue({ weightUnit: "KG", distanceUnit: "KM" }),
}));
vi.mock("@/lib/photos/avatar", () => ({
  loadAvatarUrl: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/components/nav/AppNav", () => ({ AppNav: () => <nav>nav</nav> }));
vi.mock("@/components/auth/account-theme", () => ({
  AccountTheme: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/session/SessionSync", () => ({ default: () => null }));
vi.mock("@/lib/workout/previousSets", () => ({
  loadPreviousSets: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("@/components/session/CheckInPanel", () => ({
  default: () => <p>How do you feel today?</p>,
}));
vi.mock("@/components/session/ExerciseCard", () => ({
  default: ({ exerciseName }: { exerciseName: string }) => (
    <p>log {exerciseName}</p>
  ),
}));
vi.mock("@/components/session/WorkoutBar", () => ({
  default: () => (
    <div role="region" aria-label="Workout controls">
      bar
    </div>
  ),
}));
import WorkoutPage from "./page";

const workout = {
  id: 42,
  startedAt: new Date("2026-11-26T14:00:00Z"),
  activeBankedSeconds: 0,
  activeSince: new Date("2026-11-26T14:00:00Z"),
  plan: { name: "Starter plan" },
  planDay: {
    name: "Push day",
    dayIndex: 0,
    weekdays: [],
    exercises: [
      {
        id: 1,
        exerciseId: "bench",
        sets: 3,
        reps: 8,
        restSeconds: 90,
        substitutionReason: null,
        exercise: {
          name: "Bench press",
          equipment: "barbell",
          primaryMuscles: ["chest"],
          cues: [],
          commonMistakes: [],
        },
      },
    ],
  },
  sets: [],
};
const render = async (id: string) =>
  renderToStaticMarkup(await WorkoutPage({ params: Promise.resolve({ id }) }));

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "owner", name: "Sam" });
  loadWorkingWeightsFor.mockResolvedValue(new Map());
});

describe("/session/[id]", () => {
  it("shows only that workout: its exercises and the fixed bar, no body map or run box", async () => {
    loadOpenWorkout.mockResolvedValue(workout);
    const html = await render("42");
    expect(loadOpenWorkout).toHaveBeenCalledWith(
      expect.anything(),
      "owner",
      42,
    );
    expect(html).toContain("Push day");
    expect(html).toContain("log Bench press");
    expect(html).toContain("Workout controls");
    expect(html).not.toContain("Explore by muscle");
    expect(html).not.toContain("Running distance");
    expect(html).toContain('href="/coach"');
  });

  it.each([["a missing, finished or foreign workout", "42", null]])(
    "sends %s back to /session with one answer",
    async (_name, id, found) => {
      loadOpenWorkout.mockResolvedValue(found);
      await expect(render(id)).rejects.toThrow("redirect:/session");
    },
  );

  it("never queries for an address that is not a whole number", async () => {
    await expect(render("abc")).rejects.toThrow("redirect:/session");
    expect(loadOpenWorkout).not.toHaveBeenCalled();
  });
});
