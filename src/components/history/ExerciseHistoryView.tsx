import Link from "next/link";
import type { ExerciseHistory } from "@/lib/history/types";
import {
  LINE_BOX as BOX,
  bestSet,
  dateLabel,
  setLabel,
  topWeightLine,
} from "@/lib/history/view";

// Room around the line so the stroke at the top and bottom is not clipped.
const PAD = 4;

// Every logged set of one exercise (D29): the best set, a line of the top weight per
// workout (oldest on the left), and each workout's sets, newest first.
export function ExerciseHistoryView({
  exercise,
}: {
  exercise: ExerciseHistory;
}) {
  const best = bestSet(exercise.workouts.flatMap((workout) => workout.sets));
  const line = topWeightLine(
    [...exercise.workouts]
      .reverse()
      .map((workout) => bestSet(workout.sets)?.weightKg ?? null),
    BOX,
  );
  const lineLabel = line
    ? `Top weight per workout, ${line.min} to ${line.max} kg over ${line.count} workouts`
    : null;

  return (
    <div className="grid gap-8">
      {best && (
        <p className="m-0 text-sm">
          <span className="font-semibold">Best set:</span> {setLabel(best)}
        </p>
      )}

      {line && lineLabel && (
        <figure className="m-0">
          {/* The caption below says what the line shows; the drawing is hidden from
              screen readers so the text is not read twice. */}
          <svg
            aria-hidden="true"
            className="h-16 w-full max-w-sm text-foreground"
            viewBox={`${-PAD} ${-PAD} ${BOX.width + PAD + PAD} ${BOX.height + PAD + PAD}`}
          >
            <polyline
              fill="none"
              points={line.points}
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <figcaption className="mt-1 text-xs text-foreground/60">
            {lineLabel}
          </figcaption>
        </figure>
      )}

      <ol role="list" className="m-0 grid gap-4 p-0">
        {exercise.workouts.map((workout) => (
          <li
            className="list-none border border-foreground/15 p-4"
            key={workout.workoutId}
          >
            <Link
              className="text-sm font-semibold underline"
              href={`/history/${workout.workoutId}`}
            >
              {dateLabel(workout.startedAt)}
            </Link>
            <ol role="list" className="mt-2 mb-0 grid gap-1 p-0 text-sm">
              {workout.sets.map((set) => (
                <li className="list-none" key={set.setNumber}>
                  Set {set.setNumber}: {setLabel(set)}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      {exercise.olderHidden && (
        <p className="m-0 text-xs text-foreground/60">
          Older sets are not shown.
        </p>
      )}

      <Link className="text-sm underline" href="/history">
        ‹ All workouts
      </Link>
    </div>
  );
}
