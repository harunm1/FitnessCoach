import { describe, expect, it } from "vitest";
import { chartPoints, niceScale, tickDates } from "./chart";

// Live bug L6, 25 Nov 2026: the exercise chart was a tiny unlabelled line. These are the
// numbers behind the new one: a point per workout (top weight and estimated 1RM, oldest
// first) and an axis with round tick values in the user's unit.
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 17));
const sets = (...rows: [number, number | null][]) =>
  rows.map(([reps, weightKg], i) => ({
    setNumber: i + 1,
    reps,
    weightKg,
    rpe: null,
  }));

describe("chartPoints", () => {
  const newestFirst = [
    { workoutId: 3, startedAt: day(20), sets: sets([5, 100], [8, 80]) },
    { workoutId: 2, startedAt: day(13), sets: sets([10, 90]) },
    { workoutId: 1, startedAt: day(6), sets: sets([12, null]) },
  ];

  it("lists the workouts oldest first", () => {
    expect(chartPoints(newestFirst).map((p) => p.workoutId)).toEqual([1, 2, 3]);
  });

  it("takes the top weight of each workout, and null for a bodyweight one", () => {
    expect(chartPoints(newestFirst).map((p) => p.topKg)).toEqual([
      null,
      90,
      100,
    ]);
  });

  it("estimates the one-rep max with Epley, from the best set", () => {
    // 5 x 100 kg: 100 x (1 + 5/30) = 116.67; 8 x 80 kg: 80 x (1 + 8/30) = 101.33.
    expect(chartPoints(newestFirst)[2].e1rmKg).toBeCloseTo(116.67, 2);
    expect(chartPoints(newestFirst)[1].e1rmKg).toBeCloseTo(120, 2);
  });

  it("leaves out sets over 10 reps, which say little about a maximum", () => {
    const [point] = chartPoints([
      { workoutId: 9, startedAt: day(1), sets: sets([15, 50]) },
    ]);
    expect(point.topKg).toBe(50);
    expect(point.e1rmKg).toBeNull();
  });
});

describe("niceScale", () => {
  it("rounds the axis out to tick values a person would write", () => {
    const scale = niceScale([52.5, 100]);
    expect(scale.ticks[0]).toBeLessThanOrEqual(52.5);
    expect(scale.ticks.at(-1)).toBeGreaterThanOrEqual(100);
    scale.ticks.forEach((tick) => expect(tick % 5).toBe(0));
  });

  it("maps the lowest tick to the bottom and the highest to the top", () => {
    const scale = niceScale([60, 100]);
    expect(scale.toY(scale.ticks[0], 200)).toBe(200);
    expect(scale.toY(scale.ticks.at(-1) as number, 200)).toBe(0);
  });

  it("gives a flat series a readable axis instead of dividing by zero", () => {
    const scale = niceScale([80, 80]);
    expect(scale.ticks.length).toBeGreaterThan(1);
    expect(scale.toY(80, 200)).toBeGreaterThan(0);
    expect(scale.toY(80, 200)).toBeLessThan(200);
  });
});

describe("tickDates", () => {
  it("labels the first and last workout, and a few between, never more than five", () => {
    const picked = tickDates(30);
    expect(picked[0]).toBe(0);
    expect(picked.at(-1)).toBe(29);
    expect(picked.length).toBeLessThanOrEqual(5);
  });

  it("labels a single workout once", () => {
    expect(tickDates(1)).toEqual([0]);
  });
});
