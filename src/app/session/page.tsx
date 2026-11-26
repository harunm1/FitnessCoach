import Link from "next/link";
import { redirect } from "next/navigation";
import { weekdayLabel } from "@/lib/programs/weekdays";
import { prisma } from "@/lib/prisma";
import BodyMap from "@/components/BodyMap";
import LocalTime from "@/components/LocalTime";
import WorkoutElapsedTime from "@/components/WorkoutElapsedTime";
import { BODY_MAP_MUSCLE_NAMES } from "@/lib/body-map/muscles";
import { getNextPlanDayIndex } from "@/lib/workout/progression";
import { workoutPath } from "@/lib/workout/sessionPaths";
import { startOrResumeWorkout } from "./actions";
import { requireUser } from "@/lib/auth/session";
import { AccountTheme } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import theme from "@/components/theme/app-theme.module.css";
import { loadAvatarUrl } from "@/lib/photos/avatar";

export const dynamic = "force-dynamic";

const BODY_MAP_EXERCISE_LIMIT = 200;
const ORDINAL_WIDTH = 2;

// The landing (D46): the next workout, Start, the last workout, Explore by muscle and a
// way to log a run. A workout that is open is on its own page, so this redirects there.
export default async function SessionPage() {
  const user = await requireUser();
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
          userId: user.id,
          planId: plan.id,
          finishedAt: null,
          // The workout page needs its plan day; without one it would send the user back.
          planDay: { isNot: null },
        },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      })
    : null;
  if (activeWorkout) redirect(workoutPath(activeWorkout.id));

  const bodyMapExercises = plan
    ? await prisma.exercise.findMany({
        where: {
          OR: [
            { primaryMuscles: { hasSome: [...BODY_MAP_MUSCLE_NAMES] } },
            { secondaryMuscles: { hasSome: [...BODY_MAP_MUSCLE_NAMES] } },
          ],
        },
        orderBy: { name: "asc" },
        take: BODY_MAP_EXERCISE_LIMIT,
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
  const finishedWorkout = plan
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
  const completedWorkoutCount = plan
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
    nextDayIndex === null ? undefined : plan?.days[nextDayIndex];

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
                Next workout
              </p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
                {sessionDay.name}
              </h1>
              <p className="mt-3 text-sm text-foreground/70">{plan.name}</p>
              <p className="mt-1 text-xs text-foreground/60">
                Day {sessionDay.dayIndex + 1} of {plan.days.length}
                {sessionDay.weekdays.length > 0
                  ? ` · ${weekdayLabel(sessionDay.weekdays)}`
                  : ""}
              </p>
            </div>

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

            <section aria-label={`${sessionDay.name} exercises`}>
              <ol className="divide-y divide-foreground/15 border-y border-foreground/15">
                {sessionDay.exercises.map((slot, index) => (
                  <li
                    className="grid gap-1 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center"
                    key={slot.id}
                  >
                    <span className="font-mono text-xs text-foreground/50">
                      {String(index + 1).padStart(ORDINAL_WIDTH, "0")}
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
                    </div>
                    <p className="m-0 text-sm text-foreground/70 sm:text-right">
                      {slot.sets} sets × {slot.reps} reps
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <form action={startOrResumeWorkout}>
                <button
                  className="min-h-12 bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
                  type="submit"
                >
                  {completedWorkoutCount > 0
                    ? "Start next workout"
                    : "Start workout"}
                </button>
              </form>
              <Link
                className="inline-flex min-h-12 items-center text-sm underline underline-offset-4"
                href="/progress#run-log"
              >
                Log a run
              </Link>
            </div>

            <BodyMap exercises={bodyMapExercises} />
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
