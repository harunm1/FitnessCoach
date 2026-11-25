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

function dbWith(overrides: Record<string, unknown>) {
  const workout = {
    count: vi.fn(async () => 0),
    // The training history (D36): no finished workouts unless a test gives some.
    findMany: vi.fn(async () => []),
    ...(overrides.workout as object | undefined),
  };
  return {
    profile: { findUnique: vi.fn(async () => profile) },
    plan: { findFirst: vi.fn(async () => null) },
    user: {
      findUnique: vi.fn(async () => ({ weightUnit: "KG", distanceUnit: "KM" })),
    },
    setLog: { findMany: vi.fn(async () => []) },
    ...overrides,
    workout,
  } as unknown as Parameters<typeof coachContextFor>[0];
}

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

    expect(context?.historyLines?.[0]).toMatch(/^Training since /);
    expect(context?.historyLines?.[0]).toContain("intermediate");
    expect(context?.historyLines?.[1]).toContain("Bench Press 80 kg x 5");
    expect(JSON.stringify(context?.historyLines)).not.toMatch(
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

    expect(context?.historyLines?.[1]).toContain("Bench Press 135 lb x 5");
  });

  it("has no history lines for a user with no finished workouts", async () => {
    const context = await coachContextFor(dbWith({}), "owner", NOW);

    expect(context?.historyLines).toEqual([]);
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
