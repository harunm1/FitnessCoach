// Free-tier limits for the repeated eval runs (#64), and the wait and daily budget they imply.
export type Limits = { rpm: number; rpd?: number; tpm?: number; tpd?: number };

// Groq: openai/gpt-oss-120b base limits, console.groq.com/docs/rate-limits, checked
// 10 Nov 2026 (the account's own figures are on its limits page).
// Gemini: free-tier limits are per project and shown only in AI Studio; RPD resets at
// midnight Pacific (ai.google.dev/gemini-api/docs/rate-limits, 10 Nov 2026). The
// defaults are cautious stand-ins: Flash-Lite (the fallback, GEMINI_MODEL) ran 15 s
// apart in round 2 with no per-minute 429, and 20 a day is the cap gemini-3.5-flash
// hit then (docs/COACH_EVAL.md). Set EVAL_GAP_MS and EVAL_MAX_CALLS from the
// project's AI Studio limits page.
export const PROVIDER_LIMITS: Record<"groq" | "gemini", Limits> = {
  groq: { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200_000 },
  gemini: { rpm: 4, rpd: 20 },
};

// A full-library prompt is about 4,700 tokens (docs/COACH_EVAL.md, round 2); with the
// reply and low-effort reasoning, 8,000 per call is a safe ceiling.
export const TOKENS_PER_CALL = 8000;

const MINUTE = 60_000;

// The wait between calls that keeps both per-minute limits.
export function callGapMs(
  limits: Pick<Limits, "rpm" | "tpm">,
  tokensPerCall: number,
): number {
  const byRequests = MINUTE / limits.rpm;
  const byTokens = limits.tpm ? (MINUTE * tokensPerCall) / limits.tpm : 0;
  return Math.ceil(Math.max(byRequests, byTokens));
}

// How many calls fit in one day under both daily limits.
export function dailyCallBudget(
  limits: Pick<Limits, "rpd" | "tpd">,
  tokensPerCall: number,
): number {
  const byTokens = limits.tpd
    ? Math.floor(limits.tpd / tokensPerCall)
    : Infinity;
  return Math.min(limits.rpd ?? Infinity, byTokens);
}

export type RunKey = { id: string; run: number };

// The (profile, run) pairs not yet in the results file, profile by profile, so a run
// cut short by a daily cap leaves whole profiles finished and resumes where it stopped.
export function pendingRuns(
  ids: string[],
  repeat: number,
  done: RunKey[],
): RunKey[] {
  const finished = new Set(done.map((d) => `${d.id}#${d.run}`));
  return ids.flatMap((id) =>
    Array.from({ length: repeat }, (_, i) => ({ id, run: i + 1 })).filter(
      (k) => !finished.has(`${k.id}#${k.run}`),
    ),
  );
}

// Wraps a call so each one starts at least gapMs after the previous one started. The
// coach can call twice in a row (a rejected plan is retried), so pacing sits on the
// call, not between profiles.
export function paced<A, R>(
  call: (arg: A) => Promise<R>,
  gapMs: number,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): (arg: A) => Promise<R> {
  let lastStart = -Infinity;
  return async (arg) => {
    const wait = lastStart + gapMs - now();
    if (wait > 0) await sleep(wait);
    lastStart = now();
    return call(arg);
  };
}

// A run in which every call was refused for rate limiting says nothing about the
// coach: it is not recorded, and the batch stops there to resume after the reset.
export function rateLimitedOut(
  calls: { error?: string; reply?: unknown }[],
): boolean {
  return calls.length > 0 && calls.every((c) => c.error?.includes("HTTP 429"));
}
