import { getNextPlanDayIndex } from "@/lib/workout/progression";

type DayKind = "STRENGTH" | "RUN" | "REST";
type RunType = "EASY" | "TEMPO" | "INTERVALS" | "HILLS" | "LONG";

// The active plan, as much of it as the rule below needs.
export type PlanForRun = {
  id: number;
  createdDay: string; // the day the plan was made, "2026-11-20"
  finishedWorkouts: number; // finished workouts on this plan
  hasOpenWorkout: boolean; // a session is open on this plan
  days: { id: number; kind: DayKind; runType: RunType | null }[]; // by dayIndex
};

export type RunPlanDay = {
  planId: number;
  planDayId: number;
  runType: RunType | null;
};

// The plan day a run logged by hand completes, or null (D27). Plan days are a
// rotation, not dates: the next day is finished workouts modulo days, as on the
// session screen. A run takes that day only when it is a run day, no session is
// open on the plan (the session screen holds that day), and the run is not from
// before the plan existed.
export function planDayForRun(
  plan: PlanForRun | null,
  runDay: string,
): RunPlanDay | null {
  if (!plan || plan.hasOpenWorkout || runDay < plan.createdDay) return null;
  const index = getNextPlanDayIndex(plan.finishedWorkouts, plan.days.length);
  const day = index === null ? undefined : plan.days[index];
  if (!day || day.kind !== "RUN") return null;
  return { planId: plan.id, planDayId: day.id, runType: day.runType };
}
