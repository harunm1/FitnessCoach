// @vitest-environment jsdom
// Tests for the live workout clock (D34): it counts active time, can be paused and resumed,
// pauses by itself after 30 idle minutes with the pause starting at the last activity, shows a
// "Resume or finish?" prompt, and is NOT paused when the screen turns off or the tab is hidden.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActiveWorkoutClock from "./ActiveWorkoutClock";

const { pauseWorkoutClock, resumeWorkoutClock, finishWorkout } = vi.hoisted(
  () => ({
    pauseWorkoutClock: vi.fn(),
    resumeWorkoutClock: vi.fn(),
    finishWorkout: vi.fn(),
  }),
);
vi.mock("@/app/session/pauseActions", () => ({
  pauseWorkoutClock,
  resumeWorkoutClock,
}));
vi.mock("@/app/session/actions", () => ({ finishWorkout }));

const NOW = Date.parse("2026-11-25T18:00:00.000Z");
const SECOND_MS = 1000;
const MINUTE_MS = 60_000;
const FIVE_MINUTES = 300_000;
const TEN_MINUTES = 600_000;
const TWENTY_MINUTES = 1_200_000;
const TWENTY_NINE_MINUTES = 1_740_000;
const THIRTY_ONE_MINUTES = 1_860_000;
const THIRTY_FIVE_MINUTES = 2_100_000;
const FORTY_MINUTES = 2_400_000;
const FIFTY_MINUTES = 3_000_000;
const SIXTY_MINUTES = 3_600_000;
const BANKED_TEN_MINUTES = 600;
const WORKOUT_ID = 5;
const INTERACTION_KEY = `fc.lastInteraction.${WORKOUT_ID}`;
const iso = (ms: number) => new Date(ms).toISOString();

type Props = Partial<{
  bankedSeconds: number;
  activeSinceMs: number | null;
  lastSetMs: number | null;
}>;

function renderClock({
  bankedSeconds = 0,
  activeSinceMs = NOW - SIXTY_MINUTES,
  lastSetMs = null,
}: Props = {}) {
  return render(
    <ActiveWorkoutClock
      activeSinceIso={activeSinceMs === null ? null : iso(activeSinceMs)}
      bankedSeconds={bankedSeconds}
      lastSetAtIso={lastSetMs === null ? null : iso(lastSetMs)}
      serverNowIso={iso(Date.now())}
      workoutId={WORKOUT_ID}
    />,
  );
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
}

const okPaused = (bankedSeconds: number) => ({
  status: "ok" as const,
  bankedSeconds,
  activeSinceIso: null,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  window.localStorage.clear();
  pauseWorkoutClock.mockReset();
  resumeWorkoutClock.mockReset();
  pauseWorkoutClock.mockResolvedValue(okPaused(BANKED_TEN_MINUTES));
  resumeWorkoutClock.mockResolvedValue({
    status: "ok",
    bankedSeconds: BANKED_TEN_MINUTES,
    activeSinceIso: iso(NOW),
  });
});

afterEach(() => {
  cleanup();
  setHidden(false);
  vi.useRealTimers();
});

describe("ActiveWorkoutClock", () => {
  it("shows banked plus running time and ticks once a second", async () => {
    renderClock({
      bankedSeconds: BANKED_TEN_MINUTES,
      activeSinceMs: NOW - 30 * SECOND_MS,
      lastSetMs: NOW - SECOND_MS,
    });
    await settle();
    expect(screen.getByText("00:10:30")).toBeTruthy();
    await advance(3 * SECOND_MS);
    expect(screen.getByText("00:10:33")).toBeTruthy();
  });

  it("shows a paused clock frozen at its banked time, with Resume", async () => {
    renderClock({ bankedSeconds: BANKED_TEN_MINUTES, activeSinceMs: null });
    await settle();
    await advance(TEN_MINUTES);
    expect(screen.getByText("00:10:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resume workout" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause workout" })).toBeNull();
  });

  it("Pause stops the clock now and keeps the banked time the server returned", async () => {
    renderClock({
      activeSinceMs: NOW - TEN_MINUTES,
      lastSetMs: NOW - SECOND_MS,
    });
    await settle();
    await act(async () => {
      screen.getByRole("button", { name: "Pause workout" }).click();
    });
    expect(pauseWorkoutClock).toHaveBeenCalledWith(iso(NOW));
    expect(screen.getByRole("button", { name: "Resume workout" })).toBeTruthy();
    await advance(FIFTY_MINUTES);
    expect(screen.getByText("00:10:00")).toBeTruthy();
  });

  it("Resume starts a new stretch from the server's time", async () => {
    renderClock({ bankedSeconds: BANKED_TEN_MINUTES, activeSinceMs: null });
    await settle();
    await act(async () => {
      screen.getByRole("button", { name: "Resume workout" }).click();
    });
    expect(resumeWorkoutClock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Pause workout" })).toBeTruthy();
    await advance(5 * SECOND_MS);
    expect(screen.getByText("00:10:05")).toBeTruthy();
  });

  it("shows the server's error when a pause fails and stays running", async () => {
    pauseWorkoutClock.mockResolvedValue({
      status: "error",
      message: "There is no workout in progress.",
    });
    renderClock({ activeSinceMs: NOW - TEN_MINUTES, lastSetMs: NOW });
    await settle();
    await act(async () => {
      screen.getByRole("button", { name: "Pause workout" }).click();
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "no workout in progress",
    );
    expect(screen.getByRole("button", { name: "Pause workout" })).toBeTruthy();
  });
});

describe("idle auto-pause", () => {
  it("pauses at the LAST ACTIVITY (the last set), not when it was noticed", async () => {
    const lastSet = NOW - THIRTY_FIVE_MINUTES;
    renderClock({ lastSetMs: lastSet });
    await settle();
    expect(pauseWorkoutClock).toHaveBeenCalledTimes(1);
    expect(pauseWorkoutClock).toHaveBeenCalledWith(iso(lastSet));
  });

  it("asks 'Resume or finish?' after an idle pause", async () => {
    renderClock({ lastSetMs: NOW - THIRTY_FIVE_MINUTES });
    await settle();
    expect(document.body.textContent).toContain("Resume or finish?");
    expect(screen.getByRole("button", { name: "Resume workout" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finish workout" })).toBeTruthy();
  });

  it("does not pause before 30 idle minutes", async () => {
    renderClock({ lastSetMs: NOW - TWENTY_NINE_MINUTES });
    await settle();
    expect(pauseWorkoutClock).not.toHaveBeenCalled();
  });

  it("pauses once the 30 minutes pass while the page is open, backdated to the last set", async () => {
    const lastSet = NOW - TWENTY_NINE_MINUTES;
    renderClock({ lastSetMs: lastSet });
    await settle();
    expect(pauseWorkoutClock).not.toHaveBeenCalled();
    await advance(2 * MINUTE_MS);
    expect(pauseWorkoutClock).toHaveBeenCalledTimes(1);
    expect(pauseWorkoutClock).toHaveBeenCalledWith(iso(lastSet));
  });

  it("a tap counts as activity: the pause starts at the tap, not at the last set", async () => {
    const lastSet = NOW - TWENTY_MINUTES;
    renderClock({ lastSetMs: lastSet });
    await settle();
    await advance(FIVE_MINUTES);
    const tapAt = Date.now();
    act(() => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    // 29 minutes after the tap: still active.
    await advance(TWENTY_NINE_MINUTES);
    expect(pauseWorkoutClock).not.toHaveBeenCalled();
    await advance(2 * MINUTE_MS);
    expect(pauseWorkoutClock).toHaveBeenCalledTimes(1);
    const sent = Date.parse(pauseWorkoutClock.mock.calls[0][0]);
    expect(Math.abs(sent - tapAt)).toBeLessThanOrEqual(SECOND_MS);
  });

  it("uses the last interaction kept on this device across a reload", async () => {
    window.localStorage.setItem(INTERACTION_KEY, String(NOW - TEN_MINUTES));
    renderClock({ lastSetMs: NOW - FORTY_MINUTES });
    await settle();
    expect(pauseWorkoutClock).not.toHaveBeenCalled();
  });

  it("asks the server once, not on every tick", async () => {
    renderClock({ lastSetMs: NOW - THIRTY_ONE_MINUTES });
    await settle();
    await advance(10 * SECOND_MS);
    expect(pauseWorkoutClock).toHaveBeenCalledTimes(1);
  });

  it("Resume from the prompt starts running again and removes the prompt", async () => {
    renderClock({ lastSetMs: NOW - THIRTY_FIVE_MINUTES });
    await settle();
    await act(async () => {
      screen.getByRole("button", { name: "Resume workout" }).click();
    });
    expect(resumeWorkoutClock).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("Resume or finish?");
    expect(screen.getByRole("button", { name: "Pause workout" })).toBeTruthy();
  });
});

describe("the screen turning off is not a pause (the rest timer must keep counting)", () => {
  it("keeps running when the page is hidden, and is right when it comes back", async () => {
    renderClock({
      bankedSeconds: BANKED_TEN_MINUTES,
      activeSinceMs: NOW,
      lastSetMs: NOW,
    });
    await settle();
    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(pauseWorkoutClock).not.toHaveBeenCalled();
    // Five minutes with no timers delivered (a sleeping phone), then the page wakes.
    vi.setSystemTime(NOW + 5 * MINUTE_MS);
    setHidden(false);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(pauseWorkoutClock).not.toHaveBeenCalled();
    expect(screen.getByText("00:15:00")).toBeTruthy();
  });

  it("a long sleep is still judged by the idle rule when the page wakes", async () => {
    renderClock({
      activeSinceMs: NOW,
      lastSetMs: NOW,
    });
    await settle();
    setHidden(true);
    vi.setSystemTime(NOW + FIFTY_MINUTES);
    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(pauseWorkoutClock).toHaveBeenCalledTimes(1);
    expect(pauseWorkoutClock).toHaveBeenCalledWith(iso(NOW));
  });
});
