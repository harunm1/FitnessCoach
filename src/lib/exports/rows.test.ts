import { describe, expect, it } from "vitest";
import { toCsv, UTF8_BOM } from "./csv";
import { coachCsvRows, workoutCsvRows, type WorkoutSetRow } from "./rows";

const HUNDRED_KG = 100;
const HUNDRED_KG_IN_LB_TO_PLATE = 220.5;
const ODD_KG = 82.3;
const ODD_KG_TO_PLATE = 82.25;
const REPS = 5;
const RPE = 8;
const FIRST_DATA_ROW = 1;
const SECOND_DATA_ROW = 2;
const FIRST_SET = 1;
const SECOND_SET = 2;
// 22:30 on the 24th in Toronto is already the 25th in UTC.
const LATE_EVENING = new Date("2026-11-25T03:30:00Z");

function set(overrides: Partial<WorkoutSetRow> = {}): WorkoutSetRow {
  return {
    startedAt: LATE_EVENING,
    exerciseName: "Bench Press",
    setNumber: 1,
    weightKg: HUNDRED_KG,
    reps: REPS,
    rpe: RPE,
    notes: null,
    ...overrides,
  };
}

// A data row as an object keyed by the header, so a test names the column it checks.
function record(rows: unknown[][], index = FIRST_DATA_ROW) {
  const [header, ...data] = rows;
  return Object.fromEntries(
    header.map((name, column) => [name, data[index - FIRST_DATA_ROW][column]]),
  );
}

const body = (rows: unknown[][]) => toCsv(rows as never).slice(UTF8_BOM.length);

describe("workoutCsvRows", () => {
  it("starts with the header the page promises", () => {
    expect(workoutCsvRows([], "KG")[0]).toEqual([
      "date",
      "exercise",
      "set",
      "weight",
      "unit",
      "reps",
      "rpe",
      "notes",
    ]);
  });

  it("writes one row per set, the weight in the user's pounds", () => {
    expect(record(workoutCsvRows([set()], "LB"))).toEqual({
      date: "2026-11-24",
      exercise: "Bench Press",
      set: FIRST_SET,
      weight: HUNDRED_KG_IN_LB_TO_PLATE,
      unit: "lb",
      reps: REPS,
      rpe: RPE,
      notes: "",
    });
  });

  it("writes kilograms to the plate step when the user chose kilograms", () => {
    const row = record(workoutCsvRows([set({ weightKg: ODD_KG })], "KG"));
    expect(row).toMatchObject({ weight: ODD_KG_TO_PLATE, unit: "kg" });
  });

  it("leaves weight, unit and rpe empty for a set without them", () => {
    const row = record(
      workoutCsvRows([set({ weightKg: null, rpe: null })], "LB"),
    );
    expect(row).toMatchObject({ weight: "", unit: "", reps: REPS, rpe: "" });
  });

  it("dates a workout by its Toronto day, not its UTC day", () => {
    expect(record(workoutCsvRows([set()], "KG")).date).toBe("2026-11-24");
  });

  it("writes every set, in the order given", () => {
    const rows = workoutCsvRows(
      [set({ setNumber: FIRST_SET }), set({ setNumber: SECOND_SET })],
      "KG",
    );
    expect(record(rows, SECOND_DATA_ROW).set).toBe(SECOND_SET);
  });

  it("keeps a comma, a quote and a newline inside their cells", () => {
    const text = body(
      workoutCsvRows(
        [
          set({
            exerciseName: 'Row, "wide" grip',
            notes: "felt good,\nlast rep slow",
          }),
        ],
        "KG",
      ),
    );
    expect(text).toContain('"Row, ""wide"" grip"');
    expect(text).toContain('"felt good,\nlast rep slow"');
  });

  it("guards a note that a spreadsheet would run as a formula", () => {
    const text = body(workoutCsvRows([set({ notes: "=1+1" })], "KG"));
    expect(text).toContain('"\t=1+1"');
  });
});

describe("coachCsvRows", () => {
  it("has date, role and message, in that order", () => {
    expect(coachCsvRows([])[0]).toEqual(["date", "role", "message"]);
  });

  it("names the roles user and coach and dates in ISO 8601 UTC", () => {
    const rows = coachCsvRows([
      { createdAt: LATE_EVENING, role: "USER", content: "How heavy?" },
      { createdAt: LATE_EVENING, role: "ASSISTANT", content: "Add 5 lb." },
    ]);
    expect(record(rows)).toEqual({
      date: "2026-11-25T03:30:00.000Z",
      role: "user",
      message: "How heavy?",
    });
    expect(record(rows, SECOND_DATA_ROW).role).toBe("coach");
  });

  it("keeps a multi-line message with quotes in one record", () => {
    const text = body(
      coachCsvRows([
        {
          createdAt: LATE_EVENING,
          role: "ASSISTANT",
          content: 'Try:\n- "slow" reps, 3 sets',
        },
      ]),
    );
    expect(text).toContain('"Try:\n- ""slow"" reps, 3 sets"');
  });

  it("guards a message that starts like a formula", () => {
    const text = body(
      coachCsvRows([
        { createdAt: LATE_EVENING, role: "USER", content: "@everyone" },
      ]),
    );
    expect(text).toContain('"\t@everyone"');
  });
});
