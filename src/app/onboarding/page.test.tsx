import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, loadTrainingProfile, loadAvatarUrl, database } =
  vi.hoisted(() => ({
    requireUser: vi.fn(),
    loadTrainingProfile: vi.fn(),
    loadAvatarUrl: vi.fn(),
    database: { profile: { findUnique: vi.fn() } },
  }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/photos/avatar", () => ({ loadAvatarUrl }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/trainingProfile/load", () => ({ loadTrainingProfile }));
vi.mock("@/app/onboarding/actions", () => ({ saveQuizProfile: vi.fn() }));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));
import OnboardingPage from "./page";

const history = {
  workoutCount: 186,
  trainingSince: new Date("2025-03-12T15:00:00Z"),
  workoutsPerWeek: 3,
  usualHour: 18,
  level: "INTERMEDIATE",
  equipment: ["barbell", "dumbbell"],
  workingWeights: [],
};

const savedBeginner = {
  goal: "STRENGTH",
  level: "BEGINNER",
  trainingMode: "GYM",
  daysPerWeek: 3,
  equipment: ["body only"],
  injuries: null,
};

async function render() {
  return renderToStaticMarkup(await OnboardingPage());
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "session-owner", name: "Free Demo" });
  loadAvatarUrl.mockResolvedValue(null);
  database.profile.findUnique.mockResolvedValue(savedBeginner);
  loadTrainingProfile.mockResolvedValue(history);
});

describe("onboarding page (D36)", () => {
  it("pre-fills experience and equipment from the history, and says so", async () => {
    const html = await render();
    expect(html).toContain("Pre-filled from your 186 logged workouts");
    expect(html).toContain('<option value="INTERMEDIATE" selected="">');
    expect(html).toMatch(
      /value="barbell"[^>]*checked=""|checked=""[^>]*value="barbell"/,
    );
    expect(html).toMatch(
      /value="dumbbell"[^>]*checked=""|checked=""[^>]*value="dumbbell"/,
    );
  });

  it("reads the history of the signed-in user only", async () => {
    await render();
    expect(loadTrainingProfile).toHaveBeenCalledWith(
      database,
      "session-owner",
      expect.any(Date),
    );
  });

  it("shows the saved answers and no note when there is no history", async () => {
    loadTrainingProfile.mockResolvedValue({
      ...history,
      workoutCount: 0,
      trainingSince: null,
      level: "BEGINNER",
      equipment: [],
    });
    const html = await render();
    expect(html).not.toContain("Pre-filled");
    expect(html).toContain('<option value="BEGINNER" selected="">');
  });
});
