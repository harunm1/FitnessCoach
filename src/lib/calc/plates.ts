// Plate and warm-up calculator (#95, D25). Pure functions in kilograms, no model call.
// All sums run in hundredths of a kilogram, so 1.25 kg plates add up without float
// error.

// Disc sizes and a 20 kg bar: the IPF Technical Rulebook (2026) allows discs of 1.25,
// 2.5, 5, 10, 15, 20 and 25 kg; its competition bar is 25 kg with collars, so the usual
// 20 kg gym bar is the default here and can be changed (checked 24 Nov 2026).
export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
// Above the 400 kg body-weight ceiling of D24 and any barbell lift; keeps the search small.
export const MAX_TARGET_KG = 1000;

const HUNDREDTHS = 100;
const SIDES = 2;
const toHundredths = (kg: number) => Math.round(kg * HUNDREDTHS);
const fromHundredths = (units: number) => units / HUNDREDTHS;

export type PlateOptions = { barKg?: number; plateKgs?: number[] };

export type PlateResult =
  | {
      kind: "loaded";
      perSide: number[]; // heaviest first
      loadedKg: number; // at most the target
      shortByKg: number; // target minus loadedKg
    }
  | { kind: "below-bar"; barKg: number } // the target is under the bar
  | { kind: "no-plates" }
  | { kind: "too-heavy"; maxKg: number }
  | { kind: "invalid" }; // a target not above zero, or a bar that is not a number or is below zero

// The fewest plates for the heaviest load of at most `limit` that the sizes can make,
// by a coin-change search over hundredths (sizes number about seven and the limit at
// most 50,000 units). Greedy would be enough for the default set, but with a set the
// user builds it can stop short of a load the plates reach exactly (15 and 10 kg for
// 60 kg on a 20 kg bar, 20 kg a side).
function bestPerSide(sizes: number[], limit: number): number[] {
  const unreachable = Number.POSITIVE_INFINITY;
  const count: number[] = [0];
  const last: number[] = [0];
  Array.from({ length: limit }, (_, i) => i + 1).forEach((units) => {
    const fits = sizes.filter(
      (size) => size <= units && count[units - size] !== unreachable,
    );
    const best = fits.reduce(
      (pick, size) =>
        pick === 0 || count[units - size] + 1 < count[units - pick] + 1
          ? size
          : pick,
      0,
    );
    count[units] = best === 0 ? unreachable : count[units - best] + 1;
    last[units] = best;
  });
  const reach = count.reduce(
    (top, plates, units) => (plates !== unreachable ? units : top),
    0,
  );
  const plates: number[] = [];
  for (let left = reach; left > 0; left -= last[left]) plates.push(last[left]);
  return plates.sort((a, b) => b - a);
}

export function platesPerSide(
  targetKg: number,
  { barKg = DEFAULT_BAR_KG, plateKgs = DEFAULT_PLATES_KG }: PlateOptions = {},
): PlateResult {
  if (!Number.isFinite(targetKg) || targetKg <= 0) return { kind: "invalid" };
  if (!Number.isFinite(barKg) || barKg < 0) return { kind: "invalid" };
  if (targetKg > MAX_TARGET_KG)
    return { kind: "too-heavy", maxKg: MAX_TARGET_KG };

  const target = toHundredths(targetKg);
  const bar = toHundredths(barKg);
  if (target < bar) return { kind: "below-bar", barKg };
  const sizes = [
    ...new Set(
      plateKgs.filter((p) => Number.isFinite(p) && p > 0).map(toHundredths),
    ),
  ].filter((units) => units > 0);
  if (sizes.length === 0) return { kind: "no-plates" };

  const perSide = bestPerSide(sizes, Math.floor((target - bar) / SIDES));
  const loaded = bar + perSide.reduce((sum, size) => sum + size, 0) * SIDES;
  return {
    kind: "loaded",
    perSide: perSide.map(fromHundredths),
    loadedKg: fromHundredths(loaded),
    shortByKg: fromHundredths(target - loaded),
  };
}

export type WarmupSet = { kg: number; reps: number };

// The empty bar for 5, then 40%, 60% and 80% of the working weight for 5, 3 and 2.
// This is a common gym convention (a Starting Strength coach's wall chart quoted on its
// forum, and online warm-up calculators), not a studied protocol: unverified default,
// read 24 Nov 2026.
const RAMP = [
  { percent: 40, reps: 5 },
  { percent: 60, reps: 3 },
  { percent: 80, reps: 2 },
];
const BAR_SET_REPS = 5;
const PERCENT = 100;

// Empty when there is nothing to ramp to: a working weight at or under the bar, or an
// input platesPerSide refuses (no plates, a bad bar, too heavy).
export function warmupSets(
  workingKg: number,
  options: PlateOptions = {},
): WarmupSet[] {
  const barKg = options.barKg ?? DEFAULT_BAR_KG;
  const work = platesPerSide(workingKg, options);
  if (
    work.kind !== "loaded" ||
    toHundredths(work.loadedKg) <= toHundredths(barKg)
  )
    return [];

  const steps = RAMP.flatMap(({ percent, reps }): WarmupSet[] => {
    const target = fromHundredths(
      Math.floor((toHundredths(workingKg) * percent) / PERCENT),
    );
    const load = platesPerSide(target, options);
    return load.kind === "loaded" ? [{ kg: load.loadedKg, reps }] : [];
  });
  // A step on or below the bar, or no heavier than the step before it, adds nothing; a
  // light working weight gets fewer than four sets.
  return steps.reduce<WarmupSet[]>(
    (sets, step) =>
      step.kg > sets[sets.length - 1].kg && step.kg < workingKg
        ? [...sets, step]
        : sets,
    [{ kg: barKg, reps: BAR_SET_REPS }],
  );
}
