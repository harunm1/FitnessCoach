// The set list of one exercise while some sets wait in the offline queue (D31): queued sets
// are shown and counted, and the next set number follows them.
import { describe, expect, it } from "vitest";
import { mergeLoggedSets } from "./mergeLoggedSets";

const SET_ONE = 1;
const SET_TWO = 2;
const SET_THREE = 3;
const PLANNED = 3;
const REPS = 8;
const EDITED_REPS = 9;
const FIRST_QUEUED_AT = 5_000;
const LATER_QUEUED_AT = 6_000;

const server = [{ id: 1, setNumber: SET_ONE, reps: REPS, weightKg: "12" }];

describe("mergeLoggedSets", () => {
  it("counts only server sets when nothing is queued", () => {
    expect(mergeLoggedSets(server, [], PLANNED)).toMatchObject({
      loggedCount: 1,
      nextSetNumber: SET_TWO,
      remaining: SET_TWO,
      latestQueuedAt: null,
    });
  });

  it("adds queued sets to the list, the count and the next set number", () => {
    const merged = mergeLoggedSets(
      server,
      [
        {
          clientId: "b",
          setNumber: SET_TWO,
          reps: REPS,
          weightKg: null,
          queuedAt: FIRST_QUEUED_AT,
          error: null,
        },
      ],
      PLANNED,
    );
    expect(merged.rows).toEqual([
      {
        key: "server-1",
        setNumber: SET_ONE,
        reps: REPS,
        weightKg: "12",
        queued: false,
        error: null,
      },
      {
        key: "queued-b",
        setNumber: SET_TWO,
        reps: REPS,
        weightKg: null,
        queued: true,
        error: null,
      },
    ]);
    expect(merged).toMatchObject({
      loggedCount: SET_TWO,
      nextSetNumber: SET_THREE,
      remaining: 1,
      latestQueuedAt: FIRST_QUEUED_AT,
    });
  });

  it("shows a queued edit of a logged set in place of the server values", () => {
    const merged = mergeLoggedSets(
      server,
      [
        {
          clientId: "e",
          setNumber: SET_ONE,
          reps: EDITED_REPS,
          weightKg: null,
          queuedAt: LATER_QUEUED_AT,
          error: null,
        },
      ],
      PLANNED,
    );
    expect(merged.rows).toHaveLength(1);
    expect(merged.rows[0]).toMatchObject({ reps: EDITED_REPS, queued: true });
    expect(merged.nextSetNumber).toBe(SET_TWO);
  });

  it("reports no remaining sets once the plan's sets are all logged or queued", () => {
    const queued = [SET_TWO, SET_THREE].map((setNumber) => ({
      clientId: `q${setNumber}`,
      setNumber,
      reps: REPS,
      weightKg: null,
      queuedAt: LATER_QUEUED_AT + setNumber,
      error: null,
    }));
    expect(mergeLoggedSets(server, queued, PLANNED)).toMatchObject({
      loggedCount: PLANNED,
      remaining: 0,
      latestQueuedAt: LATER_QUEUED_AT + SET_THREE,
    });
  });
});
