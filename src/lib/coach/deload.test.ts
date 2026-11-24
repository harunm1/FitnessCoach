// Tests for the fatigue deload rule (#93, D21): a lighter week is proposed only when two signals agree.
import { describe, expect, it } from "vitest";
import { proposeDeload, type SessionLog } from "./deload";

// A session where every set of "squat" was done at the given RPE and reps; the plan said 10 reps.
function session(
  rpe: number | null,
  reps: number,
  exerciseId = "squat",
): SessionLog {
  return {
    sets: [
      { exerciseId, reps, rpe },
      { exerciseId, reps, rpe },
    ],
    plannedReps: { [exerciseId]: 10 },
  };
}

describe("proposeDeload", () => {
  it("proposes a deload when both signals agree in the two latest sessions", () => {
    const result = proposeDeload([session(9, 8), session(9, 7)]);
    expect(result.propose).toBe(true);
    expect(result.signals).toEqual(["high-effort", "missed-reps"]);
    expect(result.missedExerciseIds).toEqual(["squat"]);
    expect(result.message).toMatch(/lighter week/i);
  });

  it("does not propose when only effort is high", () => {
    const result = proposeDeload([session(9, 10), session(10, 10)]);
    expect(result.propose).toBe(false);
    expect(result.signals).toEqual(["high-effort"]);
  });

  it("does not propose when only reps are missed", () => {
    const result = proposeDeload([session(7, 8), session(7, 8)]);
    expect(result.propose).toBe(false);
    expect(result.signals).toEqual(["missed-reps"]);
  });

  it("needs both of the two latest sessions for each signal", () => {
    const result = proposeDeload([session(9, 8), session(7, 10)]);
    expect(result.propose).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it("needs the same lift to miss reps in both sessions", () => {
    const result = proposeDeload([
      session(9, 8, "squat"),
      session(9, 8, "bench"),
    ]);
    expect(result.signals).toEqual(["high-effort"]);
    expect(result.propose).toBe(false);
  });

  it("gives no proposal with fewer than two sessions", () => {
    expect(proposeDeload([session(10, 5)]).propose).toBe(false);
    expect(proposeDeload([]).propose).toBe(false);
  });

  it("ignores sessions older than the two latest", () => {
    const result = proposeDeload([
      session(7, 10),
      session(7, 10),
      session(10, 5),
      session(10, 5),
    ]);
    expect(result.propose).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it("gives no effort signal when no RPE was logged", () => {
    const result = proposeDeload([session(null, 8), session(null, 8)]);
    expect(result.signals).toEqual(["missed-reps"]);
    expect(result.propose).toBe(false);
  });

  it("ignores a lift with no planned reps", () => {
    const noPlan = (rpe: number): SessionLog => ({
      sets: [{ exerciseId: "squat", reps: 3, rpe }],
      plannedReps: {},
    });
    const result = proposeDeload([noPlan(9), noPlan(9)]);
    expect(result.signals).toEqual(["high-effort"]);
    expect(result.propose).toBe(false);
  });
  it("returns empty details when no deload is proposed", () => {
    const result = proposeDeload([session(9, 10), session(9, 10)]);
    expect(result.missedExerciseIds).toEqual([]);
    expect(result.message).toBe("");
  });

  it("lists only the lift missed in both sessions when several are logged", () => {
    const both = (squatReps: number, benchReps: number): SessionLog => ({
      sets: [
        { exerciseId: "squat", reps: squatReps, rpe: 9 },
        { exerciseId: "bench", reps: benchReps, rpe: 9 },
      ],
      plannedReps: { squat: 10, bench: 10 },
    });
    const result = proposeDeload([both(8, 10), both(8, 8)]);
    expect(result.propose).toBe(true);
    expect(result.missedExerciseIds).toEqual(["squat"]);
  });

  it("averages only the sets that carry an RPE", () => {
    const mixed: SessionLog = {
      sets: [
        { exerciseId: "squat", reps: 8, rpe: 9 },
        { exerciseId: "squat", reps: 8, rpe: null },
      ],
      plannedReps: { squat: 10 },
    };
    expect(proposeDeload([mixed, mixed]).propose).toBe(true);
  });

  it("gives no effort signal for a session with no sets", () => {
    const empty: SessionLog = { sets: [], plannedReps: {} };
    expect(proposeDeload([empty, empty]).signals).toEqual([]);
  });
});
