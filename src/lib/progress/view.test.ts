import { describe, expect, it } from "vitest";
import type { ProgressSet, ProgressWorkout } from "./types";
import {
  clock,
  durationMinutes,
  fillPlanGoals,
  groupByDay,
  groupByExercise,
  inMonth,
  monthGrid,
  pace,
  parseDay,
  parseMonth,
  shiftMonth,
} from "./view";

function workout(
  startedAt: string,
  minutes = 50,
  planDays = 3,
): ProgressWorkout {
  const start = new Date(startedAt);
  return {
    id: 1,
    startedAt: start,
    finishedAt: new Date(start.getTime() + minutes * 60000),
    dayName: "Push",
    planDays,
    distanceKm: null,
    runSeconds: null,
    sets: [],
  };
}

function set(exerciseName: string, setNumber: number): ProgressSet {
  return {
    exerciseName,
    category: "strength",
    primaryMuscles: ["chest"],
    secondaryMuscles: [],
    setNumber,
    reps: 10,
    weightKg: 20,
  };
}

describe("parseMonth and parseDay", () => {
  it("accepts valid values and falls back otherwise", () => {
    expect(parseMonth("2026-10", "2026-11")).toBe("2026-10");
    expect(parseMonth("2026-13", "2026-11")).toBe("2026-11");
    expect(parseMonth(undefined, "2026-11")).toBe("2026-11");
    expect(parseDay("2026-11-08")).toBe("2026-11-08");
    expect(parseDay("2026-11-32")).toBeUndefined();
  });
});

describe("shiftMonth", () => {
  it("moves across a year boundary", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("monthGrid", () => {
  it("starts on Monday and pads with null", () => {
    // 1 November 2026 is a Sunday.
    const weeks = monthGrid("2026-11");
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      "2026-11-01",
    ]);
    expect(weeks.at(-1)?.at(-1)).toBeNull();
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it("handles a leap-year February", () => {
    expect(monthGrid("2028-02").flat().filter(Boolean)).toHaveLength(29);
  });
});

describe("groupByDay", () => {
  it("groups by the Toronto calendar day", () => {
    // 10:30 p.m. on 8 November in Toronto, already 9 November in UTC.
    const late = workout("2026-11-09T03:30:00Z");
    const days = groupByDay([late]);
    expect([...days.keys()]).toEqual(["2026-11-08"]);
  });
});

describe("durations and pace", () => {
  it("rounds a workout to whole minutes", () => {
    expect(durationMinutes(workout("2026-11-08T17:00:00Z", 47))).toBe(47);
  });

  it("formats a clock and a pace", () => {
    expect(clock(1925)).toBe("32:05");
    expect(pace(5, 1920)).toBe("6:24 /km");
    expect(pace(null, 1920)).toBeNull();
  });
});

describe("groupByExercise", () => {
  it("keeps exercise order and sorts each exercise's sets", () => {
    const groups = groupByExercise([
      set("Bench Press", 2),
      set("Row", 1),
      set("Bench Press", 1),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Bench Press", "Row"]);
    expect(groups[0]?.sets.map((s) => s.setNumber)).toEqual([1, 2]);
  });
});

describe("fillPlanGoals", () => {
  it("gives a workout without a plan the goal of the last one with a plan", () => {
    const filled = fillPlanGoals([
      workout("2026-11-02T17:00:00Z", 50, 4),
      workout("2026-11-04T17:00:00Z", 50, 0),
      workout("2026-11-09T17:00:00Z", 50, 3),
      workout("2026-11-10T17:00:00Z", 50, 0),
    ]);
    expect(filled.map((w) => w.planDays)).toEqual([4, 4, 3, 3]);
  });

  it("leaves the goal at zero before any plan exists", () => {
    const filled = fillPlanGoals([
      workout("2026-11-02T17:00:00Z", 50, 0),
      workout("2026-11-03T17:00:00Z", 50, 2),
    ]);
    expect(filled.map((w) => w.planDays)).toEqual([0, 2]);
  });

  it("does not change the workouts it was given", () => {
    const original = [
      workout("2026-11-02T17:00:00Z", 50, 3),
      workout("2026-11-03T17:00:00Z", 50, 0),
    ];
    fillPlanGoals(original);
    expect(original[1].planDays).toBe(0);
  });
});

describe("inMonth", () => {
  it("keeps the month's workouts by Toronto date", () => {
    const workouts = [
      // 8 p.m. on 31 October in Toronto, already 1 November in UTC.
      workout("2026-11-01T00:00:00Z"),
      workout("2026-11-15T17:00:00Z"),
      workout("2026-12-01T17:00:00Z"),
    ];
    expect(
      inMonth(workouts, "2026-11").map((w) => w.startedAt.toISOString()),
    ).toEqual(["2026-11-15T17:00:00.000Z"]);
    expect(inMonth(workouts, "2026-10")).toHaveLength(1);
  });
});
