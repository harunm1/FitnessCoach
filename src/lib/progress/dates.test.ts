import { describe, expect, it } from "vitest";
import { dayKey, previousWeek, weekKey } from "./dates";

describe("dayKey", () => {
  it("uses the Toronto calendar day, not the UTC one", () => {
    // 03:30 UTC on Monday is 10:30 p.m. on Sunday in Toronto.
    expect(dayKey(new Date("2026-11-09T03:30:00Z"))).toBe("2026-11-08");
  });

  it("accepts another time zone", () => {
    expect(dayKey(new Date("2026-11-09T03:30:00Z"), "UTC")).toBe("2026-11-09");
  });
});

describe("weekKey", () => {
  it("maps a Sunday to the Monday before it", () => {
    expect(weekKey("2026-11-08")).toBe("2026-11-02");
  });

  it("keeps a Monday as its own week", () => {
    expect(weekKey("2026-11-02")).toBe("2026-11-02");
  });

  it("crosses a year boundary", () => {
    expect(weekKey("2026-01-01")).toBe("2025-12-29");
  });
});

describe("previousWeek", () => {
  it("returns the Monday seven days earlier", () => {
    expect(previousWeek("2026-11-02")).toBe("2026-10-26");
  });

  it("crosses a month boundary", () => {
    expect(previousWeek("2026-03-02")).toBe("2026-02-23");
  });
});
