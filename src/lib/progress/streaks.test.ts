import { describe, expect, it } from "vitest";
import {
  activeStreakWeeks,
  activeWeekStreak,
  goalMetStreak,
  type FinishedWorkout,
} from "./streaks";

// 17:00 UTC is midday in Toronto (noon in winter, 1 p.m. during daylight saving),
// so the UTC timestamp falls on the same calendar day.
function on(day: string, planDays = 3): FinishedWorkout {
  return { startedAt: new Date(`${day}T17:00:00Z`), planDays };
}

// Wednesday 11 November 2026; its week starts Monday 9 November.
const today = new Date("2026-11-11T17:00:00Z");

describe("activeWeekStreak", () => {
  it("is 0 with no workouts", () => {
    expect(activeWeekStreak([], today)).toBe(0);
  });

  it("counts this week once it has a workout", () => {
    expect(activeWeekStreak([on("2026-11-10")], today)).toBe(1);
  });

  it("counts consecutive weeks", () => {
    const workouts = [on("2026-10-28"), on("2026-11-04"), on("2026-11-10")];
    expect(activeWeekStreak(workouts, today)).toBe(3);
  });

  it("stops at a week with no workouts", () => {
    // Nothing in the week of 26 October.
    const workouts = [on("2026-10-21"), on("2026-11-04"), on("2026-11-10")];
    expect(activeWeekStreak(workouts, today)).toBe(2);
  });

  it("does not break the streak in a week that has not trained yet", () => {
    const workouts = [on("2026-10-28"), on("2026-11-04")];
    expect(activeWeekStreak(workouts, today)).toBe(2);
  });

  it("counts several workouts in one week once", () => {
    const workouts = [on("2026-11-09"), on("2026-11-10"), on("2026-11-11")];
    expect(activeWeekStreak(workouts, today)).toBe(1);
  });
});

describe("activeStreakWeeks", () => {
  it("lists the streak's Mondays, newest first", () => {
    const workouts = [on("2026-10-28"), on("2026-11-04"), on("2026-11-10")];
    expect(activeStreakWeeks(workouts, today)).toEqual([
      "2026-11-09",
      "2026-11-02",
      "2026-10-26",
    ]);
  });

  it("uses the Toronto calendar day for late-evening workouts", () => {
    // 11:30 p.m. Sunday 8 November in Toronto is Monday 9 November in UTC, so it
    // belongs to last week, not this one.
    const lateSunday = {
      startedAt: new Date("2026-11-09T04:30:00Z"),
      planDays: 3,
    };
    expect(activeStreakWeeks([lateSunday], today)).toEqual(["2026-11-02"]);
  });
});

describe("goalMetStreak", () => {
  it("counts a week with all planned days done", () => {
    const workouts = [on("2026-11-02"), on("2026-11-04"), on("2026-11-06")];
    expect(goalMetStreak(workouts, today)).toBe(1);
  });

  it("does not count a week with fewer workouts than planned", () => {
    const workouts = [on("2026-11-02"), on("2026-11-04")];
    expect(goalMetStreak(workouts, today)).toBe(0);
  });

  it("keeps counting while this week is still short of its goal", () => {
    const lastWeek = [on("2026-11-02"), on("2026-11-04"), on("2026-11-06")];
    const thisWeek = [on("2026-11-10")];
    expect(goalMetStreak([...lastWeek, ...thisWeek], today)).toBe(1);
  });

  it("uses the plan of the week's latest workout", () => {
    // Two workouts on a 3-day plan, then a switch to a 2-day plan: the goal is 2.
    const workouts = [on("2026-11-02", 3), on("2026-11-04", 2)];
    expect(goalMetStreak(workouts, today)).toBe(1);
  });

  it("finds the latest workout even when the list is not in date order", () => {
    // Same week as above, newest first: the 2-day plan still sets the goal.
    const workouts = [on("2026-11-04", 2), on("2026-11-02", 3)];
    expect(goalMetStreak(workouts, today)).toBe(1);
  });

  it("counts a week as met when the workout has no plan", () => {
    // A deleted plan has no training days, so there is no goal to miss.
    expect(goalMetStreak([on("2026-11-10", 0)], today)).toBe(1);
  });
});
