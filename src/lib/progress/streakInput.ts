// What the streaks count (D36, reversing D22): every finished workout, imported or live. An
// imported workout has no plan, so its week is judged against the user's weekly goal instead.
import type { FinishedWorkout } from "./streaks";
import type { ProgressWorkout } from "./types";

export function streakInput(
  workouts: ProgressWorkout[],
  fallbackPlanDays: number,
): FinishedWorkout[] {
  return workouts.map((workout) => ({
    startedAt: workout.startedAt,
    // No plan days (an import, or a workout logged by hand with no plan) has no goal of
    // its own, so the profile's days a week is used.
    planDays:
      workout.imported || workout.planDays === 0
        ? fallbackPlanDays
        : workout.planDays,
  }));
}
