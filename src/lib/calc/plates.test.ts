// Tests for the plate and warm-up calculator (#95, D25): pure functions, kilograms.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BAR_KG,
  DEFAULT_PLATES_KG,
  platesPerSide,
  warmupSets,
} from "./plates";

describe("platesPerSide", () => {
  it("loads the heaviest plates first on each side of the bar", () => {
    expect(platesPerSide(100)).toEqual({
      kind: "loaded",
      perSide: [25, 15],
      loadedKg: 100,
      shortByKg: 0,
    });
  });

  it("returns no plates for the empty bar", () => {
    expect(platesPerSide(DEFAULT_BAR_KG)).toEqual({
      kind: "loaded",
      perSide: [],
      loadedKg: DEFAULT_BAR_KG,
      shortByKg: 0,
    });
  });

  it("uses small plates for odd loads and keeps decimals exact", () => {
    expect(platesPerSide(62.5)).toEqual({
      kind: "loaded",
      perSide: [20, 1.25],
      loadedKg: 62.5,
      shortByKg: 0,
    });
  });

  it("rounds down to the nearest loadable weight and says how far short it is", () => {
    // 21 kg needs 0.5 kg a side; the smallest default plate is 1.25 kg.
    expect(platesPerSide(21)).toEqual({
      kind: "loaded",
      perSide: [],
      loadedKg: 20,
      shortByKg: 1,
    });
  });

  it("uses the plates the user owns", () => {
    expect(platesPerSide(60, { plateKgs: [10, 5] })).toEqual({
      kind: "loaded",
      perSide: [10, 10],
      loadedKg: 60,
      shortByKg: 0,
    });
  });

  it("uses a different bar", () => {
    expect(platesPerSide(35, { barKg: 15 })).toMatchObject({
      perSide: [10],
      loadedKg: 35,
    });
  });

  it("uses the fewest plates for every 2.5 kg step up to 380 kg", () => {
    const fewest = (target: number): number => {
      const units = Math.round(((target - DEFAULT_BAR_KG) / 2) * 100);
      const sizes = DEFAULT_PLATES_KG.map((p) => Math.round(p * 100));
      const best: number[] = [0];
      Array.from({ length: units }, (_, i) => i + 1).forEach((u) => {
        best[u] = Math.min(
          ...sizes.filter((s) => s <= u).map((s) => best[u - s] + 1),
        );
      });
      return best[units];
    };
    const targets = Array.from(
      { length: 145 },
      (_, i) => DEFAULT_BAR_KG + i * 2.5,
    );
    targets.forEach((target) => {
      const result = platesPerSide(target);
      if (result.kind !== "loaded") throw new Error(String(target));
      expect(result.perSide.length, `${target} kg`).toBe(fewest(target));
      expect(result.loadedKg, `${target} kg`).toBe(target);
    });
  });

  it("refuses a target below the bar", () => {
    expect(platesPerSide(15)).toEqual({ kind: "below-bar", barKg: 20 });
  });

  it("refuses a target that is not a positive finite number", () => {
    [Number.NaN, Infinity, -5, 0].forEach((bad) =>
      expect(platesPerSide(bad).kind, String(bad)).toBe("invalid"),
    );
  });

  it("finds an exact load that greedy would miss with a custom set", () => {
    expect(platesPerSide(60, { plateKgs: [15, 10] })).toEqual({
      kind: "loaded",
      perSide: [10, 10],
      loadedKg: 60,
      shortByKg: 0,
    });
    expect(platesPerSide(100, { plateKgs: [25, 10] })).toMatchObject({
      loadedKg: 100,
      shortByKg: 0,
    });
    expect(platesPerSide(28, { plateKgs: [2, 0.5] })).toMatchObject({
      perSide: [2, 2],
      loadedKg: 28,
    });
  });

  it("refuses a bar or plate that is not a finite number instead of throwing", () => {
    expect(platesPerSide(100, { barKg: Number.NaN }).kind).toBe("invalid");
    expect(platesPerSide(100, { barKg: -10 }).kind).toBe("invalid");
    expect(warmupSets(100, { barKg: Number.NaN })).toEqual([]);
    expect(platesPerSide(100, { plateKgs: [Infinity, 10] })).toMatchObject({
      perSide: [10, 10, 10, 10],
      loadedKg: 100,
    });
  });

  it("refuses a target above the largest it will load", () => {
    expect(platesPerSide(1e12)).toEqual({ kind: "too-heavy", maxKg: 1000 });
    expect(platesPerSide(1000).kind).toBe("loaded");
  });

  it("compares the target with the bar in hundredths", () => {
    expect(platesPerSide(20.004)).toMatchObject({ perSide: [], loadedKg: 20 });
    expect(platesPerSide(19.994).kind).toBe("below-bar");
  });

  it("refuses an empty or non-positive plate set instead of looping", () => {
    expect(platesPerSide(100, { plateKgs: [] }).kind).toBe("no-plates");
    expect(platesPerSide(100, { plateKgs: [0, -5] }).kind).toBe("no-plates");
  });
});

describe("warmupSets", () => {
  it("ramps from the bar to 80% of the working weight, rounded down to what can be loaded", () => {
    expect(warmupSets(100)).toEqual([
      { kg: 20, reps: 5 },
      { kg: 40, reps: 5 },
      { kg: 60, reps: 3 },
      { kg: 80, reps: 2 },
    ]);
  });

  it("rounds each step down to a loadable weight", () => {
    // 40%, 60%, 80% of 72.5 are 29, 43.5 and 58; loadable steps are 2.5 kg.
    expect(warmupSets(72.5).map((s) => s.kg)).toEqual([20, 27.5, 42.5, 57.5]);
  });

  it("drops steps that land on the bar or repeat the step before", () => {
    // 40% of 30 is 12 and 60% is 18, both below the bar; 80% is 24, which rounds to 22.5.
    expect(warmupSets(30)).toEqual([
      { kg: 20, reps: 5 },
      { kg: 22.5, reps: 2 },
    ]);
  });

  it("has no warm-up when there are no plates, or a ramp step repeats", () => {
    expect(warmupSets(100, { plateKgs: [] })).toEqual([]);
    // With only 10 kg plates a step moves in 20 kg jumps: 40, 60 and 80 are loadable, and
    // 40% of 50 (20) is the bar, 60% (30) rounds to the bar, 80% (40) is loadable.
    expect(warmupSets(50, { plateKgs: [10] })).toEqual([
      { kg: 20, reps: 5 },
      { kg: 40, reps: 2 },
    ]);
  });

  it("has no warm-up when the working weight is the bar or less", () => {
    expect(warmupSets(20)).toEqual([]);
    expect(warmupSets(10)).toEqual([]);
    expect(warmupSets(Number.NaN)).toEqual([]);
  });

  it("never reaches the working weight", () => {
    [22.5, 25, 45, 100, 182.5].forEach((work) =>
      warmupSets(work).forEach((set) => expect(set.kg).toBeLessThan(work)),
    );
  });
});
