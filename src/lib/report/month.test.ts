import { describe, expect, it } from "vitest";
import { inMonth, monthOf, monthSearchWindow } from "./month";

describe("monthOf", () => {
  it("is the Toronto month of the moment", () => {
    expect(monthOf(new Date("2026-11-15T17:00:00Z"))).toBe("2026-11");
  });

  it("uses Toronto, not UTC, at a month's edge", () => {
    // 23:30 on 30 Nov in Toronto is already 1 Dec in UTC.
    expect(monthOf(new Date("2026-12-01T04:30:00Z"))).toBe("2026-11");
    expect(monthOf(new Date("2026-12-01T05:30:00Z"))).toBe("2026-12");
  });
});

describe("inMonth", () => {
  it("tests a moment against a month by its Toronto day", () => {
    expect(inMonth(new Date("2026-12-01T04:30:00Z"), "2026-11")).toBe(true);
    expect(inMonth(new Date("2026-12-01T05:30:00Z"), "2026-11")).toBe(false);
  });
});

describe("monthSearchWindow", () => {
  it("is wide enough on both sides to hold every Toronto moment of the month", () => {
    const { from, to } = monthSearchWindow("2026-11");
    // Toronto is behind UTC, so the month starts at 05:00 UTC on the 1st
    // (the first moment) and ends at 04:59 UTC on 1 Dec.
    expect(from.getTime()).toBeLessThanOrEqual(
      new Date("2026-11-01T05:00:00Z").getTime(),
    );
    expect(to.getTime()).toBeGreaterThan(
      new Date("2026-12-01T04:59:00Z").getTime(),
    );
  });

  it("does not reach past the neighbouring months by more than a day", () => {
    const { from, to } = monthSearchWindow("2026-11");
    expect(from.getTime()).toBeGreaterThan(
      new Date("2026-10-30T00:00:00Z").getTime(),
    );
    expect(to.getTime()).toBeLessThan(
      new Date("2026-12-03T00:00:00Z").getTime(),
    );
  });
});
