import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { bodyWeight: { findMany } } }));
import { loadBodyWeights, WEIGHT_HISTORY_LIMIT } from "./loadWeights";

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("loadBodyWeights", () => {
  it("reads only this user's weigh-ins since the given day, oldest first", async () => {
    await loadBodyWeights("session-owner", "2025-11-24");
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "session-owner",
        date: { gte: new Date("2025-11-24T00:00:00Z") },
      },
      orderBy: { date: "asc" },
      take: WEIGHT_HISTORY_LIMIT,
      select: { date: true, weightKg: true, note: true },
    });
  });

  it("turns database dates and decimals into day strings and numbers", async () => {
    findMany.mockResolvedValue([
      {
        date: new Date("2026-11-23T00:00:00Z"),
        weightKg: { toString: () => "81.50" },
        note: "Morning",
      },
      {
        date: new Date("2026-11-24T00:00:00Z"),
        weightKg: { toString: () => "81.20" },
        note: null,
      },
    ]);
    expect(await loadBodyWeights("session-owner", "2025-11-24")).toEqual([
      { date: "2026-11-23", weightKg: 81.5, note: "Morning" },
      { date: "2026-11-24", weightKg: 81.2, note: null },
    ]);
  });
});
