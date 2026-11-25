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

  it("shows a run's own recorded duration instead of the gap (B1)", () => {
    vi.useFakeTimers();
    render(
      <WorkoutElapsedTime
        durationSeconds={1800}
        finishedAt="2026-11-25T14:20:00.000Z"
        startedAt={startedAt}
      />,
    );
    expect(screen.getByRole("timer").textContent).toBe("00:30:00");
  });

  it("says Not timed when finish equals start and nothing else was recorded (B1)", () => {
    vi.useFakeTimers();
    render(<WorkoutElapsedTime startedAt={startedAt} finishedAt={startedAt} />);
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByText("Not timed")).toBeTruthy();
  });

  it("says Not timed for a workout finished long after it was started (B1)", () => {
    vi.useFakeTimers();
    render(
      <WorkoutElapsedTime
        startedAt={startedAt}
        finishedAt="2026-11-26T06:40:22.000Z"
      />,
    );
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByText("Workout duration")).toBeTruthy();
    expect(screen.getByText("Not timed")).toBeTruthy();
    expect(screen.queryByText(/18:40:22/)).toBeNull();
  });

  it("stops the live clock once the workout has been open longer than the cap (B1)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(start + 20 * 3600 * 1000);
    render(<WorkoutElapsedTime startedAt={startedAt} />);
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByText("Not timed")).toBeTruthy();
  });
});
