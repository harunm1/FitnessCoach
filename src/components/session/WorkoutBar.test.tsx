// @vitest-environment jsdom
// The bar fixed to the bottom of the workout page (D43): the clock, Pause or Resume, and
// Finish workout, always in view, so Finish never sits below a long list of exercises.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/session/actions", () => ({ finishWorkout: vi.fn() }));
vi.mock("@/app/session/pauseActions", () => ({
  pauseWorkoutClock: vi.fn(),
  resumeWorkoutClock: vi.fn(),
}));
import WorkoutBar from "./WorkoutBar";

const NOW = "2026-11-26T15:00:00.000Z";
const props = {
  workoutId: 7,
  bankedSeconds: 0,
  activeSinceIso: NOW,
  lastSetAtIso: null,
  serverNowIso: NOW,
};

afterEach(cleanup);

describe("WorkoutBar", () => {
  it("is fixed to the bottom of the screen and holds clock, pause and finish", () => {
    render(<WorkoutBar {...props} />);
    const bar = screen.getByRole("region", { name: "Workout controls" });
    expect(bar.className).toContain("fixed");
    expect(bar.className).toContain("bottom-0");
    expect(within(bar).getByRole("timer")).toBeTruthy();
    expect(
      within(bar).getByRole("button", { name: "Pause clock" }),
    ).toBeTruthy();
    expect(
      within(bar).getByRole("button", { name: "Finish workout" }),
    ).toBeTruthy();
  });

  it("offers Resume while the clock is paused, and one Finish button only", () => {
    render(<WorkoutBar {...props} activeSinceIso={null} bankedSeconds={90} />);
    const bar = screen.getByRole("region", { name: "Workout controls" });
    expect(
      within(bar).getByRole("button", { name: "Resume clock" }),
    ).toBeTruthy();
    expect(
      within(bar).getAllByRole("button", { name: /finish workout/i }),
    ).toHaveLength(1);
  });
});
