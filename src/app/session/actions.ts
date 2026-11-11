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
import { requireUser } from "@/lib/auth/session";

export async function saveRunMetrics(
  _previousState: RunMetricsActionState,
  formData: FormData,
): Promise<RunMetricsActionState> {
  const user = await requireUser();
  const parsed = runMetricsSchema.safeParse({
    distanceKm: formData.get("distanceKm"),
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

  revalidatePath("/session");
  redirect("/session");
}

export async function logSet(
  exerciseId: string,
  _previousState: SetLogActionState,
  formData: FormData,
): Promise<SetLogActionState> {
  const user = await requireUser();
  const parsed = setLogSchema.safeParse({
    setNumber: formData.get("setNumber"),
    reps: formData.get("reps"),
    weightKg: formData.get("weightKg"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Enter valid set details.",
    };
  }

  const workout = await prisma.workout.findFirst({
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
          exercises: {
            where: { exerciseId },
            select: { sets: true },
          },
        },
      },
      sets: {
        where: { exerciseId },
        select: { setNumber: true },
      },
    },
  });

  const plannedExercise = workout?.planDay?.exercises[0];
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
      message: "That set is out of date. Refresh the session and try again.",
    };
  }

  try {
    const weightKg =
      parsed.data.weightKg === undefined
        ? null
        : new Prisma.Decimal(parsed.data.weightKg);
    await prisma.setLog.upsert({
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
      },
      update: {
        reps: parsed.data.reps,
        weightKg,
      },
    });
  } catch {
    return {
      status: "error",
      message: "Could not save this set. Refresh the page and try again.",
    };
  }

  revalidatePath("/session");
  redirect("/session");
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
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  if (existingWorkout) redirect("/session");

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

  await prisma.workout.create({
    data: {
      user: { connect: { id: user.id } },
      plan: { connect: { id: plan.id, userId: user.id, active: true } },
      planDay: { connect: { id: nextDay.id, planId: plan.id } },
    },
  });

  redirect("/session");
}

export async function finishWorkout() {
  const user = await requireUser();

  const workout = await prisma.workout.findFirst({
    where: {
      userId: user.id,
      finishedAt: null,
      plan: { userId: user.id, active: true },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  if (workout) {
    await prisma.workout.updateMany({
      where: { id: workout.id, userId: user.id, finishedAt: null },
      data: { finishedAt: new Date() },
    });
  }

  revalidatePath("/session");
  redirect("/session");
}
