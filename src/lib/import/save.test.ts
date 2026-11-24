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
function fakeDb(existing: string[] = []) {
  const createdWorkouts = vi.fn(
    async ({ data }: { data: { importKey: string }[] }) =>
      data
        .filter((row) => !existing.includes(row.importKey))
        .map((row, index) => ({ id: 100 + index, importKey: row.importKey })),
  );
  const createdSets = vi.fn<
    (args: { data: unknown }) => Promise<{ count: number }>
  >(async () => ({ count: 0 }));
  const db = {
    workout: { createManyAndReturn: createdWorkouts },
    setLog: { createMany: createdSets },
  } as unknown as ImportDb;
  return { db, createdWorkouts, createdSets };
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
    });
    expect(result).toEqual({
      imported: 1,
      alreadyImported: 0,
      sets: 1,
      skippedSets: 1,
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
    });
  });

  it("adds nothing for a workout already imported", async () => {
    const { db, createdSets } = fakeDb([push.key]);
    const result = await saveImport(db, "user-1", [push], mapping);
    expect(createdSets).not.toHaveBeenCalled();
    expect(result).toEqual({
      imported: 0,
      alreadyImported: 1,
      sets: 0,
      skippedSets: 1,
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
