// What the streaks count (D34, reversing D22): every finished workout, imported or live. An
// imported workout has no plan, so its week is judged against the user's weekly goal instead.
import type { FinishedWorkout } from "./streaks";
import type { ProgressWorkout } from "./types";

export function streakInput(
  workouts: ProgressWorkout[],
  fallbackPlanDays: number,
): FinishedWorkout[] {
  return workouts.map((workout) => ({
    startedAt: workout.startedAt,
    planDays: workout.imported ? fallbackPlanDays : workout.planDays,
  }));
}
