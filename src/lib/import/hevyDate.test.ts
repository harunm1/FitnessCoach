// Tests for reading Hevy's start and end times (#131); the formats are listed in docs/IMPORT_FORMATS.md.
import { describe, expect, it } from "vitest";
import { parseHevyDate } from "./hevyDate";

describe("parseHevyDate", () => {
  it("reads 'D MMM YYYY, HH:mm' as Toronto time (summer, UTC-4)", () => {
    expect(parseHevyDate("20 Jun 2024, 18:30")?.toISOString()).toBe(
      "2024-06-20T22:30:00.000Z",
    );
  });

  it("reads the US 12-hour form (winter, UTC-5)", () => {
    expect(parseHevyDate("Nov 20, 2024, 6:30 PM")?.toISOString()).toBe(
      "2024-11-20T23:30:00.000Z",
    );
    expect(parseHevyDate("Nov 20, 2024, 12:05 AM")?.toISOString()).toBe(
      "2024-11-20T05:05:00.000Z",
    );
  });

  it("reads an ISO-style date with or without seconds", () => {
    expect(parseHevyDate("2024-01-15 07:30:00")?.toISOString()).toBe(
      "2024-01-15T12:30:00.000Z",
    );
    expect(parseHevyDate("2024-01-15 07:30")?.toISOString()).toBe(
      "2024-01-15T12:30:00.000Z",
    );
  });

  it("ignores case and extra spaces in month names", () => {
    expect(parseHevyDate("  20 jun 2024,  18:30 ")).not.toBeNull();
  });

  it("reads a time that does not exist (spring forward) one hour early, and an ambiguous one as the first", () => {
    // 2024-03-10 02:30 does not exist in Toronto; 2024-11-03 01:30 happens twice.
    expect(parseHevyDate("10 Mar 2024, 02:30")?.toISOString()).toBe(
      "2024-03-10T06:30:00.000Z",
    );
    expect(parseHevyDate("3 Nov 2024, 01:30")?.toISOString()).toBe(
      "2024-11-03T05:30:00.000Z",
    );
  });

  it("refuses all-numeric dates that could be day-first or month-first", () => {
    expect(parseHevyDate("03/04/2024 10:00")).toBeNull();
    expect(parseHevyDate("03-04-2024 10:00")).toBeNull();
  });

  it("refuses impossible dates and times", () => {
    expect(parseHevyDate("31 Feb 2024, 10:00")).toBeNull();
    expect(parseHevyDate("20 Jun 2024, 25:00")).toBeNull();
    expect(parseHevyDate("Nov 20, 2024, 13:30 PM")).toBeNull();
    expect(parseHevyDate("2024-01-15 07:30:75")).toBeNull();
    expect(parseHevyDate("")).toBeNull();
    expect(parseHevyDate("yesterday")).toBeNull();
  });
});
