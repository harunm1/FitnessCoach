import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});

import { prisma as db } from "@/lib/prisma";
import { prismaCoachSink } from "@/lib/coach/coachSink";
import { writeRecord, type CoachRecord } from "@/lib/coach/coachLog";
import { generatePlan } from "@/lib/coach/generatePlan";

const prefix = `coach-sink-${randomUUID()}`;
let sequence = 0;
const record: CoachRecord = {
  kind: "plan",
  promptVersion: "plan-test-v1",
  attempt: 1,
  latencyMs: 125,
  outcome: "ok",
  providerEvents: [],
  inputTokens: null,
  outputTokens: null,
  guardrailVerdict: null,
};

function athlete() {
  return db.user.create({
    data: {
      name: "Coach record athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: true,
    },
  });
}

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.$disconnect();
});

describe("PostgreSQL coach record sink", () => {
  it("stores JSON and provider metadata without forwarding prompts, errors or a submitted owner", async () => {
    const [owner, other] = await Promise.all([athlete(), athlete()]);
    const supplied = {
      ...record,
      provider: "Groq",
      model: "fixture-model",
      inputTokens: 120,
      outputTokens: 35,
      guardrailVerdict: "ALLOW" as const,
      providerEvents: [
        {
          provider: "Groq",
          action: "retry" as const,
          status: 429,
          waitMs: 100,
        },
      ],
      problems: ["previous reply did not pass the verifier"],
      raw: { reply: "Keep the movement controlled.", values: [1, true, null] },
      userId: other.id,
      prompt: "private profile input that must not be stored",
      error: "private diagnostic text that must not be stored",
    };
    await prismaCoachSink(owner.id)(supplied);
    const saved = await db.coachEvent.findFirstOrThrow({
      where: { userId: owner.id },
    });
    expect(saved).toMatchObject({
      userId: owner.id,
      kind: "plan",
      promptVersion: record.promptVersion,
      attempt: 1,
      latencyMs: 125,
      outcome: "ok",
      provider: "Groq",
      model: "fixture-model",
      inputTokens: 120,
      outputTokens: 35,
      guardrailVerdict: "ALLOW",
      providerEvents: supplied.providerEvents,
      problems: supplied.problems,
      raw: supplied.raw,
    });
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(await db.coachEvent.count({ where: { userId: other.id } })).toBe(0);
    expect(JSON.stringify(saved)).not.toContain(supplied.prompt);
    expect(JSON.stringify(saved)).not.toContain(supplied.error);
  });

  it("preserves reported zero token counts instead of treating them as unknown", async () => {
    const user = await athlete();
    const counted = {
      ...record,
      inputTokens: 0,
      outputTokens: 0,
      guardrailVerdict: null,
    };
    await prismaCoachSink(user.id)(counted);
    expect(
      await db.coachEvent.findFirstOrThrow({ where: { userId: user.id } }),
    ).toMatchObject({
      inputTokens: 0,
      outputTokens: 0,
      guardrailVerdict: null,
    });
  });

  it("reads each user's records separately", async () => {
    const [first, second] = await Promise.all([athlete(), athlete()]);
    await prismaCoachSink(first.id)({
      ...record,
      raw: { reply: "First private reply" },
    });
    await prismaCoachSink(second.id)({
      ...record,
      raw: { reply: "Second private reply" },
    });
    const firstRows = await db.coachEvent.findMany({
      where: { userId: first.id },
      orderBy: { createdAt: "desc" },
    });
    expect(firstRows).toHaveLength(1);
    expect(firstRows[0].raw).toEqual({ reply: "First private reply" });
    expect(JSON.stringify(firstRows)).not.toContain("Second private reply");
    expect(await db.coachEvent.count({ where: { userId: second.id } })).toBe(1);
  });

  it.each(["Your knee injury may need attention.", null, { value: BigInt(1) }])(
    "stores chat metadata with SQL NULL raw regardless of the reply",
    async (raw) => {
      const user = await athlete();
      await prismaCoachSink(user.id)({ ...record, kind: "chat", raw });
      const [saved] = await db.$queryRaw<
        { kind: string; outcome: string; absent: boolean }[]
      >`
        SELECT "kind", "outcome", "raw" IS NULL AS "absent"
        FROM "CoachEvent" WHERE "userId" = ${user.id}
      `;
      expect(saved).toEqual({ kind: "chat", outcome: "ok", absent: true });
    },
  );

  it.each([
    "ok",
    "retried",
    "switched",
    "rejected",
    "error",
    "rule_based",
  ] as const)(
    "stores the %s outcome with unknown metadata left null",
    async (outcome) => {
      const user = await athlete();
      await prismaCoachSink(user.id)({ ...record, outcome });
      expect(
        await db.coachEvent.findFirstOrThrow({ where: { userId: user.id } }),
      ).toMatchObject({
        outcome,
        provider: null,
        model: null,
        inputTokens: null,
        outputTokens: null,
        guardrailVerdict: null,
        providerEvents: [],
        problems: null,
        raw: null,
      });
    },
  );

  it("distinguishes an absent reply from explicit JSON null", async () => {
    const user = await athlete();
    const sink = prismaCoachSink(user.id);
    await sink(record);
    await sink({ ...record, raw: null });
    const rows = await db.$queryRaw<
      { absent: boolean; jsonNull: boolean | null }[]
    >`
      SELECT "raw" IS NULL AS "absent", "raw" = 'null'::jsonb AS "jsonNull"
      FROM "CoachEvent" WHERE "userId" = ${user.id} ORDER BY id
    `;
    expect(rows).toEqual([
      { absent: true, jsonNull: null },
      { absent: false, jsonNull: true },
    ]);
  });

  it("removes records when their user is deleted, without deleting another user's records", async () => {
    const [first, second] = await Promise.all([athlete(), athlete()]);
    await prismaCoachSink(first.id)(record);
    await prismaCoachSink(second.id)(record);
    await db.user.delete({ where: { id: first.id } });
    expect(await db.coachEvent.count({ where: { userId: first.id } })).toBe(0);
    expect(await db.coachEvent.count({ where: { userId: second.id } })).toBe(1);
  });

  it("keeps logging best effort when the user no longer exists", async () => {
    const sink = prismaCoachSink(`${prefix}-missing`);
    await expect(sink(record)).rejects.toThrow();
    await expect(writeRecord(sink, record)).resolves.toBeUndefined();
  });

  it("does not write a partial event for non-JSON replies", async () => {
    const user = await athlete();
    await expect(
      prismaCoachSink(user.id)({ ...record, raw: { value: BigInt(1) } }),
    ).rejects.toThrow();
    expect(await db.coachEvent.count({ where: { userId: user.id } })).toBe(0);
  });

  it("persists records from the real plan generator using a mocked model", async () => {
    const user = await athlete();
    const library = [
      {
        id: "press",
        name: "Press",
        category: "strength",
        equipment: "body only",
        primaryMuscles: ["chest"],
        secondaryMuscles: [],
      },
      {
        id: "squat",
        name: "Squat",
        category: "strength",
        equipment: "body only",
        primaryMuscles: ["quadriceps"],
        secondaryMuscles: [],
      },
    ];
    const plan = {
      name: "Fixture plan",
      days: [
        {
          name: "Day one",
          exercises: library.map((e) => ({
            exerciseId: e.id,
            sets: 3,
            reps: 8,
            restSeconds: 90,
            rpe: 7,
          })),
        },
      ],
    };
    const model = vi.fn<(prompt: string) => Promise<typeof plan>>(
      async () => plan,
    );
    const result = await generatePlan(
      model,
      { daysPerWeek: 1, equipment: ["body only"], avoidMuscles: [] },
      library,
      {
        log: prismaCoachSink(user.id),
        takeProviderEvents: () => [
          { provider: "Groq", action: "served", model: "fixture-model" },
        ],
      },
    );
    expect(result.source).toBe("COACH");
    expect(model).toHaveBeenCalledOnce();
    const saved = await db.coachEvent.findMany({ where: { userId: user.id } });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      kind: "plan",
      outcome: "ok",
      provider: "Groq",
      model: "fixture-model",
      raw: plan,
    });
    const prompt = model.mock.calls[0]?.[0];
    expect(prompt).toContain("Build a 1-day weekly strength plan");
    expect(JSON.stringify(saved[0])).not.toContain(
      "Build a 1-day weekly strength plan",
    );
  });
});
