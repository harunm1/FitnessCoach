import "server-only";
// Writes one set from the offline queue (D31), idempotent by clientId. Running it twice
// with the same input leaves the same one row: a known clientId writes nothing, and the
// row is upserted on (workoutId, exerciseId, setNumber) carrying the clientId, so the key
// and the set commit in one statement. Only the signed-in user's open workout is used,
// and the pain stop rule of logSet (#92) applies the same way: the user's row is locked,
// and after a stop-range score only a correction of an existing set is accepted.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { painTrafficLight } from "@/lib/coach/painTrafficLight";
import type { SyncOutcome } from "@/lib/offline/types";
import type { QueuedSetInput } from "./queuedSetSchema";
import { getSetLogOperation } from "./setLogOperation";

type Tx = Prisma.TransactionClient;

const UNIQUE_VIOLATION = "P2002";

const failed = (message: string): SyncOutcome => ({ status: "error", message });

function findOpenWorkout(tx: Tx, userId: string, input: QueuedSetInput) {
  return tx.workout.findFirst({
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
        select: {
          setNumber: true,
          painDuringSession: true,
          painNextMorning: true,
        },
      },
    },
  });
}

// The answer for a clientId the server already holds: the same set is a replay, another
// set means the key was reused, which is refused rather than guessed at.
async function knownClientId(
  db: Tx,
  workoutId: number,
  input: QueuedSetInput,
): Promise<SyncOutcome | null> {
  const existing = await db.setLog.findUnique({
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

const stopped = (set: {
  painDuringSession: number | null;
  painNextMorning: number | null;
}) =>
  painTrafficLight(set.painDuringSession ?? 0, set.painNextMorning ?? 0)
    .state === "stop";

async function upsertSet(
  tx: Tx,
  userId: string,
  workoutId: number,
  input: QueuedSetInput,
) {
  const values = {
    reps: input.reps,
    weightKg:
      input.weightKg === undefined ? null : new Prisma.Decimal(input.weightKg),
    painDuringSession: input.painDuringSession ?? null,
    painNextMorning: input.painNextMorning ?? null,
    clientId: input.clientId,
  };
  await tx.setLog.upsert({
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
      ...values,
    },
    // A later edit of the same set wins and takes over the key (last write wins).
    update: values,
  });
}

async function recordInTransaction(
  tx: Tx,
  userId: string,
  input: QueuedSetInput,
): Promise<SyncOutcome> {
  // The same per-user lock logSet takes, so two writes never pass the stop check together.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const workout = await findOpenWorkout(tx, userId, input);
  const planned = workout?.planDay?.exercises[0];
  if (!workout || !planned) {
    return failed(
      "This set's workout is no longer open, so it cannot be saved. Discard it.",
    );
  }

  const known = await knownClientId(tx, workout.id, input);
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
  if (operation === "create" && workout.sets.some(stopped)) {
    return failed(
      "This exercise is blocked by a recorded stop-range pain score, so this set was not saved. Discard it.",
    );
  }

  await upsertSet(tx, userId, workout.id, input);
  return { status: "saved" };
}

export async function recordQueuedSet(
  userId: string,
  input: QueuedSetInput,
): Promise<SyncOutcome> {
  try {
    return await prisma.$transaction((tx) =>
      recordInTransaction(tx, userId, input),
    );
  } catch (error) {
    // Two copies of one set arriving together: the loser finds the winner's row. The
    // workout was already checked as the user's inside the transaction that raced.
    const raced =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION;
    const known = raced
      ? await knownClientId(prisma, input.workoutId, input)
      : null;
    return known ?? failed("Could not save this set. Try again.");
  }
}
