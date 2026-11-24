// Tests for reading a Hevy workout CSV into workouts and sets (#131).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHevyCsv } from "./hevy";

const fixture = readFileSync("tests/fixtures/hevy-export.csv", "utf8");

const HEADER =
  "title,start_time,end_time,exercise_title,set_type,weight_lbs,reps,rpe";

describe("parseHevyCsv", () => {
  it("groups rows into workouts, skips warm-ups and numbers the sets", () => {
    const result = parseHevyCsv(fixture);
    if (!result.ok) throw new Error(result.error);
    expect(result.workouts).toHaveLength(2);
    const push = result.workouts[0];
    expect(push.title).toBe("Push Day");
    expect(push.startedAt.toISOString()).toBe("2024-06-20T22:30:00.000Z");
    expect(push.finishedAt.toISOString()).toBe("2024-06-20T23:20:00.000Z");
    expect(push.key).toBe("2024-06-20T22:30:00.000Z|Push Day");
    expect(
      push.sets.map((s) => [s.exerciseTitle, s.setNumber, s.reps]),
    ).toEqual([
      ["Bench Press (Barbell)", 1, 8],
      ["Bench Press (Barbell)", 2, 7],
      ["Face Pull (Cable)", 1, 15],
      ["Zercher Carry", 1, 12],
    ]);
    expect(push.sets[0]).toMatchObject({ weightKg: 80, rpe: 8 });
    expect(push.sets[2].rpe).toBeNull();
    expect(result.skippedWarmups).toBe(1);
  });

  it("keeps a bodyweight set with no weight", () => {
    const result = parseHevyCsv(fixture);
    if (!result.ok) throw new Error(result.error);
    expect(result.workouts[1].sets[0]).toMatchObject({
      exerciseTitle: "Pull Up",
      weightKg: null,
      reps: 10,
    });
  });

  it("converts pounds to kilograms with two decimals", () => {
    const csv = `${HEADER}\nA,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",Squat,normal,225,5,\n`;
    const result = parseHevyCsv(csv);
    if (!result.ok) throw new Error(result.error);
    expect(result.workouts[0].sets[0].weightKg).toBe(102.06);
  });

  it("drops an RPE that is not a whole number from 1 to 10", () => {
    const csv = `${HEADER}\nA,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",Squat,normal,100,5,8.5\nA,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",Squat,normal,100,5,11\n`;
    const result = parseHevyCsv(csv);
    if (!result.ok) throw new Error(result.error);
    expect(result.workouts[0].sets.map((s) => s.rpe)).toEqual([null, null]);
  });

  it("refuses a file that is not a Hevy export and names the missing columns", () => {
    const result = parseHevyCsv(
      "Date,Exercise Name,Weight,Reps\n2024-01-01,Squat,100,5\n",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/title/);
      expect(result.error).toMatch(/start_time/);
    }
  });

  it("refuses a file with no weight column", () => {
    const result = parseHevyCsv(
      "title,start_time,exercise_title,reps\nA,x,Squat,5\n",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/weight_kg/);
  });

  it("refuses the whole file when a date cannot be read, naming the row", () => {
    const csv = `${HEADER}\nA,03/04/2024 10:00,"20 Jun 2024, 19:00",Squat,normal,100,5,\n`;
    const result = parseHevyCsv(csv);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/row 2/i);
  });

  it("refuses a negative or non-numeric weight and impossible reps", () => {
    const bad = (w: string, r: string) =>
      parseHevyCsv(
        `${HEADER}\nA,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",Squat,normal,${w},${r},\n`,
      );
    expect(bad("-5", "5").ok).toBe(false);
    expect(bad("abc", "5").ok).toBe(false);
    expect(bad("100", "5000").ok).toBe(false);
    expect(bad("100", "2.5").ok).toBe(false);
  });

  it("refuses hex and exponent weights, zero reps and very long names", () => {
    const bad = (w: string, r: string, name = "Squat") =>
      parseHevyCsv(
        `${HEADER}
A,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",${name},normal,${w},${r},
`,
      );
    expect(bad("0x10", "5").ok).toBe(false);
    expect(bad("1e3", "5").ok).toBe(false);
    expect(bad("100", "0").ok).toBe(false);
    expect(bad("100", "5", "x".repeat(201)).ok).toBe(false);
    expect(bad("102.5", "5").ok).toBe(true);
  });

  it("skips timed sets that have no reps", () => {
    const csv = `${HEADER}\nA,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",Plank,normal,,,\nA,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",Squat,normal,100,5,\n`;
    const result = parseHevyCsv(csv);
    if (!result.ok) throw new Error(result.error);
    expect(result.workouts[0].sets).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
  });

  it("refuses a file over the row cap", () => {
    const row =
      'A,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",Squat,normal,100,5,\n';
    const result = parseHevyCsv(HEADER + "\n" + row.repeat(20_001));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/20,000/);
  });

  it("refuses an empty file", () => {
    expect(parseHevyCsv("").ok).toBe(false);
    expect(parseHevyCsv(HEADER + "\n").ok).toBe(false);
  });
});

describe("parseHevyCsv hostile and damaged files", () => {
  it("refuses a header wider than any Hevy export, before reading any row", () => {
    const wide = `${"x,".repeat(100)}${HEADER}\n${"a\n".repeat(50)}`;
    const result = parseHevyCsv(wide);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/columns/i);
  });

  it("refuses a row shorter than the header and names the row", () => {
    const text = `${HEADER}\nPush,"20 Jun 2024, 6:30 pm","20 Jun 2024, 7:20 pm",Bench Press (Barbell),normal,100`;
    const result = parseHevyCsv(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Row 2/);
  });
});
