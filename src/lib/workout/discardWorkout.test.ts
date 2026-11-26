// Unit test for discarding an unfinished workout (D47): the delete is scoped to the owner and
// to a workout that is not finished, and reports whether a row was removed.
import { describe, expect, it, vi } from "vitest";
import { discardOpenWorkout } from "./discardWorkout";

const WORKOUT_ID = 42;

function fakeDb(count: number) {
  const deleteMany = vi.fn().mockResolvedValue({ count });
  return { db: { workout: { deleteMany } }, deleteMany };
}

describe("discardOpenWorkout", () => {
  it("deletes only this user's unfinished workout with that id", async () => {
    const { db, deleteMany } = fakeDb(1);
    await discardOpenWorkout(db, "user-1", WORKOUT_ID);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: WORKOUT_ID, userId: "user-1", finishedAt: null },
    });
  });

  it("reports true when a workout was removed", async () => {
    expect(await discardOpenWorkout(fakeDb(1).db, "user-1", WORKOUT_ID)).toBe(
      true,
    );
  });

  it("reports false when nothing matched (missing, finished or someone else's)", async () => {
    expect(await discardOpenWorkout(fakeDb(0).db, "user-1", WORKOUT_ID)).toBe(
      false,
    );
  });
});
