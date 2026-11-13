// Weekly streaks for the progress page (#16). Plan days have no calendar dates (the
// session screen serves the next day whenever the user trains), so streaks count
// finished workouts per week, Monday to Sunday, in the user's time zone.
import { DEFAULT_TIME_ZONE, dayKey, previousWeek, weekKey } from "./dates";

export type FinishedWorkout = {
  startedAt: Date;
  // Training days (STRENGTH + RUN) in the plan the workout belongs to.
  planDays: number;
};

type Week = { workouts: number; latest: Date; planDays: number };

// One entry per week that has at least one workout.
function groupByWeek(
  workouts: FinishedWorkout[],
  timeZone: string,
): Map<string, Week> {
  const weeks = new Map<string, Week>();
  for (const workout of workouts) {
    const key = weekKey(dayKey(workout.startedAt, timeZone));
    const week = weeks.get(key);
    if (!week) {
      weeks.set(key, {
        workouts: 1,
        latest: workout.startedAt,
        planDays: workout.planDays,
      });
      continue;
    }
    week.workouts += 1;
    // A plan change mid-week: the newest workout's plan sets that week's goal.
    if (workout.startedAt > week.latest) {
      week.latest = workout.startedAt;
      week.planDays = workout.planDays;
    }
  }
  return weeks;
}

// The weeks of the current streak, newest first. The current week only joins once it
// counts; until then the streak runs from last week, so it never breaks mid-week.
function streakWeeks(
  weeks: Map<string, Week>,
  today: Date,
  counts: (week: Week | undefined) => boolean,
  timeZone: string,
): string[] {
  let week = weekKey(dayKey(today, timeZone));
  if (!counts(weeks.get(week))) week = previousWeek(week);
  const streak: string[] = [];
  while (counts(weeks.get(week))) {
    streak.push(week);
    week = previousWeek(week);
  }
  return streak;
}

const isActive = (week: Week | undefined) => (week?.workouts ?? 0) > 0;

// A week meets its goal when it has as many workouts as its plan has training days.
const metGoal = (week: Week | undefined) =>
  week !== undefined && week.workouts >= week.planDays;

// Week keys (Mondays) of the current active-week streak, newest first. The progress
// page uses them to collect the muscles worked across the streak.
export function activeStreakWeeks(
  workouts: FinishedWorkout[],
  today: Date,
  timeZone = DEFAULT_TIME_ZONE,
): string[] {
  return streakWeeks(
    groupByWeek(workouts, timeZone),
    today,
    isActive,
    timeZone,
  );
}

// Weeks in a row with at least one finished workout.
export function activeWeekStreak(
  workouts: FinishedWorkout[],
  today: Date,
  timeZone = DEFAULT_TIME_ZONE,
): number {
  return activeStreakWeeks(workouts, today, timeZone).length;
}

// Weeks in a row with at least as many finished workouts as the plan has training
// days. It counts workouts, not which plan days they were.
export function goalMetStreak(
  workouts: FinishedWorkout[],
  today: Date,
  timeZone = DEFAULT_TIME_ZONE,
): number {
  return streakWeeks(groupByWeek(workouts, timeZone), today, metGoal, timeZone)
    .length;
}
