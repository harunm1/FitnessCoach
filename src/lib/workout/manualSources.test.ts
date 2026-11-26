// Tests for which Workout.source values mean "logged by hand after the fact" (D49, #194).
import { describe, expect, it } from "vitest";
import {
  isManualSource,
  MANUAL_STRENGTH_SOURCE,
  MANUAL_STRENGTH_STORED_HOUR_UTC,
} from "./manualSources";

describe("isManualSource", () => {
  it("is true for a run or a strength workout logged by hand", () => {
    expect(isManualSource("manual-run")).toBe(true);
    expect(isManualSource(MANUAL_STRENGTH_SOURCE)).toBe(true);
  });

  it("is false for a live or imported workout", () => {
    expect(isManualSource("live")).toBe(false);
    expect(isManualSource("hevy-import")).toBe(false);
  });

  it("stores a day-only workout at the same hour as a run logged by hand", () => {
    expect(MANUAL_STRENGTH_STORED_HOUR_UTC).toBe("T17:00:00Z");
  });
});
