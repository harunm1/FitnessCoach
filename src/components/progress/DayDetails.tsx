import type { ExerciseGroup } from "@/lib/progress/view";

export type DayWorkout = {
  id: number;
  name: string;
  startTime: string; // "6:00 PM"
  minutes: number;
  exercises: ExerciseGroup[];
  run: { distanceKm: number; time: string; pace: string | null } | null;
};

type DayDetailsProps = {
  dayLabel: string | null; // "Sunday, November 8"; null when no day is selected
  workouts: DayWorkout[];
};

// Everything logged on the selected day (#16): each workout's name and length, its
// sets grouped by exercise, and the run if one was logged.
export default function DayDetails({ dayLabel, workouts }: DayDetailsProps) {
  if (!dayLabel) {
    return (
      <p className="m-0 text-sm text-foreground/60">
        Tap a day in the calendar to see its workout.
      </p>
    );
  }
  return (
    <section aria-labelledby="day-title">
      <h2 className="m-0 text-lg font-semibold" id="day-title">
        {dayLabel}
      </h2>
      {workouts.length === 0 ? (
        <p className="mt-2 mb-0 text-sm text-foreground/60">
          No workout this day.
        </p>
      ) : (
        <ul className="mt-3 grid gap-4 p-0">
          {workouts.map((workout) => (
            <li
              className="list-none border border-foreground/15 p-4"
              key={workout.id}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="m-0 text-base font-semibold">{workout.name}</h3>
                <p className="m-0 text-xs text-foreground/60">
                  {workout.startTime} · {workout.minutes} min
                </p>
              </div>
              {workout.run && (
                <p className="mt-2 mb-0 text-sm">
                  Run: {workout.run.distanceKm} km in {workout.run.time}
                  {workout.run.pace && ` · ${workout.run.pace}`}
                </p>
              )}
              {workout.exercises.length > 0 && (
                <ul className="mt-3 grid gap-2 p-0">
                  {workout.exercises.map((exercise) => (
                    <li className="list-none text-sm" key={exercise.name}>
                      <span className="font-medium">{exercise.name}</span>
                      <span className="block text-xs text-foreground/60">
                        {exercise.sets
                          .map(
                            (set) =>
                              `${set.reps} reps${set.weightKg === null ? "" : ` × ${set.weightKg} kg`}`,
                          )
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
