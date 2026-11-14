// The workouts the progress demo creates (#16), worked out from today's date so the
// page always has a current streak to show. Pure, so it is tested without a database.
import { dayKey, previousWeek, weekKey } from "../../src/lib/progress/dates";
import {
  activeStreakWeeks,
  goalMetStreak,
} from "../../src/lib/progress/streaks";
import { fillPlanGoals } from "../../src/lib/progress/view";

export const DEMO_TIME_ZONE = "America/Toronto";
// Upper body, lower body and a run; the fourth day is rest.
export const DEMO_PLAN_DAYS = 3;

// What a workout contains. Each kind exercises a different part of the page.
export type DemoKind =
  | "upper" // chest, back, shoulders, biceps
  | "lower" // legs, glutes, calves, abs (one bodyweight exercise)
  | "power" // powerlifting and plyometrics: lifting outside "strength"
  | "free" // a session with no plan: its goal comes from the last plan
  | "stretch" // stretching only: left off the body map and muscle list
  | "cardio" // cardio only: also left off
  | "run"; // a logged run: distance, time and pace, no sets

export type DemoWorkout = {
  day: string; // "2026-11-09", in Toronto
  hour: number; // Toronto clock time
  minute: number;
  kind: DemoKind;
  minutes: number;
  withPlan: boolean;
  finished: boolean;
  // How many weeks ago, so weights can go up over time.
  weeksAgo: number;
  run?: { km: number; seconds: number };
};

const WEEKDAY = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
type Weekday = keyof typeof WEEKDAY;
type Entry = [Weekday, number, number, DemoKind, Partial<DemoWorkout>?];

// Week by week, newest first. Week 0 is this week.
//   Weeks 1-4 each reach the plan's goal of 3: a 4-week goal streak.
//   Week 5 has workouts but misses the goal (a free session and a stretch).
//   Week 6 reaches the goal again; week 7 is empty, so the active streak is
//   weeks 0-6. Older weeks fill earlier months for the calendar arrows.
const WEEKS: Entry[][] = [
  [["mon", 8, 0, "upper"]],
  [
    ["mon", 12, 0, "upper"],
    ["wed", 12, 0, "lower"],
    // 10:30 p.m. in Toronto, already Saturday in UTC: must still show on Friday.
    ["fri", 22, 30, "run", { run: { km: 6.2, seconds: 2201 } }],
  ],
  [
    ["mon", 12, 0, "upper"],
    // Two workouts on one day.
    ["wed", 12, 0, "lower"],
    ["wed", 18, 30, "run", { run: { km: 5, seconds: 1800 } }],
    ["sat", 10, 0, "power"],
  ],
  [
    ["mon", 12, 0, "upper"],
    ["wed", 12, 0, "lower"],
    ["fri", 7, 0, "run", { run: { km: 8, seconds: 2880 } }],
  ],
  [
    ["tue", 12, 0, "upper"],
    ["thu", 12, 0, "lower"],
    ["sun", 9, 0, "run", { run: { km: 10, seconds: 3720 } }],
  ],
  [
    ["mon", 12, 0, "free", { withPlan: false }],
    ["thu", 12, 0, "stretch"],
  ],
  [
    ["mon", 12, 0, "upper"],
    ["wed", 12, 0, "power"],
    ["fri", 12, 0, "run", { run: { km: 5.5, seconds: 2035 } }],
  ],
  [],
  [
    ["tue", 12, 0, "upper"],
    ["thu", 12, 0, "cardio"],
    ["sat", 9, 0, "run", { run: { km: 4, seconds: 1560 } }],
  ],
  [
    ["mon", 12, 0, "lower"],
    ["fri", 12, 0, "upper"],
  ],
  [
    ["wed", 12, 0, "upper"],
    // Started but never finished: must not appear anywhere.
    ["fri", 12, 0, "lower", { finished: false }],
  ],
  [["mon", 12, 0, "run", { run: { km: 3, seconds: 1140 } }]],
];

const MINUTES: Record<DemoKind, number> = {
  upper: 55,
  lower: 60,
  power: 50,
  free: 35,
  stretch: 15,
  cardio: 25,
  run: 0, // from the run's own time
};

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The moment a Toronto clock shows this day and time, in standard or daylight time.
export function torontoTime(day: string, hour: number, minute: number): Date {
  const [year, month, date] = day.split("-").map(Number);
  for (const offset of [5, 4]) {
    const candidate = new Date(
      Date.UTC(year, month - 1, date, hour + offset, minute),
    );
    const shown = new Intl.DateTimeFormat("en-CA", {
      timeZone: DEMO_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(candidate);
    const expected = `${day}, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (shown === expected) return candidate;
  }
  throw new Error(`No Toronto time ${day} ${hour}:${minute}`);
}

// The demo workouts for the week containing `now` and the 11 weeks before it,
// leaving out anything that would start in the future.
export function demoSchedule(now: Date): DemoWorkout[] {
  let monday = weekKey(dayKey(now, DEMO_TIME_ZONE));
  const workouts: DemoWorkout[] = [];
  WEEKS.forEach((entries, weeksAgo) => {
    for (const [weekday, hour, minute, kind, extra] of entries) {
      const day = addDays(monday, WEEKDAY[weekday]);
      const workout: DemoWorkout = {
        day,
        hour,
        minute,
        kind,
        minutes: extra?.run
          ? Math.round(extra.run.seconds / 60)
          : MINUTES[kind],
        withPlan: true,
        finished: true,
        weeksAgo,
        ...extra,
      };
      if (torontoTime(day, hour, minute) <= now) workouts.push(workout);
    }
    monday = previousWeek(monday);
  });
  return workouts.sort(
    (a, b) =>
      torontoTime(a.day, a.hour, a.minute).getTime() -
      torontoTime(b.day, b.hour, b.minute).getTime(),
  );
}

// The streaks the progress page should show for the demo alone, worked out with
// the page's own functions.
export function expectedStreaks(now: Date) {
  const finished = demoSchedule(now).filter((w) => w.finished);
  const workouts = fillPlanGoals(
    finished.map((w, id) => {
      const start = torontoTime(w.day, w.hour, w.minute);
      return {
        id,
        startedAt: start,
        finishedAt: start,
        dayName: null,
        planDays: w.withPlan ? DEMO_PLAN_DAYS : 0,
        distanceKm: null,
        runSeconds: null,
        sets: [],
      };
    }),
  );
  return {
    activeWeeks: activeStreakWeeks(workouts, now).length,
    goalWeeks: goalMetStreak(workouts, now),
  };
}
