// @vitest-environment jsdom
// The Discard workout button (D47): it asks before it deletes, and sends nothing when the
// user cancels.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const discardWorkout = vi.hoisted(() => vi.fn());
vi.mock("@/app/session/discardAction", () => ({ discardWorkout }));
import DiscardWorkoutButton from "./DiscardWorkoutButton";

const WORKOUT_ID = 7;
const LOGGED_SETS = "logged sets";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  discardWorkout.mockReset();
});

describe("DiscardWorkoutButton", () => {
  it("shows a Discard workout button", () => {
    render(<DiscardWorkoutButton workoutId={WORKOUT_ID} />);
    expect(
      screen.getByRole("button", { name: "Discard workout" }),
    ).toBeTruthy();
  });

  it("asks for confirmation naming what is lost, and does not submit on Cancel", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<DiscardWorkoutButton workoutId={WORKOUT_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard workout" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(String(confirm.mock.calls[0][0])).toContain(LOGGED_SETS);
    expect(discardWorkout).not.toHaveBeenCalled();
  });

  it("submits the discard for this workout after OK", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DiscardWorkoutButton workoutId={WORKOUT_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard workout" }));
    // The form passes its data after the bound id; only the id matters.
    expect(discardWorkout.mock.calls[0][0]).toBe(WORKOUT_ID);
  });
});
