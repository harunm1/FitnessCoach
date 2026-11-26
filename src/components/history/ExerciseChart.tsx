import { niceScale, tickDates, type ChartPoint } from "@/lib/history/chart";
import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";
import {
  formatWeight,
  fromKg,
  weightLabel,
  type WeightUnit,
} from "@/lib/units/convert";

// The exercise's progress over its workouts (live bug L6, 25 Nov 2026): the top weight and the
// estimated one-rep max of each workout, oldest on the left, with the best of each marked.
// Drawn in a phone-sized box (360 x 280, so about 270 px tall on a phone) and scaled up on a
// wider screen. Every colour is currentColor at an opacity, so it follows the light and dark
// themes; the two lines also differ in shape (round and square markers), not only in weight.
const BOX = { width: 360, height: 280 };
const MARGIN = { top: 22, right: 12, bottom: 34, left: 46 };
const PLOT = {
  width: BOX.width - MARGIN.left - MARGIN.right,
  height: BOX.height - MARGIN.top - MARGIN.bottom,
};
const MARKER = 3.5;
const SQUARE = MARKER * 1.6;
const HIT_RADIUS = 12;
const FONT = 11;
const NO_VALUE = "–";

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});

const round = (value: number) => Math.round(value * 10) / 10;

export function ExerciseChart({
  points,
  weightUnit,
}: {
  points: ChartPoint[];
  weightUnit: WeightUnit;
}) {
  const withTop = points.filter((point) => point.topKg !== null);
  if (withTop.length < 2) return null;

  const shown = (kg: number) => fromKg(kg, weightUnit);
  const tops = withTop.map((point) => shown(point.topKg as number));
  const estimates = points.map((point) =>
    point.e1rmKg === null ? null : shown(point.e1rmKg),
  );
  const known = estimates.filter((value): value is number => value !== null);
  const scale = niceScale([...tops, ...known]);
  const x = (index: number) =>
    MARGIN.left + (index / (points.length - 1)) * PLOT.width;
  const y = (value: number) => MARGIN.top + scale.toY(value, PLOT.height);
  const at = (index: number, value: number) =>
    `${round(x(index))},${round(y(value))}`;

  const topPath = points.flatMap((point, index) =>
    point.topKg === null ? [] : [at(index, shown(point.topKg))],
  );
  const estimatePath = estimates.flatMap((value, index) =>
    value === null ? [] : [at(index, value)],
  );
  const bestTop = Math.max(...tops);
  const bestEstimate = known.length > 0 ? Math.max(...known) : null;
  const unit = weightLabel(weightUnit);
  const labelled = tickDates(points.length);
  const lowest = Math.min(...tops);
  const description = `Top weight and estimated 1RM over ${points.length} workouts, ${lowest} to ${bestTop} ${unit}`;
  const anchorFor = (index: number) => {
    if (index === 0) return "start";
    return index === points.length - 1 ? "end" : "middle";
  };

  return (
    <figure className="m-0 grid max-w-md gap-2">
      <svg
        aria-label={description}
        className="block h-auto min-h-60 w-full text-foreground"
        role="img"
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      >
        <text fill="currentColor" fontSize={FONT} opacity="0.75" x={2} y={11}>
          {`Weight (${unit})`}
        </text>
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line
              opacity="0.15"
              stroke="currentColor"
              x1={MARGIN.left}
              x2={BOX.width - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              dominantBaseline="middle"
              fill="currentColor"
              fontSize={FONT}
              opacity="0.75"
              textAnchor="end"
              x={MARGIN.left - 6}
              y={y(tick)}
            >
              {tick}
            </text>
          </g>
        ))}
        {labelled.map((index) => (
          <text
            fill="currentColor"
            fontSize={FONT}
            key={index}
            opacity="0.75"
            textAnchor={anchorFor(index)}
            x={x(index)}
            y={BOX.height - 10}
          >
            {DATE_FORMAT.format(points[index].date)}
          </text>
        ))}

        <line
          opacity="0.6"
          stroke="currentColor"
          strokeDasharray="4 3"
          x1={MARGIN.left}
          x2={BOX.width - MARGIN.right}
          y1={y(bestTop)}
          y2={y(bestTop)}
        />
        <text
          fill="currentColor"
          fontSize={FONT}
          opacity="0.9"
          textAnchor="end"
          x={BOX.width - MARGIN.right}
          y={y(bestTop) + 13}
        >
          {`Best set ${bestTop} ${unit}`}
        </text>
        {bestEstimate !== null && (
          <>
            <line
              opacity="0.6"
              stroke="currentColor"
              strokeDasharray="1 3"
              x1={MARGIN.left}
              x2={BOX.width - MARGIN.right}
              y1={y(bestEstimate)}
              y2={y(bestEstimate)}
            />
            <text
              fill="currentColor"
              fontSize={FONT}
              opacity="0.9"
              textAnchor="end"
              x={BOX.width - MARGIN.right}
              y={y(bestEstimate) - 4}
            >
              {`Best est. 1RM ${bestEstimate} ${unit}`}
            </text>
          </>
        )}

        {estimatePath.length > 1 && (
          <polyline
            fill="none"
            opacity="0.7"
            points={estimatePath.join(" ")}
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.75"
          />
        )}
        <polyline
          fill="none"
          points={topPath.join(" ")}
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        {points.map((point, index) => {
          const top = point.topKg === null ? null : shown(point.topKg);
          const estimate = estimates[index];
          const topText =
            point.topKg === null
              ? "bodyweight"
              : formatWeight(point.topKg, weightUnit);
          const estimateText =
            point.e1rmKg === null
              ? ""
              : `, estimated 1RM ${formatWeight(point.e1rmKg, weightUnit)}`;
          return (
            <g key={point.workoutId}>
              <title>{`${DATE_FORMAT.format(point.date)}: top set ${topText}${estimateText}`}</title>
              {estimate !== null && (
                <rect
                  fill="currentColor"
                  height={SQUARE}
                  opacity="0.7"
                  width={SQUARE}
                  x={x(index) - SQUARE / 2}
                  y={y(estimate) - SQUARE / 2}
                />
              )}
              {top !== null && (
                <circle
                  cx={x(index)}
                  cy={y(top)}
                  fill="currentColor"
                  r={MARKER}
                />
              )}
              <circle
                cx={x(index)}
                cy={y(top ?? estimate ?? scale.ticks[0])}
                fill="transparent"
                r={HIT_RADIUS}
              />
            </g>
          );
        })}
      </svg>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">
          Values by workout
        </summary>
        <table
          aria-label="Values by workout"
          className="w-full border-collapse text-left"
        >
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Top set</th>
              <th scope="col">Est. 1RM</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.workoutId}>
                <th scope="row">{DATE_FORMAT.format(point.date)}</th>
                <td>
                  {point.topKg === null
                    ? "bodyweight"
                    : formatWeight(point.topKg, weightUnit)}
                </td>
                <td>
                  {point.e1rmKg === null
                    ? NO_VALUE
                    : formatWeight(point.e1rmKg, weightUnit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70">
        <span>
          <span aria-hidden="true">● </span>Top weight
        </span>
        <span>
          <span aria-hidden="true">■ </span>Estimated 1RM (Epley, sets of up to
          10 reps)
        </span>
      </figcaption>
    </figure>
  );
}
