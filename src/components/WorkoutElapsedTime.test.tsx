// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkoutElapsedTime from "./WorkoutElapsedTime";

const startedAt = "2026-11-25T12:00:00.000Z";
const start = Date.parse(startedAt);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("WorkoutElapsedTime", () => {
  it("resumes from the saved start and catches up after time away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(start + 65_000);
    const view = render(<WorkoutElapsedTime startedAt={startedAt} />);
    expect(screen.getByRole("timer").textContent).toBe("00:01:05");
    vi.setSystemTime(start + 3_665_000);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("timer").textContent).toBe("01:01:06");
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("freezes at the saved finish time and does not start an interval", () => {
    vi.useFakeTimers();
    render(
      <WorkoutElapsedTime
        startedAt={startedAt}
        finishedAt="2026-11-25T13:02:03.000Z"
      />,
    );
    expect(screen.getByRole("timer").textContent).toBe("01:02:03");
    expect(screen.getByText("Workout duration")).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not show negative time when the browser clock is behind", () => {
    vi.useFakeTimers();
    vi.setSystemTime(start - 1000);
    render(<WorkoutElapsedTime startedAt={startedAt} />);
    expect(screen.getByRole("timer").textContent).toBe("00:00:00");
  });
});
