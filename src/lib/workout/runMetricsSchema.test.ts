import { describe, expect, it } from "vitest";
import { runMetricsSchema } from "./runMetricsSchema";

const validRun = {
  distanceKm: "5.25",
  durationMinutes: "28",
  durationSeconds: "45",
};

describe("runMetricsSchema", () => {
  it("parses running form values", () => {
    expect(runMetricsSchema.parse(validRun)).toEqual({
      distanceKm: 5.25,
      durationMinutes: 28,
      durationSeconds: 45,
    });
  });

  it("accepts a run duration recorded entirely in seconds", () => {
    expect(
      runMetricsSchema.safeParse({
        distanceKm: "0.01",
        durationMinutes: "0",
        durationSeconds: "1",
      }).success,
    ).toBe(true);
  });

  it("rejects zero distance and a zero duration", () => {
    expect(
      runMetricsSchema.safeParse({
        ...validRun,
        distanceKm: "0",
      }).success,
    ).toBe(false);
    expect(
      runMetricsSchema.safeParse({
        ...validRun,
        durationMinutes: "0",
        durationSeconds: "0",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid distance precision and seconds values", () => {
    expect(
      runMetricsSchema.safeParse({ ...validRun, distanceKm: "5.123" }).success,
    ).toBe(false);
    expect(
      runMetricsSchema.safeParse({ ...validRun, durationSeconds: "60" })
        .success,
    ).toBe(false);
  });
});
