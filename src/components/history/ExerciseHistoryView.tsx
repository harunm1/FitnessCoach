import Link from "next/link";
import type { ExerciseHistory } from "@/lib/history/types";
import { chartPoints } from "@/lib/history/chart";
import { bestSet, dateLabel, setLabel } from "@/lib/history/view";
import type { WeightUnit } from "@/lib/units/convert";
import { ExerciseChart } from "./ExerciseChart";

// Every logged set of one exercise (D29): the best set, a chart of the top weight and
// estimated 1RM per workout (oldest on the left; live bug L6), and each workout's sets,
// newest first.
export function ExerciseHistoryView({
  exercise,
  weightUnit = "KG",
}: {
  exercise: ExerciseHistory;
  weightUnit?: WeightUnit; // what the user chose (D30)
}) {
  const best = bestSet(exercise.workouts.flatMap((workout) => workout.sets));

  return (
    <div className="grid gap-8">
      {best && (
        <p className="m-0 text-sm">
          <span className="font-semibold">Best set:</span>{" "}
          {setLabel(best, weightUnit)}
        </p>
      )}

      <ExerciseChart
        points={chartPoints(exercise.workouts)}
        weightUnit={weightUnit}
      />

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
                  Set {set.setNumber}: {setLabel(set, weightUnit)}
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
