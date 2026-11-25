// The read-only queries behind scripts/demo-db-peek.ts (#162). Everything runs inside
// one transaction that is made READ ONLY first, so even a connection string with write
// rights cannot change a row through this file: Postgres refuses the statement.
import type { PrismaClient } from "../../src/generated/prisma/client";

export const NO_SUCH_USER = "no-such-user" as const;

const LATEST_WORKOUTS = 3;
const LATEST_SETS = 5;
const LATEST_PHOTOS = 3;
// A remote database may need a moment to wake; Prisma defaults (2 s, 5 s) are short.
const MAX_WAIT_MS = 10_000;
const TIMEOUT_MS = 15_000;

export type PeekResult = {
  user: { id: string; name: string; tier: string };
  totals: { workouts: number; sets: number; photos: number };
  workouts: {
    id: number;
    startedAt: Date;
    finished: boolean;
    source: string;
    sets: number;
  }[];
  sets: {
    id: number;
    workoutId: number;
    exercise: string;
    setNumber: number;
    reps: number;
    weightKg: string | null;
    loggedAt: Date;
  }[];
  photos: { id: number; storageKey: string; takenAt: Date }[];
};

export async function peekDemoUser(
  db: PrismaClient,
  email: string,
): Promise<PeekResult | typeof NO_SUCH_USER> {
  return db.$transaction(
    async (tx) => {
      // Must be the first statement of the transaction; every later write would fail.
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;

      const user = await tx.user.findFirst({
        where: { email: { equals: email.trim(), mode: "insensitive" } },
        select: { id: true, name: true, tier: true },
      });
      if (!user) return NO_SUCH_USER;

      const [workouts, sets, photos, workoutCount, setCount, photoCount] =
        await Promise.all([
          tx.workout.findMany({
            where: { userId: user.id },
            orderBy: [{ startedAt: "desc" }, { id: "desc" }],
            take: LATEST_WORKOUTS,
            select: {
              id: true,
              startedAt: true,
              finishedAt: true,
              source: true,
              _count: { select: { sets: true } },
            },
          }),
          tx.setLog.findMany({
            where: { workout: { userId: user.id } },
            orderBy: [{ loggedAt: "desc" }, { id: "desc" }],
            take: LATEST_SETS,
            select: {
              id: true,
              workoutId: true,
              setNumber: true,
              reps: true,
              weightKg: true,
              loggedAt: true,
              exercise: { select: { name: true } },
            },
          }),
          tx.progressPhoto.findMany({
            where: { userId: user.id },
            orderBy: [{ takenAt: "desc" }, { id: "desc" }],
            take: LATEST_PHOTOS,
            select: { id: true, storageKey: true, takenAt: true },
          }),
          tx.workout.count({ where: { userId: user.id } }),
          tx.setLog.count({ where: { workout: { userId: user.id } } }),
          tx.progressPhoto.count({ where: { userId: user.id } }),
        ]);

      return {
        user,
        totals: { workouts: workoutCount, sets: setCount, photos: photoCount },
        workouts: workouts.map((workout) => ({
          id: workout.id,
          startedAt: workout.startedAt,
          finished: workout.finishedAt !== null,
          source: workout.source,
          sets: workout._count.sets,
        })),
        sets: sets.map((set) => ({
          id: set.id,
          workoutId: set.workoutId,
          exercise: set.exercise.name,
          setNumber: set.setNumber,
          reps: set.reps,
          weightKg: set.weightKg === null ? null : set.weightKg.toString(),
          loggedAt: set.loggedAt,
        })),
        photos,
      };
    },
    { maxWait: MAX_WAIT_MS, timeout: TIMEOUT_MS },
  );
}
