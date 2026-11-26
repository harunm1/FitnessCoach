// Weekday names for a plan day (D38): shown on the plan and in the program folders.
import { describe, expect, it } from "vitest";
import { weekdayLabel } from "./weekdays";

describe("weekdayLabel", () => {
  it("names the day's weekdays in order", () => {
    expect(weekdayLabel(["TUE"])).toBe("Tuesday");
    expect(weekdayLabel(["MON", "THU"])).toBe("Monday, Thursday");
  });

  it("is empty for a plan built before weekdays", () => {
    expect(weekdayLabel([])).toBe("");
  });
});
