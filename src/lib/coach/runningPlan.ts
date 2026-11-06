// Rule-based running week (#34). Used the same way as defaultPlan.ts: when the
// coach's running plan fails verifyRunningPlan twice, or no provider answers, the
// user still gets a week that respects the 10% rule. Its output always passes the
// verifier (runningPlan.test.ts checks this for every fixture profile).
import type { RunSessionInput, RunType, RunningPlanInput } from "./schema";
import { RUN_LIMITS } from "./schema";
import { weeklyCapKm, type RunProfile } from "./verifyRunning";

// Share of the week's distance per session, by number of run days. The long run
// is last and the harder session sits between easy days.
const WEEKS: Record<number, { type: RunType; share: number }[]> = {
  1: [{ type: "EASY", share: 1 }],
  2: [
    { type: "EASY", share: 0.45 },
    { type: "LONG", share: 0.55 },
  ],
  3: [
    { type: "EASY", share: 0.35 },
    { type: "TEMPO", share: 0.25 },
    { type: "LONG", share: 0.4 },
  ],
  4: [
    { type: "EASY", share: 0.25 },
    { type: "TEMPO", share: 0.2 },
    { type: "EASY", share: 0.2 },
    { type: "LONG", share: 0.35 },
  ],
  5: [
    { type: "EASY", share: 0.2 },
    { type: "INTERVALS", share: 0.15 },
    { type: "EASY", share: 0.15 },
    { type: "TEMPO", share: 0.2 },
    { type: "LONG", share: 0.3 },
  ],
};

const NAMES: Record<RunType, string> = {
  EASY: "Easy run",
  TEMPO: "Tempo run",
  INTERVALS: "Intervals",
  HILLS: "Hill repeats",
  LONG: "Long run",
};

// Seconds per km relative to easy pace. A long run is a little slower than easy.
const PACE_OFFSET: Record<RunType, number> = {
  EASY: 0,
  LONG: 15,
  TEMPO: -45,
  INTERVALS: -75,
  HILLS: 0,
};

// Distances are rounded down to the half kilometre, so the week never exceeds the cap.
const halfKmDown = (km: number) => Math.floor(km * 2) / 2;

export function buildRunningPlan(profile: RunProfile): RunningPlanInput {
  const cap = weeklyCapKm(profile);
  // Every run is at least the schema's minimum, so a small week gets fewer run days:
  // start from what the user asked for (five at most) and drop a day until it fits.
  let days = Math.max(1, Math.min(profile.runDaysPerWeek, 5));
  let week = layOut(days, cap, profile.easyPaceSecPerKm);
  while (days > 1 && sum(week) > cap) {
    days -= 1;
    week = layOut(days, cap, profile.easyPaceSecPerKm);
  }
  return { name: `${days}-day running week, ${sum(week)} km`, days: week };
}

function layOut(days: number, cap: number, easyPace: number | null) {
  return WEEKS[days].map(({ type, share }) => ({
    name: NAMES[type],
    run: session(type, cap * share, easyPace),
  }));
}

const sum = (week: { run: { distanceKm: number } }[]) =>
  week.reduce((km, d) => km + d.run.distanceKm, 0);

function session(
  type: RunType,
  km: number,
  easyPace: number | null,
): RunSessionInput {
  const { min, max } = RUN_LIMITS.paceSecPerKm;
  return {
    type,
    distanceKm: Math.min(
      RUN_LIMITS.distanceKm.max,
      Math.max(RUN_LIMITS.distanceKm.min, halfKmDown(km)),
    ),
    targetPaceSecPerKm:
      easyPace === null
        ? null
        : Math.min(max, Math.max(min, easyPace + PACE_OFFSET[type])),
  };
}
