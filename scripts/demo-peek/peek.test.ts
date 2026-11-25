// Tests for the read-only demo peek (#162): the query stays inside a READ ONLY
// transaction, uses only read methods, and the printout carries the rows the
// presenter must point at (set time, weight, photo time, storage key). The real
// Postgres refusal of a write is in tests/integration/demo-peek.test.ts.
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../../src/generated/prisma/client";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { parseArgs } from "./args";
import { describeFailure } from "./failure";
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
const LIST_QUERIES = 3;
const TIE_BREAK_KEYS = 2; // the timestamp, then the id

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
    weightKg: new Prisma.Decimal("62.5"),
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

// Matches the name of any call that changes data, e.g. "user.update",
// "setLog.deleteMany" or "queryRaw"; "setLog.findMany" and "raw:SET TRANSACTION
// READ ONLY" are not matched. Tester: https://regex101.com/?regex=insert%7Ccreate%7Cupdate%7Cupsert%7Cdelete%7Ctruncate%7Cdrop%7Calter%7CexecuteRawUnsafe%7CqueryRaw&flags=i
const WRITE_CALL = new RegExp(
  "insert|create|update|upsert|delete|truncate|drop|alter|executeRawUnsafe|queryRaw",
  "i",
);

// A client that records every call, so the tests can say what the peek touched.
function fakeDb(user: typeof USER | null = USER) {
  const calls: string[] = [];
  const orders: unknown[] = [];
  const list =
    <T>(name: string, value: T) =>
    async (args?: { orderBy?: unknown }) => {
      calls.push(name);
      if (args?.orderBy !== undefined) orders.push(args.orderBy);
      return value;
    };
  const tx = {
    $executeRaw: vi.fn(async (strings: TemplateStringsArray) => {
      calls.push(`raw:${strings.join("?").trim()}`);
      return 0;
    }),
    user: { findFirst: list("user.findFirst", user) },
    workout: {
      findMany: list("workout.findMany", WORKOUTS),
      count: list("workout.count", WORKOUT_COUNT),
    },
    setLog: {
      findMany: list("setLog.findMany", SETS),
      count: list("setLog.count", SET_COUNT),
    },
    progressPhoto: {
      findMany: list("progressPhoto.findMany", PHOTOS),
      count: list("progressPhoto.count", PHOTO_COUNT),
    },
  };
  const db = {
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
  } as unknown as PrismaClient;
  return { db, calls, orders };
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
      weightKg: "62.5",
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

  it("breaks timestamp ties by id, so a re-run shows the same rows", async () => {
    const { db, orders } = fakeDb();
    await peekDemoUser(db, "demo@example.com");
    expect(orders).toHaveLength(LIST_QUERIES);
    orders.forEach((order) => {
      expect(order).toHaveLength(TIE_BREAK_KEYS);
      expect((order as unknown[])[1]).toEqual({ id: "desc" });
    });
  });

  it("looks the email up with any capitals or spaces", async () => {
    const { db, calls } = fakeDb();
    await peekDemoUser(db, "  Demo@Example.COM ");
    expect(calls).toContain("user.findFirst");
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
        weightKg: "62.5",
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
    expect(text).toContain("62.5 kg");
    expect(text).toContain("progress/u1/aaaa.webp");
    expect(text).toContain("5 workouts, 40 sets, 1 photo");
  });

  it("shows times in Toronto time with seconds and the zone, so a new row is easy to spot", () => {
    // 17:05:00Z on 26 Nov is 12:05:00 in Toronto (EST, UTC-5).
    expect(formatPeek(result)).toContain("2026-11-26 12:05:00 EST");
  });

  it("handles summer time, midnight (00, not 24) and the repeated autumn hour", () => {
    const at = (iso: string) =>
      formatPeek({
        ...result,
        sets: [{ ...result.sets[0], loggedAt: new Date(iso) }],
      });
    expect(at("2026-07-01T04:00:00Z")).toContain("2026-07-01 00:00:00 EDT");
    expect(at("2026-11-27T05:00:00Z")).toContain("2026-11-27 00:00:00 EST");
    // 1 Nov 2026 01:30 happens twice; the zone tells the two apart.
    expect(at("2026-11-01T05:30:00Z")).toContain("01:30:00 EDT");
    expect(at("2026-11-01T06:30:00Z")).toContain("01:30:00 EST");
  });

  it("names the database it read and the time zone", () => {
    const text = formatPeek(result, "neondb");
    expect(text).toContain("Database: neondb");
    expect(text).toContain("America/Toronto");
  });

  it("labels the set time as the first save, since editing a set keeps it", () => {
    expect(formatPeek(result)).toContain("first logged");
  });

  it("prints a plain line for the unknown email", () => {
    expect(formatPeek(NO_SUCH_USER)).toContain("No account");
  });

  it("marks an empty list instead of printing a blank gap", () => {
    const text = formatPeek({ ...result, photos: [], sets: [] });
    expect(text).toContain("(none yet)");
  });
});

describe("describeFailure", () => {
  const url = "postgresql://appuser:s3cretpw@db.example-host.com:5432/proddb";

  it("never prints the url, host, user or password", () => {
    const error = new Error(
      `Can't reach database server at db.example-host.com:5432\nconnection ${url} failed for user "appuser" with s3cretpw`,
    );
    const text = describeFailure(error);
    ["s3cretpw", "appuser", "db.example-host.com", "postgresql://"].forEach(
      (hidden) => expect(text).not.toContain(hidden),
    );
  });

  it("keeps the error code, and handles a thrown string", () => {
    const error = Object.assign(new Error("x"), { code: "P1001" });
    expect(describeFailure(error)).toContain("P1001");
    expect(describeFailure("boom")).toContain("Peek failed");
  });
});

describe("parseArgs", () => {
  const url = "postgresql://u:p@localhost:5432/db";

  it("takes the email from the argument, then from DEMO_PEEK_EMAIL", () => {
    expect(parseArgs(["a@b.c"], { DATABASE_URL: url })).toMatchObject({
      email: "a@b.c",
    });
    expect(
      parseArgs([], { DATABASE_URL: url, DEMO_PEEK_EMAIL: "x@y.z" }),
    ).toMatchObject({ email: "x@y.z" });
  });

  it("returns a usage message when the email or the url is missing", () => {
    expect(parseArgs([], { DATABASE_URL: url })).toHaveProperty("usage");
    expect(parseArgs(["a@b.c"], {})).toHaveProperty("usage");
  });

  it("reports only the database name of the url", () => {
    expect(parseArgs(["a@b.c"], { DATABASE_URL: url })).toMatchObject({
      databaseName: "db",
    });
  });
});
