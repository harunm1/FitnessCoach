import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BodyMap from "@/components/BodyMap";
import ExerciseCueDetails from "@/components/ExerciseCueDetails";
import ExerciseLogPanel from "@/components/session/ExerciseLogPanel";
import SessionSync from "@/components/session/SessionSync";
import { latestLoggedAt } from "@/lib/workout/restRemaining";
import RunMetricsForm from "@/components/RunMetricsForm";
import LocalTime from "@/components/LocalTime";
import WorkoutElapsedTime from "@/components/WorkoutElapsedTime";
import { BODY_MAP_MUSCLE_NAMES } from "@/lib/body-map/muscles";
import { getNextPlanDayIndex } from "@/lib/workout/progression";
import { finishWorkout, startOrResumeWorkout } from "./actions";
import { requireUser } from "@/lib/auth/session";
import { formatDistance } from "@/lib/units/convert";
import { loadUnitPrefs } from "@/lib/units/prefs";
import { AccountTheme } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import theme from "@/components/theme/app-theme.module.css";
import { loadAvatarUrl } from "@/lib/photos/avatar";

export const dynamic = "force-dynamic";

export default async function SessionPage() {
  const user = await requireUser();
  const units = await loadUnitPrefs(user.id);
  // Started now so the photo link loads alongside the plan.
  const avatar = loadAvatarUrl(user.id);
  const plan = await prisma.plan.findFirst({
    where: {
      active: true,
      userId: user.id,
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
                  cues: true,
                  commonMistakes: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const bodyMapExercises = plan
    ? await prisma.exercise.findMany({
        where: {
          OR: [
            { primaryMuscles: { hasSome: [...BODY_MAP_MUSCLE_NAMES] } },
            { secondaryMuscles: { hasSome: [...BODY_MAP_MUSCLE_NAMES] } },
          ],
        },
        orderBy: { name: "asc" },
        take: 200,
        select: {
          id: true,
          name: true,
          equipment: true,
          primaryMuscles: true,
          secondaryMuscles: true,
          instructions: true,
        },
      })
    : [];
  const activeWorkout = plan
    ? await prisma.workout.findFirst({
        where: {
          userId: user.id,
          planId: plan.id,
          finishedAt: null,
        },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
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
              painDuringSession: true,
              painNextMorning: true,
              loggedAt: true,
            },
          },
        },
      })
    : null;
  const finishedWorkout =
    plan && !activeWorkout
      ? await prisma.workout.findFirst({
          where: {
            userId: user.id,
            planId: plan.id,
            finishedAt: { not: null },
          },
          orderBy: { finishedAt: "desc" },
          select: { startedAt: true, finishedAt: true, durationSeconds: true },
        })
      : null;
  const completedWorkoutCount =
    plan && !activeWorkout
      ? await prisma.workout.count({
          where: {
            userId: user.id,
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
  const renderedAtIso = new Date().toISOString();
  const loggedByExercise = new Map<
    string,
    NonNullable<typeof activeWorkout>["sets"]
  >();
  for (const set of activeWorkout?.sets ?? []) {
    const exerciseSets = loggedByExercise.get(set.exerciseId) ?? [];
    exerciseSets.push(set);
    loggedByExercise.set(set.exerciseId, exerciseSets);
  }

  const avatarUrl = await avatar;

  return (
    <AccountTheme
      className={`${theme.appTheme} min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12`}
    >
      <div className={`mx-auto max-w-7xl ${theme.readablePage}`}>
        <AppNav
          current="session"
          name={user.name}
          avatarUrl={avatarUrl}
          actions={
            <Link
              className="shrink-0 text-sm text-foreground/60 underline underline-offset-4"
              href="/onboarding"
            >
              Edit profile
            </Link>
          }
        />

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
              <div className="mb-6 border-l-2 border-foreground px-3 py-2 text-sm">
                <p className="m-0" role="status">
                  Workout in progress since{" "}
                  <LocalTime
                    iso={activeWorkout.startedAt.toISOString()}
                    kind="time"
                  />
                </p>
                <WorkoutElapsedTime
                  startedAt={activeWorkout.startedAt.toISOString()}
                />
              </div>
            ) : null}

            {finishedWorkout?.finishedAt && (
              <div className="mb-6 border-l-2 border-foreground/30 px-3 py-2">
                <p className="m-0 text-sm text-foreground/70">
                  Last workout finished{" "}
                  <LocalTime
                    iso={finishedWorkout.finishedAt.toISOString()}
                    kind="datetime"
                  />
                </p>
                <WorkoutElapsedTime
                  startedAt={finishedWorkout.startedAt.toISOString()}
                  finishedAt={finishedWorkout.finishedAt.toISOString()}
                  durationSeconds={finishedWorkout.durationSeconds}
                />
              </div>
            )}

            {activeWorkout && <SessionSync userId={user.id} />}

            {activeWorkout && (
              <p className="mb-4 text-xs text-foreground/60">
                {activeWorkout.sets.length} sets logged across this workout.
              </p>
            )}

            <section aria-label={`${sessionDay.name} exercises`}>
              <ol className="divide-y divide-foreground/15 border-y border-foreground/15">
                {sessionDay.exercises.map((slot, index) => {
                  const sets = loggedByExercise.get(slot.exerciseId) ?? [];
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
                        {slot.substitutionReason ? (
                          <p
                            className="mt-1 mb-0 text-xs font-medium text-foreground/70"
                            role="note"
                          >
                            Substitution: {slot.substitutionReason}
                          </p>
                        ) : null}
                        <p className="mt-1 mb-0 text-xs text-foreground/60 capitalize">
                          {slot.exercise.primaryMuscles.join(" · ")}
                          {slot.exercise.equipment &&
                            ` · ${slot.exercise.equipment}`}
                        </p>
                        <ExerciseCueDetails
                          exerciseName={slot.exercise.name}
                          cues={slot.exercise.cues}
                          commonMistakes={slot.exercise.commonMistakes}
                        />
                        {activeWorkout && (
                          <ExerciseLogPanel
                            equipment={slot.exercise.equipment}
                            exerciseId={slot.exerciseId}
                            exerciseName={slot.exercise.name}
                            lastLoggedAtIso={
                              sets.length > 0
                                ? latestLoggedAt(sets).toISOString()
                                : null
                            }
                            plannedSets={slot.sets}
                            restSeconds={slot.restSeconds}
                            serverNowIso={renderedAtIso}
                            serverSets={sets.map((set) => ({
                              id: set.id,
                              setNumber: set.setNumber,
                              reps: set.reps,
                              weightKg: set.weightKg?.toString() ?? null,
                              painDuringSession: set.painDuringSession,
                              painNextMorning: set.painNextMorning,
                            }))}
                            targetReps={slot.reps}
                            workoutId={activeWorkout.id}
                            weightUnit={units.weightUnit}
                          />
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

            <BodyMap exercises={bodyMapExercises} />

            {activeWorkout && (
              <section
                aria-labelledby="run-entry-title"
                className="mt-8 border-t border-foreground/15 pt-6"
              >
                <p
                  className="m-0 text-[10px] font-semibold tracking-[0.12em] text-foreground/55 uppercase"
                  data-projector-decorative="true"
                >
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
                      Saved run:{" "}
                      {formatDistance(
                        Number(activeWorkout.distanceKm),
                        units.distanceUnit,
                      )}{" "}
                      in {Math.floor(activeWorkout.durationSeconds / 60)} min{" "}
                      {activeWorkout.durationSeconds % 60} sec
                    </p>
                  )}
                <RunMetricsForm
                  distanceKm={activeWorkout.distanceKm?.toString() ?? null}
                  distanceUnit={units.distanceUnit}
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
    </AccountTheme>
  );
}
