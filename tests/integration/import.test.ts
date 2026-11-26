// Integration test for the workout import (#131) against a real PostgreSQL: the fixture file
// saves once, a second upload adds nothing, rows are owned by the user and marked imported.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});

import { prisma as db } from "@/lib/prisma";
import { parseHevyCsv } from "@/lib/import/hevy";
import { saveImport } from "@/lib/import/save";

const prefix = `import-${randomUUID()}`;
let sequence = 0;

function athlete() {
  return db.user.create({
    data: {
      name: "Import athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: true,
    },
  });
}

const exerciseIds = [`${prefix}-bench`, `${prefix}-carry`];

beforeAll(async () => {
  await db.exercise.createMany({
    data: exerciseIds.map((id) => ({
      id,
      name: `${prefix} ${id}`,
      level: "BEGINNER",
      category: "strength",
      equipment: "body only",
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    })),
  });
});

// Users go first: their workouts and sets are deleted with them, and sets point at exercises.
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  await db.$disconnect();
});

function twoExercises() {
  return { bench: exerciseIds[0], carry: exerciseIds[1] };
}

describe("workout import on PostgreSQL", () => {
  it("saves the fixture once, owned and marked imported, and a second upload adds nothing", async () => {
    const parsed = parseHevyCsv(
      readFileSync("tests/fixtures/hevy-export.csv", "utf8"),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const user = await athlete();
    const { bench, carry } = twoExercises();
    const mapping = {
      "Bench Press (Barbell)": bench,
      "Face Pull (Cable)": carry,
      "Pull Up": carry,
    };

    const first = await db.$transaction((tx) =>
      saveImport(tx, user.id, parsed.workouts, mapping),
    );
    expect(first).toMatchObject({ imported: 2, alreadyImported: 0 });

    const stored = await db.workout.findMany({
      where: { userId: user.id },
      include: { sets: true },
      orderBy: { startedAt: "asc" },
    });
    expect(stored).toHaveLength(2);
    expect(stored.every((workout) => workout.source === "hevy-import")).toBe(
      true,
    );
    expect(stored[0].startedAt.toISOString()).toBe("2024-06-20T22:30:00.000Z");
    expect(stored[0].finishedAt?.toISOString()).toBe(
      "2024-06-20T23:20:00.000Z",
    );
    expect(stored[0].sets.map((set) => set.reps).sort((a, b) => a - b)).toEqual(
      [7, 8, 15],
    );

    const second = await db.$transaction((tx) =>
      saveImport(tx, user.id, parsed.workouts, mapping),
    );
    expect(second).toMatchObject({ imported: 0, alreadyImported: 2, sets: 0 });
    expect(await db.workout.count({ where: { userId: user.id } })).toBe(2);
    expect(
      await db.setLog.count({ where: { workout: { userId: user.id } } }),
    ).toBe(4);
  });

  // Live bug L4: the first upload skipped an unmapped exercise, so the stored workout had
  // only part of it; a later upload with the exercise mapped fills it in, once.
  it("fills in exercises a first upload skipped, without duplicating sets", async () => {
    const parsed = parseHevyCsv(
      readFileSync("tests/fixtures/hevy-export.csv", "utf8"),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const user = await athlete();
    const { bench, carry } = twoExercises();
    const partial = { "Bench Press (Barbell)": bench };
    const complete = {
      ...partial,
      "Face Pull (Cable)": carry,
      "Pull Up": carry,
    };
    const first = await db.$transaction((tx) =>
      saveImport(tx, user.id, parsed.workouts, partial),
    );
    expect(first.repairedSets).toBe(0);
    const before = await db.setLog.count({
      where: { workout: { userId: user.id } },
    });

    const repair = await db.$transaction((tx) =>
      saveImport(tx, user.id, parsed.workouts, complete),
    );
    // Pull Day has only Pull Up, unmapped in the first upload, so it was never stored: the
    // second upload creates it (imported 1) and repairs Push Day (alreadyImported 1).
    expect(repair).toMatchObject({ imported: 1, alreadyImported: 1 });
    expect(repair.repairedSets).toBeGreaterThan(0);
    const after = await db.setLog.count({
      where: { workout: { userId: user.id } },
    });
    expect(after).toBe(before + repair.sets);
    expect(repair.sets).toBeGreaterThan(repair.repairedSets);

    const again = await db.$transaction((tx) =>
      saveImport(tx, user.id, parsed.workouts, complete),
    );
    expect(again).toMatchObject({ repairedSets: 0, sets: 0 });
    expect(
      await db.setLog.count({ where: { workout: { userId: user.id } } }),
    ).toBe(after);
  });

  it("saves two file titles mapped to one exercise with sets numbered in order", async () => {
    const csv = [
      "title,start_time,end_time,exercise_title,set_type,weight_kg,reps",
      'A,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",Pull Up,normal,,10',
      'A,"20 Jun 2024, 18:30","20 Jun 2024, 19:00",Pull-up,normal,,8',
    ].join("\n");
    const parsed = parseHevyCsv(csv);
    if (!parsed.ok) throw new Error(parsed.error);
    const { bench } = twoExercises();
    const user = await athlete();
    const result = await db.$transaction((tx) =>
      saveImport(tx, user.id, parsed.workouts, {
        "Pull Up": bench,
        "Pull-up": bench,
      }),
    );
    expect(result).toMatchObject({ imported: 1, sets: 2 });
    const sets = await db.setLog.findMany({
      where: { workout: { userId: user.id } },
      orderBy: { setNumber: "asc" },
    });
    expect(sets.map((set) => set.setNumber)).toEqual([1, 2]);
  });

  it("lets two users import the same file", async () => {
    const parsed = parseHevyCsv(
      readFileSync("tests/fixtures/hevy-export.csv", "utf8"),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const { bench } = twoExercises();
    const mapping = { "Bench Press (Barbell)": bench };
    const [a, b] = await Promise.all([athlete(), athlete()]);
    await db.$transaction((tx) =>
      saveImport(tx, a.id, parsed.workouts, mapping),
    );
    const result = await db.$transaction((tx) =>
      saveImport(tx, b.id, parsed.workouts, mapping),
    );
    expect(result.imported).toBe(1);
  });
});
