// Tests for saving imported workouts (#131): owned by the user, marked as imported, mapped
// exercises only, and a re-upload adds nothing. The database is a fake that records its calls.
import { describe, expect, it, vi } from "vitest";
import type { ImportWorkout } from "./hevy";
import { saveImport, type ImportDb } from "./save";

const when = (iso: string) => new Date(iso);

const push: ImportWorkout = {
  key: "2024-06-20T22:30:00.000Z|Push Day",
  title: "Push Day",
  startedAt: when("2024-06-20T22:30:00.000Z"),
  finishedAt: when("2024-06-20T23:20:00.000Z"),
  sets: [
    {
      exerciseTitle: "Bench Press (Barbell)",
      setNumber: 1,
      reps: 8,
      weightKg: 80,
      rpe: 8,
    },
    {
      exerciseTitle: "Zercher Carry",
      setNumber: 1,
      reps: 12,
      weightKg: 60,
      rpe: null,
    },
  ],
};
const onlySkipped: ImportWorkout = {
  key: "2024-06-22T11:00:00.000Z|Carry Day",
  title: "Carry Day",
  startedAt: when("2024-06-22T11:00:00.000Z"),
  finishedAt: when("2024-06-22T11:45:00.000Z"),
  sets: [
    {
      exerciseTitle: "Zercher Carry",
      setNumber: 1,
      reps: 12,
      weightKg: 60,
      rpe: null,
    },
  ],
};

// Returns the ids of the rows the fake "created"; keys listed in `existing` are skipped
// the way skipDuplicates skips them.
// `have` lists, per importKey, the exercise ids the stored workout already has sets for.
function fakeDb(existing: string[] = [], have: Record<string, string[]> = {}) {
  const createdWorkouts = vi.fn(
    async ({ data }: { data: { importKey: string }[] }) =>
      data
        .filter((row) => !existing.includes(row.importKey))
        .map((row, index) => ({ id: 100 + index, importKey: row.importKey })),
  );
  const createdSets = vi.fn<
    (args: { data: unknown }) => Promise<{ count: number }>
  >(async () => ({ count: 0 }));
  const found = vi.fn(async () =>
    existing.map((key, index) => ({
      id: 500 + index,
      importKey: key,
      sets: (have[key] ?? []).map((exerciseId) => ({ exerciseId })),
    })),
  );
  const db = {
    workout: { createManyAndReturn: createdWorkouts, findMany: found },
    setLog: { createMany: createdSets },
  } as unknown as ImportDb;
  return { db, createdWorkouts, createdSets, found };
}

const mapping = { "Bench Press (Barbell)": "bench" };

describe("saveImport", () => {
  it("saves a finished workout owned by the user, marked as imported, with its original times", async () => {
    const { db, createdWorkouts, createdSets } = fakeDb();
    const result = await saveImport(db, "user-1", [push], mapping);
    expect(createdWorkouts).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          source: "hevy-import",
          importKey: push.key,
          startedAt: push.startedAt,
          finishedAt: push.finishedAt,
          notes: "Push Day",
        },
      ],
      skipDuplicates: true,
      select: { id: true, importKey: true },
    });
    expect(createdSets).toHaveBeenCalledWith({
      data: [
        {
          workoutId: 100,
          exerciseId: "bench",
          setNumber: 1,
          reps: 8,
          weightKg: 80,
          rpe: 8,
          loggedAt: push.startedAt,
        },
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual({
      imported: 1,
      alreadyImported: 0,
      sets: 1,
      skippedSets: 1,
      repairedWorkouts: 0,
      repairedSets: 0,
    });
  });

  it("drops sets for names the user skipped, and a workout left with no sets", async () => {
    const { db, createdWorkouts } = fakeDb();
    const result = await saveImport(db, "user-1", [onlySkipped], mapping);
    expect(createdWorkouts).not.toHaveBeenCalled();
    expect(result).toEqual({
      imported: 0,
      alreadyImported: 0,
      sets: 0,
      skippedSets: 1,
      repairedWorkouts: 0,
      repairedSets: 0,
    });
  });

  it("adds nothing for a workout already imported", async () => {
    const { db, createdSets } = fakeDb([push.key], { [push.key]: ["bench"] });
    const result = await saveImport(db, "user-1", [push], mapping);
    expect(createdSets).not.toHaveBeenCalled();
    expect(result).toEqual({
      imported: 0,
      alreadyImported: 1,
      sets: 0,
      skippedSets: 1,
      repairedWorkouts: 0,
      repairedSets: 0,
    });
  });

  // Live bug L4, 25 Nov: "Full Body B" was saved with only its Romanian Deadlift because the
  // other names were unmapped at the first upload; a re-upload then found the workout and
  // added nothing, so the missing exercises could never be filled in.
  describe("a workout already imported with only some of its exercises", () => {
    const fullBody: ImportWorkout = {
      key: "2026-10-07T17:00:00.000Z|Full Body B",
      title: "Full Body B",
      startedAt: when("2026-10-07T17:00:00.000Z"),
      finishedAt: when("2026-10-07T18:31:00.000Z"),
      sets: [
        {
          exerciseTitle: "Romanian Deadlift",
          setNumber: 1,
          reps: 8,
          weightKg: 100,
          rpe: null,
        },
        {
          exerciseTitle: "Face Pull",
          setNumber: 1,
          reps: 15,
          weightKg: 20,
          rpe: null,
        },
        {
          exerciseTitle: "Face Pull",
          setNumber: 2,
          reps: 14,
          weightKg: 20,
          rpe: null,
        },
        {
          exerciseTitle: "Lat Pulldown",
          setNumber: 1,
          reps: 10,
          weightKg: 50,
          rpe: null,
        },
      ],
    };
    const all = {
      "Romanian Deadlift": "rdl",
      "Face Pull": "face",
      "Lat Pulldown": "lat",
    };

    it("adds the exercises the stored workout lacks, numbered from 1", async () => {
      const { db, createdSets } = fakeDb([fullBody.key], {
        [fullBody.key]: ["rdl"],
      });
      const result = await saveImport(db, "user-1", [fullBody], all);
      expect(createdSets).toHaveBeenCalledTimes(1);
      expect(createdSets.mock.calls[0][0].data).toEqual([
        {
          workoutId: 500,
          exerciseId: "face",
          setNumber: 1,
          reps: 15,
          weightKg: 20,
          rpe: null,
          loggedAt: fullBody.startedAt,
        },
        {
          workoutId: 500,
          exerciseId: "face",
          setNumber: 2,
          reps: 14,
          weightKg: 20,
          rpe: null,
          loggedAt: fullBody.startedAt,
        },
        {
          workoutId: 500,
          exerciseId: "lat",
          setNumber: 1,
          reps: 10,
          weightKg: 50,
          rpe: null,
          loggedAt: fullBody.startedAt,
        },
      ]);
      expect(result).toMatchObject({
        imported: 0,
        alreadyImported: 1,
        repairedWorkouts: 1,
        repairedSets: 3,
        sets: 3,
      });
    });

    it("never touches an exercise the workout already has, so a third upload adds nothing", async () => {
      const { db, createdSets } = fakeDb([fullBody.key], {
        [fullBody.key]: ["rdl", "face", "lat"],
      });
      const result = await saveImport(db, "user-1", [fullBody], all);
      expect(createdSets).not.toHaveBeenCalled();
      expect(result).toMatchObject({ repairedWorkouts: 0, repairedSets: 0 });
    });

    it("only looks at the user's own workouts", async () => {
      const { db, found } = fakeDb([fullBody.key], { [fullBody.key]: ["rdl"] });
      await saveImport(db, "user-1", [fullBody], all);
      expect(found).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", importKey: { in: [fullBody.key] } },
        }),
      );
    });
  });
  it("numbers sets per library exercise when two file titles map to the same one", async () => {
    const { db, createdSets } = fakeDb();
    const twoTitles: ImportWorkout = {
      ...push,
      sets: [
        {
          exerciseTitle: "Pull Up",
          setNumber: 1,
          reps: 10,
          weightKg: null,
          rpe: null,
        },
        {
          exerciseTitle: "Pull-up",
          setNumber: 1,
          reps: 8,
          weightKg: null,
          rpe: null,
        },
      ],
    };
    await saveImport(db, "user-1", [twoTitles], {
      "Pull Up": "pullups",
      "Pull-up": "pullups",
    });
    const rows = createdSets.mock.calls[0][0].data as { setNumber: number }[];
    expect(rows.map((row) => row.setNumber)).toEqual([1, 2]);
  });

  it("treats a title like 'constructor' as a name to skip, not as a mapped exercise", async () => {
    const { db, createdWorkouts } = fakeDb();
    const odd: ImportWorkout = {
      ...push,
      sets: [
        {
          exerciseTitle: "constructor",
          setNumber: 1,
          reps: 5,
          weightKg: null,
          rpe: null,
        },
      ],
    };
    const result = await saveImport(db, "user-1", [odd], {});
    expect(createdWorkouts).not.toHaveBeenCalled();
    expect(result.skippedSets).toBe(1);
  });
});
