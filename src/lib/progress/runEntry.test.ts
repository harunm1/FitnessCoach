import { describe, expect, it } from "vitest";
import { parseDuration, parseRunEntry } from "./runEntry";

const TODAY = "2026-11-24";
const valid = {
  date: "2026-11-23",
  distanceKm: "5.2",
  duration: "0:31:12",
  effort: "6",
  note: "  Easy loop  ",
};

const message = (fields: Record<string, unknown>) => {
  const result = parseRunEntry({ ...valid, ...fields }, TODAY);
  return result.ok ? null : result.message;
};

describe("parseDuration", () => {
  it("reads h:mm:ss and mm:ss as seconds", () => {
    expect(parseDuration("0:31:12")).toBe(1872);
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("31:12")).toBe(1872);
    expect(parseDuration(" 45:00 ")).toBe(2700);
  });

  it("refuses anything that is not a clock time", () => {
    for (const text of [
      "",
      "31",
      "0:61:00",
      "0:30:60",
      "1:2:3",
      "a:bc:de",
      "-0:30:00",
    ]) {
      expect(parseDuration(text)).toBeNull();
    }
  });
});

describe("parseRunEntry", () => {
  it("returns the run in plain numbers, the note trimmed", () => {
    expect(parseRunEntry(valid, TODAY)).toEqual({
      ok: true,
      value: {
        date: "2026-11-23",
        distanceKm: 5.2,
        durationSec: 1872,
        effort: 6,
        note: "Easy loop",
      },
    });
  });

  it("leaves effort and note out when they are blank", () => {
    const result = parseRunEntry({ ...valid, effort: "", note: "" }, TODAY);
    expect(result).toMatchObject({
      ok: true,
      value: { effort: null, note: null },
    });
  });

  it("accepts a comma decimal and rounds the distance to 0.01 km", () => {
    const result = parseRunEntry({ ...valid, distanceKm: "5,256" }, TODAY);
    expect(result).toMatchObject({ ok: true, value: { distanceKm: 5.26 } });
  });

  it("refuses a distance outside 0.1 to 300 km, or one that is not a number", () => {
    for (const distanceKm of [
      "0",
      "0.05",
      "300.01",
      "abc",
      "1e2",
      "0x10",
      "",
    ]) {
      expect(message({ distanceKm })).toBe(
        "Enter a distance between 0.1 and 300 km.",
      );
    }
    expect(message({ distanceKm: "300", duration: "23:59:59" })).toBeNull();
    expect(message({ distanceKm: "0.1", duration: "0:00:30" })).toBeNull();
  });

  it("refuses a time that is not h:mm:ss, zero, or over 24 hours", () => {
    const text = "Enter the time as h:mm:ss, for example 0:32:15.";
    expect(message({ duration: "32" })).toBe(text);
    expect(message({ duration: "0:00:00" })).toBe(
      "Enter a time longer than zero.",
    );
    expect(message({ duration: "24:00:01" })).toBe(
      "Keep the time to 24 hours or less.",
    );
  });

  it("refuses a pace faster than 1:30 or slower than 30:00 per km as a typo", () => {
    expect(message({ distanceKm: "10", duration: "0:14:59" })).toBe(
      "That pace is faster than 1:30 per km. Check the distance and time.",
    );
    expect(message({ distanceKm: "10", duration: "0:15:00" })).toBeNull();
    expect(message({ distanceKm: "1", duration: "0:30:01" })).toBe(
      "That pace is slower than 30:00 per km. Check the distance and time.",
    );
  });

  it("refuses an effort outside 1 to 10 or not a whole number", () => {
    for (const effort of ["0", "11", "5.5", "x", "0x5", "1e1", "+7"]) {
      expect(message({ effort })).toBe(
        "Effort is a whole number from 1 to 10.",
      );
    }
  });

  it("refuses a day that is not real, before 2000 or after today", () => {
    expect(message({ date: "2026-02-30" })).toBe("Choose the day you ran.");
    expect(message({ date: "1999-12-31" })).toBe("Choose a day from 2000 on.");
    expect(message({ date: "2026-11-25" })).toBe(
      "That day hasn't happened yet.",
    );
    expect(message({ date: TODAY })).toBeNull();
  });

  it("refuses a note over 300 characters, counted as characters", () => {
    expect(message({ note: "a".repeat(301) })).toBe(
      "Keep the note to 300 characters.",
    );
    expect(message({ note: "🏃".repeat(300) })).toBeNull();
  });

  it("refuses missing fields with the field's own message", () => {
    expect(message({ date: undefined })).toBe("Choose the day you ran.");
    expect(message({ distanceKm: undefined })).toBe(
      "Enter a distance between 0.1 and 300 km.",
    );
  });
});
