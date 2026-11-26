import Link from "next/link";
import { minutesLabel } from "@/lib/workout/duration";
import type { WorkoutDetail } from "@/lib/history/types";
import { dateLabel } from "@/lib/history/view";
import { duration } from "@/lib/progress/view";
import {
  formatDistance,
  formatPace,
  fromKg,
  STORED_UNITS,
  weightLabel,
  type UnitPrefs,
} from "@/lib/units/convert";

// One finished workout in full (D29, laid out again for live bug L5, 25 Nov 2026): a header
// with the date, duration, volume and records, the run, one card per exercise with its sets as
// a table (set, weight, reps, RPE when logged) and a link to the exercise's history, and the
// notes. The shape follows the end-of-workout summaries in docs/COMPETITORS.md.
const dash = "—";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border border-foreground/15 p-3">
      <dt className="text-xs text-foreground/60">{label}</dt>
      <dd className="m-0 text-lg font-semibold">{value}</dd>
    </div>
  );
}
export function WorkoutDetailView({
  workout,
  units = STORED_UNITS,
}: {
  workout: WorkoutDetail;
  units?: UnitPrefs; // what the user chose (D30); the numbers are stored in kg and km
}) {
  const runPace = workout.run
    ? formatPace(
        workout.run.distanceKm,
        workout.run.seconds,
        units.distanceUnit,
      )
    : null;
  const unit = units.weightUnit;
  const setCount = workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0,
  );
  const volume = `${fromKg(workout.volumeKg, unit).toLocaleString("en-CA")} ${weightLabel(unit)}`;
  return (
    <div className="grid gap-8">
      <section aria-label="Summary" className="grid gap-3">
        <p className="m-0 text-sm text-foreground/70">
          {dateLabel(workout.startedAt)}
          {workout.imported && (
            <span className="ml-2 border border-foreground/30 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              Imported
            </span>
          )}
        </p>
        <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Duration" value={minutesLabel(workout.minutes)} />
          <Stat label="Volume" value={volume} />
          <Stat label="Sets" value={String(setCount)} />
          <Stat
            label="Records"
            value={String(workout.recordExerciseIds.length)}
          />
        </dl>
      </section>

      {workout.run && (
        <section aria-labelledby="run-title">
          <h2 className="m-0 text-lg font-semibold" id="run-title">
            Run
          </h2>
          <p className="mt-2 mb-0 text-sm">
            {formatDistance(workout.run.distanceKm, units.distanceUnit)} in{" "}
            {duration(workout.run.seconds)}
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
            {workout.exercises.map((exercise) => {
              const hasRpe = exercise.sets.some((set) => set.rpe !== null);
              const isRecord = workout.recordExerciseIds.includes(exercise.id);
              return (
                <li
                  className="list-none border border-foreground/15 p-4"
                  key={exercise.id}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      className="text-base font-semibold underline"
                      href={`/history/exercise/${encodeURIComponent(exercise.id)}`}
                    >
                      {exercise.name}
                    </Link>
                    {isRecord && (
                      <span className="border border-foreground px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                        Record
                      </span>
                    )}
                  </div>
                  <table className="mt-3 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-foreground/15 text-left text-xs text-foreground/60">
                        <th className="py-1 pr-3 font-medium" scope="col">
                          Set
                        </th>
                        <th className="py-1 pr-3 font-medium" scope="col">
                          Weight ({weightLabel(unit)})
                        </th>
                        <th className="py-1 pr-3 font-medium" scope="col">
                          Reps
                        </th>
                        {hasRpe && (
                          <th className="py-1 font-medium" scope="col">
                            RPE
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {exercise.sets.map((set) => (
                        <tr
                          className="border-b border-foreground/10 last:border-0"
                          key={set.setNumber}
                        >
                          <td className="py-1.5 pr-3">{set.setNumber}</td>
                          <td className="py-1.5 pr-3">
                            {set.weightKg === null
                              ? dash
                              : fromKg(set.weightKg, unit)}
                          </td>
                          <td className="py-1.5 pr-3">{set.reps}</td>
                          {hasRpe && (
                            <td className="py-1.5">{set.rpe ?? dash}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              );
            })}
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
