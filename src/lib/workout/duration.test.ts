import { describe, expect, it } from "vitest";
import {
  MAX_WORKOUT_SECONDS,
  minutesLabel,
  workoutMinutes,
  workoutSeconds,
} from "./duration";

const start = new Date("2026-11-24T10:00:00Z");
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);

describe("workoutSeconds (B1: start to finish only)", () => {
  it("is the time from start to finish", () => {
    expect(
      workoutSeconds({
        startedAt: start,
        finishedAt: at(45 * 60),
        durationSeconds: null,
      }),
    ).toBe(45 * 60);
  });

  it("is null for an unfinished workout, never timed to now", () => {
    expect(
      workoutSeconds({
        startedAt: start,
        finishedAt: null,
        durationSeconds: null,
      }),
    ).toBeNull();
  });

  it("is null when the workout was left open for longer than the cap", () => {
    expect(
      workoutSeconds({
        startedAt: start,
        finishedAt: at(MAX_WORKOUT_SECONDS + 1),
        durationSeconds: null,
      }),
    ).toBeNull();
    expect(
      workoutSeconds({
        startedAt: start,
        finishedAt: at(18 * 3600 + 40 * 60),
        durationSeconds: null,
      }),
    ).toBeNull();
  });

  it("keeps a workout exactly at the cap", () => {
    expect(
      workoutSeconds({
        startedAt: start,
        finishedAt: at(MAX_WORKOUT_SECONDS),
        durationSeconds: null,
      }),
    ).toBe(MAX_WORKOUT_SECONDS);
  });

  it("uses the recorded run duration instead of the gap", () => {
    expect(
      workoutSeconds({
        startedAt: start,
        finishedAt: at(20 * 3600),
        durationSeconds: 2400,
      }),
    ).toBe(2400);
  });

  it("is null when finish is before start", () => {
    expect(
      workoutSeconds({
        startedAt: start,
        finishedAt: at(-60),
        durationSeconds: null,
      }),
    ).toBeNull();
  });
});

describe("minutesLabel and workoutMinutes", () => {
  it("labels a timed and an untimed workout", () => {
    expect(minutesLabel(45)).toBe("45 min");
    expect(minutesLabel(null)).toBe("Not timed");
  });

  it("rounds to whole minutes, at least 1, null when not timed", () => {
    const t = { startedAt: start, durationSeconds: null };
    expect(workoutMinutes({ ...t, finishedAt: at(50 * 60 + 20) })).toBe(50);
    expect(workoutMinutes({ ...t, finishedAt: start })).toBe(1);
    expect(workoutMinutes({ ...t, finishedAt: null })).toBeNull();
  });
});
