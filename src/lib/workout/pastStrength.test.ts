// Tests for the past strength workout entry check (D49, #194): the day, the exercises and
// their sets, in the unit the user typed.
import { describe, expect, it } from "vitest";
import { parsePastStrength } from "./pastStrength";

const TODAY = "2026-11-26";
const entry = (changes: Record<string, unknown> = {}) => ({
  date: "2026-11-24",
  minutes: "",
  note: "",
  exercises: [
    {
      exerciseId: "bench-press",
      sets: [
        { reps: "8", weight: "60" },
        { reps: "6", weight: "62.5" },
      ],
    },
  ],
  ...changes,
});

describe("parsePastStrength", () => {
  it("accepts a day in the past with sets and reads the weights in kilograms", () => {
    const parsed = parsePastStrength(entry(), TODAY, "KG");
    expect(parsed).toEqual({
      ok: true,
      value: {
        date: "2026-11-24",
        minutes: null,
        note: null,
        exercises: [
          {
            exerciseId: "bench-press",
            sets: [
              { reps: 8, weightKg: 60 },
              { reps: 6, weightKg: 62.5 },
            ],
          },
        ],
      },
    });
  });

  it("accepts today and a bodyweight set without a weight", () => {
    const parsed = parsePastStrength(
      entry({
        date: TODAY,
        exercises: [
          { exerciseId: "push-up", sets: [{ reps: "15", weight: "" }] },
        ],
      }),
      TODAY,
      "KG",
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok)
      expect(parsed.value.exercises[0].sets[0]).toEqual({
        reps: 15,
        weightKg: undefined,
      });
  });

  it("converts pounds to kilograms", () => {
    const parsed = parsePastStrength(
      entry({
        exercises: [
          { exerciseId: "squat", sets: [{ reps: "5", weight: "225" }] },
        ],
      }),
      TODAY,
      "LB",
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok)
      expect(parsed.value.exercises[0].sets[0].weightKg).toBeCloseTo(102.06, 1);
  });

  it("refuses a day that has not happened yet", () => {
    expect(
      parsePastStrength(entry({ date: "2026-11-27" }), TODAY, "KG"),
    ).toEqual({
      ok: false,
      message: "That day hasn't happened yet.",
    });
  });

  it("refuses a missing, malformed or impossible day", () => {
    for (const date of [
      undefined,
      "",
      "24/11/2026",
      "2026-02-30",
      "1999-12-31",
    ]) {
      const parsed = parsePastStrength(entry({ date }), TODAY, "KG");
      expect(parsed.ok).toBe(false);
    }
  });

  it("refuses an entry with no exercise or an exercise with no set", () => {
    expect(parsePastStrength(entry({ exercises: [] }), TODAY, "KG").ok).toBe(
      false,
    );
    expect(
      parsePastStrength(
        entry({ exercises: [{ exerciseId: "squat", sets: [] }] }),
        TODAY,
        "KG",
      ).ok,
    ).toBe(false);
  });

  it("refuses the same exercise listed twice", () => {
    const sets = [{ reps: "5", weight: "100" }];
    const parsed = parsePastStrength(
      entry({
        exercises: [
          { exerciseId: "squat", sets },
          { exerciseId: "squat", sets },
        ],
      }),
      TODAY,
      "KG",
    );
    expect(parsed).toEqual({
      ok: false,
      message: "List each exercise once and add its sets under it.",
    });
  });

  it("refuses reps outside 1 to 30 and a weight that is not a load", () => {
    const badReps = parsePastStrength(
      entry({
        exercises: [
          { exerciseId: "squat", sets: [{ reps: "0", weight: "50" }] },
        ],
      }),
      TODAY,
      "KG",
    );
    expect(badReps).toEqual({
      ok: false,
      message: "Reps are a whole number from 1 to 30.",
    });
    const badWeight = parsePastStrength(
      entry({
        exercises: [
          { exerciseId: "squat", sets: [{ reps: "5", weight: "0.02" }] },
        ],
      }),
      TODAY,
      "KG",
    );
    expect(badWeight.ok).toBe(false);
  });

  it("refuses more than 15 exercises and more than 10 sets of one", () => {
    const many = Array.from({ length: 16 }, (_, index) => ({
      exerciseId: `exercise-${index}`,
      sets: [{ reps: "5", weight: "20" }],
    }));
    expect(parsePastStrength(entry({ exercises: many }), TODAY, "KG").ok).toBe(
      false,
    );
    const sets = Array.from({ length: 11 }, () => ({
      reps: "5",
      weight: "20",
    }));
    expect(
      parsePastStrength(
        entry({ exercises: [{ exerciseId: "squat", sets }] }),
        TODAY,
        "KG",
      ).ok,
    ).toBe(false);
  });

  it("reads the optional minutes and note, and refuses out-of-range minutes", () => {
    const parsed = parsePastStrength(
      entry({ minutes: "50", note: "  Felt strong  " }),
      TODAY,
      "KG",
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.minutes).toBe(50);
      expect(parsed.value.note).toBe("Felt strong");
    }
    for (const minutes of ["0", "361", "abc", "-5", "1.5"]) {
      expect(parsePastStrength(entry({ minutes }), TODAY, "KG").ok).toBe(false);
    }
  });

  it("refuses a note over 300 characters", () => {
    expect(
      parsePastStrength(entry({ note: "x".repeat(301) }), TODAY, "KG").ok,
    ).toBe(false);
  });

  it("refuses something that is not an entry at all", () => {
    for (const raw of [null, undefined, "text", 5, []]) {
      expect(parsePastStrength(raw, TODAY, "KG").ok).toBe(false);
    }
  });
});
