import type { PrismaClient } from "@/generated/prisma/client";

// The workout page's data (D46): one open workout of this user on the user's active plan,
// with its plan day's exercises in order and the sets logged so far. Null for a missing,
// finished or another user's workout, so the page can answer all three the same way.
export async function loadOpenWorkout(
  db: Pick<PrismaClient, "workout">,
  userId: string,
  workoutId: number,
) {
  return db.workout.findFirst({
    where: {
      id: workoutId,
      userId,
      finishedAt: null,
      plan: { userId, active: true },
      planDay: { isNot: null },
    },
    select: {
      id: true,
      startedAt: true,
      activeBankedSeconds: true,
      activeSince: true,
      plan: { select: { name: true } },
      planDay: {
        select: {
          name: true,
          dayIndex: true,
          weekdays: true,
          exercises: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              exerciseId: true,
              sets: true,
              reps: true,
              restSeconds: true,
              substitutionReason: true,
              exercise: {
                select: {
                  name: true,
                  equipment: true,
                  primaryMuscles: true,
                  cues: true,
                  commonMistakes: true,
                },
              },
            },
          },
        },
      },
      sets: {
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
        select: {
          id: true,
          exerciseId: true,
          setNumber: true,
          reps: true,
          weightKg: true,
          painDuringSession: true,
          painNextMorning: true,
          loggedAt: true,
        },
      },
    },
  });
}
