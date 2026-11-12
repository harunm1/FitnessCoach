import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));
import {
  claimCoachPlanRequest,
  planRetryAfterSeconds,
} from "./plan-rate-limit";

const requestedAt = new Date("2026-11-06T12:00:00Z");

describe("plan request cooldown", () => {
  it("allows a first request", () => {
    expect(planRetryAfterSeconds(null, requestedAt)).toBe(0);
  });

  it.each([
    [0, 60],
    [1, 60],
    [23_000, 37],
    [59_999, 1],
    [60_000, 0],
    [60_001, 0],
  ])("returns remaining seconds after %i milliseconds", (elapsed, seconds) => {
    const now = new Date(requestedAt.getTime() + elapsed);
    expect(planRetryAfterSeconds(requestedAt, now)).toBe(seconds);
  });

  it("rejects invalid timestamps instead of allowing a request", () => {
    expect(() => planRetryAfterSeconds(new Date(NaN), requestedAt)).toThrow();
  });

  it("propagates database failures so callers do not start model work", async () => {
    const failure = new Error("database unavailable");
    const database = {
      $queryRaw: vi.fn().mockRejectedValue(failure),
    } as unknown as Pick<PrismaClient, "$queryRaw">;
    await expect(claimCoachPlanRequest(database, "verified-user")).rejects.toBe(
      failure,
    );
  });
});
