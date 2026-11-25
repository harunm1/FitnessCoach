import {
  dayLabel,
  weightChart,
  type WeightPoint,
} from "@/lib/progress/weightChart";

import { formatBodyWeight, type WeightUnit } from "@/lib/units/convert";

const SIZE = { width: 600, height: 200, padding: 16 };

// A line of the user's weigh-ins over time, oldest on the left (D24). Plain
// SVG drawn on the server. For screen readers the label gives the first and
// last weigh-ins and the caption the lightest and heaviest; the section's list
// gives the five latest as text.
export default function WeightChart({
  entries,
  weightUnit = "KG",
}: {
  entries: WeightPoint[];
  weightUnit?: WeightUnit;
}) {
  const chart = weightChart(entries, SIZE);
  if (!chart) return null;
  const first = chart.points[0];
  const last = chart.points[chart.points.length - 1];
  return (
    <figure className="m-0 grid gap-1">
      <svg
        role="img"
        aria-label={`Body weight from ${dayLabel(first.date)} to ${dayLabel(last.date)}: ${formatBodyWeight(first.weightKg, weightUnit)} to ${formatBodyWeight(last.weightKg, weightUnit)}`}
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
          Lightest {formatBodyWeight(chart.lowestKg, weightUnit)}, heaviest{" "}
          {formatBodyWeight(chart.highestKg, weightUnit)}
        </span>
        <span>{dayLabel(last.date)}</span>
      </figcaption>
    </figure>
  );
}
