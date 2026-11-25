import { formatBodyWeight, type WeightUnit } from "@/lib/units/convert";
import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";

type LabelledPhoto = { takenAt: Date; weightKg: number | null };

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// Only numeric parts come from Intl: ICU builds differ on month words ("Nov."
// in one, "Nov" in another), and these labels are rendered on the server and
// again in the browser, so they must come out the same in both.
const numericParts = new Intl.DateTimeFormat("en-US", {
  timeZone: DEFAULT_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

// "Nov 12, 2026": the Toronto day the photo was taken.
export function photoDate(takenAt: Date): string {
  const parts = numericParts.formatToParts(takenAt);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return `${MONTHS[part("month") - 1]} ${part("day")}, ${part("year")}`;
}

// "Progress photo from Nov 12, 2026, 81.5 kg" (or in pounds, D30): the alt text, so a screen
// reader hears the date and, when it was logged, the weight.
export function photoAlt(
  { takenAt, weightKg }: LabelledPhoto,
  unit: WeightUnit = "KG",
): string {
  const date = `Progress photo from ${photoDate(takenAt)}`;
  return weightKg === null
    ? date
    : `${date}, ${formatBodyWeight(weightKg, unit)}`;
}

// "Nov 12, 2026 · 81.5 kg": the visible caption and the dialog title.
export function photoCaption(
  { takenAt, weightKg }: LabelledPhoto,
  unit: WeightUnit = "KG",
): string {
  const date = photoDate(takenAt);
  return weightKg === null
    ? date
    : `${date} · ${formatBodyWeight(weightKg, unit)}`;
}
