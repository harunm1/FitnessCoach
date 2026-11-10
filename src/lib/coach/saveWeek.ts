// Saving a week (#46). A hybrid week from buildHybridWeek, or a coach plan, becomes
// one Plan with a PlanDay per day: strength days carry PlanExercise rows, run days a
// PlanRun. The new plan becomes the user's only active plan, in one transaction that
// locks the user's row, so a dropped connection never leaves a plan without its days
// and two saveWeek calls run in turn. The Plan_one_active_per_user index holds the
// one-active-plan rule against every other writer (#76).
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
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

// Prisma's code when Postgres aborts a transaction for a deadlock or write conflict.
// Only ORM statements report it; a deadlock in a raw query comes back as P2010. The
// raw FOR UPDATE below is the transaction's first statement, holding no locks yet, so
// it cannot be part of a deadlock: keep it first.
const ABORTED = "P2034";

function wasAborted(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === ABORTED
  );
}

// A quiz save (src/app/onboarding/actions.ts) that has deactivated the old plan holds
// that row, then needs the User row for its insert, while saveWeek holds the User row
// and waits for the old plan: a deadlock. Postgres aborts one of the two, and which
// one "should not be relied upon" (PostgreSQL 16, 13.3.4). If it aborts saveWeek, one
// retry, after the quiz save has committed, deactivates the quiz's plan and saves this
// one, so the newer save wins. If it aborts the quiz save, this save goes through and
// the quiz save fails with P2034 (tests/integration/schema-constraints.test.ts). The
// transaction has no side effects outside the database, so running it again is safe.
export async function saveWeek(
  prisma: PrismaClient,
  userId: string,
  week: { name: string; days: WeekDay[] },
  source: PlanSourceName,
): Promise<{ planId: number }> {
  try {
    return await saveWeekOnce(prisma, userId, week, source);
  } catch (error) {
    if (!wasAborted(error)) throw error;
    console.warn("saveWeek: retrying once after Postgres aborted it", {
      userId,
      error,
    });
    return saveWeekOnce(prisma, userId, week, source);
  }
}

async function saveWeekOnce(
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
