import Link from "next/link";
import { redirect } from "next/navigation";
import { weekdayLabel } from "@/lib/programs/weekdays";
import { prisma } from "@/lib/prisma";
import ExerciseCueDetails from "@/components/ExerciseCueDetails";
import ExerciseCard from "@/components/session/ExerciseCard";
import CheckInPanel from "@/components/session/CheckInPanel";
import SessionSync from "@/components/session/SessionSync";
import WorkoutBar from "@/components/session/WorkoutBar";
import { latestLoggedAt } from "@/lib/workout/restRemaining";
import { loadPreviousSets } from "@/lib/workout/previousSets";
import { loadOpenWorkout } from "@/lib/workout/loadOpenWorkout";
import { parseWorkoutId, SESSION_LANDING } from "@/lib/workout/sessionPaths";
import { requireUser } from "@/lib/auth/session";
import { loadUnitPrefs } from "@/lib/units/prefs";
import { loadWorkingWeightsFor } from "@/lib/trainingProfile/load";
import { AccountTheme } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import theme from "@/components/theme/app-theme.module.css";
import { loadAvatarUrl } from "@/lib/photos/avatar";

export const dynamic = "force-dynamic";

const ORDINAL_WIDTH = 2;

// One workout and nothing else (D43): its exercises in order with their sets, the rest
// timer and cues, and the bar fixed to the bottom with the clock, Pause and Finish.
export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const workoutId = parseWorkoutId((await params).id);
  const workout =
    workoutId === null
      ? null
      : await loadOpenWorkout(prisma, user.id, workoutId);
  // A missing, finished or another user's workout all land on the landing.
  if (!workout?.planDay) redirect(SESSION_LANDING);

  const day = workout.planDay;
  const units = await loadUnitPrefs(user.id);
  const avatarUrl = await loadAvatarUrl(user.id);
  const workingWeights = await loadWorkingWeightsFor(
    prisma,
    user.id,
    day.exercises.map((slot) => slot.exerciseId),
  );
  const previousSets = await loadPreviousSets(
    prisma,
    user.id,
    day.exercises.map((slot) => slot.exerciseId),
  );
  const renderedAtIso = new Date().toISOString();
  const loggedByExercise = workout.sets.reduce(
    (grouped, set) =>
      grouped.set(set.exerciseId, [
        ...(grouped.get(set.exerciseId) ?? []),
        set,
      ]),
    new Map<string, typeof workout.sets>(),
  );

  return (
    <AccountTheme
      // Bottom padding keeps the last card clear of the fixed bar.
      className={`${theme.appTheme} min-h-screen bg-background px-5 pt-8 pb-40 text-foreground sm:px-8 sm:pt-12`}
    >
      <div className={`mx-auto max-w-7xl ${theme.readablePage}`}>
        <AppNav
          current="session"
          name={user.name}
          avatarUrl={avatarUrl}
          actions={null}
        />

        <div className="mb-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 uppercase">
            Workout in progress
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
            {day.name}
          </h1>
          <p className="mt-2 text-xs text-foreground/60">
            {workout.plan?.name} · Day {day.dayIndex + 1}
            {day.weekdays.length > 0 ? ` · ${weekdayLabel(day.weekdays)}` : ""}
          </p>
          <Link
            className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            href="/coach"
          >
            Ask the coach
          </Link>
        </div>

        <SessionSync userId={user.id} />
        <CheckInPanel workoutId={workout.id} />

        <section aria-label={`${day.name} exercises`}>
          <ol className="divide-y divide-foreground/15 border-y border-foreground/15">
            {day.exercises.map((slot, index) => {
              const sets = loggedByExercise.get(slot.exerciseId) ?? [];
              return (
                <li className="grid gap-3 py-5" key={slot.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-foreground/50">
                        {String(index + 1).padStart(ORDINAL_WIDTH, "0")}
                      </span>
                      <h2 className="m-0 text-base font-semibold">
                        {slot.exercise.name}
                      </h2>
                    </div>
                    <p className="m-0 shrink-0 text-sm text-foreground/70">
                      {slot.sets} × {slot.reps}
                      <span className="ml-2 text-xs text-foreground/50">
                        {slot.restSeconds}s rest
                      </span>
                    </p>
                  </div>
                  {slot.substitutionReason ? (
                    <p
                      className="m-0 text-xs font-medium text-foreground/70"
                      role="note"
                    >
                      Substitution: {slot.substitutionReason}
                    </p>
                  ) : null}
                  <p className="m-0 text-xs text-foreground/60 capitalize">
                    {slot.exercise.primaryMuscles.join(" · ")}
                    {slot.exercise.equipment && ` · ${slot.exercise.equipment}`}
                  </p>
                  <ExerciseCueDetails
                    exerciseName={slot.exercise.name}
                    cues={slot.exercise.cues}
                    commonMistakes={slot.exercise.commonMistakes}
                  />
                  <div>
                    <ExerciseCard
                      key={`${slot.exerciseId}-${units.weightUnit}`}
                      previous={previousSets.get(slot.exerciseId) ?? []}
                      primaryMuscle={slot.exercise.primaryMuscles[0] ?? null}
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
                      suggestedWeightKg={
                        workingWeights.get(slot.exerciseId) ?? null
                      }
                      targetReps={slot.reps}
                      workoutId={workout.id}
                      weightUnit={units.weightUnit}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <WorkoutBar
          workoutId={workout.id}
          bankedSeconds={workout.activeBankedSeconds}
          activeSinceIso={workout.activeSince?.toISOString() ?? null}
          lastSetAtIso={
            workout.sets.length > 0
              ? latestLoggedAt(workout.sets).toISOString()
              : null
          }
          serverNowIso={renderedAtIso}
        />
      </div>
    </AccountTheme>
  );
}
