// getBodyWeightTrend (D43): the user's own weigh-ins over the last 90 days, as a few lines the
// coach can quote, in the user's unit, with the period named. Invented data only.
import { describe, expect, it, vi } from "vitest";
import { bodyWeightTrendResult, getBodyWeightTrend } from "./bodyWeightTrend";

const NOW = new Date("2026-11-26T17:00:00Z");

describe("bodyWeightTrendResult (D43)", () => {
  it("gives the first and latest weigh-in, the change and the change a week", () => {
    const result = bodyWeightTrendResult(
      [
        { date: "2026-09-01", weightKg: 84.2 },
        { date: "2026-10-15", weightKg: 82.6 },
        { date: "2026-11-24", weightKg: 81 },
      ],
      "KG",
      NOW,
    );
    expect(result.name).toBe("getBodyWeightTrend");
    expect(result.period).toBe("last 90 days (28 Aug 2026 to 26 Nov 2026)");
    expect(result.lines).toEqual([
      "Weigh-ins: 3.",
      "First: 1 Sep 2026, 84.2 kg. Latest: 24 Nov 2026, 81 kg.",
      "Change: -3.2 kg over 84 days, -0.27 kg a week.",
    ]);
  });

  it("converts to pounds for a pound user", () => {
    const result = bodyWeightTrendResult(
      [
        { date: "2026-11-01", weightKg: 90.72 },
        { date: "2026-11-22", weightKg: 89.81 },
      ],
      "LB",
      NOW,
    );
    expect(result.lines[1]).toBe(
      "First: 1 Nov 2026, 200 lb. Latest: 22 Nov 2026, 198 lb.",
    );
    expect(result.lines[2]).toBe(
      "Change: -2 lb over 21 days, -0.67 lb a week.",
    );
  });

  it("says one entry is not a trend", () => {
    const result = bodyWeightTrendResult(
      [{ date: "2026-11-20", weightKg: 80 }],
      "KG",
      NOW,
    );
    expect(result.lines).toEqual([
      "Weigh-ins: 1. Latest: 20 Nov 2026, 80 kg.",
      "One weigh-in is not a trend yet.",
    ]);
  });

  it("says none is logged and where to log it", () => {
    const result = bodyWeightTrendResult([], "KG", NOW);
    expect(result.lines).toEqual([
      "No body-weight entries in this period. The user logs them on Progress, Weight.",
    ]);
  });
});

describe("getBodyWeightTrend (D43)", () => {
  it("reads only the signed-in user's rows from the last 90 days", async () => {
    const findMany = vi.fn(async () => [
      { date: new Date("2026-11-01T00:00:00Z"), weightKg: "80.5" },
    ]);
    const db = { bodyWeight: { findMany } } as unknown as Parameters<
      typeof getBodyWeightTrend
    >[0];

    const result = await getBodyWeightTrend(db, "owner", "KG", NOW);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "owner",
          date: { gte: new Date("2026-08-28T00:00:00Z") },
        },
      }),
    );
    expect(result.lines[0]).toBe("Weigh-ins: 1. Latest: 1 Nov 2026, 80.5 kg.");
  });
});
