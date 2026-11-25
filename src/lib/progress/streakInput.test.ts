import { describe, expect, it } from "vitest";
import type { ProgressWorkout } from "./types";
import { streakInput } from "./streakInput";
import { activeWeekStreak, goalMetStreak } from "./streaks";

// Wednesday 25 November 2026, noon in Toronto. Weeks start on Monday.
const NOW = new Date("2026-11-25T17:00:00Z");

function workout(
  iso: string,
  overrides: Partial<ProgressWorkout> = {},
): ProgressWorkout {
  const start = new Date(iso);
  return {
    id: start.getTime(),
    startedAt: start,
    finishedAt: new Date(start.getTime() + 50 * 60000),
    dayName: null,
    imported: true,
    planDays: 0,
    distanceKm: null,
    runSeconds: null,
    sets: [],
    ...overrides,
  };
}

// Three imported sessions in each of the two weeks before this one, one this week.
const importedHistory = [
  workout("2026-11-09T23:00:00Z"),
  workout("2026-11-11T23:00:00Z"),
  workout("2026-11-13T23:00:00Z"),
  workout("2026-11-16T23:00:00Z"),
  workout("2026-11-18T23:00:00Z"),
  workout("2026-11-20T23:00:00Z"),
  workout("2026-11-23T23:00:00Z"),
];

describe("streakInput (D34: imported history counts)", () => {
  it("counts imported workouts toward the active streak", () => {
    const input = streakInput(importedHistory, 3);
    expect(activeWeekStreak(input, NOW)).toBe(3);
  });

  it("judges an imported week against the fallback plan days", () => {
    // This week has 1 of 3, so it is not yet a goal week; the two before it are.
    expect(goalMetStreak(streakInput(importedHistory, 3), NOW)).toBe(2);
    expect(goalMetStreak(streakInput(importedHistory, 4), NOW)).toBe(0);
  });

  it("keeps a live workout's own plan days", () => {
    const live = workout("2026-11-20T23:30:00Z", {
      imported: false,
      planDays: 2,
    });
    const input = streakInput([...importedHistory.slice(0, 5), live], 5);
    // The newest workout of the week (live, 2 plan days) sets that week's goal.
    expect(input.at(-1)).toEqual({ startedAt: live.startedAt, planDays: 2 });
    // The week of 16 November has 3 sessions against the live one's goal of 2: met. The
    // week before is imported only, judged against the fallback of 5, which 3 sessions miss.
    expect(goalMetStreak(input, NOW)).toBe(1);
  });

  it("is broken by a week with no workout, imported or not", () => {
    const gap = importedHistory.filter(
      (item) => item.startedAt < new Date("2026-11-16T00:00:00Z"),
    );
    // Only the week of 9 November: the last two weeks are empty.
    expect(activeWeekStreak(streakInput(gap, 3), NOW)).toBe(0);
  });

  it("returns only start and plan days", () => {
    expect(streakInput([importedHistory[0]], 3)).toEqual([
      { startedAt: importedHistory[0].startedAt, planDays: 3 },
    ]);
  });
});
