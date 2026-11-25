// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BodyMapExercise } from "@/lib/body-map/muscles";

vi.mock("@/components/ExerciseCoachChat", () => ({
  default: () => <div data-testid="coach-chat" />,
}));
import BodyMap from "./BodyMap";

const exercises: BodyMapExercise[] = [
  {
    id: "bench",
    name: "Bench Press",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
    equipment: "barbell",
    instructions: ["Lower the bar to your chest."],
  },
];

// The fill of a diagram region, by its id (e.g. "chest").
function fillOf(container: HTMLElement, slug: string) {
  return container.querySelector(`path[id="${slug}"]`)?.getAttribute("fill");
}

afterEach(cleanup);

describe("BodyMap", () => {
  it("does not say the coach is not available yet (#140)", () => {
    render(<BodyMap exercises={exercises} />);
    expect(screen.queryByText(/AI-generated coaching yet/)).toBeNull();
    expect(
      screen.getByText(/stop the movement and see a health professional/),
    ).toBeTruthy();
  });

  it("draws the front muscles green on the body diagram", () => {
    const { container } = render(<BodyMap exercises={exercises} />);
    expect(fillOf(container, "chest")).toBe("#2f6345");
    expect(fillOf(container, "head")).toBe("#d6d9d1");
  });

  it("colours the chosen muscle and lists its exercises", () => {
    const { container } = render(<BodyMap exercises={exercises} />);
    fireEvent.click(screen.getByRole("button", { name: "Chest" }));
    expect(fillOf(container, "chest")).toBe("#e9734d");
    expect(screen.getByText("Bench Press")).toBeTruthy();
  });

  // Live feedback 24 Nov, item 3: the question box was hidden behind a second tap.
  it("shows the coach chat as soon as a muscle is picked, because the first exercise opens by itself", () => {
    render(<BodyMap exercises={exercises} />);
    expect(screen.queryByTestId("coach-chat")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chest" }));
    expect(screen.getByTestId("coach-chat")).toBeTruthy();
  });

  it("does not send the user away to the Coach page from the footer note", () => {
    render(<BodyMap exercises={exercises} />);
    expect(screen.queryByText(/Ask the coach on the Coach page/)).toBeNull();
  });

  it("picks a muscle when its region on the body is tapped", () => {
    const { container } = render(<BodyMap exercises={exercises} />);
    fireEvent.click(container.querySelector('path[id="chest"]')!);
    expect(
      screen
        .getByRole("button", { name: "Chest" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("shows the back muscles on the back view", () => {
    const { container } = render(<BodyMap exercises={exercises} />);
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    expect(screen.getByRole("button", { name: "Triceps" })).toBeTruthy();
    expect(fillOf(container, "triceps")).toBe("#2f6345");
  });
});
