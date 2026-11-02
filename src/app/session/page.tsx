import Link from "next/link";
import { prisma } from "@/lib/prisma";
import RestTimer from "@/components/RestTimer";
import RunMetricsForm from "@/components/RunMetricsForm";
import SetLogForm from "@/components/SetLogForm";
import { getNextPlanDayIndex } from "@/lib/workout/progression";
import { finishWorkout, startOrResumeWorkout } from "./actions";

const demoEmail = "demo@fitnesscoach.local";

export const dynamic = "force-dynamic";

export default async function SessionPage() {
  const plan = await prisma.plan.findFirst({
    where: {
      active: true,
      user: { email: demoEmail },
    },
    orderBy: { createdAt: "desc" },
    include: {
      days: {
        orderBy: { dayIndex: "asc" },
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: {
              exercise: {
                select: {
                  name: true,
                  equipment: true,
                  primaryMuscles: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const activeWorkout = plan
    ? await prisma.workout.findFirst({
        where: {
          user: { email: demoEmail },
          planId: plan.id,
          finishedAt: null,
        },
        orderBy: { startedAt: "desc" },
        select: {
          startedAt: true,
          planDayId: true,
          distanceKm: true,
          durationSeconds: true,
          sets: {
            orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
            select: {
              id: true,
              exerciseId: true,
              setNumber: true,
              reps: true,
              weightKg: true,
            },
          },
        },
      })
    : null;
  const completedWorkoutCount =
    plan && !activeWorkout
      ? await prisma.workout.count({
          where: {
            user: { email: demoEmail },
            planId: plan.id,
            finishedAt: { not: null },
          },
        })
      : 0;
  const nextDayIndex = plan
    ? getNextPlanDayIndex(completedWorkoutCount, plan.days.length)
    : null;
  const sessionDay =
    plan?.days.find((day) => day.id === activeWorkout?.planDayId) ??
    (nextDayIndex === null ? undefined : plan?.days[nextDayIndex]);
  const loggedByExercise = new Map<
    string,
    NonNullable<typeof activeWorkout>["sets"]
  >();
  for (const set of activeWorkout?.sets ?? []) {
    const exerciseSets = loggedByExercise.get(set.exerciseId) ?? [];
    exerciseSets.push(set);
    loggedByExercise.set(set.exerciseId, exerciseSets);
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex items-center justify-between border-b border-foreground/15 pb-5">
          <Link className="text-sm font-bold tracking-[0.12em]" href="/">
            FORM
          </Link>
          <Link
            className="text-xs text-foreground/60 underline underline-offset-4"
            href="/onboarding"
          >
            Edit profile
          </Link>
        </header>

        {plan && sessionDay ? (
          <>
            <div className="mb-8">
              <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 uppercase">
                {activeWorkout ? "Workout in progress" : "Next workout"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
                {sessionDay.name}
              </h1>
              <p className="mt-3 text-sm text-foreground/70">{plan.name}</p>
              <p className="mt-1 text-xs text-foreground/60">
                Day {sessionDay.dayIndex + 1} of {plan.days.length}
              </p>
            </div>

            {activeWorkout ? (
              <p
                className="mb-6 border-l-2 border-foreground px-3 py-2 text-sm"
                role="status"
              >
                Workout in progress since{" "}
                {new Intl.DateTimeFormat("en", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(activeWorkout.startedAt)}
              </p>
            ) : null}

            {activeWorkout && (
              <p className="mb-4 text-xs text-foreground/60">
                {activeWorkout.sets.length} sets logged across this workout.
              </p>
            )}

            <section aria-label={`${sessionDay.name} exercises`}>
              <ol className="divide-y divide-foreground/15 border-y border-foreground/15">
                {sessionDay.exercises.map((slot, index) => {
                  const sets = loggedByExercise.get(slot.exerciseId) ?? [];
                  const remaining = Math.max(slot.sets - sets.length, 0);
                  return (
                    <li
                      className="grid gap-3 py-5 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center"
                      key={slot.id}
                    >
                      <span className="font-mono text-xs text-foreground/50">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h2 className="m-0 text-base font-semibold">
                          {slot.exercise.name}
                        </h2>
                        <p className="mt-1 mb-0 text-xs text-foreground/60 capitalize">
                          {slot.exercise.primaryMuscles.join(" · ")}
                          {slot.exercise.equipment &&
                            ` · ${slot.exercise.equipment}`}
                        </p>
                        {activeWorkout && (
                          <>
                            <p className="mt-3 mb-0 text-xs font-medium text-foreground/70">
                              {sets.length} / {slot.sets} sets logged
                              {remaining > 0
                                ? ` · ${remaining} remaining`
                                : " · Complete"}
                            </p>
                            {sets.length > 0 && (
                              <>
                                <ul
                                  aria-label={`${slot.exercise.name} logged sets`}
                                  className="mt-2 flex flex-wrap gap-2 p-0"
                                >
                                  {sets.map((set) => (
                                    <li
                                      className="list-none border border-foreground/15 bg-white px-2 py-1 text-[11px] text-foreground/70"
                                      key={set.id}
                                    >
                                      Set {set.setNumber}: {set.reps} reps
                                      {set.weightKg !== null &&
                                        ` · ${set.weightKg.toString()} kg`}
                                    </li>
                                  ))}
                                </ul>
                                <RestTimer
                                  exerciseName={slot.exercise.name}
                                  restSeconds={slot.restSeconds}
                                />
                              </>
                            )}
                            {remaining > 0 && (
                              <SetLogForm
                                exerciseId={slot.exerciseId}
                                nextSetNumber={sets.length + 1}
                                targetReps={slot.reps}
                              />
                            )}
                          </>
                        )}
                      </div>
                      <p className="m-0 text-sm text-foreground/70 sm:text-right">
                        {slot.sets} sets × {slot.reps} reps
                        <span className="block text-xs text-foreground/50">
                          {slot.restSeconds}s rest
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>

            {activeWorkout && (
              <section
                aria-labelledby="run-entry-title"
                className="mt-8 border-t border-foreground/15 pt-6"
              >
                <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-foreground/55 uppercase">
                  Optional workout entry
                </p>
                <h2
                  className="mt-2 mb-0 text-lg font-semibold"
                  id="run-entry-title"
                >
                  Running distance and time
                </h2>
                {activeWorkout.distanceKm !== null &&
                  activeWorkout.durationSeconds !== null && (
                    <p className="mt-2 mb-0 text-sm text-foreground/70">
                      Saved run: {activeWorkout.distanceKm.toString()} km in{" "}
                      {Math.floor(activeWorkout.durationSeconds / 60)} min{" "}
                      {activeWorkout.durationSeconds % 60} sec
                    </p>
                  )}
                <RunMetricsForm
                  distanceKm={activeWorkout.distanceKm?.toString() ?? null}
                  durationSeconds={activeWorkout.durationSeconds}
                />
              </section>
            )}

            <p className="mt-6 text-xs text-foreground/60">
              {activeWorkout
                ? "Resume this session or finish it when you are done."
                : "Your next plan day is ready when you are."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <form action={startOrResumeWorkout}>
                <button
                  className="min-h-12 bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
                  type="submit"
                >
                  {activeWorkout
                    ? "Resume workout"
                    : completedWorkoutCount > 0
                      ? "Start next workout"
                      : "Start workout"}
                </button>
              </form>
              {activeWorkout && (
                <form action={finishWorkout}>
                  <button
                    className="min-h-12 border border-foreground/25 px-5 text-sm font-semibold transition-colors hover:bg-foreground/5"
                    type="submit"
                  >
                    Finish workout
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <section className="py-10">
            <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 uppercase">
              No plan saved yet
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              Set up your profile first
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-foreground/70">
              Complete the quiz to create a starter plan for your week.
            </p>
            <Link
              className="mt-6 inline-flex min-h-11 items-center bg-foreground px-5 text-sm font-semibold text-background"
              href="/onboarding"
            >
              Go to quiz
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
