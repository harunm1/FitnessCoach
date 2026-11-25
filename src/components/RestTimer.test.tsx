// @vitest-environment jsdom
// Tests for the rest timer (live feedback 24 Nov, item 2): it starts by itself when a set is
// logged, can be skipped or reset, and does not restart for an old set after a reload.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RestTimer from "./RestTimer";

const { alertRestEnded, unlockAudio } = vi.hoisted(() => ({
  alertRestEnded: vi.fn(),
  unlockAudio: vi.fn(),
}));
vi.mock("@/lib/alerts/browserAlert", () => ({ alertRestEnded, unlockAudio }));

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
  Array.from({ length: seconds }).forEach(() => {
    act(() => {
      vi.advanceTimersByTime(ONE_SECOND_MS);
    });
  });
}

const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
  alertRestEnded.mockClear();
  unlockAudio.mockClear();
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

describe("RestTimer when the page refreshes", () => {
  it("does not restart a paused timer when only the server time changes", () => {
    const view = renderTimer(iso(NOW));
    tick(TEN_SECONDS);
    act(() => {
      screen.getByRole("button", { name: "Pause timer" }).click();
    });
    expect(screen.getByText("Paused")).toBeTruthy();
    view.rerender(
      <RestTimer
        exerciseName="Bench Press"
        lastLoggedAtIso={iso(NOW)}
        restSeconds={REST}
        serverNowIso={iso(NOW + TEN_SECONDS * ONE_SECOND_MS)}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText("Paused")).toBeTruthy();
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

// Rest alerts, +15 / -15 and the deadline clock (D34).
const FIFTEEN = 15;
const NINETY_SECONDS = 90;
const NINETY_SECONDS_MS = 90_000;
const SIXTY_SECONDS_MS = 60_000;
const HUNDRED_SECONDS_MS = 100_000;
const FOUR_MINUTES_MS = 240_000;
const THIRTY = 30;
const SEVENTY_FIVE = 75;

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
}

function wake() {
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("RestTimer +15 / -15", () => {
  it("+15 adds fifteen seconds to the running rest", () => {
    renderTimer(iso(NOW));
    tick(TEN_SECONDS);
    act(() => {
      screen.getByRole("button", { name: "+15 s" }).click();
    });
    expect(screen.getByText("01:35")).toBeTruthy();
  });

  it("-15 takes fifteen seconds off the running rest", () => {
    renderTimer(iso(NOW));
    tick(TEN_SECONDS);
    act(() => {
      screen.getByRole("button", { name: "-15 s" }).click();
    });
    expect(screen.getByText("01:05")).toBeTruthy();
  });

  it("-15 with less than fifteen seconds left ends the rest like Skip, with no alert", () => {
    renderTimer(iso(NOW - (NINETY_SECONDS - TEN_SECONDS) * ONE_SECOND_MS));
    act(() => {
      screen.getByRole("button", { name: "-15 s" }).click();
    });
    expect(screen.queryByText("Resting")).toBeNull();
    expect(screen.getByText("01:30")).toBeTruthy();
    tick(THIRTY);
    expect(alertRestEnded).not.toHaveBeenCalled();
  });

  it("the adjust buttons appear only while resting", () => {
    renderTimer(iso(NOW - OLD_SET_AGE_MS));
    expect(screen.queryByRole("button", { name: "+15 s" })).toBeNull();
    expect(screen.queryByRole("button", { name: "-15 s" })).toBeNull();
  });

  it("a +15 moves the alert later by fifteen seconds", () => {
    renderTimer(iso(NOW));
    act(() => {
      screen.getByRole("button", { name: "+15 s" }).click();
    });
    tick(NINETY_SECONDS);
    expect(alertRestEnded).not.toHaveBeenCalled();
    tick(FIFTEEN);
    expect(alertRestEnded).toHaveBeenCalledTimes(1);
  });
});

describe("RestTimer rest-end alert", () => {
  it("fires once when the countdown reaches zero, and not again", () => {
    renderTimer(iso(NOW));
    tick(NINETY_SECONDS - 1);
    expect(alertRestEnded).not.toHaveBeenCalled();
    tick(1);
    expect(screen.getByText("Rest complete")).toBeTruthy();
    expect(alertRestEnded).toHaveBeenCalledTimes(1);
    tick(THIRTY);
    expect(alertRestEnded).toHaveBeenCalledTimes(1);
  });

  it("does not fire for a rest the user skipped", () => {
    renderTimer(iso(NOW));
    act(() => {
      screen.getByRole("button", { name: "Skip rest" }).click();
    });
    tick(NINETY_SECONDS + THIRTY);
    expect(alertRestEnded).not.toHaveBeenCalled();
  });

  it("does not fire while the rest timer is paused", () => {
    renderTimer(iso(NOW));
    tick(TEN_SECONDS);
    act(() => {
      screen.getByRole("button", { name: "Pause timer" }).click();
    });
    tick(NINETY_SECONDS + THIRTY);
    expect(alertRestEnded).not.toHaveBeenCalled();
    expect(screen.getByText("01:20")).toBeTruthy();
  });

  it("keeps counting with the screen off: a timer that never ticked is right when the tab wakes", () => {
    renderTimer(iso(NOW));
    setHidden(true);
    // The browser delivered no timers for 100 seconds (a sleeping phone).
    vi.setSystemTime(NOW + HUNDRED_SECONDS_MS);
    wake();
    expect(screen.getByText("Rest complete")).toBeTruthy();
    expect(alertRestEnded).toHaveBeenCalledTimes(1);
    tick(THIRTY);
    expect(alertRestEnded).toHaveBeenCalledTimes(1);
    setHidden(false);
  });

  it("shows the true remaining time after a nap shorter than the rest", () => {
    renderTimer(iso(NOW));
    vi.setSystemTime(NOW + SIXTY_SECONDS_MS);
    wake();
    expect(screen.getByText("00:30")).toBeTruthy();
    expect(alertRestEnded).not.toHaveBeenCalled();
  });

  it("is not paused by the page being hidden", () => {
    renderTimer(iso(NOW));
    setHidden(true);
    wake();
    expect(screen.getByText("Resting")).toBeTruthy();
    setHidden(false);
  });

  it("is late-proof: a four minute gap still fires exactly once", () => {
    renderTimer(iso(NOW));
    vi.setSystemTime(NOW + FOUR_MINUTES_MS);
    wake();
    wake();
    expect(alertRestEnded).toHaveBeenCalledTimes(1);
  });

  it("fires again for the next rest", () => {
    const view = renderTimer(iso(NOW));
    tick(NINETY_SECONDS);
    expect(alertRestEnded).toHaveBeenCalledTimes(1);
    const next = NOW + NINETY_SECONDS_MS;
    view.rerender(
      <RestTimer
        exerciseName="Bench Press"
        lastLoggedAtIso={iso(next)}
        restSeconds={REST}
        serverNowIso={iso(next)}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    tick(NINETY_SECONDS);
    expect(alertRestEnded).toHaveBeenCalledTimes(2);
  });

  it("counts a rest that began 15 seconds ago with 75 seconds left", () => {
    renderTimer(iso(NOW - FIFTEEN * ONE_SECOND_MS));
    expect(screen.getByText("01:15")).toBeTruthy();
    tick(SEVENTY_FIVE);
    expect(alertRestEnded).toHaveBeenCalledTimes(1);
  });
});
