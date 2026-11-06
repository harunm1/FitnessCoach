// Verifier for running plans (#34), the running twin of verify.ts: plain TypeScript,
// every problem reported at once so a regeneration prompt can list them all.
//   - no more run days than the user asked for
//   - the week's distance stays within 10% of last week's logged distance,
//     or within a starting volume set by activity level when nothing is logged yet
//   - at most one long run a week
import { RUN_LIMITS, runningPlanSchema, type RunningPlanInput } from "./schema";

export type ActivityLevel = "SEDENTARY" | "LIGHT" | "ACTIVE" | "PHYSICAL_JOB";

export type RunProfile = {
  runDaysPerWeek: number;
  activityLevel: ActivityLevel;
  // Sum of RunLog.distanceKm over the last seven days; null when nothing is logged.
  lastWeekKm: number | null;
  // From the quiz or recent logs; null for a new runner.
  easyPaceSecPerKm: number | null;
};

// First-week volume with no running history. A physical job already loads the legs,
// so it starts with the light group rather than the active one.
export const STARTING_WEEK_KM: Record<ActivityLevel, number> = {
  SEDENTARY: 6,
  LIGHT: 10,
  ACTIVE: 15,
  PHYSICAL_JOB: 10,
};

export function weeklyCapKm(profile: RunProfile): number {
  if (profile.lastWeekKm && profile.lastWeekKm > 0) {
    // Rounded down, so the cap never exceeds 10%; but never below one shortest run,
    // or a user who logged a short jog could be given no valid week at all.
    return Math.max(
      RUN_LIMITS.distanceKm.min,
      Math.floor(profile.lastWeekKm * (1 + RUN_LIMITS.weeklyIncrease) * 10) /
        10,
    );
  }
  return STARTING_WEEK_KM[profile.activityLevel];
}

export type RunVerifyResult =
  { ok: true; plan: RunningPlanInput } | { ok: false; problems: string[] };

export function verifyRunningPlan(
  raw: unknown,
  profile: RunProfile,
): RunVerifyResult {
  const parsed = runningPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "plan"}: ${issue.message}`,
      ),
    };
  }
  const plan = parsed.data;
  const problems: string[] = [];

  if (plan.days.length > profile.runDaysPerWeek) {
    problems.push(
      `plan has ${plan.days.length} run days; the user asked for ${profile.runDaysPerWeek}`,
    );
  }

  const total = round1(plan.days.reduce((km, d) => km + d.run.distanceKm, 0));
  const cap = weeklyCapKm(profile);
  if (total > cap) {
    problems.push(
      profile.lastWeekKm && profile.lastWeekKm > 0
        ? `plan totals ${total} km; last week was ${profile.lastWeekKm} km, so this week is at most ${cap} km`
        : `plan totals ${total} km; with no logged runs the first week is at most ${cap} km`,
    );
  }

  const longRuns = plan.days.filter((d) => d.run.type === "LONG").length;
  if (longRuns > 1) {
    problems.push(`plan has ${longRuns} long runs; one a week at most`);
  }

  return problems.length === 0 ? { ok: true, plan } : { ok: false, problems };
}

export function round1(km: number): number {
  return Math.round(km * 10) / 10;
}
