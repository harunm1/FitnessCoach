// @vitest-environment jsdom
// Tests for the rest timer (live feedback 24 Nov, item 2): it starts by itself when a set is
// logged, can be skipped or reset, and does not restart for an old set after a reload.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RestTimer from "./RestTimer";

const NOW = Date.parse("2026-11-25T15:00:00.000Z");
const REST = 90;
const OLD_SET_AGE_MS = 600_000;
const ONE_SECOND_MS = 1000;
const THREE_SECONDS = 3;
const TEN_SECONDS = 10;
const TWENTY_SECONDS = 20;
const HOUR_MS = 3_600_000;
const TWENTY_SECONDS_MS = TWENTY_SECONDS * ONE_SECOND_MS;

// Each tick re-arms the timer in an effect, so advance one second per act.
function tick(seconds: number) {
  for (let i = 0; i < seconds; i += 1) {
    act(() => {
      vi.advanceTimersByTime(ONE_SECOND_MS);
    });
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderTimer(lastLoggedAtIso: string) {
  const view = render(
    <RestTimer
      exerciseName="Bench Press"
      lastLoggedAtIso={lastLoggedAtIso}
      serverNowIso={iso(Date.now())}
      restSeconds={REST}
    />,
  );
  // The component finishes its first effects on a zero-length timeout.
  act(() => {
    vi.advanceTimersByTime(0);
  });
  return view;
}

describe("RestTimer with a wrong device clock", () => {
  it("counts from the server's clock, so a device an hour ahead still starts the rest", () => {
    vi.setSystemTime(NOW + HOUR_MS);
    render(
      <RestTimer
        exerciseName="Bench Press"
        lastLoggedAtIso={iso(NOW - TEN_SECONDS * ONE_SECOND_MS)}
        restSeconds={REST}
        serverNowIso={iso(NOW)}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText("Resting")).toBeTruthy();
    expect(screen.getByText("01:20")).toBeTruthy();
  });
});

describe("RestTimer auto start", () => {
  it("starts resting without a click when the set was just logged", () => {
    renderTimer(iso(NOW));
    expect(screen.getByText("Resting")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start rest" })).toBeNull();
    expect(screen.getByText("01:30")).toBeTruthy();
  });

  it("counts down once a second", () => {
    renderTimer(iso(NOW));
    tick(THREE_SECONDS);
    expect(screen.getByText("01:27")).toBeTruthy();
  });

  it("does not restart for a set logged long ago, for example after a reload", () => {
    renderTimer(iso(NOW - OLD_SET_AGE_MS));
    expect(screen.getByText("Rest timer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start rest" })).toBeTruthy();
  });

  it("restarts the countdown when the next set is logged", () => {
    const view = renderTimer(iso(NOW));
    tick(TWENTY_SECONDS);
    expect(screen.getByText("01:10")).toBeTruthy();
    view.rerender(
      <RestTimer
        exerciseName="Bench Press"
        lastLoggedAtIso={iso(NOW + TWENTY_SECONDS_MS)}
        serverNowIso={iso(NOW + TWENTY_SECONDS_MS)}
        restSeconds={REST}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText("01:30")).toBeTruthy();
    expect(screen.getByText("Resting")).toBeTruthy();
  });

  it("lets the user skip the rest and then start it again by hand", () => {
    renderTimer(iso(NOW));
    act(() => {
      screen.getByRole("button", { name: "Skip rest" }).click();
    });
    expect(screen.queryByText("Resting")).toBeNull();
    expect(screen.getByText("01:30")).toBeTruthy();
    act(() => {
      screen.getByRole("button", { name: "Start rest" }).click();
    });
    expect(screen.getByText("Resting")).toBeTruthy();
  });

  it("still pauses and resets a running timer", () => {
    renderTimer(iso(NOW));
    tick(TEN_SECONDS);
    act(() => {
      screen.getByRole("button", { name: "Pause timer" }).click();
    });
    expect(screen.getByText("Paused")).toBeTruthy();
    act(() => {
      screen.getByRole("button", { name: "Reset" }).click();
    });
    expect(screen.getByText("01:30")).toBeTruthy();
  });
});
