"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  setLogSchema,
  type SetLogActionState,
} from "@/lib/workout/setLogSchema";
import {
  runMetricsSchema,
  type RunMetricsActionState,
} from "@/lib/workout/runMetricsSchema";
import { getNextPlanDayIndex } from "@/lib/workout/progression";

const demoEmail = "demo@fitnesscoach.local";

export async function saveRunMetrics(
  _previousState: RunMetricsActionState,
  formData: FormData,
): Promise<RunMetricsActionState> {
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

  const user = await prisma.user.findUnique({
    where: { email: demoEmail },
    select: { id: true },
  });
  if (!user) {
    return { status: "error", message: "The demo user could not be found." };
  }

  const workout = await prisma.workout.findFirst({
    where: {
      userId: user.id,
      finishedAt: null,
      plan: { active: true },
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
      where: { id: workout.id },
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
  const parsed = setLogSchema.safeParse({
    reps: formData.get("reps"),
    weightKg: formData.get("weightKg"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Enter valid set details.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: demoEmail },
    select: { id: true },
  });
  if (!user) {
    return { status: "error", message: "The demo user could not be found." };
  }

  const workout = await prisma.workout.findFirst({
    where: {
      userId: user.id,
      finishedAt: null,
      plan: { active: true },
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
        orderBy: { setNumber: "desc" },
        take: 1,
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

  const setNumber = (workout.sets[0]?.setNumber ?? 0) + 1;
  if (setNumber > plannedExercise.sets) {
    return { status: "error", message: "All planned sets are already logged." };
  }

  try {
    await prisma.setLog.create({
      data: {
        workoutId: workout.id,
        exerciseId,
        setNumber,
        reps: parsed.data.reps,
        weightKg:
          parsed.data.weightKg === undefined
            ? null
            : new Prisma.Decimal(parsed.data.weightKg),
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
  const user = await prisma.user.findUnique({
    where: { email: demoEmail },
    select: { id: true },
  });
  if (!user) redirect("/onboarding");

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
      userId: user.id,
      planId: plan.id,
      planDayId: nextDay.id,
    },
  });

  redirect("/session");
}

export async function finishWorkout() {
  const user = await prisma.user.findUnique({
    where: { email: demoEmail },
    select: { id: true },
  });
  if (!user) redirect("/onboarding");

  const workout = await prisma.workout.findFirst({
    where: {
      userId: user.id,
      finishedAt: null,
      plan: { active: true },
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
