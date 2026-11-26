"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  setLogSchema,
  type SetLogActionState,
} from "@/lib/workout/setLogSchema";
import { getSetLogOperation } from "@/lib/workout/setLogOperation";
import {
  runMetricsSchema,
  type RunMetricsActionState,
} from "@/lib/workout/runMetricsSchema";
import { getNextPlanDayIndex } from "@/lib/workout/progression";
import { SESSION_LANDING, workoutPath } from "@/lib/workout/sessionPaths";
import { finishedActiveSeconds } from "@/lib/workout/activeTime";
import {
  clockOf,
  findOpenClockWorkout,
  latestSetMs,
} from "@/lib/workout/openClock";
import { requireUser } from "@/lib/auth/session";
import { painTrafficLight } from "@/lib/coach/painTrafficLight";
import {
  DISTANCE_UNIT_MESSAGE,
  WEIGHT_UNIT_MESSAGE,
  distanceFieldToKm,
  readDistanceUnit,
  readWeightUnit,
  weightFieldToKg,
} from "@/lib/units/input";

export async function saveRunMetrics(
  _previousState: RunMetricsActionState,
  formData: FormData,
): Promise<RunMetricsActionState> {
  const user = await requireUser();
  const distanceUnit = readDistanceUnit(formData);
  if (!distanceUnit) {
    return { status: "error", message: DISTANCE_UNIT_MESSAGE };
  }
  const parsed = runMetricsSchema.safeParse({
    // Typed in the unit the form showed; stored in km (D30).
    distanceKm: distanceFieldToKm(formData.get("distanceKm"), distanceUnit),
    durationMinutes: formData.get("durationMinutes"),
    durationSeconds: formData.get("durationSeconds"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Enter valid running details.",
    };
  }

  const workout = await prisma.workout.findFirst({
    where: {
      userId: user.id,
      finishedAt: null,
      plan: { userId: user.id, active: true },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (!workout) {
    return {
      status: "error",
      message: "Start a workout before saving running details.",
    };
  }

  try {
    await prisma.workout.update({
      where: {
        id: workout.id,
        userId: user.id,
        finishedAt: null,
        plan: { userId: user.id, active: true },
      },
      data: {
        distanceKm: new Prisma.Decimal(parsed.data.distanceKm),
        durationSeconds:
          parsed.data.durationMinutes * 60 + parsed.data.durationSeconds,
      },
    });
  } catch {
    return {
      status: "error",
      message: "Could not save your run. Please try again.",
    };
  }

  revalidatePath(workoutPath(workout.id));
  redirect(workoutPath(workout.id));
}

export async function logSet(
  exerciseId: string,
  _previousState: SetLogActionState,
  formData: FormData,
): Promise<SetLogActionState> {
  const user = await requireUser();
  const weightUnit = readWeightUnit(formData);
  if (!weightUnit) {
    return { status: "error", message: WEIGHT_UNIT_MESSAGE };
  }
  const parsed = setLogSchema.safeParse({
    setNumber: formData.get("setNumber"),
    reps: formData.get("reps"),
    painDuringSession: formData.get("painDuringSession"),
    painNextMorning: formData.get("painNextMorning"),
    // Typed in the unit the form showed; stored in kg (D30).
    weightKg: weightFieldToKg(formData.get("weightKg"), weightUnit),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Enter valid set details.",
    };
  }

  const during = parsed.data.painDuringSession ?? 0;
  const nextMorning = parsed.data.painNextMorning ?? 0;
  const traffic = painTrafficLight(during, nextMorning);

  let result: SetLogActionState | null;
  let workoutId = 0;
  try {
    result = await prisma.$transaction(
      async (tx): Promise<SetLogActionState | null> => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
        const workout = await tx.workout.findFirst({
          where: {
            userId: user.id,
            finishedAt: null,
            plan: { userId: user.id, active: true },
            planDay: { plan: { userId: user.id } },
          },
          orderBy: { startedAt: "desc" },
          include: {
            planDay: {
              include: {
                exercises: { where: { exerciseId }, select: { sets: true } },
              },
            },
            sets: {
              where: { exerciseId },
              select: {
                setNumber: true,
                painDuringSession: true,
                painNextMorning: true,
              },
            },
          },
        });
        const plannedExercise = workout?.planDay?.exercises[0];
        if (workout) workoutId = workout.id;
        if (!workout || !plannedExercise) {
          return {
            status: "error",
            message: "Start a workout before logging sets for this exercise.",
          };
        }
        const operation = getSetLogOperation(
          parsed.data.setNumber,
          workout.sets.map((set) => set.setNumber),
          plannedExercise.sets,
        );
        if (!operation) {
          return {
            status: "error",
            message:
              "That set is out of date. Refresh the session and try again.",
          };
        }
        const existingStop = workout.sets.some(
          (set) =>
            painTrafficLight(
              set.painDuringSession ?? 0,
              set.painNextMorning ?? 0,
            ).state === "stop",
        );
        if (existingStop && operation === "create") {
          return {
            status: "error",
            message:
              "This exercise is blocked by a recorded stop-range pain score. Correct an incorrectly entered score before logging another set.",
          };
        }

        const weightKg =
          parsed.data.weightKg === undefined
            ? null
            : new Prisma.Decimal(parsed.data.weightKg);
        const painScores = {
          painDuringSession: parsed.data.painDuringSession ?? null,
          painNextMorning: parsed.data.painNextMorning ?? null,
        };
        await tx.setLog.upsert({
          where: {
            workoutId_exerciseId_setNumber: {
              workoutId: workout.id,
              exerciseId,
              setNumber: parsed.data.setNumber,
            },
            workout: { userId: user.id },
          },
          create: {
            workoutId: workout.id,
            exerciseId,
            setNumber: parsed.data.setNumber,
            reps: parsed.data.reps,
            weightKg,
            ...painScores,
          },
          update: { reps: parsed.data.reps, weightKg, ...painScores },
        });
        return null;
      },
    );
  } catch {
    return {
      status: "error",
      message: "Could not save this set. Refresh the page and try again.",
    };
  }

  if (result) return result;
  revalidatePath(workoutPath(workoutId));
  if (traffic.state === "stop") {
    return {
      status: "error",
      message: `${traffic.reason} This set was saved, and further sets for this exercise are blocked.`,
    };
  }
  redirect(workoutPath(workoutId));
}

export async function startOrResumeWorkout() {
  const user = await requireUser();

  const plan = await prisma.plan.findFirst({
    where: { userId: user.id, active: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      days: {
        orderBy: { dayIndex: "asc" },
        select: { id: true },
      },
    },
  });
  if (!plan || plan.days.length === 0) redirect("/onboarding");

  const existingWorkout = await prisma.workout.findFirst({
    where: {
      userId: user.id,
      planId: plan.id,
      finishedAt: null,
      planDay: { isNot: null },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  if (existingWorkout) redirect(workoutPath(existingWorkout.id));

  const completedWorkoutCount = await prisma.workout.count({
    where: {
      userId: user.id,
      planId: plan.id,
      finishedAt: { not: null },
    },
  });
  const nextDayIndex = getNextPlanDayIndex(
    completedWorkoutCount,
    plan.days.length,
  );
  const nextDay = nextDayIndex === null ? undefined : plan.days[nextDayIndex];
  if (!nextDay) redirect("/onboarding");

  const started = await prisma.workout.create({
    data: {
      user: { connect: { id: user.id } },
      plan: { connect: { id: plan.id, userId: user.id, active: true } },
      planDay: { connect: { id: nextDay.id, planId: plan.id } },
    },
    select: { id: true },
  });

  redirect(workoutPath(started.id));
}

const FINISH_TRIES = 2;

export async function finishWorkout() {
  const user = await requireUser();

  // Two tries: if another tab paused or resumed between the read and the write, the second
  // read sees the new clock and Finish still lands.
  for (let attempt = 0; attempt < FINISH_TRIES; attempt += 1) {
    const workout = await findOpenClockWorkout(user.id);
    if (!workout) break;
    const finishedAt = new Date();
    // Duration counts active time only (D37): paused time and an idle stretch are left out.
    // A run keeps the duration it recorded itself.
    const activeSeconds = finishedActiveSeconds(
      clockOf(workout),
      await latestSetMs(workout.id),
      finishedAt.getTime(),
    );
    const { count } = await prisma.workout.updateMany({
      where: {
        id: workout.id,
        userId: user.id,
        finishedAt: null,
        // The stretch that was read: a pause from another tab in between is not overwritten.
        activeSince: workout.activeSince,
      },
      data: {
        finishedAt,
        activeSince: null,
        activeBankedSeconds: activeSeconds,
        ...(workout.durationSeconds === null
          ? { durationSeconds: activeSeconds }
          : {}),
      },
    });
    if (count > 0) break;
  }

  revalidatePath(SESSION_LANDING);
  redirect(SESSION_LANDING);
}
