// Integration test for the body weight log (D24, #16) against a real PostgreSQL:
// the Server Action's upsert replaces a day instead of adding a second row,
// rows stay with their owner, and the migration's CHECKs refuse what the form refuses.
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});

import { logBodyWeight } from "@/app/progress/weight/actions";
import { prisma as db } from "@/lib/prisma";
import { loadBodyWeights } from "@/lib/progress/loadWeights";

const prefix = `weight-${randomUUID()}`;
let sequence = 0;
const idle = { status: "idle" as const };

function athlete() {
  return db.user.create({
    data: {
      name: "Weight athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: true,
    },
  });
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => data.append(name, value));
  return data;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-24T15:00:00Z") });
});

afterAll(async () => {
  vi.useRealTimers();
  // Weigh-ins are deleted with their users (onDelete: Cascade).
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.$disconnect();
});

describe("body weight on PostgreSQL", () => {
  it("keeps one row per day: logging a day again replaces it", async () => {
    const user = await athlete();
    requireUser.mockResolvedValue({ id: user.id });

    const first = await logBodyWeight(
      idle,
      form({ date: "2026-11-23", weightKg: "81.5", note: "Morning" }),
    );
    expect(first).toEqual({ status: "saved", date: "2026-11-23" });
    await logBodyWeight(idle, form({ date: "2026-11-23", weightKg: "81.2" }));
    await logBodyWeight(idle, form({ date: "2026-11-24", weightKg: "81" }));

    expect(await loadBodyWeights(user.id, "2025-11-24")).toEqual([
      { date: "2026-11-23", weightKg: 81.2, note: null },
      { date: "2026-11-24", weightKg: 81, note: null },
    ]);
  });

  it("shows each user only their own weigh-ins", async () => {
    const owner = await athlete();
    const other = await athlete();
    requireUser.mockResolvedValue({ id: other.id });
    await logBodyWeight(idle, form({ date: "2026-11-20", weightKg: "70" }));

    expect(await loadBodyWeights(owner.id, "2025-11-24")).toEqual([]);
    expect(await loadBodyWeights(other.id, "2025-11-24")).toHaveLength(1);
  });

  it("refuses rows outside the form's bounds at the database too", async () => {
    const user = await athlete();
    const day = new Date("2026-11-01T00:00:00Z");
    await expect(
      db.bodyWeight.create({
        data: { userId: user.id, date: day, weightKg: 500 },
      }),
    ).rejects.toThrow(/BodyWeight_weightKg_check/);
    await expect(
      db.bodyWeight.create({
        data: {
          userId: user.id,
          date: day,
          weightKg: 80,
          note: "a".repeat(301),
        },
      }),
    ).rejects.toThrow(/BodyWeight_note_check/);
  });
});
