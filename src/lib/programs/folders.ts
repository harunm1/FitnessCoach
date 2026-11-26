// The user's programs for the Programs page (D38): their plans, newest first, as
// folders of day routines. Only the signed-in user's own plans: the query is by userId.
import "server-only";
import { prisma } from "@/lib/prisma";
import type { FolderPlan } from "@/components/programs/ProgramFolders";

// Enough history to find a recent program; older plans stay in the database.
const MAX_FOLDERS = 10;

export async function loadProgramFolders(
  userId: string,
): Promise<FolderPlan[]> {
  const plans = await prisma.plan.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_FOLDERS,
    select: {
      id: true,
      name: true,
      active: true,
      templateId: true,
      days: {
        where: { kind: "STRENGTH" },
        orderBy: { dayIndex: "asc" },
        select: {
          name: true,
          weekdays: true,
          exercises: {
            orderBy: { order: "asc" },
            select: {
              sets: true,
              reps: true,
              exercise: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  return plans.map((plan) => ({
    ...plan,
    days: plan.days.map((day) => ({
      name: day.name,
      weekdays: day.weekdays,
      exercises: day.exercises.map((e) => ({
        name: e.exercise.name,
        sets: e.sets,
        reps: e.reps,
      })),
    })),
  }));
}
