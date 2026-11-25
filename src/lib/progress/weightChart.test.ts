import { describe, expect, it } from "vitest";
import {
  dayLabel,
  weightChart,
  weightSummary,
  yearBefore,
} from "./weightChart";

const SIZE = { width: 300, height: 100, padding: 10 };

describe("weightChart", () => {
  it("has nothing to draw without entries", () => {
    expect(weightChart([], SIZE)).toBeNull();
  });

  it("puts a single entry in the middle", () => {
    const chart = weightChart([{ date: "2026-11-01", weightKg: 80 }], SIZE);
    expect(chart?.points).toEqual([
      { date: "2026-11-01", weightKg: 80, x: 150, y: 50 },
    ]);
    expect(chart?.path).toBe("M150 50");
  });

  it("spaces entries by date, not by position, oldest on the left", () => {
    const chart = weightChart(
      [
        { date: "2026-11-01", weightKg: 82 },
        { date: "2026-11-02", weightKg: 81 },
        { date: "2026-11-11", weightKg: 80 },
      ],
      SIZE,
    );
    const xs = chart?.points.map((point) => point.x);
    // 1 day of 10 is a tenth of the 280 px between the paddings.
    expect(xs).toEqual([10, 38, 290]);
  });

  it("draws heavier higher, with a 1 kg margin above and below", () => {
    const chart = weightChart(
      [
        { date: "2026-11-01", weightKg: 82 },
        { date: "2026-11-02", weightKg: 80 },
      ],
      SIZE,
    );
    // Domain 79 to 83 kg over 80 px: 82 kg is 1/4 down, 80 kg is 3/4 down.
    expect(chart?.points.map((point) => point.y)).toEqual([30, 70]);
    expect(chart?.minKg).toBe(79);
    expect(chart?.maxKg).toBe(83);
    expect(chart?.path).toBe("M10 30 L290 70");
  });

  it("sorts entries that arrive out of order", () => {
    const chart = weightChart(
      [
        { date: "2026-11-02", weightKg: 80 },
        { date: "2026-11-01", weightKg: 82 },
      ],
      SIZE,
    );
    expect(chart?.points.map((point) => point.date)).toEqual([
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});

describe("weightChart ranges", () => {
  it("rounds the padded axis and reports the user's own lightest and heaviest", () => {
    const chart = weightChart(
      [
        { date: "2026-11-01", weightKg: 64.1 },
        { date: "2026-11-02", weightKg: 65 },
      ],
      SIZE,
    );
    // 64.1 - 1 in floating point is 63.099999999999994.
    expect(chart?.minKg).toBe(63.1);
    expect(chart?.maxKg).toBe(66);
    expect(chart?.lowestKg).toBe(64.1);
    expect(chart?.highestKg).toBe(65);
  });
});

describe("weightSummary", () => {
  it("is empty without entries", () => {
    expect(weightSummary([])).toBeNull();
  });

  it("gives the latest weight and the change since the first", () => {
    expect(
      weightSummary([
        { date: "2026-11-11", weightKg: 80.4 },
        { date: "2026-10-01", weightKg: 82 },
      ]),
    ).toEqual({
      latest: { date: "2026-11-11", weightKg: 80.4 },
      first: { date: "2026-10-01", weightKg: 82 },
      changeKg: -1.6,
    });
  });
});

describe("dayLabel", () => {
  it("writes a day the way the photo labels do", () => {
    expect(dayLabel("2026-11-04")).toBe("Nov 4, 2026");
    expect(dayLabel("2026-01-31")).toBe("Jan 31, 2026");
  });
});

describe("yearBefore", () => {
  it("goes back one calendar year", () => {
    expect(yearBefore("2026-11-12")).toBe("2025-11-12");
  });

  it("turns 29 February into 1 March of a year without one", () => {
    expect(yearBefore("2028-02-29")).toBe("2027-03-01");
  });
});
