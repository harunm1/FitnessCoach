// Per-user attempt limiter for coach messages (#63): taken synchronously before any model call, so parallel sends and failed sends both count.
export type AttemptLimits = { perMinute: number; perDay: number };
export type Refusal = "minute" | "day";

const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 1440;
const DAY_MS = MINUTES_PER_DAY * MINUTE_MS;

// In memory, so it holds per server instance: across instances, the count of saved
// messages in the database is the backstop. Each user keeps at most perDay times.
export function createAttemptLimiter(
  limits: AttemptLimits,
  now: () => number = Date.now,
) {
  const attempts = new Map<string, number[]>();

  // Records an attempt and returns null, or returns why it is refused.
  function take(userId: string): Refusal | null {
    const at = now();
    const recent = (attempts.get(userId) ?? []).filter((t) => t > at - DAY_MS);
    attempts.set(userId, recent);
    if (recent.filter((t) => t > at - MINUTE_MS).length >= limits.perMinute) {
      return "minute";
    }
    if (recent.length >= limits.perDay) return "day";
    recent.push(at);
    return null;
  }

  return { take, clear: () => attempts.clear() };
}
