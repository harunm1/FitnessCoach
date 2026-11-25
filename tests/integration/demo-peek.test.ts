// Integration test for the demo peek (#162) against a real PostgreSQL: it sends only
// BEGIN, SET TRANSACTION READ ONLY, SELECT and COMMIT, changes no row, and the same
// transaction pattern makes Postgres refuse a write (code 25006).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { NO_SUCH_USER, peekDemoUser } from "../../scripts/demo-peek/queries";
import { testDatabaseURL } from "../helpers/database-url";

const statements: string[] = [];
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testDatabaseURL() }),
  log: [{ emit: "event", level: "query" }],
});
db.$on("query", (event) => statements.push(event.query));

const prefix = `peek-${randomUUID()}`;
const email = `${prefix}@example.test`;
const exerciseId = `${prefix}-squat`;
const PHOTO_FILE = "x.webp";
const REPS = 5;
const ALLOWED_STATEMENTS = [
  "BEGIN",
  "COMMIT",
  "SET TRANSACTION READ ONLY",
  "SELECT",
];

beforeAll(async () => {
  await db.exercise.create({
    data: {
      id: exerciseId,
      name: "Peek Squat",
      level: "BEGINNER",
      category: "strength",
      primaryMuscles: [],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    },
  });
  const user = await db.user.create({
    data: { name: "Peek", email, tier: "TRIAL" },
  });
  const workout = await db.workout.create({ data: { userId: user.id } });
  await db.setLog.create({
    data: { workoutId: workout.id, exerciseId, setNumber: 1, reps: REPS },
  });
  await db.progressPhoto.create({
    data: { userId: user.id, storageKey: `progress/${user.id}/${PHOTO_FILE}` },
  });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.exercise.deleteMany({ where: { id: exerciseId } });
  await db.$disconnect();
});

describe("demo peek against PostgreSQL", () => {
  it("reads the rows, sends only read statements and changes nothing", async () => {
    const before = await db.setLog.count();
    statements.length = 0;
    const result = await peekDemoUser(db, email.toUpperCase());
    if (result === NO_SUCH_USER) throw new Error("expected the user");
    expect(result.totals).toEqual({ workouts: 1, sets: 1, photos: 1 });
    expect(statements.map((s) => s.trim().toUpperCase())).toContain(
      "SET TRANSACTION READ ONLY",
    );
    statements.forEach((statement) =>
      expect(
        ALLOWED_STATEMENTS.some((start) =>
          statement.trimStart().toUpperCase().startsWith(start),
        ),
      ).toBe(true),
    );
    expect(await db.setLog.count()).toBe(before);
  });

  it("refuses a write inside the read-only transaction", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.user.updateMany({ where: { email }, data: { name: "X" } });
      }),
    ).rejects.toThrow("read-only transaction");
  });
});
