import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";

export const PLAN_REQUEST_WINDOW_MS = 60_000;

export function planRetryAfterSeconds(lastRequest: Date | null, now: Date) {
  if (!lastRequest) return 0;
  const remaining =
    lastRequest.getTime() + PLAN_REQUEST_WINDOW_MS - now.getTime();
  if (!Number.isFinite(remaining))
    throw new Error("Invalid plan request time.");
  return Math.max(0, Math.ceil(remaining / 1000));
}

export type PlanRequestReservation =
  | { allowed: true; retryAfterSeconds: 0 }
  | { allowed: false; retryAfterSeconds: number; message: string };

type Database = Pick<PrismaClient, "$queryRaw">;

// Call after authentication and input validation, outside the plan-save transaction.
// The ID must come from the verified session. A provider failure does not refund it.
export async function claimCoachPlanRequest(
  database: Database,
  userId: string,
): Promise<PlanRequestReservation> {
  const claimed = await database.$queryRaw<{ requestedAt: Date }[]>(Prisma.sql`
    UPDATE "User"
    SET "lastCoachPlanRequestedAt" = timezone('UTC', clock_timestamp()),
        "updatedAt" = timezone('UTC', clock_timestamp())
    WHERE "id" = ${userId} AND "emailVerified" = true
      AND (
        "lastCoachPlanRequestedAt" IS NULL
        OR "lastCoachPlanRequestedAt" <= timezone('UTC', clock_timestamp())
          - (${PLAN_REQUEST_WINDOW_MS}::bigint * interval '1 millisecond')
      )
    RETURNING "lastCoachPlanRequestedAt" AS "requestedAt"
  `);
  if (claimed.length) return { allowed: true, retryAfterSeconds: 0 };

  const [account] = await database.$queryRaw<
    { requestedAt: Date | null; now: Date }[]
  >(Prisma.sql`
    SELECT "lastCoachPlanRequestedAt" AS "requestedAt",
           timezone('UTC', clock_timestamp()) AS "now"
    FROM "User"
    WHERE "id" = ${userId} AND "emailVerified" = true
  `);
  if (!account) throw new Error("Account unavailable for plan requests.");

  const retryAfterSeconds = Math.max(
    1,
    planRetryAfterSeconds(account.requestedAt, account.now),
  );
  return {
    allowed: false,
    retryAfterSeconds,
    message: `Please wait ${retryAfterSeconds} ${retryAfterSeconds === 1 ? "second" : "seconds"} before requesting another plan.`,
  };
}
