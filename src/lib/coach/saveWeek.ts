// Saving a week (#46). A hybrid week from buildHybridWeek, or a coach plan, becomes
// one Plan with a PlanDay per day: strength days carry PlanExercise rows, run days a
// PlanRun. The new plan becomes the user's only active plan, in one transaction that
// locks the user's row, so neither a dropped connection nor two saves at once leave
// two active plans or a plan without its days.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { WeekDay } from "./hybridWeek";

export type PlanSourceName = "COACH" | "DEFAULT";

// The nested create input for one plan. Kept pure so it can be tested without a
// database; saveWeek only adds the transaction around it.
export function weekToPlanData(
  userId: string,
  week: { name: string; days: WeekDay[] },
  source: PlanSourceName,
): Prisma.PlanUncheckedCreateInput {
  return {
    userId,
    name: week.name,
    source,
    active: true,
    days: {
      create: week.days.map((day, dayIndex) =>
        day.kind === "RUN"
          ? {
              dayIndex,
              name: day.name,
              kind: "RUN" as const,
              run: {
                create: {
                  type: day.run.type,
                  distanceKm: day.run.distanceKm,
                  targetPaceSecPerKm: day.run.targetPaceSecPerKm,
                },
              },
            }
          : {
              dayIndex,
              name: day.name,
              kind: "STRENGTH" as const,
              exercises: {
                create: day.exercises.map((slot, order) => ({
                  exerciseId: slot.exerciseId,
                  order,
                  sets: slot.sets,
                  reps: slot.reps,
                  restSeconds: slot.restSeconds,
                })),
              },
            },
      ),
    },
  };
}

export async function saveWeek(
  prisma: PrismaClient,
  userId: string,
  week: { name: string; days: WeekDay[] },
  source: PlanSourceName,
): Promise<{ planId: number }> {
  const plan = await prisma.$transaction(async (tx) => {
    // Lock the user's row first: under Postgres's default READ COMMITTED, two
    // concurrent saves (a double tap, a client retry) would otherwise each deactivate
    // the old plan and both insert an active one. With the lock they run in turn.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    await tx.plan.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });
    return tx.plan.create({
      data: weekToPlanData(userId, week, source),
      select: { id: true },
    });
  });
  return { planId: plan.id };
}
