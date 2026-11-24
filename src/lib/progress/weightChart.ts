export type WeightPoint = { date: string; weightKg: number };

export type ChartSize = { width: number; height: number; padding: number };

export type WeightChart = {
  points: (WeightPoint & { x: number; y: number })[];
  path: string; // an SVG path: "M10 30 L290 70"
  minKg: number;
  maxKg: number;
};

// Room above the heaviest and below the lightest day, so the line never
// touches the edge and a flat week is not drawn as a wild swing.
const MARGIN_KG = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayNumber = (day: string) =>
  Math.round(new Date(`${day}T00:00:00Z`).getTime() / DAY_MS);

const byDate = (a: WeightPoint, b: WeightPoint) => a.date.localeCompare(b.date);

// Positions are rounded to 0.1 px (enough for a screen, and the markup stays
// short); kilograms to 0.01 kg, as the database keeps them.
const STEPS_PER_PX = 10;
const STEPS_PER_KG = 100;
const tidy = (value: number) => Math.round(value * STEPS_PER_PX) / STEPS_PER_PX;

// Where each weigh-in sits in a width × height box: days spread left (oldest)
// to right (newest) by date, heavier higher. Null when there is nothing to draw.
export function weightChart(
  entries: WeightPoint[],
  { width, height, padding }: ChartSize,
): WeightChart | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort(byDate);
  const kgs = sorted.map((entry) => entry.weightKg);
  const minKg = Math.min(...kgs) - MARGIN_KG;
  const maxKg = Math.max(...kgs) + MARGIN_KG;
  const firstDay = dayNumber(sorted[0].date);
  const daySpan = dayNumber(sorted[sorted.length - 1].date) - firstDay;
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;

  const points = sorted.map((entry) => ({
    ...entry,
    // One day only: put it in the middle rather than divide by zero.
    x: tidy(
      daySpan === 0
        ? width / 2
        : padding + ((dayNumber(entry.date) - firstDay) / daySpan) * innerWidth,
    ),
    y: tidy(
      padding + ((maxKg - entry.weightKg) / (maxKg - minKg)) * innerHeight,
    ),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  return { points, path, minKg, maxKg };
}

export type WeightSummary = {
  latest: WeightPoint;
  first: WeightPoint;
  changeKg: number;
};

// The newest weigh-in and how far it is from the oldest one shown.
export function weightSummary(entries: WeightPoint[]): WeightSummary | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort(byDate);
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  return {
    latest,
    first,
    // So 80.4 - 82 shows as -1.6 and not -1.5999999999999943.
    changeKg:
      Math.round((latest.weightKg - first.weightKg) * STEPS_PER_KG) /
      STEPS_PER_KG,
  };
}

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

// "2026-11-24" as "Nov 24, 2026", the same on the server and in any browser.
export function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${MONTHS[month - 1]} ${date}, ${year}`;
}

// "2026-11-12" to "2025-11-12": the start of the chart's year. A 29 February
// rolls on to 1 March, as Date does.
export function yearBefore(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, "YYYY-MM-DD".length);
}
