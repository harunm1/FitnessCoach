import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chartPoints } from "@/lib/history/chart";
import { ExerciseChart } from "./ExerciseChart";

// Live bug L6, 25 Nov 2026: "too small and hard to read in light and dark". The chart now
// has axis labels with units, a tooltip per point, lines for the best set and the best
// estimated 1RM, and a 240 px floor on a phone.
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 17));
const set = (reps: number, weightKg: number) => ({
  setNumber: 1,
  reps,
  weightKg,
  rpe: null,
});
const points = chartPoints([
  { workoutId: 3, startedAt: day(20), sets: [set(5, 100)] },
  { workoutId: 2, startedAt: day(13), sets: [set(10, 90)] },
  { workoutId: 1, startedAt: day(6), sets: [set(8, 80)] },
]);
const html = (unit: "KG" | "LB" = "KG") =>
  renderToStaticMarkup(<ExerciseChart points={points} weightUnit={unit} />);

describe("ExerciseChart", () => {
  it("is an image with a text description for screen readers", () => {
    const out = html();
    expect(out).toContain('role="img"');
    expect(out).toMatch(/aria-label="[^"]*3 workouts[^"]*80 to 100 kg/);
  });

  it("is at least 240 px tall on a phone", () => {
    expect(html()).toContain("min-h-60");
  });

  it("labels the vertical axis with the unit and round values", () => {
    const out = html();
    expect(out).toContain("Weight (kg)");
    expect(out).toMatch(/<text[^>]*>80<\/text>/);
    expect(out).toMatch(/<text[^>]*>100<\/text>/);
  });

  it("labels the horizontal axis with dates", () => {
    const out = html();
    expect(out).toContain(">Nov 6<");
    expect(out).toContain(">Nov 20<");
  });

  it("draws a line for the top weight and one for the estimated 1RM", () => {
    expect(html().match(/<polyline/g)).toHaveLength(2);
    const out = html();
    expect(out).toContain("Top weight");
    expect(out).toContain("Estimated 1RM");
  });

  it("marks the best set and the best estimated 1RM", () => {
    const out = html();
    expect(out).toContain("Best set 100 kg");
    // 5 x 100 = 116.67, 10 x 90 = 120: the best estimate is 120 kg.
    expect(out).toContain("Best est. 1RM 120 kg");
  });

  it("gives every workout a tooltip with its date, top weight and estimate", () => {
    const out = html();
    expect(out.match(/<title>/g)).toHaveLength(3);
    expect(out).toContain("Nov 13: top set 90 kg, estimated 1RM 120 kg");
  });

  it("switches every number to pounds for a user who chose pounds", () => {
    const out = html("LB");
    expect(out).toContain("Weight (lb)");
    expect(out).toContain("Best set 220.5 lb");
    expect(out).not.toContain(" kg");
  });

  it("uses the theme's colours, not fixed ones, so both themes keep their contrast", () => {
    const out = html();
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(out).toContain("currentColor");
  });

  it("draws nothing for fewer than two workouts", () => {
    expect(
      renderToStaticMarkup(
        <ExerciseChart points={points.slice(0, 1)} weightUnit="KG" />,
      ),
    ).toBe("");
  });
});
