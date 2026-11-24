// Tests for formatting a stored instant as local time (#141, #144).
import { describe, expect, it } from "vitest";
import { formatLocal } from "./localTime";

const instant = new Date("2026-11-29T22:48:02Z");

describe("formatLocal", () => {
  it("formats a date and time in the given zone, not as a GMT string", () => {
    const text = formatLocal(instant, "datetime", "America/Toronto");
    expect(text).toBe("Sunday, November 29, 2026 at 5:48 PM");
    expect(text).not.toMatch(/GMT/);
  });

  it("formats a clock time in the given zone", () => {
    expect(
      formatLocal(new Date("2026-11-22T22:55:00Z"), "time", "America/Toronto"),
    ).toBe("5:55 PM");
    expect(formatLocal(new Date("2026-11-22T22:55:00Z"), "time", "UTC")).toBe(
      "10:55 PM",
    );
  });

  it("follows the zone, so two zones show the same instant differently", () => {
    expect(formatLocal(instant, "time", "Asia/Tokyo")).toBe("7:48 AM");
  });
});
