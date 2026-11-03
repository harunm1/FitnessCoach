// Hybrid week: how many strength and run days a user gets, and in what order.
// The quiz asks for days per week, a goal and a training mode (gym, running, both);
// this file turns those into a split, then fills each side with the existing
// builders (buildDefaultPlan for strength, buildRunningPlan for runs), so every day
// still passes its own verifier. Decision D9 in docs/ARCHITECTURE.md.
import { buildDefaultPlan } from "./defaultPlan";
import { buildRunningPlan } from "./runningPlan";
import type { LibraryExercise, VerifyProfile } from "./verify";
import type { PlanDayInput, RunSessionInput } from "./schema";
import type { RunProfile } from "./verifyRunning";

export type Goal = "STRENGTH" | "MUSCLE" | "FAT_LOSS" | "GENERAL_FITNESS";
export type TrainingMode = "GYM" | "RUNNING" | "BOTH";

export type HybridProfile = VerifyProfile &
  Omit<RunProfile, "runDaysPerWeek"> & {
    goal: Goal;
    trainingMode: TrainingMode;
  };

export type WeekDay =
  | ({ kind: "STRENGTH" } & PlanDayInput)
  | { kind: "RUN"; name: string; run: RunSessionInput };

export type Split = { strengthDays: number; runDays: number };

// Runners keep strength work for injury prevention: one day from three days a week,
// two from four. In a hybrid week the goal decides which side gets the larger share.
export function splitDays(
  daysPerWeek: number,
  goal: Goal,
  mode: TrainingMode,
): Split {
  const days = Math.max(1, Math.min(7, daysPerWeek));
  let strengthDays: number;
  if (mode === "GYM") strengthDays = days;
  else if (mode === "RUNNING")
    strengthDays = days >= 4 ? 2 : days === 3 ? 1 : 0;
  else if (goal === "STRENGTH" || goal === "MUSCLE")
    strengthDays = Math.ceil(days * 0.6);
  else if (goal === "FAT_LOSS")
    strengthDays = Math.min(2, Math.max(1, days - 1));
  else strengthDays = Math.ceil(days / 2);
  // At most five run days; anything beyond becomes strength in a hybrid week.
  if (mode !== "GYM" && days - strengthDays > 5) strengthDays = days - 5;
  if (mode === "BOTH" && days === 1) strengthDays = goal === "FAT_LOSS" ? 0 : 1;
  return { strengthDays, runDays: days - strengthDays };
}

export function buildHybridWeek(
  profile: HybridProfile,
  library: LibraryExercise[],
): { name: string; days: WeekDay[] } {
  const { strengthDays, runDays } = splitDays(
    profile.daysPerWeek,
    profile.goal,
    profile.trainingMode,
  );
  const strength =
    strengthDays > 0
      ? buildDefaultPlan({ ...profile, daysPerWeek: strengthDays }, library)
          .days
      : [];
  // The running builder can return fewer days when last week's volume is small;
  // the days it drops are rest days, never extra load.
  const runs =
    runDays > 0
      ? buildRunningPlan({ ...profile, runDaysPerWeek: runDays }).days
      : [];

  return {
    name: weekName(strength.length, runs.length),
    days: interleave(
      strength.map((d) => ({ kind: "STRENGTH" as const, ...d })),
      runs.map((d) => ({ kind: "RUN" as const, ...d })),
    ),
  };
}

// Spread the smaller list through the larger one so the same kind of day is not
// stacked back to back, and keep the long run (always the last run) late in the week.
export function interleave<A, B>(a: A[], b: B[]): (A | B)[] {
  const out: (A | B)[] = [];
  let i = 0;
  let j = 0;
  const total = a.length + b.length;
  for (let k = 0; k < total; k++) {
    // Take from whichever list is further behind its even share of the week.
    const aBehind = (i + 1) / (a.length + 1) <= (j + 1) / (b.length + 1);
    if (j >= b.length || (i < a.length && aBehind)) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return out;
}

function weekName(strength: number, runs: number): string {
  if (runs === 0) return `${strength}-day strength week`;
  if (strength === 0) return `${runs}-day running week`;
  return `${strength} strength and ${runs} run days`;
}
