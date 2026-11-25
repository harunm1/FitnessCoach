// The rest timer's end-time math (D36). The countdown is a deadline, not a count of one-second
// ticks, so a sleeping screen or a throttled background tab cannot make it run slow.

const MS_PER_SECOND = 1000;

// The +15 / -15 step, as on Hevy's rest timer.
export const ADJUST_SECONDS = 15;

// Whole seconds left, rounded up so the display shows 00:01 until the very end.
export function restSecondsLeft(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / MS_PER_SECOND));
}

export function restEndFromRemaining(
  remainingSeconds: number,
  nowMs: number,
): number {
  return nowMs + remainingSeconds * MS_PER_SECOND;
}

// Moves the end by `deltaSeconds`, never earlier than now.
export function adjustRestEnd(
  endsAtMs: number,
  deltaSeconds: number,
  nowMs: number,
): number {
  return Math.max(nowMs, endsAtMs + deltaSeconds * MS_PER_SECOND);
}
