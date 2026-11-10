// Database rules from the 10 November schema audit (#76): one active plan per user, one open workout per plan, and range checks on coaching and logging numbers.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { saveWeek } from "@/lib/coach/saveWeek";
import type { WeekDay } from "@/lib/coach/hybridWeek";
import { testDatabase } from "../helpers/database";

// The bounds the CHECK constraints hold (prisma/migrations/*_range_checks).
const RPE_MIN = 1;
const RPE_MAX = 10;
const DAY_INDEX_MIN = 0;
const DAY_INDEX_MAX = 6;
const DAYS_PER_WEEK_MIN = 1;
const DAYS_PER_WEEK_MAX = 7;
const FIRST_SET = 1;
const FEWEST_SETS = 1;
const FEWEST_PLANNED_REPS = 1;
const FEWEST_LOGGED_REPS = 0;
const NO_REST = 0;
const FIRST_ORDER = 0;
const NO_WEIGHT = 0;

// A valid row, which each range case changes in one field.
const VALID_SETS = 3;
const VALID_REPS = 8;
const VALID_REST_SECONDS = 90;
const VALID_DISTANCE_KM = 5;
const VALID_DURATION_SEC = 1800;
const VALID_PACE_SEC_PER_KM = 360;
const VALID_DAYS_PER_WEEK = 3;

const NEGATIVE_WEIGHT_KG = -0.5;
const LOCK_POLL_MS = 50;
const LOCK_POLL_ATTEMPTS = 100;
const RACE_TIMEOUT_MS = 15_000;
const PLANS_CREATED = 3;
const WORKOUTS_CREATED = 2;

// Postgres names the violated constraint in its message, e.g.
// 'new row for relation "SetLog" violates check constraint "SetLog_rpe_check"'.
const checkViolation = (constraint: string) =>
  `violates check constraint "${constraint}"`;

// Deadlock detection runs in the backend whose deadlock_timeout expires first, and
// that backend is the one aborted; PostgreSQL says the victim "should not be relied
// upon" (16, 13.3.4). The deadlock tests pin it by setting the quiz save's timeout.
const QUIZ_WAITS_LONGER = "10s";
const QUIZ_GIVES_UP_FIRST = "50ms";

const db = testDatabase();
const prefix = `constraints-${randomUUID()}`;
const exerciseIds = [`${prefix}-squat`, `${prefix}-row`];
let sequence = 0;

beforeAll(async () => {
  await db.exercise.createMany({
    data: exerciseIds.map((id) => ({
      id,
      name: id,
      level: "BEGINNER" as const,
      category: "strength",
      primaryMuscles: ["quadriceps"],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    })),
  });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  await db.$disconnect();
});

async function createUser() {
  return db.user.create({
    data: {
      name: "Constraint Athlete",
      email: `${prefix}-${sequence++}@example.test`,
    },
  });
}

// A plan with one strength day; inactive by default, so a test can make as many as it needs.
async function createPlanDay(userId: string, active = false) {
  const plan = await db.plan.create({
    data: {
      userId,
      name: "Fixture plan",
      source: "DEFAULT",
      active,
      days: { create: { dayIndex: 0, name: "Full body" } },
    },
    include: { days: true },
  });
  return { planId: plan.id, planDayId: plan.days[0].id };
}

async function createFinishedWorkout(userId: string) {
  const { planId, planDayId } = await createPlanDay(userId);
  return db.workout.create({
    data: { userId, planId, planDayId, finishedAt: new Date() },
  });
}

function activePlans(userId: string) {
  return db.plan.findMany({
    where: { userId, active: true },
    select: { id: true },
  });
}

// The statements a race test waits on, as Prisma sends them (matched with LIKE).
const PLAN_EXERCISE_INSERT = '%INSERT INTO "public"."PlanExercise"%';
const PLAN_UPDATE = '%UPDATE "public"."Plan"%';

async function lockWaiters(client: PrismaClient, statement: string) {
  const rows = await client.$queryRaw<{ waiting: bigint }[]>`
    SELECT count(*) AS waiting FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock'
      AND query LIKE ${statement}`;
  return Number(rows[0].waiting);
}

// Resolves once a connection to this database waits on a lock while running the given
// statement, so a test can release the transaction holding that lock at a known point
// instead of sleeping.
async function waitForLockWait(
  client: PrismaClient,
  statement: string,
  attemptsLeft = LOCK_POLL_ATTEMPTS,
): Promise<void> {
  if ((await lockWaiters(client, statement)) > 0) return;
  if (attemptsLeft === 0)
    throw new Error(`No connection waiting on a lock in ${statement}`);
  await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  await waitForLockWait(client, statement, attemptsLeft - 1);
}

// A gate the test opens by hand: `opened` settles when `open` is called.
function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

// Holds a row lock on one exercise. saveWeek's nested PlanExercise insert takes a
// key-share lock on that row for its foreign key, so saveWeek pauses there: after it
// has locked the User row, deactivated the old plan and inserted its Plan row.
async function holdExerciseRow(exerciseId: string) {
  const release = gate();
  const held = gate();
  const done = db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Exercise" WHERE id = ${exerciseId} FOR UPDATE`;
      held.open();
      await release.opened;
    },
    { timeout: RACE_TIMEOUT_MS },
  );
  await held.opened;
  return { release: release.open, done };
}

// The statements of saveQuizProfile (src/app/onboarding/actions.ts:98-136) for a user
// who already has a Profile, in order. A copy, so a change to that action does not
// reach these tests. `beforeInsert` lets a test pause between the deactivation and
// the insert; `deadlockTimeout` sets this transaction's deadlock_timeout.
function quizSave(
  userId: string,
  options: {
    beforeInsert?: () => Promise<void>;
    deadlockTimeout?: string;
  } = {},
) {
  return db.$transaction(
    async (tx) => {
      if (options.deadlockTimeout)
        await tx.$executeRawUnsafe(
          `SET LOCAL deadlock_timeout = '${options.deadlockTimeout}'`,
        );
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          goal: "GENERAL_FITNESS",
          level: "BEGINNER",
          daysPerWeek: VALID_DAYS_PER_WEEK,
          equipment: [],
        },
        update: { daysPerWeek: VALID_DAYS_PER_WEEK },
      });
      await tx.plan.updateMany({
        where: { userId, active: true },
        data: { active: false },
      });
      await options.beforeInsert?.();
      return tx.plan.create({
        data: { userId, name: "Quiz plan", source: "DEFAULT" },
        select: { id: true },
      });
    },
    { timeout: RACE_TIMEOUT_MS },
  );
}

// A user who has taken the quiz once: a Profile and one active plan. With the Profile
// in place the quiz's upsert is an UPDATE, which takes no lock on the User row.
async function quizTaker() {
  const user = await createUser();
  await profile(VALID_DAYS_PER_WEEK, user.id);
  await createPlanDay(user.id, true);
  return user;
}

const coachWeek: { name: string; days: WeekDay[] } = {
  name: "Coach week",
  days: [
    {
      kind: "STRENGTH",
      name: "Lower body",
      exercises: [
        {
          exerciseId: exerciseIds[0],
          sets: VALID_SETS,
          reps: VALID_REPS,
          restSeconds: VALID_REST_SECONDS,
        },
      ],
    },
  ],
};

describe("one active plan per user", () => {
  it("rejects a second active plan for the same user", async () => {
    // Arrange
    const user = await createUser();
    await createPlanDay(user.id, true);

    // Act
    const second = createPlanDay(user.id, true);

    // Assert
    await expect(second).rejects.toMatchObject({ code: "P2002" });
    expect(await activePlans(user.id)).toHaveLength(1);
  });

  it("keeps any number of inactive plans for the same user", async () => {
    const user = await createUser();

    await createPlanDay(user.id, true);
    await createPlanDay(user.id);
    await createPlanDay(user.id);

    expect(await db.plan.count({ where: { userId: user.id } })).toBe(
      PLANS_CREATED,
    );
  });

  // Race from the #76 schema audit, coach save first. saveWeek locks the User row,
  // deactivates the old plan and inserts its own; the quiz's UPDATE waits on the old
  // plan's row lock. When saveWeek commits, that UPDATE re-checks only the old row,
  // now inactive, and does not see the coach's new plan, so without the index the
  // quiz inserts a second active plan.
  it("rejects the quiz save that runs into a coach save, and keeps the coach's plan", async () => {
    // Arrange
    const user = await quizTaker();
    const exercise = await holdExerciseRow(exerciseIds[0]);

    // Act
    const coach = saveWeek(db, user.id, coachWeek, "COACH");
    let quiz: Promise<{ id: number }> | undefined;
    try {
      await waitForLockWait(db, PLAN_EXERCISE_INSERT);
      quiz = quizSave(user.id);
      await waitForLockWait(db, PLAN_UPDATE);
    } finally {
      exercise.release();
      await exercise.done;
    }
    const [coachResult, quizResult] = await Promise.allSettled([coach, quiz]);

    // Assert
    expect(coachResult.status).toBe("fulfilled");
    const coachPlanId =
      coachResult.status === "fulfilled" ? coachResult.value.planId : undefined;
    expect(await activePlans(user.id)).toEqual([{ id: coachPlanId }]);
    expect(quizResult).toMatchObject({
      status: "rejected",
      reason: { code: "P2002" },
    });
  });

  // The other order, quiz save first. The quiz holds the old plan's row lock and then
  // needs a key-share lock on the User row for its insert; saveWeek holds the User row
  // and waits for the old plan. Postgres aborts one of the two.
  async function deadlock(quizDeadlockTimeout: string) {
    const user = await quizTaker();
    const quizMayInsert = gate();
    const quizDeactivated = gate();
    const quiz = quizSave(user.id, {
      deadlockTimeout: quizDeadlockTimeout,
      beforeInsert: async () => {
        quizDeactivated.open();
        await quizMayInsert.opened;
      },
    });
    await quizDeactivated.opened;
    const coach = saveWeek(db, user.id, coachWeek, "COACH");
    try {
      await waitForLockWait(db, PLAN_UPDATE);
    } finally {
      quizMayInsert.open();
    }
    const [quizResult, coachResult] = await Promise.allSettled([quiz, coach]);
    return { user, quizResult, coachResult };
  }

  it("saves the coach's plan on a retry when the deadlock aborts saveWeek", async () => {
    const { user, quizResult, coachResult } = await deadlock(QUIZ_WAITS_LONGER);

    expect(quizResult.status).toBe("fulfilled");
    expect(coachResult.status).toBe("fulfilled");
    const coachPlanId =
      coachResult.status === "fulfilled" ? coachResult.value.planId : undefined;
    expect(await activePlans(user.id)).toEqual([{ id: coachPlanId }]);
  });

  it("keeps the coach's plan when the deadlock aborts the quiz save", async () => {
    const { user, quizResult, coachResult } =
      await deadlock(QUIZ_GIVES_UP_FIRST);

    expect(quizResult).toMatchObject({
      status: "rejected",
      reason: { code: "P2034" },
    });
    expect(coachResult.status).toBe("fulfilled");
    const coachPlanId =
      coachResult.status === "fulfilled" ? coachResult.value.planId : undefined;
    expect(await activePlans(user.id)).toEqual([{ id: coachPlanId }]);
  });
});

describe("one open workout per plan", () => {
  // From the #76 schema audit: startOrResumeWorkout (src/app/session/actions.ts) looks
  // for an open workout on the plan, then creates one, outside a transaction. Two taps
  // can both see none and both create; this runs those steps in that order.
  it("rejects a second open workout on a plan after both lookups found none", async () => {
    // Arrange
    const user = await createUser();
    const { planId, planDayId } = await createPlanDay(user.id, true);
    const findOpen = () =>
      db.workout.findFirst({
        where: { userId: user.id, planId, finishedAt: null },
        select: { id: true },
      });

    // Act
    const [first, second] = await Promise.all([findOpen(), findOpen()]);
    await db.workout.create({ data: { userId: user.id, planId, planDayId } });
    const duplicate = db.workout.create({
      data: { userId: user.id, planId, planDayId },
    });

    // Assert
    expect([first, second]).toEqual([null, null]);
    await expect(duplicate).rejects.toMatchObject({ code: "P2002" });
    expect(
      await db.workout.count({ where: { planId, finishedAt: null } }),
    ).toBe(1);
  });

  it("allows a new open workout once the earlier one is finished", async () => {
    const user = await createUser();
    const { planId, planDayId } = await createPlanDay(user.id, true);
    const earlier = await db.workout.create({
      data: { userId: user.id, planId, planDayId },
    });

    await db.workout.update({
      where: { id: earlier.id },
      data: { finishedAt: new Date() },
    });
    await db.workout.create({ data: { userId: user.id, planId, planDayId } });

    expect(await db.workout.count({ where: { planId } })).toBe(
      WORKOUTS_CREATED,
    );
  });

  it("allows one open workout on each of two plans", async () => {
    const user = await createUser();
    const oldPlan = await createPlanDay(user.id);
    const newPlan = await createPlanDay(user.id, true);

    await db.workout.create({ data: { userId: user.id, ...oldPlan } });
    await db.workout.create({ data: { userId: user.id, ...newPlan } });

    expect(
      await db.workout.count({ where: { userId: user.id, finishedAt: null } }),
    ).toBe(WORKOUTS_CREATED);
  });

  it("allows more than one open workout without a plan", async () => {
    const user = await createUser();

    await db.workout.create({ data: { userId: user.id } });
    await db.workout.create({ data: { userId: user.id } });

    expect(
      await db.workout.count({ where: { userId: user.id, finishedAt: null } }),
    ).toBe(WORKOUTS_CREATED);
  });
});

type Insert = () => Promise<unknown>;

async function setLog(values: {
  setNumber?: number;
  reps?: number;
  rpe?: number;
  weightKg?: number;
}) {
  const user = await createUser();
  const workout = await createFinishedWorkout(user.id);
  return db.setLog.create({
    data: {
      workoutId: workout.id,
      exerciseId: exerciseIds[0],
      setNumber: values.setNumber ?? FIRST_SET,
      reps: values.reps ?? VALID_REPS,
      rpe: values.rpe,
      weightKg: values.weightKg,
    },
  });
}

async function runLog(values: {
  distanceKm?: number;
  durationSec?: number;
  rpe?: number;
}) {
  const user = await createUser();
  const workout = await createFinishedWorkout(user.id);
  return db.runLog.create({
    data: {
      workoutId: workout.id,
      distanceKm: values.distanceKm ?? VALID_DISTANCE_KM,
      durationSec: values.durationSec ?? VALID_DURATION_SEC,
      rpe: values.rpe,
    },
  });
}

async function planExercise(values: {
  sets?: number;
  reps?: number;
  restSeconds?: number;
  order?: number;
}) {
  const user = await createUser();
  const { planDayId } = await createPlanDay(user.id);
  return db.planExercise.create({
    data: {
      planDayId,
      exerciseId: exerciseIds[0],
      order: values.order ?? FIRST_ORDER,
      sets: values.sets ?? VALID_SETS,
      reps: values.reps ?? VALID_REPS,
      restSeconds: values.restSeconds ?? VALID_REST_SECONDS,
    },
  });
}

async function planRun(values: {
  distanceKm?: number;
  targetPaceSecPerKm?: number | null;
}) {
  const user = await createUser();
  const { planDayId } = await createPlanDay(user.id);
  return db.planRun.create({
    data: {
      planDayId,
      type: "EASY",
      distanceKm: values.distanceKm ?? VALID_DISTANCE_KM,
      targetPaceSecPerKm:
        values.targetPaceSecPerKm === undefined
          ? VALID_PACE_SEC_PER_KM
          : values.targetPaceSecPerKm,
    },
  });
}

async function planDay(dayIndex: number) {
  const user = await createUser();
  const { planId } = await createPlanDay(user.id);
  return db.planDay.create({ data: { planId, dayIndex, name: "Extra day" } });
}

async function profile(daysPerWeek: number, existingUserId?: string) {
  const userId = existingUserId ?? (await createUser()).id;
  return db.profile.create({
    data: {
      userId,
      goal: "GENERAL_FITNESS",
      level: "BEGINNER",
      daysPerWeek,
      equipment: [],
    },
  });
}

describe("range checks", () => {
  // [what is wrong, the constraint that must reject it, the insert]
  const outOfRange: [string, string, Insert][] = [
    [
      "SetLog.setNumber below 1",
      "SetLog_setNumber_check",
      () => setLog({ setNumber: FIRST_SET - 1 }),
    ],
    [
      "SetLog.reps below 0",
      "SetLog_reps_check",
      () => setLog({ reps: FEWEST_LOGGED_REPS - 1 }),
    ],
    [
      "SetLog.rpe below 1",
      "SetLog_rpe_check",
      () => setLog({ rpe: RPE_MIN - 1 }),
    ],
    [
      "SetLog.rpe above 10",
      "SetLog_rpe_check",
      () => setLog({ rpe: RPE_MAX + 1 }),
    ],
    [
      "SetLog.weightKg below 0",
      "SetLog_weightKg_check",
      () => setLog({ weightKg: NEGATIVE_WEIGHT_KG }),
    ],
    [
      "RunLog.distanceKm of 0",
      "RunLog_distanceKm_check",
      () => runLog({ distanceKm: 0 }),
    ],
    [
      "RunLog.durationSec of 0",
      "RunLog_durationSec_check",
      () => runLog({ durationSec: 0 }),
    ],
    [
      "RunLog.rpe below 1",
      "RunLog_rpe_check",
      () => runLog({ rpe: RPE_MIN - 1 }),
    ],
    [
      "RunLog.rpe above 10",
      "RunLog_rpe_check",
      () => runLog({ rpe: RPE_MAX + 1 }),
    ],
    [
      "PlanExercise.sets below 1",
      "PlanExercise_sets_check",
      () => planExercise({ sets: FEWEST_SETS - 1 }),
    ],
    [
      "PlanExercise.reps below 1",
      "PlanExercise_reps_check",
      () => planExercise({ reps: FEWEST_PLANNED_REPS - 1 }),
    ],
    [
      "PlanExercise.restSeconds below 0",
      "PlanExercise_restSeconds_check",
      () => planExercise({ restSeconds: NO_REST - 1 }),
    ],
    [
      "PlanExercise.order below 0",
      "PlanExercise_order_check",
      () => planExercise({ order: FIRST_ORDER - 1 }),
    ],
    [
      "PlanRun.distanceKm of 0",
      "PlanRun_distanceKm_check",
      () => planRun({ distanceKm: 0 }),
    ],
    [
      "PlanRun.targetPaceSecPerKm of 0",
      "PlanRun_targetPaceSecPerKm_check",
      () => planRun({ targetPaceSecPerKm: 0 }),
    ],
    [
      "PlanDay.dayIndex below 0",
      "PlanDay_dayIndex_check",
      () => planDay(DAY_INDEX_MIN - 1),
    ],
    [
      "PlanDay.dayIndex above 6",
      "PlanDay_dayIndex_check",
      () => planDay(DAY_INDEX_MAX + 1),
    ],
    [
      "Profile.daysPerWeek below 1",
      "Profile_daysPerWeek_check",
      () => profile(DAYS_PER_WEEK_MIN - 1),
    ],
    [
      "Profile.daysPerWeek above 7",
      "Profile_daysPerWeek_check",
      () => profile(DAYS_PER_WEEK_MAX + 1),
    ],
  ];

  it.each(outOfRange)(
    "rejects %s by %s",
    async (_label, constraint, insert) => {
      await expect(insert()).rejects.toThrow(checkViolation(constraint));
    },
  );

  const atTheBoundary: [string, Insert][] = [
    [
      "SetLog at the lowest setNumber, reps, rpe and weight",
      () =>
        setLog({
          setNumber: FIRST_SET,
          reps: FEWEST_LOGGED_REPS,
          rpe: RPE_MIN,
          weightKg: NO_WEIGHT,
        }),
    ],
    ["SetLog at the highest rpe", () => setLog({ rpe: RPE_MAX })],
    ["RunLog at the lowest rpe", () => runLog({ rpe: RPE_MIN })],
    ["RunLog at the highest rpe", () => runLog({ rpe: RPE_MAX })],
    ["RunLog with no rpe", () => runLog({})],
    [
      "PlanExercise at the lowest sets, reps, rest and order",
      () =>
        planExercise({
          sets: FEWEST_SETS,
          reps: FEWEST_PLANNED_REPS,
          restSeconds: NO_REST,
          order: FIRST_ORDER,
        }),
    ],
    [
      "PlanRun with no target pace",
      () => planRun({ targetPaceSecPerKm: null }),
    ],
    ["PlanDay at the last dayIndex", () => planDay(DAY_INDEX_MAX)],
    ["Profile at the fewest daysPerWeek", () => profile(DAYS_PER_WEEK_MIN)],
    ["Profile at the most daysPerWeek", () => profile(DAYS_PER_WEEK_MAX)],
  ];

  it.each(atTheBoundary)("accepts %s", async (_label, insert) => {
    await expect(insert()).resolves.toBeDefined();
  });
});
