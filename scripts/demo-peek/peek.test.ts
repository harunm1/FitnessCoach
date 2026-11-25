// Tests for the read-only demo peek (#162): the query stays inside a READ ONLY
// transaction, uses only read methods, and the printout carries the rows the
// presenter must point at (set time, weight, photo time, storage key).
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { formatPeek } from "./format";
import { NO_SUCH_USER, peekDemoUser, type PeekResult } from "./queries";

const WORKOUT_ID = 7;
const SET_ID = 12;
const PHOTO_ID = 3;
const SET_NUMBER = 2;
const REPS = 8;
const WORKOUT_COUNT = 5;
const SET_COUNT = 40;
const PHOTO_COUNT = 1;
const SETS_IN_WORKOUT = 2;

const USER = { id: "u1", name: "Demo Person", tier: "TRIAL" };
const WORKOUTS = [
  {
    id: WORKOUT_ID,
    startedAt: new Date("2026-11-26T17:00:00Z"),
    finishedAt: null,
    source: "live",
    _count: { sets: SETS_IN_WORKOUT },
  },
];
const SETS = [
  {
    id: SET_ID,
    workoutId: WORKOUT_ID,
    setNumber: SET_NUMBER,
    reps: REPS,
    weightKg: { toString: () => "62.50" },
    loggedAt: new Date("2026-11-26T17:05:00Z"),
    exercise: { name: "Barbell Squat" },
  },
];
const PHOTOS = [
  {
    id: PHOTO_ID,
    storageKey: "progress/u1/aaaa.webp",
    takenAt: new Date("2026-11-26T17:09:00Z"),
  },
];

// Matches any name of a method that changes data, e.g. "user.update" or
// "setLog.deleteMany" (a write); "setLog.findMany" and "raw:SET TRANSACTION
// READ ONLY" are not matched. Tester: https://regex101.com/?regex=create%7Cupdate%7Cupsert%7Cdelete%7CexecuteRawUnsafe&flags=i
const WRITE_CALL = /create|update|upsert|delete|executeRawUnsafe/i;

// A client that records every call, so the tests can say what the peek touched.
function fakeDb(user: typeof USER | null = USER) {
  const calls: string[] = [];
  const record =
    <T>(name: string, value: T) =>
    async () => {
      calls.push(name);
      return value;
    };
  const tx = {
    $executeRaw: vi.fn(async (strings: TemplateStringsArray) => {
      calls.push(`raw:${strings.join("?").trim()}`);
      return 0;
    }),
    user: { findUnique: record("user.findUnique", user) },
    workout: {
      findMany: record("workout.findMany", WORKOUTS),
      count: record("workout.count", WORKOUT_COUNT),
    },
    setLog: {
      findMany: record("setLog.findMany", SETS),
      count: record("setLog.count", SET_COUNT),
    },
    progressPhoto: {
      findMany: record("progressPhoto.findMany", PHOTOS),
      count: record("progressPhoto.count", PHOTO_COUNT),
    },
  };
  const db = {
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
  } as unknown as PrismaClient;
  return { db, calls };
}

describe("peekDemoUser", () => {
  it("makes the transaction read-only before it reads anything", async () => {
    const { db, calls } = fakeDb();
    await peekDemoUser(db, "demo@example.com");
    expect(calls[0]).toBe("raw:SET TRANSACTION READ ONLY");
  });

  it("uses only read methods", async () => {
    const { db, calls } = fakeDb();
    await peekDemoUser(db, "demo@example.com");
    expect(calls.filter((call) => WRITE_CALL.test(call))).toEqual([]);
  });

  it("returns the latest rows with the real column names", async () => {
    const { db } = fakeDb();
    const result = await peekDemoUser(db, "demo@example.com");
    if (result === NO_SUCH_USER) throw new Error("expected a user");
    expect(result.user.name).toBe("Demo Person");
    expect(result.sets[0]).toMatchObject({
      exercise: "Barbell Squat",
      setNumber: SET_NUMBER,
      reps: REPS,
      weightKg: "62.50",
    });
    expect(result.photos[0]?.storageKey).toBe("progress/u1/aaaa.webp");
    expect(result.totals).toEqual({
      workouts: WORKOUT_COUNT,
      sets: SET_COUNT,
      photos: PHOTO_COUNT,
    });
  });

  it("says so when the email has no account, and reads nothing else", async () => {
    const { db, calls } = fakeDb(null);
    const result = await peekDemoUser(db, "nobody@example.com");
    expect(result).toBe(NO_SUCH_USER);
    expect(calls).not.toContain("setLog.findMany");
  });
});

describe("formatPeek", () => {
  const result: PeekResult = {
    user: { id: "u1", name: "Demo Person", tier: "TRIAL" },
    totals: {
      workouts: WORKOUT_COUNT,
      sets: SET_COUNT,
      photos: PHOTO_COUNT,
    },
    workouts: [
      {
        id: WORKOUT_ID,
        startedAt: new Date("2026-11-26T17:00:00Z"),
        finished: false,
        source: "live",
        sets: SETS_IN_WORKOUT,
      },
    ],
    sets: [
      {
        id: SET_ID,
        workoutId: WORKOUT_ID,
        exercise: "Barbell Squat",
        setNumber: SET_NUMBER,
        reps: REPS,
        weightKg: "62.50",
        loggedAt: new Date("2026-11-26T17:05:00Z"),
      },
    ],
    photos: [
      {
        id: PHOTO_ID,
        storageKey: "progress/u1/aaaa.webp",
        takenAt: new Date("2026-11-26T17:09:00Z"),
      },
    ],
  };

  it("prints the set, the photo key and the totals a presenter points at", () => {
    const text = formatPeek(result);
    expect(text).toContain("Barbell Squat");
    expect(text).toContain("62.50 kg");
    expect(text).toContain("progress/u1/aaaa.webp");
    expect(text).toContain("5 workouts, 40 sets, 1 photos");
  });

  it("shows times in Toronto time with seconds, so a new row is easy to spot", () => {
    // 17:05:00Z on 26 Nov is 12:05:00 in Toronto (EST, UTC-5).
    expect(formatPeek(result)).toContain("2026-11-26 12:05:00");
  });

  it("prints a plain line for the unknown email", () => {
    expect(formatPeek(NO_SUCH_USER)).toContain("No account");
  });

  it("marks an empty list instead of printing a blank gap", () => {
    const text = formatPeek({ ...result, photos: [], sets: [] });
    expect(text).toContain("(none yet)");
  });
});
