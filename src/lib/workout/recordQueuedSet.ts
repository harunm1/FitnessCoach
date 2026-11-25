import "server-only";
// Writes one set from the offline queue (D31), idempotent by clientId. Running it twice
// with the same input leaves the same one row: a known clientId writes nothing, and the
// row is upserted on (workoutId, exerciseId, setNumber) carrying the clientId, so the key
// and the set commit in one statement. Only the signed-in user's open workout is used.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { SyncOutcome } from "@/lib/offline/types";
import type { QueuedSetInput } from "./queuedSetSchema";
import { getSetLogOperation } from "./setLogOperation";

const UNIQUE_VIOLATION = "P2002";

const failed = (message: string): SyncOutcome => ({ status: "error", message });

function findOpenWorkout(userId: string, input: QueuedSetInput) {
  return prisma.workout.findFirst({
    where: {
      id: input.workoutId,
      userId,
      finishedAt: null,
      plan: { userId, active: true },
      planDay: { plan: { userId } },
    },
    select: {
      id: true,
      planDay: {
        select: {
          exercises: {
            where: { exerciseId: input.exerciseId },
            select: { sets: true },
          },
        },
      },
      sets: {
        where: { exerciseId: input.exerciseId },
        select: { setNumber: true },
      },
    },
  });
}

// The answer for a clientId the server already holds: the same set is a replay, another
// set means the key was reused, which is refused rather than guessed at.
async function knownClientId(
  workoutId: number,
  input: QueuedSetInput,
): Promise<SyncOutcome | null> {
  const existing = await prisma.setLog.findUnique({
    where: { workoutId_clientId: { workoutId, clientId: input.clientId } },
    select: { exerciseId: true, setNumber: true },
  });
  if (!existing) return null;
  const sameSet =
    existing.exerciseId === input.exerciseId &&
    existing.setNumber === input.setNumber;
  return sameSet
    ? { status: "duplicate" }
    : failed("This set was already saved as a different set. Discard it.");
}

async function upsertSet(
  userId: string,
  workoutId: number,
  input: QueuedSetInput,
) {
  const weightKg =
    input.weightKg === undefined ? null : new Prisma.Decimal(input.weightKg);
  await prisma.setLog.upsert({
    where: {
      workoutId_exerciseId_setNumber: {
        workoutId,
        exerciseId: input.exerciseId,
        setNumber: input.setNumber,
      },
      workout: { userId },
    },
    create: {
      workoutId,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      weightKg,
      clientId: input.clientId,
    },
    // A later edit of the same set wins and takes over the key (last write wins).
    update: { reps: input.reps, weightKg, clientId: input.clientId },
  });
}

export async function recordQueuedSet(
  userId: string,
  input: QueuedSetInput,
): Promise<SyncOutcome> {
  const workout = await findOpenWorkout(userId, input);
  const planned = workout?.planDay?.exercises[0];
  if (!workout || !planned) {
    return failed(
      "This set's workout is no longer open, so it cannot be saved. Discard it.",
    );
  }

  const known = await knownClientId(workout.id, input);
  if (known) return known;

  const operation = getSetLogOperation(
    input.setNumber,
    workout.sets.map((set) => set.setNumber),
    planned.sets,
  );
  if (!operation) {
    return failed(
      "That set is out of date. Refresh the session and try again.",
    );
  }

  try {
    await upsertSet(userId, workout.id, input);
  } catch (error) {
    // Two copies of one set arriving together: the loser finds the winner's row.
    const raced =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION;
    const known = raced ? await knownClientId(workout.id, input) : null;
    return known ?? failed("Could not save this set. Try again.");
  }
  return { status: "saved" };
}
