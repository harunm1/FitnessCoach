// Helpers that turn workouts into what the progress page shows (#16): the month grid,
// workouts per day, durations and paces. Pure functions, so they are tested offline.
import { DEFAULT_TIME_ZONE, dayKey } from "./dates";
import type { ProgressSet, ProgressWorkout } from "./types";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// "2026-11" from a valid month parameter, or the fallback.
export function parseMonth(value: string | undefined, fallback: string) {
  return value && MONTH.test(value) ? value : fallback;
}

// A valid day parameter, or undefined.
export function parseDay(value: string | undefined): string | undefined {
  return value && DAY.test(value) ? value : undefined;
}

// The month a day key belongs to: "2026-11-08" -> "2026-11".
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

// The month before (-1) or after (+1).
export function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

// The month as weeks of day keys, Monday first; null pads the first and last week.
export function monthGrid(month: string): (string | null)[][] {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7; // Monday 0 ... Sunday 6

  const cells: (string | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Workouts grouped by the calendar day they started on, in the user's time zone.
export function groupByDay(
  workouts: ProgressWorkout[],
  timeZone = DEFAULT_TIME_ZONE,
): Map<string, ProgressWorkout[]> {
  const days = new Map<string, ProgressWorkout[]>();
  for (const workout of workouts) {
    const key = dayKey(workout.startedAt, timeZone);
    days.set(key, [...(days.get(key) ?? []), workout]);
  }
  return days;
}

// Whole minutes from start to finish, at least 1.
export function durationMinutes(workout: ProgressWorkout): number {
  const ms = workout.finishedAt.getTime() - workout.startedAt.getTime();
  return Math.max(1, Math.round(ms / 60000));
}

// "32:05" for a duration in seconds.
export function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

// "6:24 /km", or null when the run has no usable distance or time.
export function pace(distanceKm: number | null, seconds: number | null) {
  if (!distanceKm || !seconds || distanceKm <= 0) return null;
  return `${clock(seconds / distanceKm)} /km`;
}

export type ExerciseGroup = { name: string; sets: ProgressSet[] };

// Sets grouped by exercise, in the order the exercises were first logged.
export function groupByExercise(sets: ProgressSet[]): ExerciseGroup[] {
  const groups = new Map<string, ProgressSet[]>();
  for (const set of sets) {
    groups.set(set.exerciseName, [
      ...(groups.get(set.exerciseName) ?? []),
      set,
    ]);
  }
  return [...groups].map(([name, grouped]) => ({
    name,
    sets: [...grouped].sort((a, b) => a.setNumber - b.setNumber),
  }));
}

// Workouts without a plan (a free session, or a plan that was deleted) take the
// weekly goal of the most recent workout before them that had one, so they never
// count as meeting a goal of zero. Workouts are expected oldest first.
export function fillPlanGoals(workouts: ProgressWorkout[]): ProgressWorkout[] {
  let goal = 0;
  return workouts.map((workout) => {
    if (workout.planDays > 0) {
      goal = workout.planDays;
      return workout;
    }
    return { ...workout, planDays: goal };
  });
}

// The workouts that started in a month, in the user's time zone.
export function inMonth(
  workouts: ProgressWorkout[],
  month: string,
  timeZone = DEFAULT_TIME_ZONE,
): ProgressWorkout[] {
  return workouts.filter(
    (workout) => monthOf(dayKey(workout.startedAt, timeZone)) === month,
  );
}
