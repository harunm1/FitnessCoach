// The server side of the offline set queue (D31) on PostgreSQL: syncQueuedSet is
// idempotent by clientId, so a replay or a double tap stores one row, and it only ever
// writes to the signed-in user's own open workout.
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createAuth } from "@/lib/auth/core";

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});
vi.mock("@/lib/auth", () => ({ getAuth: async () => auth }));

import { prisma as db } from "@/lib/prisma";
import { syncQueuedSet } from "@/app/session/syncSetAction";

const prefix = `offline-sync-${randomUUID()}`;
const password = "Offline-sync-test-password-123!";
const baseURL = "http://localhost:3000";
const exerciseId = `${prefix}-press`;
const PLANNED_SETS = 3;
const PLANNED_REPS = 10;
const REST_SECONDS = 90;
const REPS = 8;
const EDITED_REPS = 9;
const SET_ONE = 1;
const SET_TWO = 2;
const BOTH = 2;
const IP_SUFFIX_LENGTH = 4;
const HTTP_OK = 200;
let auth: ReturnType<typeof createAuth>;
let passwordHash: string;
let owner: { id: string; email: string };
let other: { id: string; email: string };

async function athlete(label: string) {
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      name: label,
      email: `${prefix}-${label}-${id}@example.test`,
      emailVerified: true,
      accounts: {
        create: {
          accountId: id,
          providerId: "credential",
          password: passwordHash,
        },
      },
    },
  });
}

async function signIn(user: { email: string }) {
  const response = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseURL,
        "x-forwarded-for": `2001:db8:${randomUUID().slice(0, IP_SUFFIX_LENGTH)}::1`,
      },
      body: JSON.stringify({ email: user.email, password }),
    }),
  );
  expect(response.status).toBe(HTTP_OK);
  request.headers = new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; "),
  });
}

async function openWorkout(userId: string) {
  const plan = await db.plan.create({
    data: {
      userId,
      name: "Offline plan",
      source: "DEFAULT",
      days: {
        create: {
          name: "Offline day",
          dayIndex: 0,
          exercises: {
            create: {
              exerciseId,
              order: 0,
              sets: PLANNED_SETS,
              reps: PLANNED_REPS,
              restSeconds: REST_SECONDS,
            },
          },
        },
      },
    },
    include: { days: true },
  });
  return db.workout.create({
    data: { userId, planId: plan.id, planDayId: plan.days[0].id },
  });
}

function queued(workoutId: number, overrides: Record<string, unknown> = {}) {
  return {
    clientId: randomUUID(),
    workoutId,
    exerciseId,
    setNumber: SET_ONE,
    reps: REPS,
    weightKg: "12.5",
    ...overrides,
  };
}

beforeAll(async () => {
  passwordHash = await hashPassword(password);
  await db.exercise.create({
    data: {
      id: exerciseId,
      name: `${prefix} Press`,
      level: "BEGINNER",
      category: "strength",
      equipment: "body only",
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    },
  });
});

beforeEach(async () => {
  request.headers = new Headers();
  auth = createAuth(
    db,
    { baseURL, secret: "offline-sync-integration-secret-at-least-32-chars" },
    async () => {},
  );
  owner = await athlete("owner");
  other = await athlete("other");
});

afterEach(async () => {
  request.headers = new Headers();
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
});

afterAll(async () => {
  await db.exercise.deleteMany({ where: { id: exerciseId } });
  await db.$disconnect();
});

describe("syncQueuedSet", () => {
  it("saves a queued set with its clientId", async () => {
    const workout = await openWorkout(owner.id);
    await signIn(owner);
    const set = queued(workout.id);

    expect(await syncQueuedSet(set)).toEqual({ status: "saved" });

    const rows = await db.setLog.findMany({ where: { workoutId: workout.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clientId: set.clientId,
      setNumber: SET_ONE,
      reps: REPS,
    });
    expect(rows[0].weightKg?.toString()).toBe("12.5");
  });

  it("stores one row when the same queued set is replayed", async () => {
    const workout = await openWorkout(owner.id);
    await signIn(owner);
    const set = queued(workout.id);

    await syncQueuedSet(set);
    expect(await syncQueuedSet(set)).toEqual({ status: "duplicate" });

    expect(await db.setLog.count({ where: { workoutId: workout.id } })).toBe(1);
  });

  it("stores one row when the same set arrives twice at once (double tap)", async () => {
    const workout = await openWorkout(owner.id);
    await signIn(owner);
    const set = queued(workout.id);

    const results = await Promise.all([syncQueuedSet(set), syncQueuedSet(set)]);

    expect(results.every((result) => result.status !== "error")).toBe(true);
    expect(await db.setLog.count({ where: { workoutId: workout.id } })).toBe(1);
  });

  it("saves two sets logged offline, in order, once each", async () => {
    const workout = await openWorkout(owner.id);
    await signIn(owner);
    const first = queued(workout.id);
    const second = queued(workout.id, { setNumber: SET_TWO });

    // One after another, as the queue sends them.
    await [first, second, first, second].reduce<Promise<unknown>>(
      (previous, set) => previous.then(() => syncQueuedSet(set)),
      Promise.resolve(),
    );

    const rows = await db.setLog.findMany({
      where: { workoutId: workout.id },
      orderBy: { setNumber: "asc" },
    });
    expect(rows.map((row) => row.setNumber)).toEqual([SET_ONE, SET_TWO]);
    expect(rows.map((row) => row.clientId)).toEqual([
      first.clientId,
      second.clientId,
    ]);
  });

  it("applies a later edit of the same set (last write wins) and its replay is a no-op", async () => {
    const workout = await openWorkout(owner.id);
    await signIn(owner);
    await syncQueuedSet(queued(workout.id));
    const edit = queued(workout.id, { reps: EDITED_REPS });

    expect(await syncQueuedSet(edit)).toEqual({ status: "saved" });
    expect(await syncQueuedSet(edit)).toEqual({ status: "duplicate" });

    const rows = await db.setLog.findMany({ where: { workoutId: workout.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reps: EDITED_REPS,
      clientId: edit.clientId,
    });
  });

  it("refuses a known clientId sent for a different set", async () => {
    const workout = await openWorkout(owner.id);
    await signIn(owner);
    const set = queued(workout.id);
    await syncQueuedSet(set);

    const result = await syncQueuedSet({ ...set, setNumber: SET_TWO });

    expect(result.status).toBe("error");
    expect(await db.setLog.count({ where: { workoutId: workout.id } })).toBe(1);
  });

  it("never writes to another user's workout", async () => {
    const otherWorkout = await openWorkout(other.id);
    await openWorkout(owner.id);
    await signIn(owner);

    const result = await syncQueuedSet(queued(otherWorkout.id));

    expect(result.status).toBe("error");
    expect(
      await db.setLog.count({ where: { workoutId: otherWorkout.id } }),
    ).toBe(0);
  });

  it("refuses a set queued for a workout that has since been finished", async () => {
    const workout = await openWorkout(owner.id);
    await db.workout.update({
      where: { id: workout.id },
      data: { finishedAt: new Date() },
    });
    await signIn(owner);

    const result = await syncQueuedSet(queued(workout.id));

    expect(result.status).toBe("error");
    expect(await db.setLog.count({ where: { workoutId: workout.id } })).toBe(0);
  });

  it("refuses a set that skips ahead of the logged ones", async () => {
    const workout = await openWorkout(owner.id);
    await signIn(owner);
    const result = await syncQueuedSet(
      queued(workout.id, { setNumber: SET_TWO }),
    );
    expect(result.status).toBe("error");
  });

  it("refuses malformed input without writing", async () => {
    const workout = await openWorkout(owner.id);
    await signIn(owner);
    const results = await Promise.all(
      [
        queued(workout.id, { clientId: "not-a-uuid" }),
        queued(workout.id, { reps: 0 }),
        "not an object",
      ].map((bad) => syncQueuedSet(bad)),
    );
    expect(results.map((result) => result.status)).toEqual([
      "error",
      "error",
      "error",
    ]);
    expect(await db.setLog.count({ where: { workoutId: workout.id } })).toBe(0);
  });

  it("needs a signed-in user", async () => {
    const workout = await openWorkout(owner.id);
    await expect(syncQueuedSet(queued(workout.id))).rejects.toThrow(
      "redirect:",
    );
  });

  it("has a unique index on (workoutId, clientId)", async () => {
    const workout = await openWorkout(owner.id);
    const clientId = randomUUID();
    await db.setLog.create({
      data: {
        workoutId: workout.id,
        exerciseId,
        setNumber: SET_ONE,
        reps: REPS,
        clientId,
      },
    });
    await expect(
      db.setLog.create({
        data: {
          workoutId: workout.id,
          exerciseId,
          setNumber: SET_TWO,
          reps: REPS,
          clientId,
        },
      }),
    ).rejects.toThrow();
    const many = await db.setLog.createMany({
      data: [SET_ONE, SET_TWO].map((setNumber) => ({
        workoutId: workout.id,
        exerciseId,
        setNumber: setNumber + BOTH,
        reps: REPS,
      })),
    });
    // Rows without a clientId (every row logged before D31) never collide.
    expect(many.count).toBe(BOTH);
  });
});
