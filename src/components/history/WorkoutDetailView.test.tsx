import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WorkoutDetail } from "@/lib/history/types";
import { WorkoutDetailView } from "./WorkoutDetailView";

// Live bug L5, 25 Nov 2026: the workout page was a plain list. It now has a header with
// date, duration, volume and records, and a table of sets per exercise, like the end-of-
// workout summaries in docs/COMPETITORS.md (JEFIT: duration, volume, records; Hevy: sets
// per exercise with weight and reps).
const workout: WorkoutDetail = {
  id: 41,
  name: "Full Body B",
  startedAt: new Date("2026-10-07T17:00:00Z"),
  minutes: 91,
  imported: true,
  notes: null,
  run: null,
  volumeKg: 1100,
  recordExerciseIds: ["bench"],
  exercises: [
    {
      id: "bench",
      name: "Bench Press",
      sets: [
        { setNumber: 1, reps: 10, weightKg: 60, rpe: null },
        { setNumber: 2, reps: 8, weightKg: 62.5, rpe: 9 },
      ],
    },
    {
      id: "pushups",
      name: "Push-up",
      sets: [{ setNumber: 1, reps: 12, weightKg: null, rpe: null }],
    },
  ],
};

const html = (units?: Parameters<typeof WorkoutDetailView>[0]["units"]) =>
  renderToStaticMarkup(<WorkoutDetailView workout={workout} units={units} />);

describe("WorkoutDetailView header", () => {
  it("shows the date, the duration, the total volume and the records", () => {
    const out = html();
    expect(out).toContain("Wednesday, October 7, 2026");
    expect(out).toContain("91 min");
    expect(out).toMatch(/Volume<\/dt><dd[^>]*>1,100 kg/);
    expect(out).toMatch(/Records<\/dt><dd[^>]*>1</);
  });

  it("shows the volume in the user's unit", () => {
    expect(html({ weightUnit: "LB", distanceUnit: "MI" })).toMatch(
      /Volume<\/dt><dd[^>]*>2,425\.?\d* lb/,
    );
  });
});

describe("WorkoutDetailView exercise cards", () => {
  it("lists each exercise's sets as a table with set, weight and reps", () => {
    const out = html();
    expect(out.match(/<table/g)).toHaveLength(2);
    expect(out).toContain('scope="col">Set</th>');
    expect(out).toContain('scope="col">Weight (kg)</th>');
    expect(out).toContain('scope="col">Reps</th>');
    expect(out).toMatch(/<td[^>]*>1<\/td><td[^>]*>60<\/td><td[^>]*>10<\/td>/);
  });

  it("shows weights in pounds when the user chose pounds", () => {
    expect(html({ weightUnit: "LB", distanceUnit: "MI" })).toContain(
      "Weight (lb)",
    );
  });

  it("shows a dash for a bodyweight set, and RPE only when a set has one", () => {
    const out = html();
    expect(out).toMatch(/<td[^>]*>—<\/td>/);
    expect(out).toContain("RPE");
  });

  it("links each exercise to its history and marks the record", () => {
    const out = html();
    expect(out).toContain('href="/history/exercise/bench"');
    expect(out).toContain("Record");
  });
});
