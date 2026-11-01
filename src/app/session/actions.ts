"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  setLogSchema,
  type SetLogActionState,
} from "@/lib/workout/setLogSchema";

const demoEmail = "demo@fitnesscoach.local";

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
        take: 1,
        select: { id: true },
      },
    },
  });
  const firstDay = plan?.days[0];
  if (!plan || !firstDay) redirect("/onboarding");

  const existingWorkout = await prisma.workout.findFirst({
    where: {
      userId: user.id,
      planId: plan.id,
      planDayId: firstDay.id,
      finishedAt: null,
    },
    select: { id: true },
  });

  if (!existingWorkout) {
    await prisma.workout.create({
      data: {
        userId: user.id,
        planId: plan.id,
        planDayId: firstDay.id,
      },
    });
  }

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
