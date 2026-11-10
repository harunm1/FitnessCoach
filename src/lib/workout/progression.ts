export function getNextPlanDayIndex(
  completedWorkoutCount: number,
  planDayCount: number,
): number | null {
  if (planDayCount < 1) return null;
  return completedWorkoutCount % planDayCount;
}
