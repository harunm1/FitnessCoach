import {
  dayLabel,
  weightChart,
  type WeightPoint,
} from "@/lib/progress/weightChart";

const SIZE = { width: 600, height: 200, padding: 16 };

// A line of the user's weigh-ins over time, oldest on the left (D24). Plain
// SVG drawn on the server. For screen readers the label gives the first and
// last weigh-ins and the caption the lightest and heaviest; the section's list
// gives the five latest as text.
export default function WeightChart({ entries }: { entries: WeightPoint[] }) {
  const chart = weightChart(entries, SIZE);
  if (!chart) return null;
  const first = chart.points[0];
  const last = chart.points[chart.points.length - 1];
  return (
    <figure className="m-0 grid gap-1">
      <svg
        role="img"
        aria-label={`Body weight from ${dayLabel(first.date)} to ${dayLabel(last.date)}: ${first.weightKg} kg to ${last.weightKg} kg`}
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        className="h-auto w-full border border-foreground/15"
      >
        <path
          d={chart.path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {chart.points.map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r={4}
            fill="currentColor"
          />
        ))}
      </svg>
      <figcaption className="flex justify-between text-xs text-foreground/60">
        <span>{dayLabel(first.date)}</span>
        <span>
          Lightest {chart.lowestKg} kg, heaviest {chart.highestKg} kg
        </span>
        <span>{dayLabel(last.date)}</span>
      </figcaption>
    </figure>
  );
}
