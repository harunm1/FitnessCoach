import Link from "next/link";
import type { WorkoutDetail } from "@/lib/history/types";
import { dateLabel, setLabel } from "@/lib/history/view";
import { duration, pace } from "@/lib/progress/view";

// One finished workout in full (D28): when and how long, the run, every exercise
// with each set (reps, kg, RPE), and the notes.
export function WorkoutDetailView({ workout }: { workout: WorkoutDetail }) {
  const runPace = workout.run
    ? pace(workout.run.distanceKm, workout.run.seconds)
    : null;
  return (
    <div className="grid gap-8">
      <p className="m-0 text-sm text-foreground/70">
        {dateLabel(workout.startedAt)} · {workout.minutes} min
        {workout.imported && (
          <span className="ml-2 border border-foreground/30 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Imported
          </span>
        )}
      </p>

      {workout.run && (
        <section aria-labelledby="run-title">
          <h2 className="m-0 text-lg font-semibold" id="run-title">
            Run
          </h2>
          <p className="mt-2 mb-0 text-sm">
            {workout.run.distanceKm} km in {duration(workout.run.seconds)}
            {runPace && ` · ${runPace}`}
            {workout.run.rpe !== null && ` · RPE ${workout.run.rpe}`}
          </p>
        </section>
      )}

      {workout.exercises.length > 0 && (
        <section aria-labelledby="exercises-title">
          <h2 className="m-0 text-lg font-semibold" id="exercises-title">
            Exercises
          </h2>
          <ul role="list" className="mt-3 grid gap-4 p-0">
            {workout.exercises.map((exercise) => (
              <li
                className="list-none border border-foreground/15 p-4"
                key={exercise.id}
              >
                <Link
                  className="text-base font-semibold underline"
                  href={`/history/exercise/${encodeURIComponent(exercise.id)}`}
                >
                  {exercise.name}
                </Link>
                <ol role="list" className="mt-2 mb-0 grid gap-1 p-0 text-sm">
                  {exercise.sets.map((set) => (
                    <li className="list-none" key={set.setNumber}>
                      Set {set.setNumber}: {setLabel(set)}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      )}

      {workout.notes && (
        <section aria-labelledby="notes-title">
          <h2 className="m-0 text-lg font-semibold" id="notes-title">
            Notes
          </h2>
          <p className="mt-2 mb-0 text-sm whitespace-pre-line">
            {workout.notes}
          </p>
        </section>
      )}

      {workout.exercises.length === 0 && !workout.run && (
        <p className="m-0 text-sm text-foreground/60">
          No sets were logged in this workout.
        </p>
      )}

      <Link className="text-sm underline" href="/history">
        ‹ All workouts
      </Link>
    </div>
  );
}
