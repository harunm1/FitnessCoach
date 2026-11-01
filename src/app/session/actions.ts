"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const demoEmail = "demo@fitnesscoach.local";

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