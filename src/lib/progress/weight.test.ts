import { describe, expect, it } from "vitest";
import { parseWeightEntry } from "./weight";

const TODAY = "2026-11-24";

function entry(fields: Record<string, string | undefined>) {
  return parseWeightEntry(
    { date: TODAY, weightKg: "81.5", note: undefined, ...fields },
    TODAY,
  );
}

describe("parseWeightEntry", () => {
  it("accepts a date, a weight and a note", () => {
    expect(entry({ note: "  Morning, before breakfast " })).toEqual({
      ok: true,
      value: { date: TODAY, weightKg: 81.5, note: "Morning, before breakfast" },
    });
  });

  it("treats a blank note as no note", () => {
    expect(entry({ note: "   " })).toEqual({
      ok: true,
      value: { date: TODAY, weightKg: 81.5, note: null },
    });
  });

  it("accepts a comma as the decimal mark", () => {
    expect(entry({ weightKg: "81,5" })).toMatchObject({
      ok: true,
      value: { weightKg: 81.5 },
    });
  });

  it("rounds to the 0.01 kg the database keeps", () => {
    expect(entry({ weightKg: "81.456" })).toMatchObject({
      value: { weightKg: 81.46 },
    });
  });

  it.each([
    ["", "Enter a weight between 20 and 400 kg."],
    ["heavy", "Enter a weight between 20 and 400 kg."],
    ["19.99", "Enter a weight between 20 and 400 kg."],
    ["400.01", "Enter a weight between 20 and 400 kg."],
    ["Infinity", "Enter a weight between 20 and 400 kg."],
    ["0x50", "Enter a weight between 20 and 400 kg."],
    ["1e2", "Enter a weight between 20 and 400 kg."],
    ["81.5.2", "Enter a weight between 20 and 400 kg."],
  ])("refuses the weight %j", (weightKg, message) => {
    expect(entry({ weightKg })).toEqual({ ok: false, message });
  });

  it("accepts both ends of the weight range", () => {
    expect(entry({ weightKg: "20" })).toMatchObject({ ok: true });
    expect(entry({ weightKg: "400" })).toMatchObject({ ok: true });
  });

  it.each([
    ["", "Choose the day you weighed yourself."],
    ["24/11/2026", "Choose the day you weighed yourself."],
    ["2026-02-30", "Choose the day you weighed yourself."],
    ["2026-13-01", "Choose the day you weighed yourself."],
  ])("refuses the date %j", (date, message) => {
    expect(entry({ date })).toEqual({ ok: false, message });
  });

  it("refuses a day after today", () => {
    expect(entry({ date: "2026-11-25" })).toEqual({
      ok: false,
      message: "That day hasn't happened yet.",
    });
  });

  it("refuses a day before 2000", () => {
    expect(entry({ date: "1999-12-31" })).toEqual({
      ok: false,
      message: "Choose a day from 2000 on.",
    });
  });

  it("refuses a note over 300 characters, counting characters not bytes", () => {
    expect(entry({ note: "é".repeat(300) })).toMatchObject({ ok: true });
    expect(entry({ note: "a".repeat(301) })).toEqual({
      ok: false,
      message: "Keep the note to 300 characters.",
    });
  });
});
