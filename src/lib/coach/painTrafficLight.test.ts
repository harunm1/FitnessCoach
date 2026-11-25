import { describe, expect, it } from "vitest";
import { PAIN_TRAFFIC_THRESHOLDS, painTrafficLight } from "./painTrafficLight";

describe("painTrafficLight", () => {
  it("returns repeat at and below the repeat threshold", () => {
    expect(painTrafficLight(0, 0).state).toBe("repeat");
    expect(painTrafficLight(PAIN_TRAFFIC_THRESHOLDS.repeatMax, 0).state).toBe(
      "repeat",
    );
  });

  it("returns hold at and across the hold boundaries", () => {
    expect(painTrafficLight(3, 0).state).toBe("hold");
    expect(painTrafficLight(5, 5).state).toBe("hold");
  });

  it("returns stop at 6 and 10", () => {
    expect(painTrafficLight(6, 0).state).toBe("stop");
    expect(painTrafficLight(10, 10).state).toBe("stop");
  });

  it("uses the worst score across during-session and next-morning pain", () => {
    expect(painTrafficLight(2, 6).state).toBe("stop");
    expect(painTrafficLight(5, 2).state).toBe("hold");
  });

  it("rejects out-of-range and fractional scores", () => {
    expect(() => painTrafficLight(-1, 0)).toThrow(RangeError);
    expect(() => painTrafficLight(11, 0)).toThrow(RangeError);
    expect(() => painTrafficLight(2.5, 0)).toThrow(RangeError);
  });

  it("provides a one-line reason for every state", () => {
    for (const result of [
      painTrafficLight(2, 0),
      painTrafficLight(4, 0),
      painTrafficLight(6, 0),
    ]) {
      expect(result.reason.length).toBeGreaterThan(20);
    }
  });
});
