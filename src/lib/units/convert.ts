// Unit conversion for the display preference (D29). Everything stored is in kilograms and
// kilometres; these helpers convert at the edges only (typed input in, shown text out).

export type WeightUnit = "KG" | "LB";
export type DistanceUnit = "KM" | "MI";

// The 1959 international pound and mile; NIST Guide to the SI, Appendix B.8 (read 25 Nov 2026):
// 4.535 924 E-01 kg per pound, 1.609 344 E+03 m per mile, the mile marked exact.
export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;

// A weight is shown to the plate step of its unit: a 0.5 lb pair of plates, a 0.25 kg pair.
const LB_STEP = 0.5;
const KG_STEP = 0.25;
// The database keeps weights and distances to 0.01 (Decimal(6,2) and Decimal(5,2)).
const HUNDREDTHS = 100;
const SECONDS_PER_MINUTE = 60;
const SECOND_DIGITS = 2;

const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;
const toHundredths = (value: number) =>
  Math.round(value * HUNDREDTHS) / HUNDREDTHS;

// A typed weight in the user's unit, as the kilograms the database keeps.
export function toKg(value: number, unit: WeightUnit): number {
  return toHundredths(unit === "LB" ? value * KG_PER_LB : value);
}

// A stored weight as the number to show: pounds to 0.5, kilograms to 0.25.
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === "LB"
    ? roundTo(kg / KG_PER_LB, LB_STEP)
    : roundTo(kg, KG_STEP);
}

// A stored body or photo weight as the number to show: pounds to 0.1, kilograms as stored
// (0.01). A scale reading is not a load, so it is not rounded to the plate step.
const TENTHS = 10;
export function fromKgBody(kg: number, unit: WeightUnit): number {
  return unit === "LB"
    ? Math.round((kg / KG_PER_LB) * TENTHS) / TENTHS
    : toHundredths(kg);
}

// A typed distance in the user's unit, as the kilometres the database keeps.
export function toKm(value: number, unit: DistanceUnit): number {
  return toHundredths(unit === "MI" ? value * KM_PER_MI : value);
}

// A stored distance as the number to show, to 0.01.
export function fromKm(km: number, unit: DistanceUnit): number {
  return toHundredths(unit === "MI" ? km / KM_PER_MI : km);
}

// The limits of a range stored in kilograms, as the numbers to name in a message in the
// user's unit. Pounds are narrowed inward to whole pounds, so a limit that is named is
// always accepted.
export function weightBounds(
  minKg: number,
  maxKg: number,
  unit: WeightUnit,
): [number, number] {
  return unit === "KG"
    ? [minKg, maxKg]
    : [Math.ceil(minKg / KG_PER_LB), Math.floor(maxKg / KG_PER_LB)];
}

// The same for a distance range stored in kilometres, narrowed inward to hundredths of a mile.
export function distanceBounds(
  minKm: number,
  maxKm: number,
  unit: DistanceUnit,
): [number, number] {
  return unit === "KM"
    ? [minKm, maxKm]
    : [
        Math.ceil((minKm / KM_PER_MI) * HUNDREDTHS) / HUNDREDTHS,
        Math.floor((maxKm / KM_PER_MI) * HUNDREDTHS) / HUNDREDTHS,
      ];
}

export const weightLabel = (unit: WeightUnit) => (unit === "LB" ? "lb" : "kg");
export const distanceLabel = (unit: DistanceUnit) =>
  unit === "MI" ? "mi" : "km";

// "135 lb", "82.5 kg": String drops trailing zeros.
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${fromKg(kg, unit)} ${weightLabel(unit)}`;
}

// "180 lb", "81.3 kg" for a body weight.
export function formatBodyWeight(kg: number, unit: WeightUnit): string {
  return `${fromKgBody(kg, unit)} ${weightLabel(unit)}`;
}

// "6.21 mi", "5 km".
export function formatDistance(km: number, unit: DistanceUnit): string {
  return `${fromKm(km, unit)} ${distanceLabel(unit)}`;
}

// "6:00 /km" or "9:39 /mi", or null when the run has no usable distance or time.
export function formatPace(
  distanceKm: number | null,
  seconds: number | null,
  unit: DistanceUnit,
): string | null {
  if (!distanceKm || !seconds || distanceKm <= 0) return null;
  const perKm = seconds / distanceKm;
  const perUnit = unit === "MI" ? perKm * KM_PER_MI : perKm;
  const total = Math.round(perUnit);
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  const rest = String(total % SECONDS_PER_MINUTE).padStart(SECOND_DIGITS, "0");
  return `${minutes}:${rest} /${distanceLabel(unit)}`;
}

// A unit that came from a form or the database: only the exact values count, so a stray
// string never turns into a conversion.
export function parseWeightUnit(value: unknown): WeightUnit | null {
  return value === "KG" || value === "LB" ? value : null;
}

export function parseDistanceUnit(value: unknown): DistanceUnit | null {
  return value === "KM" || value === "MI" ? value : null;
}

export type UnitPrefs = { weightUnit: WeightUnit; distanceUnit: DistanceUnit };

// What a new user gets, and what a missing row falls back to (D29).
export const DEFAULT_UNITS: UnitPrefs = {
  weightUnit: "LB",
  distanceUnit: "MI",
};

// The units on a user row, or the defaults for a missing row or a value that is not a unit,
// so a page never fails because of a display setting.
export function unitsFromRow(
  row: { weightUnit?: unknown; distanceUnit?: unknown } | null | undefined,
): UnitPrefs {
  return {
    weightUnit: parseWeightUnit(row?.weightUnit) ?? DEFAULT_UNITS.weightUnit,
    distanceUnit:
      parseDistanceUnit(row?.distanceUnit) ?? DEFAULT_UNITS.distanceUnit,
  };
}

// What every number in the database means; a component given no units shows these.
export const STORED_UNITS: UnitPrefs = { weightUnit: "KG", distanceUnit: "KM" };
