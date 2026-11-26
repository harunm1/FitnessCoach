import "server-only";
// Writes one set from the offline queue (D31), idempotent by clientId. Every applied key is
// kept in QueuedSetKey, written in the same transaction as the set, so a replay of any
// earlier attempt answers "already saved" and never overwrites a later edit. Only the
// signed-in user's open workout takes new writes, and the pain stop rule of logSet (#92)
// applies the same way: the user's row is locked, and after a stop-range score only a
// correction of an existing set is accepted.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { painTrafficLight } from "@/lib/coach/painTrafficLight";
import type { SyncOutcome } from "@/lib/offline/types";
import type { QueuedSetInput } from "./queuedSetSchema";
import { getSetLogOperation } from "./setLogOperation";
import { MAX_SETS_PER_EXERCISE } from "./setTable";

type Db = Prisma.TransactionClient;

const UNIQUE_VIOLATION = "P2002";

const failed = (message: string): SyncOutcome => ({ status: "error", message });

// The answer for a key this user's workout already applied, finished or not: the same set
// is a replay, another set means the key was reused, which is refused rather than guessed.
async function appliedKey(
  db: Db,
  userId: string,
  input: QueuedSetInput,
): Promise<SyncOutcome | null> {
  const key = await db.queuedSetKey.findFirst({
    where: {
      workoutId: input.workoutId,
      clientId: input.clientId,
      workout: { userId },
    },
    select: { exerciseId: true, setNumber: true },
  });
  if (!key) return null;
  const sameSet =
    key.exerciseId === input.exerciseId && key.setNumber === input.setNumber;
  return sameSet
    ? { status: "duplicate" }
    : failed("This set was already saved as a different set. Discard it.");
}

function findOpenWorkout(db: Db, userId: string, input: QueuedSetInput) {
  return db.workout.findFirst({
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

const stopped = (set: {
  painDuringSession: number | null;
  painNextMorning: number | null;
}) =>
  painTrafficLight(set.painDuringSession ?? 0, set.painNextMorning ?? 0)
    .state === "stop";

// The set and its key in one transaction: both are stored or neither is.
async function writeSetAndKey(
  tx: Db,
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
    // A later edit of the same set wins (last write wins in queue order).
    update: values,
  });
  await tx.queuedSetKey.create({
    data: {
      workoutId,
      clientId: input.clientId,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
    },
  });
}

async function recordInTransaction(
  tx: Db,
  userId: string,
  input: QueuedSetInput,
): Promise<SyncOutcome> {
  // The same per-user lock logSet takes, so two writes never pass the checks together.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const known = await appliedKey(tx, userId, input);
  if (known) return known;

  const workout = await findOpenWorkout(tx, userId, input);
  const planned = workout?.planDay?.exercises[0];
  if (!workout || !planned) {
    return failed(
      "This set's workout is no longer open, so it cannot be saved. Discard it.",
    );
  }

  const operation = getSetLogOperation(
    input.setNumber,
    workout.sets.map((set) => set.setNumber),
    // The plan's sets are the default; Add set may go on to the limit (D44).
    MAX_SETS_PER_EXERCISE,
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

  await writeSetAndKey(tx, userId, workout.id, input);
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
    // Two copies of one set arriving together: the loser finds the winner's key.
    const raced =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION;
    const known = raced ? await appliedKey(prisma, userId, input) : null;
    return known ?? failed("Could not save this set. Try again.");
  }
}
