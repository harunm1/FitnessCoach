// Fills the free demo account with sample workouts so every part of the progress
// page (#16) can be tried: both streaks, three months of calendar, a day with two
// workouts, runs with pace, a late-evening session, a session without a plan,
// lifting outside "strength", stretching and cardio, and an unfinished workout.
//
//   npx tsx scripts/seed-progress-demo.ts
//
// Local only. Re-running replaces the demo workouts; nothing else is touched.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  DayKind,
  PlanSource,
  Prisma,
  PrismaClient,
} from "../src/generated/prisma/client";
import {
  DEMO_PLAN_DAYS,
  demoSchedule,
  expectedStreaks,
  torontoTime,
  type DemoKind,
} from "./progress-demo/schedule";

const DEMO_EMAIL = "demo-free@fitnesscoach.local";
const PLAN_NAME = "Progress demo plan";
// Marks the demo workouts, so a re-run deletes exactly these and nothing else.
const SEED_NOTE = "progress-demo";

type Slot = {
  category: string;
  muscle?: string; // a primary muscle to look for, when it matters
  sets: number;
  reps: number;
  baseKg: number | null; // null for bodyweight
};

const SLOTS: Record<Exclude<DemoKind, "run">, Slot[]> = {
  upper: [
    { category: "strength", muscle: "chest", sets: 3, reps: 8, baseKg: 40 },
    { category: "strength", muscle: "lats", sets: 3, reps: 10, baseKg: 45 },
    {
      category: "strength",
      muscle: "shoulders",
      sets: 3,
      reps: 10,
      baseKg: 20,
    },
    { category: "strength", muscle: "biceps", sets: 2, reps: 12, baseKg: 12 },
  ],
  lower: [
    {
      category: "strength",
      muscle: "quadriceps",
      sets: 3,
      reps: 8,
      baseKg: 60,
    },
    {
      category: "strength",
      muscle: "hamstrings",
      sets: 3,
      reps: 10,
      baseKg: 50,
    },
    { category: "strength", muscle: "glutes", sets: 2, reps: 10, baseKg: 40 },
    { category: "strength", muscle: "calves", sets: 2, reps: 12, baseKg: 30 },
    {
      category: "strength",
      muscle: "abdominals",
      sets: 2,
      reps: 15,
      baseKg: null,
    },
  ],
  power: [
    { category: "powerlifting", sets: 3, reps: 5, baseKg: 80 },
    { category: "plyometrics", sets: 3, reps: 6, baseKg: null },
    { category: "strength", muscle: "triceps", sets: 2, reps: 10, baseKg: 15 },
  ],
  free: [
    { category: "strength", muscle: "chest", sets: 3, reps: 10, baseKg: 35 },
    { category: "strength", muscle: "triceps", sets: 2, reps: 12, baseKg: 12 },
  ],
  stretch: [{ category: "stretching", sets: 1, reps: 1, baseKg: null }],
  cardio: [{ category: "cardio", sets: 1, reps: 1, baseKg: null }],
};

// Heavier over the weeks, in steps a gym can load (2.5 kg).
function weightFor(baseKg: number | null, weeksAgo: number) {
  if (baseKg === null) return null;
  return Math.round((baseKg + (11 - weeksAgo) * 1.25) / 2.5) * 2.5;
}

function assertLocalDatabase(connectionString: string | undefined) {
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  const host = new URL(connectionString).hostname;
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(host)
  ) {
    throw new Error("The progress demo only runs on a local database.");
  }
}

async function main() {
  assertLocalDatabase(process.env.DATABASE_URL);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
      select: { id: true },
    });
    if (!user) {
      throw new Error(
        `${DEMO_EMAIL} doesn't exist yet. Set DEMO_PASSWORD in .env and run npm run db:seed first.`,
      );
    }

    // One library exercise per slot, found once and reused.
    const exercises = new Map<string, { id: string; name: string } | null>();
    const exerciseFor = async (slot: Slot) => {
      const key = `${slot.category}:${slot.muscle ?? ""}`;
      if (!exercises.has(key)) {
        exercises.set(
          key,
          await prisma.exercise.findFirst({
            where: {
              category: slot.category,
              ...(slot.muscle && { primaryMuscles: { has: slot.muscle } }),
            },
            orderBy: { id: "asc" },
            select: { id: true, name: true },
          }),
        );
      }
      return exercises.get(key) ?? null;
    };

    const now = new Date();
    const schedule = demoSchedule(now);

    await prisma.$transaction(async (tx) => {
      await tx.workout.deleteMany({
        where: { userId: user.id, notes: SEED_NOTE },
      });
      await tx.plan.deleteMany({
        where: { userId: user.id, name: PLAN_NAME },
      });

      // Inactive, so the session screen keeps using the account's real plan.
      const plan = await tx.plan.create({
        data: {
          userId: user.id,
          name: PLAN_NAME,
          source: PlanSource.DEFAULT,
          active: false,
          days: {
            create: [
              { dayIndex: 0, name: "Upper body", kind: DayKind.STRENGTH },
              { dayIndex: 1, name: "Lower body", kind: DayKind.STRENGTH },
              { dayIndex: 2, name: "Easy run", kind: DayKind.RUN },
              { dayIndex: 3, name: "Rest", kind: DayKind.REST },
            ],
          },
        },
        select: { id: true, days: { select: { id: true, name: true } } },
      });
      const dayId = (name: string) =>
        plan.days.find((day) => day.name === name)?.id ?? null;
      const PLAN_DAY: Partial<Record<DemoKind, string>> = {
        upper: "Upper body",
        lower: "Lower body",
        power: "Lower body",
        run: "Easy run",
      };

      for (const workout of schedule) {
        const start = torontoTime(workout.day, workout.hour, workout.minute);
        const sets: Prisma.SetLogCreateWithoutWorkoutInput[] = [];
        if (workout.kind !== "run") {
          for (const slot of SLOTS[workout.kind]) {
            const exercise = await exerciseFor(slot);
            if (!exercise) continue;
            for (let setNumber = 1; setNumber <= slot.sets; setNumber++) {
              const weight = weightFor(slot.baseKg, workout.weeksAgo);
              sets.push({
                exercise: { connect: { id: exercise.id } },
                setNumber,
                reps: slot.reps,
                weightKg: weight === null ? null : new Prisma.Decimal(weight),
                loggedAt: new Date(
                  start.getTime() + (sets.length + 1) * 3 * 60000,
                ),
              });
            }
          }
        }

        const planDayName = PLAN_DAY[workout.kind];
        await tx.workout.create({
          data: {
            userId: user.id,
            planId: workout.withPlan ? plan.id : null,
            planDayId:
              workout.withPlan && planDayName ? dayId(planDayName) : null,
            startedAt: start,
            finishedAt: workout.finished
              ? new Date(start.getTime() + workout.minutes * 60000)
              : null,
            distanceKm: workout.run
              ? new Prisma.Decimal(workout.run.km.toFixed(2))
              : null,
            durationSeconds: workout.run?.seconds ?? null,
            notes: SEED_NOTE,
            sets: { create: sets },
          },
        });
      }
    });

    const missing = [...exercises]
      .filter(([, exercise]) => exercise === null)
      .map(([key]) => key);
    const { activeWeeks, goalWeeks } = expectedStreaks(now);
    const unfinished = schedule.filter((w) => !w.finished).length;
    console.log(
      `Added ${schedule.length} demo workouts (${unfinished} left unfinished) to ${DEMO_EMAIL}, with a ${DEMO_PLAN_DAYS}-day plan.`,
    );
    console.log(
      `Expected on /progress from the demo alone: active streak ${activeWeeks} weeks, goal streak ${goalWeeks} weeks.`,
    );
    if (missing.length > 0) {
      console.log(
        `No library exercise for: ${missing.join(", ")}. Run npm run db:seed to load the exercises.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
