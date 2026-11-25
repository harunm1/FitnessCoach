import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { workout: { findMany } } }));
import { loadRecentRuns, RECENT_RUNS } from "./loadRuns";

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("loadRecentRuns", () => {
  it("reads only this user's finished runs, newest first, five at most", async () => {
    await loadRecentRuns("session-owner");
    expect(RECENT_RUNS).toBe(5);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "session-owner",
        finishedAt: { not: null },
        distanceKm: { not: null },
        durationSeconds: { not: null },
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: RECENT_RUNS,
      select: {
        id: true,
        startedAt: true,
        distanceKm: true,
        durationSeconds: true,
        notes: true,
        source: true,
        planDay: { select: { name: true } },
        run: { select: { rpe: true } },
      },
    });
  });

  it("turns rows into Toronto days, numbers and a pace", async () => {
    findMany.mockResolvedValue([
      {
        id: 2,
        // 03:00 UTC on 24 Nov is still 23 Nov in Toronto.
        startedAt: new Date("2026-11-24T03:00:00Z"),
        distanceKm: { toString: () => "5.20" },
        durationSeconds: 1872,
        notes: "Easy loop",
        source: "manual-run",
        planDay: { name: "Easy run" },
        run: { rpe: 6 },
      },
      {
        id: 1,
        startedAt: new Date("2026-11-20T17:00:00Z"),
        distanceKm: { toString: () => "3.00" },
        durationSeconds: 7530,
        notes: "Push day",
        source: "hevy-import",
        planDay: null,
        run: null,
      },
    ]);
    expect(await loadRecentRuns("session-owner")).toEqual([
      {
        id: 2,
        day: "2026-11-23",
        distanceKm: 5.2,
        time: "31:12",
        durationSec: 1872,
        effort: 6,
        note: "Easy loop",
        planDayName: "Easy run",
      },
      {
        id: 1,
        day: "2026-11-20",
        distanceKm: 3,
        time: "2:05:30",
        durationSec: 7530,
        effort: null,
        // Only a run logged by hand keeps its note; an import's notes hold its title.
        note: null,
        planDayName: null,
      },
    ]);
  });
});
