// The workout clock's pause and resume math (D37). Duration counts active time only:
// `bankedSeconds` is the active time before the current stretch, `activeSinceMs` the start
// of the running stretch (null while paused). Pure, so the server action and the screen
// share one rule.

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const IDLE_MINUTES = 30;

// No set and no tap for this long pauses the workout (at the last activity).
export const IDLE_PAUSE_MS = IDLE_MINUTES * MS_PER_MINUTE;

export type ActiveClock = {
  bankedSeconds: number;
  activeSinceMs: number | null;
};

// Active seconds at `atMs`: the banked time plus the running stretch, never negative.
export function activeSeconds(clock: ActiveClock, atMs: number): number {
  if (clock.activeSinceMs === null) return clock.bankedSeconds;
  const stretch = Math.max(
    0,
    Math.floor((atMs - clock.activeSinceMs) / MS_PER_SECOND),
  );
  return clock.bankedSeconds + stretch;
}

// Stops the clock at `requestedAtMs` (a backdated idle pause passes the last activity). The
// time is held between the start of the running stretch and now, so a stale page can neither
// reach back into time already counted nor pause in the future. Pausing a paused clock is a
// no-op.
export function pauseClock(
  clock: ActiveClock,
  requestedAtMs: number,
  nowMs: number,
): ActiveClock {
  if (clock.activeSinceMs === null) return clock;
  const pausedAtMs = Math.min(
    nowMs,
    Math.max(clock.activeSinceMs, requestedAtMs),
  );
  return {
    bankedSeconds: activeSeconds(clock, pausedAtMs),
    activeSinceMs: null,
  };
}

// Starts a new stretch at `nowMs`. Resuming a running clock is a no-op.
export function resumeClock(clock: ActiveClock, nowMs: number): ActiveClock {
  if (clock.activeSinceMs !== null) return clock;
  return { bankedSeconds: clock.bankedSeconds, activeSinceMs: nowMs };
}

// Where an idle pause should start, or null while the user is still active. The answer is the
// last activity itself, however late the page notices.
export function idlePauseAt(
  lastActivityAtMs: number,
  nowMs: number,
  idleMs: number = IDLE_PAUSE_MS,
): number | null {
  return nowMs - lastActivityAtMs >= idleMs ? lastActivityAtMs : null;
}

// The newest sign of life: the start of the running stretch, the last logged set, the last
// tap or key on this device.
export function lastActivityMs(sources: {
  activeSinceMs: number;
  lastSetMs: number | null;
  lastInteractionMs: number | null;
}): number {
  return Math.max(
    sources.activeSinceMs,
    sources.lastSetMs ?? sources.activeSinceMs,
    sources.lastInteractionMs ?? sources.activeSinceMs,
  );
}

// Active seconds when the workout is finished at `nowMs`. A workout left running with no set
// for the idle limit ends at its last activity (the same rule as the idle pause), so finishing
// the next morning does not count the night.
export function finishedActiveSeconds(
  clock: ActiveClock,
  lastSetMs: number | null,
  nowMs: number,
): number {
  if (clock.activeSinceMs === null) return clock.bankedSeconds;
  const lastActivity = Math.max(clock.activeSinceMs, lastSetMs ?? 0);
  return activeSeconds(clock, idlePauseAt(lastActivity, nowMs) ?? nowMs);
}
