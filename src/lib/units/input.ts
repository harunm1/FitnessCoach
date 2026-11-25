import {
  parseDistanceUnit,
  parseWeightUnit,
  toKg,
  toKm,
  type DistanceUnit,
  type WeightUnit,
} from "./convert";

// What a form typed in the user's unit becomes before the existing checks run (D29): those
// checks, their limits and the database all stay in kilograms and kilometres.

export const WEIGHT_UNIT_MESSAGE = "Choose kg or lb for the weight.";
export const DISTANCE_UNIT_MESSAGE = "Choose km or mi for the distance.";

// A plain number with an optional "." or "," decimal part, as the forms accept.
const PLAIN_NUMBER = /^\s*\d+([.,]\d+)?\s*$/;

// Forms post the unit they showed, so a tab left open across a settings change still
// converts with the label the user read. No field means kilograms or kilometres, the stored
// unit; a value that is not a unit gives null so the action can refuse it.
export function readWeightUnit(formData: FormData): WeightUnit | null {
  const posted = formData.get("weightUnit");
  return posted === null ? "KG" : parseWeightUnit(posted);
}

export function readDistanceUnit(formData: FormData): DistanceUnit | null {
  const posted = formData.get("distanceUnit");
  return posted === null ? "KM" : parseDistanceUnit(posted);
}

function typedNumber(raw: unknown): number | null {
  if (typeof raw !== "string" || !PLAIN_NUMBER.test(raw)) return null;
  return Number(raw.trim().replace(",", "."));
}

// The typed weight as kilograms in text, or the value unchanged when it is empty or not a
// plain number, so the existing checks give their usual message.
export function weightFieldToKg(raw: unknown, unit: WeightUnit): unknown {
  const value = typedNumber(raw);
  return unit === "KG" || value === null ? raw : String(toKg(value, unit));
}

export function distanceFieldToKm(raw: unknown, unit: DistanceUnit): unknown {
  const value = typedNumber(raw);
  return unit === "KM" || value === null ? raw : String(toKm(value, unit));
}
