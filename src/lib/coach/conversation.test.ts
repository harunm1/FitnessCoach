// The coach conversation's database helpers (#63): the next session's lines, the no-plan case, and the ownership check on save.
import { describe, expect, it, vi } from "vitest";
import {
  coachContextFor,
  loadConversation,
  NO_PLAN_LINE,
  saveExchange,
} from "./conversation";

const profile = {
  goal: "MUSCLE",
  level: "BEGINNER",
  daysPerWeek: 2,
  equipment: ["dumbbell"],
  injuries: null,
};

type Overrides = Record<string, unknown> & {
  // The last 28 days of workouts with their sets (getRecentWorkouts, D43).
  recentWorkouts?: unknown[];
  importSpan?: unknown;
  weighIns?: unknown[];
};

function dbWith(overrides: Overrides) {
  const { recentWorkouts = [], importSpan, weighIns = [], ...rest } = overrides;
  const given = (rest.workout ?? {}) as Record<string, unknown>;
  const history = (given.findMany ?? (async () => [])) as (
    args: unknown,
  ) => Promise<unknown[]>;
  const workout = {
    count: vi.fn(async () => 0),
    // The training history (D36) selects start times only; getRecentWorkouts (D43) selects
    // the sets too. No finished workouts unless a test gives some.
    ...given,
    findMany: vi.fn(async (args: { select?: { sets?: unknown } }) =>
      args?.select?.sets ? recentWorkouts : history(args),
    ),
    aggregate: vi.fn(
      async () =>
        importSpan ?? {
          _count: { _all: 0 },
          _min: { startedAt: null },
          _max: { startedAt: null },
        },
    ),
  };
  return {
    profile: { findUnique: vi.fn(async () => profile) },
    plan: { findFirst: vi.fn(async () => null) },
    user: {
      findUnique: vi.fn(async () => ({ weightUnit: "KG", distanceUnit: "KM" })),
    },
    setLog: { findMany: vi.fn(async () => []) },
    bodyWeight: { findMany: vi.fn(async () => weighIns) },
    ...rest,
    workout,
  } as unknown as Parameters<typeof coachContextFor>[0];
}

const toolLines = (
  context: Awaited<ReturnType<typeof coachContextFor>>,
  name: string,
) => context?.toolResults?.find((result) => result.name === name)?.lines;

describe("coachContextFor training history (D36)", () => {
  const NOW = new Date("2026-11-25T17:00:00Z");
  const DAY_MS = 86_400_000;
  // Three workouts a week at 18:00 UTC for forty weeks: an intermediate history.
  const starts = Array.from({ length: 280 }, (_, index) => index)
    .map((back) => new Date(NOW.getTime() - back * DAY_MS))
    .filter((day) => [1, 3, 5].includes(day.getUTCDay()))
    .map(
      (day) =>
        new Date(
          Date.UTC(
            day.getUTCFullYear(),
            day.getUTCMonth(),
            day.getUTCDate(),
            18,
          ),
        ),
    )
    .filter((start) => start <= NOW)
    .reverse();

  it("includes a summary of the history and the working weights, not raw rows", async () => {
    const db = dbWith({
      workout: {
        findMany: vi.fn(async () => starts.map((startedAt) => ({ startedAt }))),
      },
      setLog: {
        findMany: vi.fn(async () => [
          {
            reps: 5,
            weightKg: "80",
            exerciseId: "bench",
            exercise: { name: "Bench Press", equipment: "barbell" },
            workout: { startedAt: new Date(NOW.getTime() - 3 * DAY_MS) },
          },
        ]),
      },
    });

    const context = await coachContextFor(db, "owner", NOW);

    const profileLines = toolLines(context, "getTrainingProfile");
    expect(profileLines?.[1]).toMatch(/^Training since /);
    expect(profileLines?.[1]).toContain("intermediate");
    expect(toolLines(context, "getExerciseHistory")?.[0]).toContain(
      "Bench Press 80 kg x 5",
    );
    expect(JSON.stringify(context?.toolResults)).not.toMatch(
      /\d{4}-\d{2}-\d{2}/,
    );
  });

  it("states the working weights in the user's unit", async () => {
    const db = dbWith({
      user: {
        findUnique: vi.fn(async () => ({
          weightUnit: "LB",
          distanceUnit: "MI",
        })),
      },
      workout: {
        findMany: vi.fn(async () => starts.map((startedAt) => ({ startedAt }))),
      },
      setLog: {
        findMany: vi.fn(async () => [
          {
            reps: 5,
            weightKg: "61.23",
            exerciseId: "bench",
            exercise: { name: "Bench Press", equipment: "barbell" },
            workout: { startedAt: new Date(NOW.getTime() - 3 * DAY_MS) },
          },
        ]),
      },
    });

    const context = await coachContextFor(db, "owner", NOW);

    expect(toolLines(context, "getExerciseHistory")?.[0]).toContain(
      "Bench Press 135 lb x 5",
    );
  });

  it("says there is no history for a user with no finished workouts", async () => {
    const context = await coachContextFor(dbWith({}), "owner", NOW);

    expect(toolLines(context, "getTrainingProfile")).toEqual([
      "No finished workouts yet.",
    ]);
  });
});

describe("coachContextFor", () => {
  it("lists the exercises of the next plan day after the finished workouts", async () => {
    const db = dbWith({
      plan: {
        findFirst: vi.fn(async () => ({
          id: 1,
          days: [
            {
              exercises: [
                { sets: 3, reps: 10, exercise: { name: "Goblet Squat" } },
              ],
            },
            {
              exercises: [
                { sets: 4, reps: 8, exercise: { name: "Dumbbell Row" } },
              ],
            },
          ],
        })),
      },
      // Three finished workouts on a two-day plan: the next day is day 2.
      workout: { count: vi.fn(async () => 3) },
    });

    const context = await coachContextFor(db, "owner");

    expect(context?.sessionLines).toEqual(["Dumbbell Row 4 x 8"]);
  });

  it("says there is no plan yet rather than calling the day a rest day", async () => {
    const context = await coachContextFor(dbWith({}), "owner");

    expect(context?.sessionLines).toEqual([NO_PLAN_LINE]);
  });

  it("is null without a profile", async () => {
    const db = dbWith({ profile: { findUnique: vi.fn(async () => null) } });

    expect(await coachContextFor(db, "owner")).toBeNull();
  });
});

describe("coachContextFor muscles to avoid", () => {
  const library = [
    { primaryMuscles: ["lower back"], secondaryMuscles: ["glutes"] },
    { primaryMuscles: ["quadriceps"], secondaryMuscles: ["glutes"] },
  ];

  it("names the library muscles found in the injury text, as onboarding does for the plan", async () => {
    const db = dbWith({
      profile: {
        findUnique: vi.fn(async () => ({
          ...profile,
          injuries: "My Lower Back is sore after deadlifts",
        })),
      },
      exercise: { findMany: vi.fn(async () => library) },
    });

    const context = await coachContextFor(db, "owner");

    expect(context?.avoidMuscles).toEqual(["lower back"]);
  });

  it("gives no muscles, and reads no exercises, when the user typed no injury", async () => {
    const findMany = vi.fn(async () => library);
    const db = dbWith({ exercise: { findMany } });

    const context = await coachContextFor(db, "owner");

    expect(context?.avoidMuscles).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("loadConversation", () => {
  it("loads only the coach's own conversation, not an exercise chat from the body map", async () => {
    const findFirst = vi.fn(async () => null);
    const db = { conversation: { findFirst } } as unknown as Parameters<
      typeof loadConversation
    >[0];

    await loadConversation(db, "owner");

    // Body-map chats carry a title ("body-map:..."); the coach conversation has none.
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "owner", title: null } }),
    );
  });
});

describe("saveExchange", () => {
  it("rejects a conversation that is not the user's and saves no message", async () => {
    const createMany = vi.fn();
    const tx = {
      conversation: {
        create: vi.fn(),
        update: vi.fn(async () => {
          throw new Error("P2025 record not found");
        }),
      },
      message: { createMany },
    };
    const db = {
      $transaction: vi.fn(async (work: (t: typeof tx) => Promise<void>) =>
        work(tx),
      ),
    } as unknown as Parameters<typeof saveExchange>[0];

    await expect(saveExchange(db, "owner", 99, "Hi", "Hello")).rejects.toThrow(
      "P2025",
    );
    expect(tx.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 99, userId: "owner" } }),
    );
    expect(createMany).not.toHaveBeenCalled();
  });
});

// The live failure of 25 Nov 17:20 (D43): asked to "review my hevy import history, and weight
// loss", the coach said it had no access to either. The context now carries both. A seeded
// fixture, never his data.
describe("coachContextFor reads the user's own data (D43)", () => {
  const NOW = new Date("2026-11-26T17:00:00Z");
  const importedSet = {
    reps: 5,
    weightKg: "80",
    exercise: { name: "Bench Press" },
  };
  const fixture = {
    recentWorkouts: [
      { source: "hevy-import", sets: [importedSet, importedSet] },
      { source: "live", sets: [importedSet] },
    ],
    importSpan: {
      _count: { _all: 412 },
      _min: { startedAt: new Date("2024-03-14T22:00:00Z") },
      _max: { startedAt: new Date("2026-11-20T23:00:00Z") },
    },
    weighIns: [
      { date: new Date("2026-09-01T00:00:00Z"), weightKg: "84.2" },
      { date: new Date("2026-11-24T00:00:00Z"), weightKg: "81.0" },
    ],
  };

  it("has the import count and the body-weight trend, each with its period", async () => {
    const context = await coachContextFor(dbWith(fixture), "owner", NOW);

    const recent = context?.toolResults?.find(
      (result) => result.name === "getRecentWorkouts",
    );
    expect(recent?.period).toBe("last 28 days (29 Oct 2026 to 26 Nov 2026)");
    expect(recent?.lines).toContain(
      "Imported from Hevy, all time: 412 workouts, 14 Mar 2024 to 20 Nov 2026.",
    );
    const weight = context?.toolResults?.find(
      (result) => result.name === "getBodyWeightTrend",
    );
    expect(weight?.period).toBe("last 90 days (28 Aug 2026 to 26 Nov 2026)");
    expect(weight?.lines).toContain(
      "Change: -3.2 kg over 84 days, -0.27 kg a week.",
    );
    expect(context?.toolResults?.map((result) => result.name)).toEqual([
      "getTrainingProfile",
      "getRecentWorkouts",
      "getExerciseHistory",
      "getBodyWeightTrend",
    ]);
  });

  it("scopes every read of the user's rows to the signed-in user", async () => {
    const db = dbWith(fixture);
    await coachContextFor(db, "owner", NOW);

    const calls = [
      ...vi.mocked(db.workout.findMany).mock.calls,
      ...vi.mocked(db.workout.aggregate).mock.calls,
      ...vi.mocked(db.bodyWeight.findMany).mock.calls,
      ...vi.mocked(db.setLog.findMany).mock.calls,
    ].map(([args]) => args as { where: Record<string, unknown> });
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const { where } of calls) {
      const owner =
        where.userId ?? (where.workout as { userId?: string })?.userId;
      expect(owner).toBe("owner");
    }
  });
});

// D43 failure path: one tool that cannot read fails the whole context, so the request reports
// "send it again" (request.ts) and no model call is made with a prompt missing that data,
// which would still tell the model it holds everything the app has.
describe("coachContextFor when a tool cannot read (D43)", () => {
  it("rejects instead of building a context without that tool's data", async () => {
    const db = dbWith({});
    vi.mocked(db.bodyWeight.findMany).mockRejectedValueOnce(
      new Error("connection lost"),
    );

    await expect(coachContextFor(db, "owner")).rejects.toThrow(
      "connection lost",
    );
  });
});
