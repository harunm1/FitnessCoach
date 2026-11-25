import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ExerciseHistory,
  HistoryRow,
  WorkoutDetail,
} from "@/lib/history/types";

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
const { requireUser, loadUnitPrefs, history, notFound } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  loadUnitPrefs: vi.fn(),
  history: {
    loadHistoryPage: vi.fn(),
    loadWorkoutDetail: vi.fn(),
    loadExerciseHistory: vi.fn(),
  },
  notFound: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/history/load", () => history);
vi.mock("@/lib/units/prefs", () => ({ loadUnitPrefs }));
vi.mock("./avatar", () => ({ navAvatar: vi.fn().mockResolvedValue(null) }));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));
import HistoryPage from "./page";
import WorkoutPage from "./[workoutId]/page";
import ExercisePage from "./exercise/[exerciseId]/page";

const start = new Date("2026-11-08T17:00:00Z");
const row = (id: number, extra: Partial<HistoryRow> = {}): HistoryRow => ({
  id,
  name: "Push",
  startedAt: start,
  minutes: 50,
  sets: 12,
  imported: false,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "session-owner", name: "Sam" });
  loadUnitPrefs.mockResolvedValue({ weightUnit: "KG", distanceUnit: "KM" });
});

describe("/history", () => {
  const render = async (page?: string | string[]) =>
    renderToStaticMarkup(
      await HistoryPage({ searchParams: Promise.resolve({ page }) }),
    );

  it("lists the user's workouts with name, date, minutes, sets and links", async () => {
    history.loadHistoryPage.mockResolvedValue({
      rows: [row(9), row(8, { name: "Leg day", imported: true, sets: 1 })],
      hasNext: false,
    });
    const html = await render();
    expect(history.loadHistoryPage).toHaveBeenCalledWith("session-owner", 1);
    expect(html).toContain('href="/history/9"');
    expect(html).toContain("Push");
    expect(html).toContain("Sunday, November 8, 2026");
    expect(html).toContain("50 min");
    expect(html).toContain("12 sets");
    expect(html).toContain("1 set<");
    expect(html).toContain("Imported");
  });

  it("links to older and newer pages only when they exist", async () => {
    history.loadHistoryPage.mockResolvedValue({
      rows: [row(9)],
      hasNext: true,
    });
    const first = await render();
    expect(first).toContain('href="/history?page=2"');
    expect(first).not.toContain("Newer");

    const second = await render("2");
    expect(history.loadHistoryPage).toHaveBeenLastCalledWith(
      "session-owner",
      2,
    );
    expect(second).toContain('href="/history?page=3"');
    expect(second).toContain('href="/history"');
  });

  it("marks History as the current menu page and keeps list semantics", async () => {
    history.loadHistoryPage.mockResolvedValue({
      rows: [row(9)],
      hasNext: false,
    });
    const html = await render();
    expect(html).toContain('aria-current="page" class');
    expect(html).toMatch(/aria-current="page"[^>]*href="\/history"/);
    expect(html).toContain('<ol role="list"');
  });

  it("reads the first of a repeated page parameter", async () => {
    history.loadHistoryPage.mockResolvedValue({ rows: [], hasNext: false });
    renderToStaticMarkup(
      await HistoryPage({
        searchParams: Promise.resolve({ page: ["2", "3"] }),
      }),
    );
    expect(history.loadHistoryPage).toHaveBeenCalledWith("session-owner", 2);
  });

  it("treats a junk page number as the first page", async () => {
    history.loadHistoryPage.mockResolvedValue({ rows: [], hasNext: false });
    await render("-4");
    expect(history.loadHistoryPage).toHaveBeenCalledWith("session-owner", 1);
  });

  it("says when there is nothing yet and points to the session", async () => {
    history.loadHistoryPage.mockResolvedValue({ rows: [], hasNext: false });
    const html = await render();
    expect(html).toContain("No finished workouts yet");
    expect(html).toContain('href="/session"');
  });
});

describe("/history/[workoutId]", () => {
  const render = async (workoutId: string) =>
    renderToStaticMarkup(
      await WorkoutPage({ params: Promise.resolve({ workoutId }) }),
    );
  const detail: WorkoutDetail = {
    id: 41,
    name: "Push",
    startedAt: start,
    minutes: 50,
    imported: false,
    notes: "Felt strong",
    run: { distanceKm: 5, seconds: 1800, rpe: 7 },
    volumeKg: 1100,
    recordExerciseIds: [],
    exercises: [
      {
        id: "Barbell_Bench_Press_-_Medium_Grip",
        name: "Bench Press",
        sets: [
          { setNumber: 1, reps: 10, weightKg: 60, rpe: null },
          { setNumber: 2, reps: 8, weightKg: 62.5, rpe: 9 },
        ],
      },
    ],
  };

  it("shows the sets in pounds and the run in miles for a user who chose them (D30)", async () => {
    loadUnitPrefs.mockResolvedValue({ weightUnit: "LB", distanceUnit: "MI" });
    history.loadWorkoutDetail.mockResolvedValue(detail);
    const html = await render("41");
    expect(loadUnitPrefs).toHaveBeenCalledWith("session-owner");
    // Weight and reps are table cells now (live bug L5): 60 kg is 132.5 lb, 62.5 kg is 138 lb.
    expect(html).toContain("Weight (lb)");
    expect(html).toMatch(/<td[^>]*>132\.5<\/td><td[^>]*>10<\/td>/);
    expect(html).toMatch(/<td[^>]*>138<\/td><td[^>]*>8<\/td><td[^>]*>9<\/td>/);
    expect(html).toContain("3.11 mi in 30:00");
    expect(html).toContain("9:39 /mi");
    expect(html).not.toContain(" kg");
    expect(html).not.toContain(" km");
  });

  it("shows every exercise with its sets, the run and the notes", async () => {
    history.loadWorkoutDetail.mockResolvedValue(detail);
    const html = await render("41");
    expect(history.loadWorkoutDetail).toHaveBeenCalledWith("session-owner", 41);
    expect(html).toContain("Push");
    expect(html).toContain("Bench Press");
    expect(html).toContain("Weight (kg)");
    expect(html).toMatch(/<td[^>]*>60<\/td><td[^>]*>10<\/td>/);
    expect(html).toMatch(
      /<td[^>]*>62\.5<\/td><td[^>]*>8<\/td><td[^>]*>9<\/td>/,
    );
    expect(html).toContain("5 km");
    expect(html).toContain("30:00");
    expect(html).toContain("6:00 /km");
    expect(html).toContain("RPE 7");
    expect(html).toContain("Felt strong");
    expect(html).toContain(
      'href="/history/exercise/Barbell_Bench_Press_-_Medium_Grip"',
    );
    expect(html).toContain('href="/history"');
  });

  it("writes a run of an hour or more as h:mm:ss", async () => {
    history.loadWorkoutDetail.mockResolvedValue({
      ...detail,
      run: { distanceKm: 21.1, seconds: 7530, rpe: null },
    });
    expect(await render("41")).toContain("21.1 km in 2:05:30");
  });

  it("answers 404 for a workout the user does not own or that does not exist", async () => {
    history.loadWorkoutDetail.mockResolvedValue(null);
    await expect(render("41")).rejects.toThrow(NOT_FOUND);
    expect(notFound).toHaveBeenCalled();
  });

  it("answers 404 for a malformed id without querying", async () => {
    await expect(render("abc")).rejects.toThrow(NOT_FOUND);
    expect(history.loadWorkoutDetail).not.toHaveBeenCalled();
  });

  it("asks for a signed-in user before reading anything", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render("41")).rejects.toThrow("NEXT_REDIRECT");
    expect(history.loadWorkoutDetail).not.toHaveBeenCalled();
  });
});

describe("/history/exercise/[exerciseId]", () => {
  const render = async (exerciseId: string) =>
    renderToStaticMarkup(
      await ExercisePage({ params: Promise.resolve({ exerciseId }) }),
    );
  const older = new Date("2026-11-01T17:00:00Z");
  const exercise: ExerciseHistory = {
    id: "Bench",
    name: "Bench Press",
    olderHidden: false,
    workouts: [
      {
        workoutId: 41,
        startedAt: start,
        sets: [
          { setNumber: 1, reps: 5, weightKg: 65, rpe: null },
          { setNumber: 2, reps: 6, weightKg: 65, rpe: 8 },
        ],
      },
      {
        workoutId: 30,
        startedAt: older,
        sets: [{ setNumber: 1, reps: 5, weightKg: 55, rpe: null }],
      },
    ],
  };

  it("shows every set over time, the best set and the top-weight line", async () => {
    history.loadExerciseHistory.mockResolvedValue(exercise);
    const html = await render("Bench");
    expect(history.loadExerciseHistory).toHaveBeenCalledWith(
      "session-owner",
      "Bench",
    );
    expect(html).toContain("Bench Press");
    expect(html).toContain("Best set");
    expect(html).toContain("6 reps × 65 kg · RPE 8");
    expect(html).toContain("5 reps × 55 kg");
    expect(html).toContain('href="/history/41"');
    expect(html).toContain("<polyline");
    expect(html).toContain("Top weight per workout, 55 to 65 kg");
    expect(html).not.toContain("Older sets");
    expect(html).toContain('<svg aria-hidden="true"');
    expect(html).not.toContain('role="img"');
    expect(html).toContain('<ol role="list"');
  });

  it("shows the best set and the top-weight line in pounds for a user who chose them (D30)", async () => {
    loadUnitPrefs.mockResolvedValue({ weightUnit: "LB", distanceUnit: "MI" });
    history.loadExerciseHistory.mockResolvedValue(exercise);
    const html = await render("Bench");
    expect(html).toContain("6 reps × 143.5 lb · RPE 8");
    expect(html).toContain("Top weight per workout, 121.5 to 143.5 lb");
    expect(html).not.toContain(" kg");
  });

  it("says when older workouts are left out", async () => {
    history.loadExerciseHistory.mockResolvedValue({
      ...exercise,
      olderHidden: true,
    });
    expect(await render("Bench")).toContain("Older sets are not shown");
  });

  it("answers 404 for an exercise the user never logged", async () => {
    history.loadExerciseHistory.mockResolvedValue(null);
    await expect(render("Bench")).rejects.toThrow(NOT_FOUND);
  });
});
