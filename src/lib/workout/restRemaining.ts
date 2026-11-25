// Seconds of rest left after a set was logged, or null when the rest window is over.
// The rest timer uses it to start by itself when a set is logged (live feedback 24 Nov,
// item 2) without restarting after a page reload an hour later.

const MS_PER_SECOND = 1000;

export function restSecondsRemaining(
  loggedAtMs: number,
  nowMs: number,
  restSeconds: number,
): number | null {
  if (!Number.isFinite(loggedAtMs) || restSeconds <= 0) return null;
  // A set stamped a little ahead of this browser's clock counts as logged just now.
  const elapsedSeconds = Math.max(
    0,
    Math.floor((nowMs - loggedAtMs) / MS_PER_SECOND),
  );
  const remaining = restSeconds - elapsedSeconds;
  return remaining > 0 ? remaining : null;
}

// The newest logged time among one exercise's sets (the list is never empty where it is used).
export function latestLoggedAt(sets: { loggedAt: Date }[]): Date {
  return sets.reduce(
    (latest, set) => (set.loggedAt > latest ? set.loggedAt : latest),
    sets[0].loggedAt,
  );
}
