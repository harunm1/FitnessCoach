// Plate and warm-up calculator (#95, D25). Pure functions in kilograms, no model call.
// All sums run in hundredths of a kilogram, so 1.25 kg plates add up without float
// error.

// Disc sizes and a 20 kg bar: the IPF Technical Rulebook (2026) allows discs of 1.25,
// 2.5, 5, 10, 15, 20 and 25 kg; its competition bar is 25 kg with collars, so the usual
// 20 kg gym bar is the default here and can be changed (checked 24 Nov 2026).
export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

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
  | { kind: "below-bar"; barKg: number } // the target is not above the bar
  | { kind: "no-plates" };

// Greedy, heaviest plate first. That uses the fewest plates for the default set (a test
// checks every 2.5 kg step to 380 kg against a coin-change search); for a set the user
// builds themselves it is a good load, not always the fewest plates.
export function platesPerSide(
  targetKg: number,
  { barKg = DEFAULT_BAR_KG, plateKgs = DEFAULT_PLATES_KG }: PlateOptions = {},
): PlateResult {
  if (!Number.isFinite(targetKg) || targetKg <= barKg) {
    // The bar alone is a valid load; only a target under it is refused.
    if (Number.isFinite(targetKg) && targetKg === barKg) {
      return { kind: "loaded", perSide: [], loadedKg: barKg, shortByKg: 0 };
    }
    return { kind: "below-bar", barKg };
  }
  const sizes = [...new Set(plateKgs.filter((p) => p > 0).map(toHundredths))]
    .filter((units) => units > 0)
    .sort((a, b) => b - a);
  if (sizes.length === 0) return { kind: "no-plates" };

  const toAdd = Math.floor(
    (toHundredths(targetKg) - toHundredths(barKg)) / SIDES,
  );
  const { perSide, left } = sizes.reduce(
    (state, size) => {
      const count = Math.floor(state.left / size);
      return {
        perSide: [...state.perSide, ...Array<number>(count).fill(size)],
        left: state.left - count * size,
      };
    },
    { perSide: [] as number[], left: toAdd },
  );
  const loadedUnits = toHundredths(barKg) + (toAdd - left) * SIDES;
  return {
    kind: "loaded",
    perSide: perSide.map(fromHundredths),
    loadedKg: fromHundredths(loadedUnits),
    shortByKg: fromHundredths(toHundredths(targetKg) - loadedUnits),
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

export function warmupSets(
  workingKg: number,
  options: PlateOptions = {},
): WarmupSet[] {
  const barKg = options.barKg ?? DEFAULT_BAR_KG;
  if (!Number.isFinite(workingKg) || workingKg <= barKg) return [];

  const steps = RAMP.flatMap(({ percent, reps }): WarmupSet[] => {
    const target = fromHundredths(
      Math.floor((toHundredths(workingKg) * percent) / PERCENT),
    );
    const load = platesPerSide(target, options);
    return load.kind === "loaded" ? [{ kg: load.loadedKg, reps }] : [];
  });
  // A step on or below the bar, or no heavier than the step before it, adds nothing.
  return steps.reduce<WarmupSet[]>(
    (sets, step) =>
      step.kg > sets[sets.length - 1].kg && step.kg < workingKg
        ? [...sets, step]
        : sets,
    [{ kg: barKg, reps: BAR_SET_REPS }],
  );
}
