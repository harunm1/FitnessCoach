// @vitest-environment jsdom
// Tests for the coach panel's chat box (live feedback 24 Nov, item 3): the question box is
// there as soon as the panel opens and its placeholder says the user can ask the coach.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/session/bodyMapActions", () => ({ askExerciseCoach: vi.fn() }));
import ExerciseCoachChat from "./ExerciseCoachChat";

afterEach(cleanup);

describe("ExerciseCoachChat", () => {
  it("shows a question box whose placeholder invites the user to ask the coach", () => {
    render(<ExerciseCoachChat exerciseId="bench" muscle="chest" />);
    const box = screen.getByRole("textbox", {
      name: /ask a question about chest/i,
    });
    expect(box.getAttribute("placeholder")).toMatch(/ask the coach/i);
  });

  it("has an Ask button next to the box", () => {
    render(<ExerciseCoachChat exerciseId="bench" muscle="chest" />);
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
  });
});
